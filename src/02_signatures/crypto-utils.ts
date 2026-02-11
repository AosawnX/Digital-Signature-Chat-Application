import { generateKeyPairSync } from 'crypto';

export interface KeyPair {
    publicKey: string;
    privateKey: string;
}

/**
 * Generates a new RSA-2048 key pair.
 * synchronous for simplicity in this educational demo.
 */
export const generateRSAKeys = (): KeyPair => {
    console.log("Generating RSA-2048 Key Pair... (this might take a second)");
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki', // Standard for public keys
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8', // Standard for private keys
            format: 'pem'
        }
    });

    return { publicKey, privateKey };
};

import { sign, verify } from 'crypto';

/**
 * Signs a message using the sender's Private Key.
 * Returns the signature in base64 format.
 */
export const signMessage = (message: string, privateKey: string): string => {
    // SHA-256 is the hashing algorithm
    const signature = sign("sha256", Buffer.from(message), privateKey);
    return signature.toString('base64');
};

/**
 * Verifies a signature using the sender's Public Key.
 * Returns true if valid, false otherwise.
 */
export const verifySignature = (message: string, signature: string, publicKey: string): boolean => {
    const isVerified = verify(
        "sha256",
        Buffer.from(message),
        publicKey,
        Buffer.from(signature, 'base64')
    );
    return isVerified;
};
