import { Connection, PublicKey, Keypair, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferCheckedInstruction, createAssociatedTokenAccountInstruction, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=68b46c12-4c46-456c-849e-352c0ab32857', 'confirmed');
const secretKey = new Uint8Array([30,189,115,131,242,254,253,160,242,215,5,98,117,135,15,205,183,29,171,237,78,46,211,61,209,97,173,246,186,91,84,134,223,248,254,162,183,17,15,231,243,92,200,129,29,157,153,107,80,232,46,196,19,247,229,191,17,77,222,136,52,148,193,190]);
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
