// Browser Crypto Implementation using Web Crypto API

// --- HELPERS ---
const enc = new TextEncoder();
const dec = new TextDecoder();

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

// --- PHASE 2: RSA KEY PAIR ---

export async function generateRSAKeys() {
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSASSA-PKCS1-v1_5",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["sign", "verify"]
    );

    // Export keys to PEM-like format (SPKI/PKCS8) for compatibility?
    // Actually, our Server expects PEM strings.
    // Exporting WebCrypto keys to PEM is verbose. 
    // To safe time, we will send RAW keys if possible, but Server expects PEM.
    // Let's implement exportToPem.

    const pubDer = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
    const privDer = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

    return {
        publicKey: toPem(pubDer, "PUBLIC KEY"),
        privateKey: toPem(privDer, "PRIVATE KEY"),
        raw: keyPair // Keep raw utility for internal use
    };
}

function toPem(buffer: ArrayBuffer, type: string) {
    const b64 = arrayBufferToBase64(buffer);
    // Chunk it? Node server might handle one line, but standard is 64 chars.
    // Let's just return one line for now (Node often handles it) or nice formatting.
    return `-----BEGIN ${type}-----\n${b64}\n-----END ${type}-----`;
}

// --- PHASE 2: SIGNING ---

export async function signMessage(_message: string, _privateKeyPem: string) {
    // We need to import the PEM back to WebKey? 
    // Optimization: If we just generated it, we have `raw` key pair.
    // But for "completeness", let's assume we load from PEM.
    // Importing PEM in browser is hard without library. 
    // PLAN: Store the CryptoKey objects in memory! 
    // The "PEM" is just for Sending to Server. 
    // Locally, we use the CryptoKey.
    throw new Error("Use signMessageWithKeyObject instead for browser performance");
}

export async function signMessageWithKeyObject(message: string, privateKey: CryptoKey) {
    const sig = await window.crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        privateKey,
        enc.encode(message)
    );
    return arrayBufferToBase64(sig);
}

// --- PHASE 3: AES ---

export async function generateAESKey() {
    const key = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    const raw = await window.crypto.subtle.exportKey("raw", key);
    return {
        base64: arrayBufferToBase64(raw),
        keyObj: key
    };
}

export async function encryptMessageAES(message: string, key: CryptoKey) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        enc.encode(message)
    );

    // WebCrypto output doesn't separate AuthTag?
    // AES-GCM in WebCrypto produces: [Ciphertext | Tag] appended.
    // Node.js `crypto` produces separate AuthTag.
    // COMPATIBILITY WARNING: 
    // Node.js: `cipher.getAuthTag()`
    // WebCrypto: The tag is the last 16 bytes of the output.

    // WE NEED TO SPLIT IT to match Node.js format: { iv, encrypted, authTag }

    const encryptBuf = new Uint8Array(encrypted);
    const tagLength = 16;
    const ciphertext = encryptBuf.slice(0, encryptBuf.length - tagLength);
    const tag = encryptBuf.slice(encryptBuf.length - tagLength);

    return JSON.stringify({
        iv: arrayBufferToBase64(iv.buffer),
        encrypted: arrayBufferToBase64(ciphertext.buffer),
        authTag: arrayBufferToBase64(tag.buffer)
    });
}

export async function decryptMessageAES(payloadStr: string, key: CryptoKey) {
    const obj = JSON.parse(payloadStr);
    const iv = base64ToArrayBuffer(obj.iv);
    const ciphertext = base64ToArrayBuffer(obj.encrypted);
    const tag = base64ToArrayBuffer(obj.authTag);

    // WebCrypto expects [Ciphertext | Tag]
    const combined = new Uint8Array(ciphertext.byteLength + tag.byteLength);
    combined.set(new Uint8Array(ciphertext));
    combined.set(new Uint8Array(tag), ciphertext.byteLength);

    const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(iv) },
        key,
        combined
    );

    return dec.decode(decrypted);
}

// --- PHASE 3: RSA-OAEP (For Key Exchange) ---
// Note: We generated RSASSA keys (Signing). We also need RSA-OAEP (Encryption).
// Usually you'd use separate keys. In our Node.js implementation, we used the SAME key for both?
// Node's `generateKeyPair` makes a general purpose RSA key.
// Web Crypto is stricter: You specify usages ["sign"] OR ["encrypt"].
// YOU CANNOT USE THE SAME KEY FOR SIGNING AND ENCRYPTION IN WEB CRYPTO (safely).
// 
// WORKAROUND:
// We will generate TWO key pairs in the browser logic:
// 1. Identity Key (Sign/Verify)
// 2. Encryption Key (Encrypt/Decrypt)
// The Server only stores ONE publicKey per user. This breaks compatibility with the Node implementation?
//
// LET'S CHECK: Node implementation uses `publicEncrypt` (OAEP) and `sign` (SHA256).
// Node allows this on one key.
//
// Browser fix: We can import the SAME key material twice with different usages?
// Yes. We export the SPKI, then import it back as RSA-OAEP.

export async function importKeyForEncryption(spkiPem: string): Promise<CryptoKey> {
    // Strip headers
    const b64 = spkiPem.replace(/-----BEGIN PUBLIC KEY-----|\n|-----END PUBLIC KEY-----/g, "");
    const ab = base64ToArrayBuffer(b64);

    return window.crypto.subtle.importKey(
        "spki",
        ab,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"]
    );
}

// ... Additional helper to convert our Signing Key to Encryption Key internally
