import crypto from 'crypto';

export const SYMBOLS = ['👑', '⭐', '7️⃣', '💎', '🚀', '🪙', '🍒'];

export const PAYLINES = [
    [1, 1, 1, 1, 1], // Middle
    [0, 0, 0, 0, 0], // Top
    [2, 2, 2, 2, 2], // Bottom
    [0, 1, 2, 1, 0], // V
    [2, 1, 0, 1, 2], // Inverted V
    [1, 0, 0, 0, 1], // Zigzag 1
    [1, 2, 2, 2, 1], // Zigzag 2
    [0, 0, 1, 2, 2], // Step Down
    [2, 2, 1, 0, 0], // Step Up
    [1, 2, 1, 0, 1]  // W-shape
];

export const PAYTABLE = {
    '7️⃣': { 3: 20, 4: 70, 5: 300 },
    '💎': { 3: 15, 4: 50, 5: 150 },
    '🚀': { 3: 10, 4: 30, 5: 100 },
    '🪙': { 3: 6, 4: 15, 5: 50 },
    '🍒': { 3: 2.5, 4: 8, 5: 25 },
    '👑': { 3: 50, 4: 150, 5: 600 },
    '⭐': { 3: 5, 4: 20, 5: 75 }
};

export function getSymbolFromInt(val) {
    if (val < 2621) return '👑';   // 4%
    if (val < 5898) return '⭐';   // 9% cumulative
    if (val < 12451) return '7️⃣';  // 19% cumulative
    if (val < 22282) return '💎';  // 34% cumulative
    if (val < 32112) return '🚀';  // 49% cumulative
    if (val < 47185) return '🪙';  // 72% cumulative
    return '🍒';               // 100%
}

export function generateSpinResultSync(serverSeed, clientSeed, nonce) {
    const combined = `${serverSeed}:${clientSeed}:${nonce}`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    
    const grid = []; 
    for (let col = 0; col < 5; col++) {
        const column = [];
        for (let row = 0; row < 3; row++) {
            const index = col * 3 + row;
            const hex = hash.slice(index * 4, index * 4 + 4);
            const intVal = parseInt(hex, 16);
            column.push(getSymbolFromInt(intVal));
        }
        grid.push(column);
    }
    return { hash, grid };
}

export function calculateWin(grid, betAmount) {
    let totalWinAmount = 0;
    
    // 1. Scatters
    let scatterCount = 0;
    grid.forEach((col) => {
        col.forEach((sym) => {
            if (sym === '⭐') scatterCount++;
        });
    });

    if (scatterCount >= 3) {
        const scatterMulti = PAYTABLE['⭐'][scatterCount] || 0;
        if (scatterMulti > 0) {
            totalWinAmount += betAmount * scatterMulti;
        }
    }

    // 2. Paylines
    const betPerLine = betAmount / PAYLINES.length;

    PAYLINES.forEach((line) => {
        let matchCount = 1;
        let firstSymbol = grid[0][line[0]];
        if (firstSymbol === '⭐') return; 
        
        let actualSymbol = firstSymbol;
        for (let i = 1; i < 5; i++) {
            const sym = grid[i][line[i]];
            if (sym === '⭐') break; 

            if (actualSymbol === '👑' && sym !== '👑') actualSymbol = sym;

            if (sym === actualSymbol || sym === '👑') {
                matchCount++;
            } else {
                break;
            }
        }

        if (matchCount >= 3) {
            const win = betPerLine * (PAYTABLE[actualSymbol]?.[matchCount] || 0);
            if (win > 0) {
                totalWinAmount += win;
            }
        }
    });

    return Math.floor(totalWinAmount);
}
