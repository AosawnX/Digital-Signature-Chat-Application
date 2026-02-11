import { WebSocketServer, WebSocket } from 'ws';
import { Certificate } from './crypto-utils';

const wss = new WebSocketServer({ port: 8085 }); // New port for Phase 5 (Chat)

interface Client extends WebSocket {
    id: string;
    certificate?: Certificate; // Store Cert instead of raw key
}

const clients = new Map<string, Client>();

wss.on('connection', (ws: Client) => {
    ws.id = Math.random().toString(36).substring(7);
    clients.set(ws.id, ws);
    console.log(`Client ${ws.id} connected`);

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());

            if (msg.type === 'register_with_cert') {
                // Client sends their Certificate!
                ws.certificate = msg.payload;
                console.log(`Client ${ws.id} provided Identity Certificate.`);
                broadcastUserList(); // Broadcast user list (clients will pull certs on demand/connect)
            }
            else if (msg.type === 'list') {
                sendUserList(ws);
            }
            else if (msg.type === 'direct') {
                const target = clients.get(msg.targetId);
                if (target && target.readyState === WebSocket.OPEN) {
                    // Relay Payload (could be handshake or chat)
                    target.send(JSON.stringify({
                        type: 'direct',
                        senderId: ws.id,
                        payload: msg.payload
                    }));
                }
            }
            // NEW: allow fetching certs
            else if (msg.type === 'get_cert') {
                const target = clients.get(msg.targetId);
                if (target?.certificate) {
                    ws.send(JSON.stringify({
                        type: 'cert_response',
                        targetId: msg.targetId,
                        certificate: target.certificate
                    }));
                }
            }

        } catch (e) {
            console.error('Invalid message:', e);
        }
    });

    ws.on('close', () => {
        clients.delete(ws.id);
        broadcastUserList();
    });
});

function getUserList() {
    // Only send IDs. Certificates are large, fetch on demand.
    return Array.from(clients.values()).map(c => ({
        id: c.id,
        hasCert: !!c.certificate
    }));
}

function sendUserList(ws: WebSocket) {
    ws.send(JSON.stringify({ type: 'user_list', users: getUserList() }));
}

function broadcastUserList() {
    const list = getUserList();
    const msg = JSON.stringify({ type: 'user_list', users: list });
    clients.forEach(c => c.send(msg));
}

console.log('Phase 5 Chat Server started on ws://localhost:8085');
