/**
 * $LUDO Casino Revenue Bot
 * 
 * Sends periodic revenue reports to your Telegram chat.
 * Reports include: Dev wallet $LUDO balance, total burned, treasury size.
 * 
 * Setup:
 * 1. Create a bot via @BotFather in Telegram → get BOT_TOKEN
 * 2. Send any message to your bot → get your CHAT_ID via getUpdates
 * 3. Fill in the config below
 * 4. npm install node-telegram-bot-api @solana/web3.js @solana/spl-token
 * 5. node revenue-bot.js
 *    OR schedule via: node -e "require('./revenue-bot').startScheduled()"
 */

const TelegramBot = require('node-telegram-bot-api');
const { Connection, PublicKey } = require('@solana/web3.js');

// ===================== CONFIG =====================
const CONFIG = {
    // Используем данные из твоего .env.local
    BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '8624467032:AAEOAHwLDtjZyXLRsM1T29TiyS9P3EsTPRw',
    CHAT_ID: process.env.TELEGRAM_CHAT_ID || '439161837',

    REPORT_INTERVAL_MINUTES: 30,
    RPC_URL: process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',

    // $LUDO on-chain addresses
    LUDO_MINT: process.env.NEXT_PUBLIC_LUDO_MINT || 'Aazg6ZeGs4YEjumFFNis2DGDZs2dF7tNaiJXNDha7dGG',
    DEV_WALLET: process.env.NEXT_PUBLIC_DEV_WALLET || 'HPHFaAUdftepbXikCyEX45vjSSpE1HHGehp3FTFAvYnV',
    TREASURY_WALLET: process.env.NEXT_PUBLIC_TREASURY_WALLET || 'G5J8U7ZewA9HT4HigYdToxXYv8GeAKgR9sNxGHdtT4qs',
    INITIAL_SUPPLY: 1_000_000_000, // Стандарт для pump.fun часто 1 млрд
};
// ==================================================

const connection = new Connection(CONFIG.RPC_URL, 'confirmed');
const bot = new TelegramBot(CONFIG.BOT_TOKEN, { polling: false });

// Track previous values to show deltas
let previousState = null;

async function getTokenBalance(walletAddress) {
    try {
        const wallet = new PublicKey(walletAddress);
        const mint = new PublicKey(CONFIG.LUDO_MINT);
        const accounts = await connection.getParsedTokenAccountsByOwner(wallet, { mint });
        if (accounts.value.length === 0) return 0;
        return accounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
    } catch (err) {
        console.error(`Error fetching balance for ${walletAddress}:`, err.message);
        return null;
    }
}

async function getTotalBurned() {
    try {
        const supply = await connection.getTokenSupply(new PublicKey(CONFIG.LUDO_MINT));
        const current = supply.value.uiAmount;
        return {
            currentSupply: current,
            burned: Math.max(0, CONFIG.INITIAL_SUPPLY - current),
        };
    } catch (err) {
        console.error('Error fetching supply:', err.message);
        return { currentSupply: null, burned: null };
    }
}

function formatNum(n) {
    if (n === null || n === undefined) return '—';
    return parseFloat(n.toFixed(2)).toLocaleString('en-US');
}

function delta(now, prev, field) {
    if (prev === null || now === null || prev[field] === null) return '';
    const diff = now - prev[field];
    if (Math.abs(diff) < 0.01) return '';
    const sign = diff > 0 ? '▲' : '▼';
    return ` ${sign}${formatNum(Math.abs(diff))}`;
}

async function buildReport() {
    const [devBalance, treasuryBalance, supplyInfo] = await Promise.all([
        getTokenBalance(CONFIG.DEV_WALLET),
        getTokenBalance(CONFIG.TREASURY_WALLET),
        getTotalBurned(),
    ]);

    const now = {
        devBalance,
        treasuryBalance,
        burned: supplyInfo.burned,
        currentSupply: supplyInfo.currentSupply,
    };

    const prev = previousState;
    const timestamp = new Date().toLocaleString('ru-RU', {
        timeZone: 'Asia/Novosibirsk',
        hour12: false,
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit',
    });

    const report = `
🎰 *$LUDO CASINO REVENUE REPORT*
🕐 ${timestamp}

💰 *Dev Wallet Balance*
\`${formatNum(devBalance)} $LUDO\`${prev ? delta(devBalance, prev, 'devBalance') : ' _(first report)_'}

🏦 *Treasury Balance*
\`${formatNum(treasuryBalance)} $LUDO\`${prev ? delta(treasuryBalance, prev, 'treasuryBalance') : ''}

🔥 *Total Burned (from ${formatNum(CONFIG.INITIAL_SUPPLY)})*
\`${formatNum(supplyInfo.burned)} $LUDO\`${prev ? delta(supplyInfo.burned, prev, 'burned') : ''}
_Current supply: ${formatNum(supplyInfo.currentSupply)}_

📊 *Burn Rate*: ${supplyInfo.currentSupply ? ((supplyInfo.burned / CONFIG.INITIAL_SUPPLY) * 100).toFixed(3) : '—'}% deflated
    `.trim();

    previousState = now;
    return report;
}

async function sendReport() {
    try {
        const report = await buildReport();
        await bot.sendMessage(CONFIG.CHAT_ID, report, { parse_mode: 'Markdown' });
        console.log(`[${new Date().toISOString()}] Report sent ✅`);
    } catch (err) {
        console.error('Failed to send report:', err.message);
    }
}

async function startScheduled() {
    console.log(`🤖 $LUDO Revenue Bot started`);
    console.log(`📡 Reporting every ${CONFIG.REPORT_INTERVAL_MINUTES} minutes`);

    // Send immediately on startup
    await sendReport();

    // Then on schedule
    setInterval(sendReport, CONFIG.REPORT_INTERVAL_MINUTES * 60 * 1000);
}

// Support manual trigger: node revenue-bot.js --now
if (process.argv.includes('--now')) {
    sendReport().then(() => process.exit(0));
} else {
    startScheduled();
}

// Listen for /report command in Telegram for on-demand reports
const pollBot = new TelegramBot(CONFIG.BOT_TOKEN, { polling: true });
console.log('💬 Telegram bot listening for /report command...');

pollBot.onText(/\/report/, async (msg) => {
    if (String(msg.chat.id) !== String(CONFIG.CHAT_ID)) return; // Only respond to owner
    await pollBot.sendMessage(CONFIG.CHAT_ID, '⏳ Fetching live data...');
    const report = await buildReport();
    await pollBot.sendMessage(CONFIG.CHAT_ID, report, { parse_mode: 'Markdown' });
});

pollBot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    await pollBot.sendMessage(chatId,
        `👋 *$LUDO Casino Revenue Bot*\n\nYour Chat ID: \`${chatId}\`\n\nCommands:\n/report — get instant report\n\nI'll auto-report every ${CONFIG.REPORT_INTERVAL_MINUTES} min.`,
        { parse_mode: 'Markdown' }
    );
});

module.exports = { sendReport, startScheduled };
