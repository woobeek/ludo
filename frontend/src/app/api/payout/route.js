import { NextResponse } from 'next/server';
import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferCheckedInstruction } from '@solana/spl-token';

export async function POST(request) {
    try {
        const body = await request.json();
        const { wallet, amount } = body;

        if (!wallet || !amount || amount <= 0) {
            return NextResponse.json({ error: 'Invalid payout request' }, { status: 400 });
        }

        const secretKeyString = process.env.TREASURY_SECRET_KEY;
        if (!secretKeyString) {
            console.error('CRITICAL: TREASURY_SECRET_KEY missing in server environment.');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        // Parse the secret key array
        const secretKeyArray = JSON.parse(secretKeyString);
        const treasuryKeypair = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
        const treasuryPubkey = treasuryKeypair.publicKey;

        const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
        const mintPubkey = new PublicKey(process.env.NEXT_PUBLIC_LUDO_MINT);
        const playerPubkey = new PublicKey(wallet);

        const treasuryATA = await getAssociatedTokenAddress(mintPubkey, treasuryPubkey);
        const playerATA = await getAssociatedTokenAddress(mintPubkey, playerPubkey);

        const payoutLamports = Math.floor(amount * 1_000_000);

        const transaction = new Transaction().add(
            createTransferCheckedInstruction(
                treasuryATA,
                mintPubkey,
                playerATA,
                treasuryPubkey,
                payoutLamports,
                6
            )
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = treasuryPubkey;

        // The critical secure step: Server signs the transaction with the hidden key
        transaction.sign(treasuryKeypair);

        const rawTransaction = transaction.serialize();
        const signature = await connection.sendRawTransaction(rawTransaction);
        
        await connection.confirmTransaction(signature, 'confirmed');

        return NextResponse.json({ success: true, signature });

    } catch (error) {
        console.error('Payout failed:', error);
        return NextResponse.json({ error: 'Failed to process payout' }, { status: 500 });
    }
}
