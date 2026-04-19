import { IncomingMessage } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { AppointmentService } from '../services/appointmentService.js';
import { verifyJWT } from '../utils/jwt.js';
import { isBlacklisted } from '../utils/tokenBlacklist.js';
import { config } from '../config/index.js';

const WS_PORT = config.wsPort;
const AUTH_TIMEOUT_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 30_000;

type ClientInfo = {
  type: string;
  phone: string;
  companyPhone?: string;
  id: number;
  isAlive: boolean;
};
const clients = new Map<WebSocket, ClientInfo>();

type AppointmentLike = { companyPhone?: string | null; technicianPhone?: string | null; [key: string]: unknown };

function clientCanReceive(user: ClientInfo, appointment: AppointmentLike): boolean {
    const effectiveCompanyPhone = user.companyPhone ?? user.phone;
    return (
        user.type === 'super_admin' ||
        (user.type === 'company' && appointment.companyPhone === effectiveCompanyPhone) ||
        (user.type === 'technician' && appointment.technicianPhone === user.phone)
    );
}

function broadcast(event: string, appointment: AppointmentLike) {
    const message = JSON.stringify({ type: event, appointment });
    for (const [ws, user] of clients) {
        if (ws.readyState !== WebSocket.OPEN) { clients.delete(ws); continue; }
        if (clientCanReceive(user, appointment)) ws.send(message);
    }
}

/**
 * Notify affected clients their stats are stale so they re-fetch once.
 * Avoids any polling on the frontend — data is pulled only when something changed.
 */
function broadcastStatsInvalidated(appointment: AppointmentLike) {
    const message = JSON.stringify({ type: 'stats:invalidated' });
    for (const [ws, user] of clients) {
        if (ws.readyState !== WebSocket.OPEN) { clients.delete(ws); continue; }
        if (clientCanReceive(user, appointment)) ws.send(message);
    }
}

export function startAppointmentWebsocket() {
    const secret = process.env.JWT_SECRET!;
    const wss = new WebSocketServer({ port: WS_PORT });

    // ── Server-side heartbeat ────────────────────────────────────────────────
    const heartbeatTimer = setInterval(() => {
        for (const [ws, info] of clients) {
            if (!info.isAlive) {
                clients.delete(ws);
                ws.terminate();
                continue;
            }
            info.isAlive = false;
            ws.ping();
        }
    }, HEARTBEAT_INTERVAL_MS);

    wss.on('close', () => clearInterval(heartbeatTimer));

    // ── Connection handler ───────────────────────────────────────────────────
    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        const origin = req.headers.origin;

        // In production require a valid Origin; in dev allow missing Origin (CLI/tools)
        if (config.nodeEnv === 'production') {
            if (!origin || !config.corsOrigins.includes(origin)) {
                ws.close(1008, 'Origin not allowed');
                return;
            }
        } else if (origin && !config.corsOrigins.includes(origin)) {
            ws.close(1008, 'Origin not allowed');
            return;
        }

        ws.send(JSON.stringify({ type: 'auth_required' }));

        const authTimeout = setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close(1008, 'Authentication timeout');
            }
        }, AUTH_TIMEOUT_MS);

        let authenticated = false;

        // Single message handler — behavior changes via `authenticated` flag
        const onMessage = async (raw: WebSocket.RawData) => {
            let payload: Record<string, unknown>;
            try {
                payload = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(raw.toString());
            } catch {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON payload' }));
                return;
            }

            if (authenticated) {
                if (payload?.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                }
                return;
            }

            // Pre-auth: only accept auth messages
            if (payload?.type !== 'auth') {
                ws.send(JSON.stringify({ type: 'error', message: 'Authentication required' }));
                return;
            }

            const token = typeof payload.token === 'string' ? payload.token : null;
            const userPayload = token ? await verifyJWT(token, secret) : null;

            if (!userPayload || userPayload.tokenType !== 'access') {
                ws.close(1008, 'Unauthorized');
                return;
            }

            if (userPayload.jti && await isBlacklisted(userPayload.jti as string)) {
                ws.close(1008, 'Token revoked');
                return;
            }

            clearTimeout(authTimeout);
            authenticated = true;

            const clientInfo: ClientInfo = {
                type: userPayload.type as string,
                phone: userPayload.phone as string,
                companyPhone: userPayload.companyPhone as string | undefined,
                id: userPayload.id as number,
                isAlive: true,
            };
            clients.set(ws, clientInfo);

            ws.send(JSON.stringify({
                type: 'ws_connected',
                message: `Connected to appointment websocket at port ${WS_PORT}`,
                timestamp: new Date().toISOString(),
            }));
        };

        ws.on('message', onMessage);

        ws.on('pong', () => {
            const info = clients.get(ws);
            if (info) info.isAlive = true;
        });

        ws.on('close', () => {
            clearTimeout(authTimeout);
            clients.delete(ws);
        });

        ws.on('error', () => {
            clearTimeout(authTimeout);
            clients.delete(ws);
        });
    });

    AppointmentService.events.on('appointment:created', (appointment) => {
        broadcast('appointment:created', appointment);
        broadcastStatsInvalidated(appointment);
    });

    AppointmentService.events.on('appointment:updated', (appointment) => {
        broadcast('appointment:updated', appointment);
        broadcastStatsInvalidated(appointment);
    });

    AppointmentService.events.on('appointment:deleted', (appointment) => {
        broadcast('appointment:deleted', appointment);
        broadcastStatsInvalidated(appointment);
    });

    AppointmentService.events.on('appointment:assigned', (appointment) => {
        broadcast('appointment:assigned', appointment);
    });

    console.log(`WebSocket server for appointments is running on ws://localhost:${WS_PORT}`);

    return wss;
}
