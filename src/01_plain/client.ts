import WebSocket from 'ws';
import readline from 'readline';

const ws = new WebSocket('ws://localhost:8080');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

ws.on('open', () => {
    console.log('Connected to server');
    console.log('Type a message and press Enter to send.');
});

ws.on('message', (data) => {
    console.log(`\n${data}`);
    process.stdout.write('> '); // Reprompt
});

rl.on('line', (input) => {
    ws.send(input);
    process.stdout.write('> ');
});

ws.on('close', () => {
    console.log('Disconnected from server');
    process.exit(0);
});

ws.on('error', (err) => {
    console.error('WebSocket error:', err);
});
