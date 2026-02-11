import {
    generateKeyPairSync,
    sign,
    verify,
    randomBytes,
    createCipheriv,
    createDecipheriv,
    publicEncrypt,
    privateDecrypt,
    constants
} from 'crypto';

export interface KeyPair {
    publicKey: string;
    privateKey: string;
}

// --- RSA (Existing) ---

export const generateRSAKeys = (): KeyPair => {
    console.log("Generating RSA-2048 Key Pair...");
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    return { publicKey, privateKey };
};

export const signMessage = (message: string, privateKey: string): string => {
    const signature = sign("sha256", Buffer.from(message), privateKey);
    return signature.toString('base64');
};

export const verifySignature = (message: string, signature: string, publicKey: string): boolean => {
    return verify(
        "sha256",
        Buffer.from(message),
        publicKey,
        Buffer.from(signature, 'base64')
    );
};

// --- HYBRID ENCRYPTION (New) ---

// 1. Generate AES-256 Key (32 bytes)
export const generateAESKey = (): string => {
    return randomBytes(32).toString('base64');
};

// 2. Encrypt AES Key with RSA Public Key (OAEP)
export const encryptAESKeyWithRSA = (aesKeyBase64: string, recipientPublicKey: string): string => {
    const buffer = Buffer.from(aesKeyBase64, 'base64');
    const encrypted = publicEncrypt(
        {
            key: recipientPublicKey,
            padding: constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
        },
        buffer
    );
    return encrypted.toString('base64');
};

// 3. Decrypt AES Key with RSA Private Key (OAEP)
export const decryptAESKeyWithRSA = (encryptedAESKeyBase64: string, privateKey: string): string => {
    const buffer = Buffer.from(encryptedAESKeyBase64, 'base64');
    const decrypted = privateDecrypt(
        {
            key: privateKey,
            padding: constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
        },
        buffer
    );
    return decrypted.toString('base64');
};

// 4. Encrypt Message with AES-GCM
// Returns: JSON string containing { iv, encrypted, authTag }
export const encryptMessageAES = (message: string, aesKeyBase64: string): string => {
    const key = Buffer.from(aesKeyBase64, 'base64');
    const iv = randomBytes(12); // Standard IV size for GCM
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(message, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');

    return JSON.stringify({
        iv: iv.toString('base64'),
        encrypted: encrypted,
        authTag: authTag
    });
};

// 5. Decrypt Message with AES-GCM
export const decryptMessageAES = (encryptedPayload: string, aesKeyBase64: string): string => {
    const { iv, encrypted, authTag } = JSON.parse(encryptedPayload);
    const key = Buffer.from(aesKeyBase64, 'base64');

    const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(iv, 'base64')
    );

    decipher.setAuthTag(Buffer.from(authTag, 'base64'));

    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};
