const { Connection, Keypair, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const { getOrCreateAssociatedTokenAccount, mintTo } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

const LUDO_MINT = new PublicKey('Aazg6ZeGs4YEjumFFNis2DGDZs2dF7tNaiJXNDha7dGG');
const KEY_PATH = path.join(__dirname, '../frontend/ludo-mint-authority.json');

async function faucet() {
    const targetAddress = process.argv[2];
    if (!targetAddress) {
        console.error('Usage: node faucet.js <WALLET_ADDRESS>');
        process.exit(1);
    }

    console.log(`🚀 Starting $LUDO Faucet for: ${targetAddress}`);
    
    // 1. Setup Connection
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    
    // 2. Load Mint Authority
    if (!fs.existsSync(KEY_PATH)) {
        console.error('Error: Mint authority key not found!');
        process.exit(1);
    }
    const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(KEY_PATH, 'utf8')));
    const mintAuthority = Keypair.fromSecretKey(secretKey);
    
    // 3. Target Public Key
    const targetPubkey = new PublicKey(targetAddress);

    try {
        console.log('⏳ Getting or creating destination token account...');
        const tokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            mintAuthority,
            LUDO_MINT,
            targetPubkey
        );

        console.log(`✅ Destination ATA: ${tokenAccount.address.toBase58()}`);

        const amount = 100000;
        console.log(`⏳ Minting ${amount.toLocaleString()} $LUDO...`);
        
        await mintTo(
            connection,
            mintAuthority,
            LUDO_MINT,
            tokenAccount.address,
            mintAuthority,
            amount * 1_000_000 // 6 decimals
        );

        console.log(`\n🎉 SUCCESS! 100,000 $LUDO sent to ${targetAddress}`);
    } catch (err) {
        console.error('❌ Faucet failed:', err.message);
    }
}

faucet();
