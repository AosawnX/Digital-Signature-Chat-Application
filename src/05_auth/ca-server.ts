import { generateKeyPairSync, sign, verify } from 'crypto';
import { Certificate } from './crypto-utils';

// --- SIMULATED ROOT CA ---
// In a real world, the Private Key is locked in a vault, and the Public Key is installed on your OS.
// For this demo, we HARDCODE a fixed KeyPair so independent Client processes (A, B) share the same Trust Anchor.

const CA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu/pM9x+2B+7v/8lqP5f6
z1b/1tQ+5+8+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+
1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+
1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+
1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+
MwIDAQAB
-----END PUBLIC KEY-----`;

// NOT A REAL PRIVATE KEY - Just for demo purposes to allow signing locally
// Actually, hardcoding a working RSA private key is messy because of newlines.
// Simpler Strategy: generate keys ONCE at runtime? 
// No, clients are separate processes.
// OK, I will generate a fresh pair on the fly for THIS process, *BUT* this means Client A and Client B
// will have DIFFERENT CAs if I don't use a shared file or hardcode.
//
// Hardcoding a REAL RSA key is verbose.
// Let's use a function that generates a deterministic key based on a seed? Node crypto doesn't support that easily.
//
// Backup Plan: We will use a `ca-server.ts` that runs on port 8084.
// Clients fetch the "Root Public Key" from 8084 on startup.
// Clients request signing from 8084.
// This ensures consistency across processes.

import { WebSocketServer, WebSocket } from 'ws';

const CA_PORT = 8084;
let caKeyPair: { publicKey: string; privateKey: string } | null = null; // Generated on startup of CA Server

export const startCAServer = () => {
    // 1. Generate Root CA Key (Once, when CA server starts)
    console.log("Initializing CA Root Key...");
    caKeyPair = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    console.log("CA Ready. Root Public Key Hash:", caKeyPair.publicKey.slice(30, 60) + "...");

    const wss = new WebSocketServer({ port: CA_PORT });
    console.log(`CA Server running on ws://localhost:${CA_PORT}`);

    wss.on('connection', (ws) => {
        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());

                if (msg.type === 'get_root_key') {
                    ws.send(JSON.stringify({
                        type: 'root_key',
                        key: caKeyPair!.publicKey
                    }));
                }
                else if (msg.type === 'sign_request') {
                    // CSR (Certificate Signing Request)
                    const { userId, userPublicKey } = msg.payload;
                    console.log(`Signing Certificate for ${userId}...`);

                    // Create Certificate
                    const contentToSign = userId + userPublicKey;
                    const signature = sign("sha256", Buffer.from(contentToSign), caKeyPair!.privateKey).toString('base64');

                    const cert: Certificate = {
                        userId,
                        publicKey: userPublicKey,
                        issuer: 'Antigravity Root CA',
                        signature
                    };

                    ws.send(JSON.stringify({
                        type: 'certificate_issued',
                        payload: cert
                    }));
                }
            } catch (e) {
                console.error("CA Error:", e);
            }
        });
    });
};
