import { WebSocketServer, WebSocket } from 'ws';

const wss = new WebSocketServer({ port: 8082 }); // New port for Phase 3

interface Client extends WebSocket {
    id: string;
    publicKey?: string;
}

interface Message {
    type: 'register' | 'list' | 'direct';
    targetId?: string; // For direct messages
    payload?: any;     // content, encryptedKey, etc.
}

const clients = new Map<string, Client>();

wss.on('connection', (ws: Client) => {
    // Assign simple readable ID for testing if possible, but random is safer for collision
    ws.id = Math.random().toString(36).substring(7);
    clients.set(ws.id, ws);
    console.log(`Client ${ws.id} connected`);

    ws.on('message', (data) => {
        try {
            const msg: Message = JSON.parse(data.toString());

            if (msg.type === 'register') {
                ws.publicKey = msg.payload.publicKey;
                console.log(`Client ${ws.id} registered Public Key`);

                // Broadcast new user list to check potential partners
                broadcastUserList();
            }
            else if (msg.type === 'list') {
                sendUserList(ws);
            }
            else if (msg.type === 'direct' && msg.targetId) {
                const target = clients.get(msg.targetId);
                if (target && target.readyState === WebSocket.OPEN) {
                    console.log(`Relaying DIRECT message from ${ws.id} to ${msg.targetId}`);
                    target.send(JSON.stringify({
                        type: 'direct',
                        senderId: ws.id,
                        payload: msg.payload
                    }));
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'Target not found' }));
                }
            }
        } catch (e) {
            console.error('Invalid message:', e);
        }
    });

    ws.on('close', () => {
        clients.delete(ws.id);
        console.log(`Client ${ws.id} disconnected`);
        broadcastUserList();
    });
});

function getUserList() {
    return Array.from(clients.values()).map(c => ({
        id: c.id,
        publicKey: c.publicKey // NOW SENDING FULL KEY
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

console.log('Phase 3 Server started on ws://localhost:8082');
