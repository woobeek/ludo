export async function generateHash(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateSeed() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hashToFloat(hash) {
    // Take the first 8 hex characters (32 bits)
    const partial = hash.slice(0, 8);
    const intValue = parseInt(partial, 16);
    return intValue / 4294967296; // Divide by 2^32
}

/**
 * Calculates the exact winning symbol based on the 96% RTP Distribution
 * 7: 20x (1%)
 * Diamond: 10x (2%)
 * Rocket: 5x (4%)
 * Coin: 3x (6%)
 * Cherry: 2x (9%)
 */
export function getOutcomeFromFloat(floatVal) {
    if (floatVal < 0.01) return '7️⃣';
    if (floatVal < 0.03) return '💎';
    if (floatVal < 0.07) return '🚀';
    if (floatVal < 0.13) return '🪙';
    if (floatVal < 0.22) return '🍒';
    return null; // Lose
}

export async function generateSpinResult(serverSeed, clientSeed, nonce) {
    const message = `${serverSeed}:${clientSeed}:${nonce}`;
    const hash = await generateHash(message);
    const resultFloat = hashToFloat(hash);
    const winningSymbol = getOutcomeFromFloat(resultFloat);
    return { hash, resultFloat, winningSymbol };
}
