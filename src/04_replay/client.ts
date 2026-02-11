import WebSocket from 'ws';
import readline from 'readline';
import {
    generateRSAKeys,
    generateAESKey,
    encryptAESKeyWithRSA,
    decryptAESKeyWithRSA,
    encryptMessageAES,
    decryptMessageAES,
    createSecurePacket,
    ReplayProtection
} from './crypto-utils';

// --- Identity ---
console.log('Generating RSA Identity...');
const { publicKey, privateKey } = generateRSAKeys();
console.log('Identity generated.');

// --- State ---
interface User {
    id: string;
    publicKey?: string;
}

let connectedUsers: User[] = [];
let targetUser: User | null = null;
let sessionKey: string | null = null;
const replayProtection = new ReplayProtection(); // Initializes validation cache

const ws = new WebSocket('ws://localhost:8083');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

ws.on('open', () => {
    console.log('Connected to Phase 4 Server (Replay Protected).');

    // Register Identity
    ws.send(JSON.stringify({
        type: 'register',
        payload: { publicKey }
    }));

    console.log('\nCommands:');
    console.log('  list                 -> Show online users');
    console.log('  connect <User ID>    -> Start secure session');
    console.log('  msg <text>           -> Send encrypted message');
    process.stdout.write('> ');
});

ws.on('message', (data) => {
    try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'user_list') {
            connectedUsers = msg.users;
            console.log('\n[USERS] Online:', connectedUsers.map(u => u.id).join(', '));
        }
        else if (msg.type === 'direct') {
            handleDirectMessage(msg);
        }
        else if (msg.type === 'error') {
            console.error('\n[ERROR]', msg.message);
        }
        process.stdout.write('> ');
    } catch (e) {
        console.error('Error:', e);
    }
});

function handleDirectMessage(envelope: any) {
    const { senderId, payload } = envelope;

    if (payload.type === 'key_exchange') {
        console.log(`\n[KEY EXCHANGE] Received Encrypted AES Key from ${senderId}`);
        try {
            const decryptedKey = decryptAESKeyWithRSA(payload.encryptedKey, privateKey);
            sessionKey = decryptedKey;

            targetUser = connectedUsers.find(u => u.id === senderId) || { id: senderId };

            console.log('[SUCCESS] Session Key Decrypted. Secure Channel Established.');
        } catch (e) {
            console.error('[FAIL] Could not decrypt session key:', e);
        }
    }
    else if (payload.type === 'chat') {
        if (!sessionKey) {
            console.log(`\n[ENCRYPTED] Message from ${senderId} (Cannot decrypt: No Session Key)`);
            return;
        }
        try {
            // 1. Decrypt Layer
            const plaintextJSON = decryptMessageAES(payload.content, sessionKey);

            // 2. Parse Secure Packet
            const packet = JSON.parse(plaintextJSON);

            // 3. Replay Protection Check
            if (replayProtection.validate(packet)) {
                // If Valid
                console.log(`\n[SECURE] ${senderId}: ${packet.payload}`);
                // Debug info
                console.log(`   (Timestamp: ${new Date(packet.timestamp).toLocaleTimeString()}, Nonce: ${packet.nonce.substring(0, 6)}...)`);
            } else {
                // If Invalid (Replay or Expired)
                console.log(`\n[REJECTED] Message from ${senderId} blocked by Replay Protection.`);
            }

        } catch (e) {
            console.error('[DECRYPT FAIL] Integrity check failed, wrong key, or malformed packet.');
        }
    }
}

rl.on('line', (input) => {
    const args = input.trim().split(' ');
    const command = args[0];

    if (command === 'list') {
        ws.send(JSON.stringify({ type: 'list' }));
    }
    else if (command === 'connect') {
        const targetId = args[1];
        const user = connectedUsers.find(u => u.id === targetId);

        if (!user || !user.publicKey) {
            console.log('User not found or has no public key.');
            process.stdout.write('> ');
            return;
        }

        console.log(`\nInitiating Handshake with ${targetId}...`);
        const newSessionKey = generateAESKey();
        sessionKey = newSessionKey;
        targetUser = user;

        const encryptedKey = encryptAESKeyWithRSA(newSessionKey, user.publicKey);

        ws.send(JSON.stringify({
            type: 'direct',
            targetId: targetUser.id,
            payload: {
                type: 'key_exchange',
                encryptedKey: encryptedKey
            }
        }));

        console.log('[SENT] Encrypted Session Key sent.');
        process.stdout.write('> ');
    }
    else if (command === 'msg') {
        if (!targetUser || !sessionKey) {
            console.log('No secure session. Use "connect <ID>" first.');
            process.stdout.write('> ');
            return;
        }

        const text = args.slice(1).join(' ');

        // 1. Create Secure Packet (Add Timestamp + Nonce)
        const packet = createSecurePacket(text);

        // 2. Encrypt the Packet JSON
        const encryptedPayload = encryptMessageAES(JSON.stringify(packet), sessionKey);

        ws.send(JSON.stringify({
            type: 'direct',
            targetId: targetUser.id,
            payload: {
                type: 'chat',
                content: encryptedPayload
            }
        }));

        console.log(`[SENT] (Encrypted & Timestamped): ${text}`);
        process.stdout.write('> ');
    } else {
        // Ignore or handle unknown
    }
});
