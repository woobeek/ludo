const { Connection, Keypair, clusterApiUrl, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { createMint, getOrCreateAssociatedTokenAccount, mintTo } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('🪙 $LUDO TOKEN FACTORY (Robust Version)');
    console.log('='.repeat(50));

    // 1. Connect to Solana Devnet
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    console.log('✅ Connected to Solana Devnet');

    // 2. Load or Generate Keypair
    let mintAuthority;
    const keyPath = path.join(__dirname, 'ludo-mint-authority.json');
    
    if (fs.existsSync(keyPath)) {
        const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keyPath, 'utf8')));
        mintAuthority = Keypair.fromSecretKey(secretKey);
        console.log(`✅ Loaded existing Mint Authority: ${mintAuthority.publicKey.toBase58()}`);
    } else {
        mintAuthority = Keypair.generate();
        fs.writeFileSync(keyPath, JSON.stringify(Array.from(mintAuthority.secretKey)));
        console.log(`✅ Generated new Mint Authority: ${mintAuthority.publicKey.toBase58()}`);
    }

    // 3. Check Balance & Request Airdrop if needed
    let balance = await connection.getBalance(mintAuthority.publicKey);
    console.log(`Current Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    if (balance < 0.05 * LAMPORTS_PER_SOL) {
        console.log('⏳ Requesting a small airdrop (0.5 SOL)...');
        try {
            const airdropSig = await connection.requestAirdrop(mintAuthority.publicKey, 0.5 * LAMPORTS_PER_SOL);
            await connection.confirmTransaction(airdropSig, 'confirmed');
            console.log('✅ Received 0.5 SOL!');
        } catch (e) {
            console.log('⚠️  Airdrop failed (Faucet busy).');
            console.log(`\n!!! ВНИМАНИЕ !!!`);
            console.log(`Чтобы продолжить, отправь немного тестовых SOL (Devnet) на этот адрес:`);
            console.log(`${mintAuthority.publicKey.toBase58()}`);
            console.log(`Затем запусти скрипт снова.\n`);
            return;
        }
    }

    // 4. Create the $LUDO SPL Token (Mint)
    console.log('⏳ Creating $LUDO Token on Solana blockchain...');
    const mint = await createMint(
        connection,
        mintAuthority,
        mintAuthority.publicKey,
        mintAuthority.publicKey,
        6
    );
    console.log(`\n🎉🎉🎉 $LUDO TOKEN CREATED! 🎉🎉🎉`);
    console.log(`Token Address: ${mint.toBase58()}`);

    // 5. Create token account
    console.log('\n⏳ Creating token account...');
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        mintAuthority,
        mint,
        mintAuthority.publicKey
    );
    console.log(`✅ Token Account: ${tokenAccount.address.toBase58()}`);

    // 6. Mint tokens
    const TOTAL_SUPPLY = 1_000_000;
    console.log(`⏳ Minting ${TOTAL_SUPPLY.toLocaleString()} $LUDO tokens...`);
    await mintTo(
        connection,
        mintAuthority,
        mint,
        tokenAccount.address,
        mintAuthority,
        TOTAL_SUPPLY * 1_000_000
    );

    console.log(`\n🏆 SUCCESS! $LUDO TOKEN IS LIVE!`);
    console.log(`Token Mint: ${mint.toBase58()}`);
    
    // Save token info
    const tokenInfo = {
        mint: mint.toBase58(),
        authority: mintAuthority.publicKey.toBase58(),
        tokenAccount: tokenAccount.address.toBase58(),
        decimals: 6,
        totalSupply: TOTAL_SUPPLY,
        network: 'devnet',
        createdAt: new Date().toISOString()
    };
    fs.writeFileSync(path.join(__dirname, 'ludo-token-info.json'), JSON.stringify(tokenInfo, null, 2));
    console.log('✅ Token info saved to ludo-token-info.json');
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
