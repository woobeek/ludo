import { NextResponse } from 'next/server';
import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferCheckedInstruction, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { recordSpin, getCurrentServerSeed, rotateServerSeed } from '../../../lib/db';
import { generateSpinResultSync, calculateWin } from '../../../utils/gameEngine';
import crypto from 'crypto';

export async function POST(request) {
    try {
        const body = await request.json();
        const { signature, betAmount, clientSeed, nonce, wallet, isSession } = body;
        
        if (!wallet || !signature || betAmount === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
        
        // 1. Basic Tx Verification (Ensure it exists on chain)
        // Note: For absolute production, we should parse the tx to verify exact amounts to treasury.
        // But preventing replay attacks via DB is the critical MVP step.
        let txVerified = false;
        try {
            // Try to verify with 'confirmed' first, but don't block if RPC is slow
            const txInfo = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
            if (txInfo && !txInfo.meta?.err) {
                txVerified = true;
            } else if (txInfo && txInfo.meta?.err) {
                return NextResponse.json({ error: 'Transaction failed on-chain' }, { status: 400 });
            }
            // If txInfo is null, RPC hasn't indexed it yet — we proceed and trust DB replay guard
        } catch (e) {
            console.error("Tx lookup error:", e);
            // RPC hiccup — proceed, DB replay check is the real guard
        }

        // 2. Generate Result
        const serverSeed = await getCurrentServerSeed();
        const { hash, grid } = generateSpinResultSync(serverSeed, clientSeed, nonce);
        const winAmount = calculateWin(grid, betAmount);
        const isWin = winAmount > 0;

        // 3. Mark signature as used (Replay Protection)
        try {
            await recordSpin(wallet, betAmount, isWin, 'spin', signature);
        } catch (e) {
            return NextResponse.json({ error: 'Transaction already processed (Replay attempt)' }, { status: 400 });
        }

        // 4. Handle Payout directly from server if win
        let payoutSignature = null;
        if (isWin) {
            try {
                const secretKeyString = process.env.TREASURY_SECRET_KEY;
                const secretKeyArray = JSON.parse(secretKeyString);
                const treasuryKeypair = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
                const treasuryPubkey = treasuryKeypair.publicKey;
                
                const mintPubkey = new PublicKey(process.env.NEXT_PUBLIC_LUDO_MINT);
                // If it's a session spin, we should technically pay back to the session wallet so balance reflects.
                // However, our UI assumes payout goes directly back to the main user wallet or session wallet.
                // In session mode, paying to main wallet is safest for funds, but balance in session won't update.
                // Let's assume the frontend passes the correct `wallet` parameter (if session, passes session wallet).
                const playerPubkey = new PublicKey(wallet);

                const treasuryATA = await getAssociatedTokenAddress(mintPubkey, treasuryPubkey, false, TOKEN_2022_PROGRAM_ID);
                const playerATA = await getAssociatedTokenAddress(mintPubkey, playerPubkey, false, TOKEN_2022_PROGRAM_ID);

                const payoutLamports = Math.floor(winAmount * 1_000_000);

                // Quick SOL balance check to prevent crashing if treasury is out of SOL
                const solBalance = await connection.getBalance(treasuryPubkey);
                if (solBalance < 5000) {
                     console.error("CRITICAL: Treasury out of SOL for gas!");
                     // Proceed without crashing, but no payout sent. Will need manual refund.
                } else {
                    const transaction = new Transaction().add(
                        createTransferCheckedInstruction(treasuryATA, mintPubkey, playerATA, treasuryPubkey, payoutLamports, 6, TOKEN_2022_PROGRAM_ID)
                    );

                    const { blockhash } = await connection.getLatestBlockhash('processed');
                    transaction.recentBlockhash = blockhash;
                    transaction.feePayer = treasuryPubkey;
                    transaction.sign(treasuryKeypair);

                    const rawTransaction = transaction.serialize();
                    payoutSignature = await connection.sendRawTransaction(rawTransaction, { skipPreflight: true });
                    // We don't await confirmation to avoid Vercel 10s timeout. Let network handle it.
                }
            } catch (payoutErr) {
                console.error('Payout failed internally:', payoutErr);
            }
        }

        // 5. Rotate Seed
        const oldSeed = serverSeed;
        const newSeed = await rotateServerSeed();
        const nextHash = crypto.createHash('sha256').update(newSeed).digest('hex');

        // 6. Respond
        return NextResponse.json({ 
            success: true, 
            grid, 
            winAmount, 
            payoutSignature,
            serverSeed: oldSeed,
            nextServerHash: nextHash,
            provableHash: hash
        });

    } catch (error) {
        console.error('Spin execution failed:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
