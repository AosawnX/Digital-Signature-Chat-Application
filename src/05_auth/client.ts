import WebSocket from 'ws';
import readline from 'readline';
import { verify } from 'crypto'; // Native verify for checking cert sig
import {
    generateRSAKeys,
    generateAESKey,
    encryptAESKeyWithRSA,
    decryptAESKeyWithRSA,
    encryptMessageAES,
    decryptMessageAES,
    createSecurePacket,
    ReplayProtection,
    Certificate
} from './crypto-utils';

// --- Identity ---
console.log('Generating RSA Identity...');
const { publicKey, privateKey } = generateRSAKeys();

// --- State ---
let caRootKey: string | null = null;
let myCertificate: Certificate | null = null;
let connectedUsers: any[] = [];
let targetUser: { id: string, publicKey: string } | null = null;
let sessionKey: string | null = null;
const replayProtection = new ReplayProtection();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// 1. BOOTSTRAP: Connect to CA to getting Root Key & My Certificate
console.log('Connecting to CA...');
const caWs = new WebSocket('ws://localhost:8084');

caWs.on('open', () => {
    // A. Get Root Key (Trust Anchor)
    caWs.send(JSON.stringify({ type: 'get_root_key' }));
});

caWs.on('message', (data) => {
    const msg = JSON.parse(data.toString());

    if (msg.type === 'root_key') {
        caRootKey = msg.key;
        console.log('[TRUST] Received CA Root Key.');

        // B. Request Signing (Issuance)
        // In real world, we'd provide proof of identity. Here, we just ask.
        caWs.send(JSON.stringify({
            type: 'sign_request',
            payload: { userId: 'User-' + Math.random().toString(36).substring(7), userPublicKey: publicKey }
        }));
    }
    else if (msg.type === 'certificate_issued') {
        myCertificate = msg.payload;
        console.log('[IDENTITY] Certificate Issued by CA.');
        caWs.close(); // Done with CA

        startChatClient(); // Proceed to Chat
    }
});

function startChatClient() {
    const ws = new WebSocket('ws://localhost:8085');

    ws.on('open', () => {
        console.log('Connected to Phase 5 Chat Server.');

        // Register with Certificate
        ws.send(JSON.stringify({
            type: 'register_with_cert',
            payload: myCertificate
        }));

        console.log('\nCommands:');
        console.log('  list                 -> Show online users');
        console.log('  connect <User ID>    -> Start secure session (Using Certs)');
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
            else if (msg.type === 'cert_response') {
                handleCertResponse(msg, ws);
            }
            else if (msg.type === 'direct') {
                handleDirectMessage(msg, ws);
            }
            process.stdout.write('> ');
        } catch (e) { console.error(e); }
    });

    rl.on('line', (input) => {
        const args = input.trim().split(' ');
        const command = args[0];

        if (command === 'list') ws.send(JSON.stringify({ type: 'list' }));
        else if (command === 'connect') {
            const targetId = args[1];
            console.log(`Fetching Certificate for ${targetId}...`);
            ws.send(JSON.stringify({ type: 'get_cert', targetId }));
        }
        else if (command === 'msg') {
            if (!targetUser || !sessionKey) { console.log('No secure session.'); return; }
            const packet = createSecurePacket(args.slice(1).join(' '));
            const encrypted = encryptMessageAES(JSON.stringify(packet), sessionKey);
            ws.send(JSON.stringify({
                type: 'direct',
                targetId: targetUser.id,
                payload: { type: 'chat', content: encrypted }
            }));
            console.log(`[SENT] ${args.slice(1).join(' ')}`);
        }
        process.stdout.write('> ');
    });
}

function handleCertResponse(msg: any, ws: WebSocket) {
    const cert = msg.certificate;
    console.log(`\n[AUTH] Verifying Certificate for ${cert.userId}...`);

    // VERIFY CERTIFICATE AGAINST ROOT KEY
    const contentToVerify = cert.userId + cert.publicKey;
    const isValid = verify("sha256", Buffer.from(contentToVerify), caRootKey!, Buffer.from(cert.signature, 'base64'));

    if (isValid) {
        console.log('[AUTH] Certificate VALID. Trusting Public Key.');

        // Handshake
        const newSessionKey = generateAESKey();
        sessionKey = newSessionKey;
        targetUser = { id: cert.userId, publicKey: cert.publicKey }; // Trusted!

        const encryptedKey = encryptAESKeyWithRSA(newSessionKey, cert.publicKey);
        ws.send(JSON.stringify({
            type: 'direct',
            targetId: cert.userId,
            payload: { type: 'key_exchange', encryptedKey }
        }));
        console.log('[HANDSHAKE] Sent Encrypted Session Key.');

    } else {
        console.error('[AUTH] Certificate INVALID! Potential MITM Attack.');
    }
}

function handleDirectMessage(envelope: any, ws: WebSocket) {
    const { senderId, payload } = envelope;

    if (payload.type === 'key_exchange') {
        console.log(`\n[HANDSHAKE] Received Key from ${senderId}`);
        // In real implementation, we should ALSO verify the sender's cert here if not already known.
        // For demo, we assume we just accept the key if we can decrypt it (Simplified).
        try {
            sessionKey = decryptAESKeyWithRSA(payload.encryptedKey, privateKey);
            targetUser = { id: senderId, publicKey: '' }; // Check cert later if needed
            console.log('[SUCCESS] Secure Channel Established.');
        } catch (e) { console.error('Decryption failed'); }
    }
    else if (payload.type === 'chat') {
        if (!sessionKey) return;
        try {
            const plain = decryptMessageAES(payload.content, sessionKey);
            const packet = JSON.parse(plain);
            if (replayProtection.validate(packet)) {
                console.log(`\n[SECURE] ${senderId}: ${packet.payload}`);
            } else {
                console.log(`\n[REJECTED] Replay detected from ${senderId}`);
            }
        } catch (e) { console.error('Decrypt error'); }
    }
}
