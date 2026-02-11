import WebSocket from 'ws';
import readline from 'readline';
import { generateRSAKeys, signMessage, verifySignature } from './crypto-utils';

// 1. Generate Identity
const { publicKey, privateKey } = generateRSAKeys();
console.log('Identity generated.');

const ws = new WebSocket('ws://localhost:8081');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

ws.on('open', () => {
    console.log('Connected to server.');

    // 2. Register Public Key
    ws.send(JSON.stringify({
        type: 'pubkey',
        key: publicKey
    }));

    console.log('Public Key sent to server.');
    console.log('Type a message to send (securely signed).');
});

ws.on('message', (data) => {
    try {
        const payload = JSON.parse(data.toString());
        const { senderId, content, signature, senderPublicKey } = payload;

        // 3. Verify Signature
        const isValid = verifySignature(content, signature, senderPublicKey);

        if (isValid) {
            console.log(`\n[VERIFIED] ${senderId}: ${content}`);
        } else {
            console.log(`\n[FAKE/TAMPERED] ${senderId}: ${content}`);
        }
        process.stdout.write('> ');

    } catch (e) {
        console.error('Error parsing message:', e);
    }
});

rl.on('line', (input) => {
    // 4. Sign Message
    const signature = signMessage(input, privateKey);

    ws.send(JSON.stringify({
        type: 'message',
        content: input,
        signature: signature
    }));

    process.stdout.write('> ');
});
