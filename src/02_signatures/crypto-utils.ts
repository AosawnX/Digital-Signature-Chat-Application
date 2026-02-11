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
