import { WebSocket, WebSocketServer } from 'ws';
import { AppointmentService } from '../services/appointmentService.js';

const WS_PORT = Number(process.env.WS_PORT ?? 3001);

const clients = new Set<WebSocket>();

function broadcast(message: object) {
    const payload = JSON.stringify(message);
    for (const ws of [...clients]) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
        } else {
            clients.delete(ws);
        }
    }
}

export function startAppointmentWebsocket() {
    const wss = new WebSocketServer({ port: WS_PORT });

    wss.on('connection', (ws: WebSocket) => {
        clients.add(ws);

        ws.send(
            JSON.stringify({
                type: 'ws_connected',
                message: `Connected to appointment websocket at port ${WS_PORT}`,
                timestamp: new Date().toISOString(),
            }),
        );

        ws.on('message', (raw: WebSocket.RawData) => {
            let payload;
            try {
                payload = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(raw.toString());
            } catch {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON payload' }));
                return;
            }

            if (payload?.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
            }
        });

        ws.on('close', () => {
            clients.delete(ws);
        });

        ws.on('error', () => {
            clients.delete(ws);
        });
    });

    AppointmentService.events.on('appointment:created', (appointment) => {
        broadcast({ type: 'appointment:created', appointment });
    });

    AppointmentService.events.on('appointment:updated', (appointment) => {
        broadcast({ type: 'appointment:updated', appointment });
    });

    AppointmentService.events.on('appointment:deleted', (payload) => {
        broadcast({ type: 'appointment:deleted', payload });
    });

    console.log(`WebSocket server for appointments is running on ws://localhost:${WS_PORT}`);

    return wss;
}
