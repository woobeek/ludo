'use client';
import { useState, useCallback, useRef } from 'react';
import { Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createTransferCheckedInstruction, createBurnCheckedInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

const LUDO_MINT = new PublicKey('Aazg6ZeGs4YEjumFFNis2DGDZs2dF7tNaiJXNDha7dGG');
const TREASURY_WALLET = new PublicKey('EZM3xXLxtCGD4uBXRjd1cre5h79isyJKxptKorKvPuyU');
const DEV_WALLET = new PublicKey('HPHFaAUdftepbXikCyEX45vjSSpE1HHGehp3FTFAvYnV');

// Minimum SOL required in session wallet for transaction fees (~0.002 SOL covers ~20 txns)
const SESSION_FEE_RESERVE = 0.003 * LAMPORTS_PER_SOL;

/**
 * useSessionWallet — Ephemeral Keypair Session Pattern
 * 
 * Generates a temporary in-memory keypair. Player makes ONE transaction
 * to fund it with $LUDO + a tiny SOL for fees. All spins are then signed
 * by the session keypair silently, with no wallet popups.
 * 
 * On "End Session", the remaining $LUDO is returned to the player's wallet.
 */
export function useSessionWallet() {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();

    // Session state
    const sessionKeypairRef = useRef(null); // Ephemeral keypair (in-memory only)
    const [sessionActive, setSessionActive] = useState(false);
    const [sessionBalance, setSessionBalance] = useState(0);
    const [isStartingSession, setIsStartingSession] = useState(false);
    const [isEndingSession, setIsEndingSession] = useState(false);
    const [sessionError, setSessionError] = useState(null);

    /**
     * Start a session:
     * 1. Generate ephemeral keypair
     * 2. Send one tx: deposit LUDO + small SOL for fees
     */
    const startSession = useCallback(async (depositAmount) => {
        if (!publicKey || !connection) return false;
        setIsStartingSession(true);
        setSessionError(null);

        try {
            // Generate a fresh ephemeral keypair (lives in memory only, never persisted)
            const sessionKeypair = Keypair.generate();
            console.log('🔑 Session keypair generated:', sessionKeypair.publicKey.toBase58());

            const playerATA = await getAssociatedTokenAddress(LUDO_MINT, publicKey);
            const sessionATA = await getAssociatedTokenAddress(LUDO_MINT, sessionKeypair.publicKey);

            const depositLamports = Math.floor(depositAmount * 1_000_000);
            const transaction = new Transaction();

            // Step 1: Fund session wallet with SOL for transaction fees
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: sessionKeypair.publicKey,
                    lamports: SESSION_FEE_RESERVE,
                })
            );

            // Step 2: Create associated token account for session wallet
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    publicKey,           // payer
                    sessionATA,          // associated token account
                    sessionKeypair.publicKey, // owner
                    LUDO_MINT
                )
            );

            // Step 3: Deposit $LUDO from player to session wallet
            transaction.add(
                createTransferCheckedInstruction(
                    playerATA,
                    LUDO_MINT,
                    sessionATA,
                    publicKey,
                    depositLamports,
                    6
                )
            );

            // ONE wallet approval for the whole session setup
            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;

            const signature = await sendTransaction(transaction, connection);
            await connection.confirmTransaction(signature, 'confirmed');

            // Store keypair in ref (in-memory only, lost on page refresh by design)
            sessionKeypairRef.current = sessionKeypair;
            setSessionBalance(depositAmount);
            setSessionActive(true);

            console.log(`✅ Session started! Deposited ${depositAmount} $LUDO into session wallet.`);
            return true;
        } catch (error) {
            console.error('❌ Failed to start session:', error);
            setSessionError(error.message || 'Failed to start session');
            return false;
        } finally {
            setIsStartingSession(false);
        }
    }, [publicKey, connection, sendTransaction]);

    /**
     * Sign and send a spin transaction using the session keypair — NO wallet popup!
     * The session wallet pays for everything from its $LUDO balance.
     */
    const sendSessionSpinTransaction = useCallback(async (betAmount) => {
        if (!sessionKeypairRef.current || !sessionActive) {
            throw new Error('No active session');
        }

        const sessionKeypair = sessionKeypairRef.current;
        const sessionPubkey = sessionKeypair.publicKey;

        const sessionATA = await getAssociatedTokenAddress(LUDO_MINT, sessionPubkey);
        const treasuryATA = await getAssociatedTokenAddress(LUDO_MINT, TREASURY_WALLET);
        const devATA = await getAssociatedTokenAddress(LUDO_MINT, DEV_WALLET);
        const playerATA = await getAssociatedTokenAddress(LUDO_MINT, publicKey);

        const totalLamports = Math.floor(betAmount * 1_000_000);
        const burnAmount = Math.floor(totalLamports * 0.03);  // 3% BURNED
        
        let devAmount = Math.floor(totalLamports * 0.05);   // Default 5% to Dev
        let refAmount = 0;
        let refATA = null;

        const referrerStr = typeof window !== 'undefined' ? localStorage.getItem('ludo_referrer') : null;
        if (referrerStr && referrerStr !== publicKey.toBase58()) {
            try {
                const refPubkey = new PublicKey(referrerStr);
                refATA = await getAssociatedTokenAddress(LUDO_MINT, refPubkey);
                refAmount = Math.floor(totalLamports * 0.005); // 0.5% to Referrer
                devAmount -= refAmount; // Dev keeps 4.5%
            } catch (e) {
                console.warn('Invalid referrer', e);
            }
        }

        const treasuryAmount = totalLamports - devAmount - burnAmount - refAmount; // 92% to Treasury

        const transaction = new Transaction().add(
            // 92% → Treasury
            createTransferCheckedInstruction(
                sessionATA, LUDO_MINT, treasuryATA, sessionPubkey, treasuryAmount, 6
            ),
            // Dev (4.5% or 5%)
            createTransferCheckedInstruction(
                sessionATA, LUDO_MINT, devATA, sessionPubkey, devAmount, 6
            ),
            // 3% → BURNED FOREVER 🔥
            createBurnCheckedInstruction(
                sessionATA, LUDO_MINT, sessionPubkey, burnAmount, 6
            )
        );

        if (refAmount > 0 && refATA) {
            transaction.add(
                createTransferCheckedInstruction(
                    sessionATA, LUDO_MINT, refATA, sessionPubkey, refAmount, 6
                )
            );
        }

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = sessionPubkey; // Session wallet pays its own fees

        // ✅ Signed by session keypair — NO wallet popup!
        transaction.sign(sessionKeypair);
        const rawTransaction = transaction.serialize();
        const signature = await connection.sendRawTransaction(rawTransaction, {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
        });

        await connection.confirmTransaction(signature, 'confirmed');

        // Update local session balance tracker
        setSessionBalance(prev => prev - betAmount);

        return signature;
    }, [sessionActive, publicKey, connection]);

    /**
     * End session: sweep remaining $LUDO back to player's wallet.
     * Remaining SOL (fees) stays in session wallet (negligible dust).
     */
    const endSession = useCallback(async () => {
        if (!sessionKeypairRef.current || !publicKey || !connection) return;
        setIsEndingSession(true);

        try {
            const sessionKeypair = sessionKeypairRef.current;
            const sessionPubkey = sessionKeypair.publicKey;
            const sessionATA = await getAssociatedTokenAddress(LUDO_MINT, sessionPubkey);
            const playerATA = await getAssociatedTokenAddress(LUDO_MINT, publicKey);

            // Fetch actual on-chain balance to sweep
            let actualBalance;
            try {
                const account = await getAccount(connection, sessionATA);
                actualBalance = Number(account.amount);
            } catch {
                actualBalance = 0;
            }

            if (actualBalance > 0) {
                const transaction = new Transaction().add(
                    createTransferCheckedInstruction(
                        sessionATA,
                        LUDO_MINT,
                        playerATA,
                        sessionPubkey,
                        actualBalance,
                        6
                    )
                );

                const { blockhash } = await connection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = sessionPubkey;
                transaction.sign(sessionKeypair);

                const rawTransaction = transaction.serialize();
                const signature = await connection.sendRawTransaction(rawTransaction);
                await connection.confirmTransaction(signature, 'confirmed');

                console.log(`✅ Session ended! Returned ${actualBalance / 1_000_000} $LUDO to player.`);
            }

            // Clear session state
            sessionKeypairRef.current = null;
            setSessionActive(false);
            setSessionBalance(0);
        } catch (error) {
            console.error('❌ Failed to end session:', error);
            setSessionError(error.message);
        } finally {
            setIsEndingSession(false);
        }
    }, [publicKey, connection]);

    const refreshSessionBalance = useCallback(async () => {
        if (!sessionKeypairRef.current) return;
        try {
            const sessionATA = await getAssociatedTokenAddress(LUDO_MINT, sessionKeypairRef.current.publicKey);
            const account = await getAccount(connection, sessionATA);
            setSessionBalance(Number(account.amount) / 1_000_000);
        } catch {
            setSessionBalance(0);
        }
    }, [connection]);

    return {
        sessionActive,
        sessionBalance,
        isStartingSession,
        isEndingSession,
        sessionError,
        startSession,
        endSession,
        sendSessionSpinTransaction,
        refreshSessionBalance,
        sessionAddress: sessionKeypairRef.current?.publicKey?.toBase58() ?? null,
    };
}
