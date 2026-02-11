import {
    randomBytes
} from 'crypto';

// Re-export specific items from Phase 3 utils if needed, or better:
// In a real project, we'd import * from previous, but here we can just extend or re-declare.
// For simplicity in this linear progression, I will duplicate the necessary base functions + add new ones,
// OR import from the previous phase. Importing is cleaner.

export * from '../03_encryption/crypto-utils';

// --- REPLAY PROTECTION ---

// 1. Packet Structure
export interface SecurePacket {
    timestamp: number;
    nonce: string;
    payload: any; // The actual message
}

// 2. Wrap Data (Add Timestamp + Nonce)
export const createSecurePacket = (payload: any): SecurePacket => {
    return {
        timestamp: Date.now(),
        nonce: randomBytes(16).toString('hex'),
        payload: payload
    };
};

/* 
   3. Validator Class
   Why a class? Because we need to maintain STATE (the cache of seen nonces).
*/
export class ReplayProtection {
    private seenNonces: Set<string> = new Set();
    private windowMs: number;

    constructor(windowSeconds: number = 60) {
        this.windowMs = windowSeconds * 1000;
    }

    /**
     * Validates a packet against Replay Attacks.
     * @returns true if valid, false if replay/expired.
     */
    public validate(packet: SecurePacket): boolean {
        const now = Date.now();

        // Check 1: Timestamp Freshness
        if (now - packet.timestamp > this.windowMs) {
            console.log(`[REJECT] Timestamp expired. Diff: ${now - packet.timestamp}ms`);
            return false;
        }

        // Check 2: Future Timestamp (Time travel check)
        if (packet.timestamp > now + 5000) { // Allow 5s clock skew
            console.log(`[REJECT] Timestamp from future.`);
            return false;
        }

        // Check 3: Nonce Uniqueness
        if (this.seenNonces.has(packet.nonce)) {
            console.log(`[REJECT] Replay detected! Nonce ${packet.nonce} already seen.`);
            return false;
        }

        // Pass! Add nonce to cache.
        this.seenNonces.add(packet.nonce);

        // Cleanup old nonces occasionally (simple approach: just keep growing for this demo, or clear explicitly)
        // For a long-running app, we'd need a cleaner.
        // Let's implement a lazy cleanup? Or just ignore for brief demo.
        setTimeout(() => this.seenNonces.delete(packet.nonce), this.windowMs);

        return true;
    }
}
