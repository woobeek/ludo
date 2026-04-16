import { Connection, PublicKey, Keypair, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferCheckedInstruction, createAssociatedTokenAccountInstruction, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL, 'confirmed');
const secretKeyString = process.env.TREASURY_SECRET_KEY;

if (!secretKeyString) {
    console.error("ERROR: TREASURY_SECRET_KEY not found in .env.local");
    process.exit(1);
}

const secretKey = new Uint8Array(JSON.parse(secretKeyString));
const treasuryKeypair = Keypair.fromSecretKey(secretKey);

const LUDO_MINT = new PublicKey('9fApW86ot5BfxTmKUz28BjD2vX3UyTVQgNDPVRAXpump');
const DEV_WALLET = new PublicKey('HPHFaAUdftepbXikCyEX45vjSSpE1HHGehp3FTFAvYnV');

async function check() {
    try {
        console.log("Treasury Public Key:", treasuryKeypair.publicKey.toBase58());
        
        const mintInfo = await connection.getAccountInfo(LUDO_MINT);
        console.log("LUDO Mint Owner:", mintInfo.owner.toBase58());
        
        // 1. Check SOL Balance
        const solBalance = await connection.getBalance(treasuryKeypair.publicKey);
        console.log("Treasury SOL Balance:", solBalance / 1e9, "SOL");

        // 2. Check LUDO ATAs
        const treasuryAta = await getAssociatedTokenAddress(LUDO_MINT, treasuryKeypair.publicKey, false, TOKEN_2022_PROGRAM_ID);
        const devAta = await getAssociatedTokenAddress(LUDO_MINT, DEV_WALLET, false, TOKEN_2022_PROGRAM_ID);

        const treasuryInfo = await connection.getAccountInfo(treasuryAta);
        const devInfo = await connection.getAccountInfo(devAta);

        console.log("Treasury LUDO ATA exists:", !!treasuryInfo);
        console.log("Dev LUDO ATA exists:", !!devInfo);

        if (!treasuryInfo || !devInfo) {
            console.log("\nFixing missing ATAs...");
            const transaction = new Transaction().add(
                ComputeBudgetProgram.setComputeUnitLimit({ units: 300000 }),
                ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000000 })
            );

            if (!treasuryInfo) {
                console.log("- Adding instruction to create Treasury ATA");
                transaction.add(createAssociatedTokenAccountInstruction(treasuryKeypair.publicKey, treasuryAta, treasuryKeypair.publicKey, LUDO_MINT, TOKEN_2022_PROGRAM_ID));
            }
            if (!devInfo) {
                console.log("- Adding instruction to create Dev ATA");
                transaction.add(createAssociatedTokenAccountInstruction(treasuryKeypair.publicKey, devAta, DEV_WALLET, LUDO_MINT, TOKEN_2022_PROGRAM_ID));
            }

            const latestBlockhash = await connection.getLatestBlockhash('confirmed');
            transaction.recentBlockhash = latestBlockhash.blockhash;
            transaction.feePayer = treasuryKeypair.publicKey;
            transaction.sign(treasuryKeypair);

            const txid = await connection.sendRawTransaction(transaction.serialize());
            console.log("Creation TX sent:", txid);
            await connection.confirmTransaction(txid, 'confirmed');
            console.log("✅ ATAs created successfully!");
        } else {
            console.log("✅ All required ATAs already exist.");
        }

    } catch (e) {
        console.error("Script Error:", e);
    }
}

check();
