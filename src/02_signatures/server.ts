import { WebSocketServer, WebSocket } from 'ws';

const wss = new WebSocketServer({ port: 8081 }); // New port for Phase 2

interface Client extends WebSocket {
    id: string;
    publicKey?: string;
}

interface Message {
    type: 'pubkey' | 'message';
    content?: string;
    signature?: string;
    key?: string;
}

wss.on('connection', (ws: Client) => {
    ws.id = Math.random().toString(36).substring(7);
    console.log(`Client ${ws.id} connected`);

    ws.on('message', (data) => {
        try {
            const parsed: Message = JSON.parse(data.toString());

            if (parsed.type === 'pubkey' && parsed.key) {
                // Store the client's public key
                ws.publicKey = parsed.key;
                console.log(`Client ${ws.id} registered Public Key`);
            } else if (parsed.type === 'message') {
                // Broadcast message + signature + sender's public key
                console.log(`Relaying message from ${ws.id}`);

                const broadcastPayload = JSON.stringify({
                    senderId: ws.id,
                    content: parsed.content,
                    signature: parsed.signature,
                    senderPublicKey: ws.publicKey
                });

                wss.clients.forEach((client) => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(broadcastPayload);
                    }
                });
            }
        } catch (e) {
            console.error('Failed to parse message:', e);
        }
    });

    ws.on('close', () => {
        console.log(`Client ${ws.id} disconnected`);
    });
});

console.log('Phase 2 Server started on ws://localhost:8081');
