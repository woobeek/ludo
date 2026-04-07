import fs from 'fs';
import path from 'path';

// Simplistic JSON store for prototyping
// This allows the Leaderboard and Feed to persist across Next.js reloads during local dev.
const DB_PATH = path.join(process.cwd(), 'database.json');

const INITIAL_DB = {
    topWins: [
        { wallet: '8xK9...2mP', amount: 250000 },
        { wallet: 'D7fE...3aB', amount: 150000 },
        { wallet: '4vNx...9qL', amount: 85000 },
        { wallet: '1aBc...7zY', amount: 40000 },
        { wallet: '9pRt...5wK', amount: 20000 }
    ],
    feed: [] // Most recent spins and burns
};

function readDB() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            fs.writeFileSync(DB_PATH, JSON.stringify(INITIAL_DB, null, 2));
            return INITIAL_DB;
        }
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    } catch (e) {
        return INITIAL_DB;
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Failed to write DB', e);
    }
}

export function getLeaderboard() {
    return readDB().topWins;
}

export function getFeed() {
    return readDB().feed;
}

export function recordSpin(wallet, amount, isWin, type = 'spin') {
    const db = readDB();
    
    const walletShort = wallet ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : 'Unknown';
    
    // Add to Feed
    const feedItem = {
        id: Date.now().toString() + Math.random().toString(),
        wallet: walletShort,
        amount,
        isWin,
        type, // 'spin' or 'burn'
        timestamp: Date.now()
    };
    
    db.feed.unshift(feedItem);
    if (db.feed.length > 50) db.feed.pop(); // Keep last 50 items
    
    // Update Leaderboard if it's a win
    if (isWin) {
        const existingIndex = db.topWins.findIndex(w => w.wallet === walletShort);
        if (existingIndex !== -1) {
            // Update existing if new win is bigger
            if (amount > db.topWins[existingIndex].amount) {
                db.topWins[existingIndex].amount = amount;
            }
        } else {
            // Check if it belongs in Top 5
            const lowestTopWin = db.topWins[db.topWins.length - 1];
            if (db.topWins.length < 5 || amount > (lowestTopWin ? lowestTopWin.amount : 0)) {
                db.topWins.push({ wallet: walletShort, amount });
            }
        }
        // Sort and slice top 5
        db.topWins.sort((a, b) => b.amount - a.amount);
        db.topWins = db.topWins.slice(0, 5);
    }
    
    writeDB(db);
    return feedItem;
}
