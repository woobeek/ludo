// In-memory store for Vercel serverless (no filesystem writes)
// Data persists within a single serverless instance lifecycle.
// For production scale, replace with Vercel KV or Supabase.

const store = {
    topWins: [
        { wallet: '8xK9...2mP', amount: 250000 },
        { wallet: 'D7fE...3aB', amount: 150000 },
        { wallet: '4vNx...9qL', amount: 85000 },
        { wallet: '1aBc...7zY', amount: 40000 },
        { wallet: '9pRt...5wK', amount: 20000 }
    ],
    feed: []
};

export function getLeaderboard() {
    return store.topWins;
}

export function getFeed() {
    return store.feed;
}

export function recordSpin(wallet, amount, isWin, type = 'spin') {
    const walletShort = wallet ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : 'Unknown';
    
    const feedItem = {
        id: Date.now().toString() + Math.random().toString(),
        wallet: walletShort,
        amount,
        isWin,
        type,
        timestamp: Date.now()
    };
    
    store.feed.unshift(feedItem);
    if (store.feed.length > 50) store.feed.pop();
    
    if (isWin) {
        const existingIndex = store.topWins.findIndex(w => w.wallet === walletShort);
        if (existingIndex !== -1) {
            if (amount > store.topWins[existingIndex].amount) {
                store.topWins[existingIndex].amount = amount;
            }
        } else {
            const lowestTopWin = store.topWins[store.topWins.length - 1];
            if (store.topWins.length < 5 || amount > (lowestTopWin ? lowestTopWin.amount : 0)) {
                store.topWins.push({ wallet: walletShort, amount });
            }
        }
        store.topWins.sort((a, b) => b.amount - a.amount);
        store.topWins = store.topWins.slice(0, 5);
    }
    
    return feedItem;
}
