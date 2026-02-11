
export * from '../04_replay/crypto-utils';

export interface Certificate {
    userId: string;
    publicKey: string; // The user's public key
    issuer: string;    // "Antigravity Root CA"
    signature: string; // CA's signature of (userId + publicKey)
}
