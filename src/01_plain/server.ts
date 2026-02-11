import { WebSocketServer, WebSocket } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

interface Client extends WebSocket {
    id: string;
}

wss.on('connection', (ws: Client) => {
    ws.id = Math.random().toString(36).substring(7);
    console.log(`Client ${ws.id} connected`);

    ws.on('message', (data, isBinary) => {
        const message = isBinary ? data : data.toString();
        console.log(`Received from ${ws.id}: ${message}`);

        // Broadcast to all other clients
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(`User ${ws.id}: ${message}`);
            }
        });
    });

    ws.on('close', () => {
        console.log(`Client ${ws.id} disconnected`);
    });
});

console.log('Phase 1 Server started on ws://localhost:8080');
