const crypto = require('crypto');

async function generateHash(message) {
    const hash = crypto.createHash('sha256');
    hash.update(message);
    return hash.digest('hex');
}

function hashToFloat(hash) {
    const partial = hash.slice(0, 8);
    const intValue = parseInt(partial, 16);
    return intValue / 4294967296;
}

function getOutcomeFromFloat(floatVal) {
    if (floatVal < 0.01) return '7️⃣';
    if (floatVal < 0.03) return '💎';
    if (floatVal < 0.07) return '🚀';
    if (floatVal < 0.13) return '🪙';
    if (floatVal < 0.22) return '🍒';
    return null;
}

const MULTIPLIERS = { '7️⃣': 20, '💎': 10, '🚀': 5, '🪙': 3, '🍒': 2 };

async function runTest(iterations) {
    let totalBet = 0;
    let totalWon = 0;
    const betAmount = 100;
    
    const serverSeed = crypto.randomBytes(16).toString('hex');
    const clientSeed = crypto.randomBytes(16).toString('hex');
    
    let wincounts = { '7️⃣': 0, '💎': 0, '🚀': 0, '🪙': 0, '🍒': 0, 'LOSE': 0 };

    for (let nonce = 1; nonce <= iterations; nonce++) {
        const message = `${serverSeed}:${clientSeed}:${nonce}`;
        const hash = await generateHash(message);
        const resultFloat = hashToFloat(hash);
        const winSym = getOutcomeFromFloat(resultFloat);
        
        totalBet += betAmount;
        
        if (winSym) {
            totalWon += betAmount * MULTIPLIERS[winSym];
            wincounts[winSym]++;
        } else {
            wincounts['LOSE']++;
        }
    }
    
    const rtp = (totalWon / totalBet) * 100;
    const houseEdge = 100 - rtp;
    
    console.log(`\n--- PROVABLY FAIR ENGINE TEST (${iterations} SPINS) ---`);
    console.log(`Total Money In: $${totalBet.toLocaleString()}`);
    console.log(`Total Money Paid Out: $${totalWon.toLocaleString()}`);
    console.log(`\nResults Distribution:`, wincounts);
    console.log(`\nActual RTP (Return To Player): ${rtp.toFixed(2)}% (Target: 96%)`);
    console.log(`Actual House Edge (Casino Profit Margin): ${houseEdge.toFixed(2)}% (Target: 4%)`);
    console.log(`Net Casino Profit: $${(totalBet - totalWon).toLocaleString()}\n`);
}

runTest(100000); // 100,000 spins
