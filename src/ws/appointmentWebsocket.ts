import { IncomingMessage } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { AppointmentService } from '../services/appointmentService.js';
import { verifyJWT } from '../utils/jwt.js';

const WS_PORT = Number(process.env.WS_PORT ?? 3001);
const AUTH_TIMEOUT_MS = 5000;

type ClientInfo = { type: string; phone: string; id: number };
const clients = new Map<WebSocket, ClientInfo>();

function broadcast(event: string, appointment: { companyPhone?: string | null; technicianPhone?: string | null; [key: string]: unknown }) {
    const message = JSON.stringify({ type: event, appointment });
    for (const [ws, user] of clients) {
        if (ws.readyState !== WebSocket.OPEN) {
            clients.delete(ws);
            continue;
        }
        const canReceive =
            user.type === 'super_admin' ||
            (user.type === 'company' && appointment.companyPhone === user.phone) ||
            (user.type === 'technician' && appointment.technicianPhone === user.phone);
        if (canReceive) ws.send(message);
    }
}

export function startAppointmentWebsocket() {
    const secret = process.env.JWT_SECRET!;
    const wss = new WebSocketServer({ port: WS_PORT });

    wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
        // Send auth challenge — client must reply with { type: "auth", token: "..." }
        ws.send(JSON.stringify({ type: 'auth_required' }));

        const authTimeout = setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close(1008, 'Authentication timeout');
            }
        }, AUTH_TIMEOUT_MS);

        const onMessage = async (raw: WebSocket.RawData) => {
            let payload: Record<string, unknown>;
            try {
                payload = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(raw.toString());
            } catch {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON payload' }));
                return;
            }

            // Handle auth message
            if (payload?.type === 'auth') {
                const token = typeof payload.token === 'string' ? payload.token : null;
                const userPayload = token ? await verifyJWT(token, secret) : null;
                if (!userPayload) {
                    ws.close(1008, 'Unauthorized');
                    return;
                }

                clearTimeout(authTimeout);
                const clientInfo: ClientInfo = {
                    type: userPayload.type as string,
                    phone: userPayload.phone as string,
                    id: userPayload.id as number,
                };
                clients.set(ws, clientInfo);

                // Switch to normal message handler
                ws.off('message', onMessage);
                ws.on('message', (data: WebSocket.RawData) => {
                    let msg: Record<string, unknown>;
                    try {
                        msg = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString());
                    } catch {
                        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON payload' }));
                        return;
                    }
                    if (msg?.type === 'ping') {
                        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                    }
                });

                ws.send(JSON.stringify({
                    type: 'ws_connected',
                    message: `Connected to appointment websocket at port ${WS_PORT}`,
                    timestamp: new Date().toISOString(),
                }));
                return;
            }

            ws.send(JSON.stringify({ type: 'error', message: 'Authentication required' }));
        };

        ws.on('message', onMessage);
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
    });

    AppointmentService.events.on('appointment:updated', (appointment) => {
        broadcast('appointment:updated', appointment);
    });

    AppointmentService.events.on('appointment:deleted', (appointment) => {
        broadcast('appointment:deleted', appointment);
    });

    console.log(`WebSocket server for appointments is running on ws://localhost:${WS_PORT}`);

    return wss;
}
