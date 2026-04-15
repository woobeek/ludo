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

export const SYMBOLS = ['👑', '⭐', '7️⃣', '💎', '🚀', '🪙', '🍒'];

/**
 * Distributes outcomes across 65536 possible values (16 bits).
 * 👑 Wild: 4% | ⭐ Scatter: 5% | 7️⃣: 10% | 💎: 15% | 🚀: 15% | 🪙: 23% | 🍒: 28%
 */
export function getSymbolFromInt(val) {
    if (val < 2621) return '👑';   // 4%
    if (val < 5898) return '⭐';   // 9% cumulative
    if (val < 12451) return '7️⃣';  // 19% cumulative
    if (val < 22282) return '💎';  // 34% cumulative
    if (val < 32112) return '🚀';  // 49% cumulative
    if (val < 47185) return '🪙';  // 72% cumulative
    return '🍒';               // 100%
}

export async function generateSpinResult(serverSeed, clientSeed, nonce) {
    const message = `${serverSeed}:${clientSeed}:${nonce}`;
    const hash = await generateHash(message);
    
    // Generate a 5x3 Grid independently from the hash
    const grid = []; 
    for (let col = 0; col < 5; col++) {
        const column = [];
        for (let row = 0; row < 3; row++) {
            const index = col * 3 + row;
            // Extract 4 hex characters (16 bits) per position
            const hex = hash.slice(index * 4, index * 4 + 4);
            const intVal = parseInt(hex, 16);
            column.push(getSymbolFromInt(intVal));
        }
        grid.push(column);
    }
    
    return { hash, grid };
}
