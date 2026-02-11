import WebSocket from 'ws';
import readline from 'readline';
import {
    generateRSAKeys,
    generateAESKey,
    encryptAESKeyWithRSA,
    decryptAESKeyWithRSA,
    encryptMessageAES,
    decryptMessageAES
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

const ws = new WebSocket('ws://localhost:8082');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

ws.on('open', () => {
    console.log('Connected to Phase 3 Server.');

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
            // Decrypt the AES key using our Private RSA Key
            const decryptedKey = decryptAESKeyWithRSA(payload.encryptedKey, privateKey);
            sessionKey = decryptedKey;

            // Auto-set the sender as our target
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
            // Decrypt the message using the AES Session Key
            const plaintext = decryptMessageAES(payload.content, sessionKey);
            console.log(`\n[SECURE] ${senderId}: ${plaintext}`);
        } catch (e) {
            console.error('[DECRYPT FAIL] Integrity check failed or wrong key.');
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

        // 1. Generate AES Session Key
        const newSessionKey = generateAESKey();
        sessionKey = newSessionKey;
        targetUser = user;

        // 2. Encrypt AES Key with Target's RSA Public Key
        const encryptedKey = encryptAESKeyWithRSA(newSessionKey, user.publicKey);

        // 3. Send Encrypted Key
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

        // 4. Encrypt Message with AES-GCM
        const encryptedPayload = encryptMessageAES(text, sessionKey);

        ws.send(JSON.stringify({
            type: 'direct',
            targetId: targetUser.id,
            payload: {
                type: 'chat',
                content: encryptedPayload
            }
        }));

        console.log(`[SENT] (Encrypted): ${text}`);
        process.stdout.write('> ');
    } else {
        // Broadcast or local echo? Phase 3 focuses on direct.
        // ws.send(JSON.stringify({ type: 'broadcast', content: input }));
        // Ignoring plain broadcast for Phase 3 to force usage of commands.
    }
});
