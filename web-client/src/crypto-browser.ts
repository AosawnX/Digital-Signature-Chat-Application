// Browser Crypto Implementation using Web Crypto API + node-forge fallback
import forge from 'node-forge';

// --- HELPERS ---
const enc = new TextEncoder();
const dec = new TextDecoder();

function isWebCryptoAvailable() {
    return window.crypto && window.crypto.subtle;
}

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
    if (isWebCryptoAvailable()) {
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

        const pubDer = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
        const privDer = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

        return {
            publicKey: toPem(pubDer, "PUBLIC KEY"),
            privateKey: toPem(privDer, "PRIVATE KEY"),
            raw: keyPair
        };
    } else {
        console.warn("Using node-forge fallback for RSA Key Gen");
        return new Promise<any>((resolve, reject) => {
            forge.pki.rsa.generateKeyPair({ bits: 2048, workers: 2 }, (err, keypair) => {
                if (err) return reject(err);
                resolve({
                    publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
                    privateKey: forge.pki.privateKeyToPem(keypair.privateKey),
                    raw: keypair // Forge key object
                });
            });
        });
    }
}

function toPem(buffer: ArrayBuffer, type: string) {
    const b64 = arrayBufferToBase64(buffer);
    return `-----BEGIN ${type}-----\n${b64}\n-----END ${type}-----`;
}

// --- PHASE 2: SIGNING ---

export async function signMessage(_message: string, _privateKeyPem: string) {
    throw new Error("Use signMessageWithKeyObject instead");
}

export async function signMessageWithKeyObject(message: string, privateKey: any) {
    if (isWebCryptoAvailable() && privateKey instanceof CryptoKey) {
        const sig = await window.crypto.subtle.sign(
            "RSASSA-PKCS1-v1_5",
            privateKey,
            enc.encode(message)
        );
        return arrayBufferToBase64(sig);
    } else {
        // Forge Fallback
        // privateKey should be Forge key object
        const md = forge.md.sha256.create();
        md.update(message, 'utf8');
        const sig = privateKey.sign(md);
        return window.btoa(sig);
    }
}

// --- PHASE 3: AES ---

export async function generateAESKey() {
    if (isWebCryptoAvailable()) {
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
    } else {
        // Forge Fallback
        const keyBytes = forge.random.getBytesSync(32);
        return {
            base64: window.btoa(keyBytes),
            keyObj: keyBytes // Raw string bytes
        };
    }
}

export async function encryptMessageAES(message: string, key: any) {
    if (isWebCryptoAvailable() && typeof key !== 'string') {
        // WebCrypto
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            enc.encode(message)
        );

        const encryptBuf = new Uint8Array(encrypted);
        const tagLength = 16;
        const ciphertext = encryptBuf.slice(0, encryptBuf.length - tagLength);
        const tag = encryptBuf.slice(encryptBuf.length - tagLength);

        return JSON.stringify({
            iv: arrayBufferToBase64(iv.buffer),
            encrypted: arrayBufferToBase64(ciphertext.buffer),
            authTag: arrayBufferToBase64(tag.buffer)
        });
    } else {
        // Forge Fallback
        const iv = forge.random.getBytesSync(12);
        const cipher = forge.cipher.createCipher('AES-GCM', key); // key is bytes
        cipher.start({ iv: iv });
        cipher.update(forge.util.createBuffer(message, 'utf8'));
        cipher.finish();

        return JSON.stringify({
            iv: window.btoa(iv),
            encrypted: window.btoa(cipher.output.data),
            authTag: window.btoa(cipher.mode.tag.data)
        });
    }
}

export async function decryptMessageAES(payloadStr: string, key: any) {
    const obj = JSON.parse(payloadStr);

    if (isWebCryptoAvailable() && typeof key !== 'string') {
        const iv = base64ToArrayBuffer(obj.iv);
        const ciphertext = base64ToArrayBuffer(obj.encrypted);
        const tag = base64ToArrayBuffer(obj.authTag);

        const combined = new Uint8Array(ciphertext.byteLength + tag.byteLength);
        combined.set(new Uint8Array(ciphertext));
        combined.set(new Uint8Array(tag), ciphertext.byteLength);

        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(iv) },
            key,
            combined
        );

        return dec.decode(decrypted);
    } else {
        // Forge Fallback
        const iv = window.atob(obj.iv);
        const encrypted = window.atob(obj.encrypted);
        const authTag = window.atob(obj.authTag);

        const decipher = forge.cipher.createDecipher('AES-GCM', key);
        decipher.start({
            iv: iv,
            tag: forge.util.createBuffer(authTag)
        });
        decipher.update(forge.util.createBuffer(encrypted));
        const pass = decipher.finish();

        if (pass) {
            return decipher.output.toString();
        } else {
            throw new Error("Decryption failed");
        }
    }
}

// --- PHASE 3: RSA-OAEP (For Key Exchange) ---

export async function importKeyForEncryption(spkiPem: string): Promise<any> {
    if (isWebCryptoAvailable()) {
        const b64 = spkiPem.replace(/-----BEGIN PUBLIC KEY-----|\n|-----END PUBLIC KEY-----/g, "");
        const ab = base64ToArrayBuffer(b64);

        return window.crypto.subtle.importKey(
            "spki",
            ab,
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ["encrypt"]
        );
    } else {
        // Forge Fallback
        // Return Forge Public Key Object
        return forge.pki.publicKeyFromPem(spkiPem);
    }
}

// --- RSA ENCRYPTION / DECRYPTION (For Session Key) ---

export async function encryptRSA(data: Uint8Array, publicKeyPem: string): Promise<string> {
    if (isWebCryptoAvailable()) {
        const key = await importKeyForEncryption(publicKeyPem);
        const encrypted = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            key,
            data as any
        );
        return arrayBufferToBase64(encrypted);
    } else {
        // Forge
        const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
        const encrypted = publicKey.encrypt(String.fromCharCode(...data), 'RSA-OAEP', {
            md: forge.md.sha256.create(),
            mgf1: { md: forge.md.sha256.create() }
        });
        return window.btoa(encrypted);
    }
}

export async function decryptRSA(base64Data: string, privateKey: any): Promise<Uint8Array> {
    if (isWebCryptoAvailable() && privateKey instanceof CryptoKey) {
        // We need to re-import the private key with "decrypt" usage.
        const jwk = await window.crypto.subtle.exportKey("jwk", privateKey);
        jwk.key_ops = ["decrypt"];
        const decryptKey = await window.crypto.subtle.importKey(
            "jwk",
            jwk,
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ["decrypt"]
        );

        const data = base64ToArrayBuffer(base64Data);
        const decrypted = await window.crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            decryptKey,
            data as any
        );
        return new Uint8Array(decrypted);

    } else {
        // Forge
        // privateKey is Forge Key Object
        const encrypted = window.atob(base64Data);
        const decrypted = privateKey.decrypt(encrypted, 'RSA-OAEP', {
            md: forge.md.sha256.create(),
            mgf1: { md: forge.md.sha256.create() }
        });
        const len = decrypted.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = decrypted.charCodeAt(i);
        }
        return bytes;
    }
}
