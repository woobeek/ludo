'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createTransferCheckedInstruction, createBurnCheckedInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

const LUDO_MINT = new PublicKey(process.env.NEXT_PUBLIC_LUDO_MINT);
const TREASURY_WALLET = new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET);
const DEV_WALLET = new PublicKey(process.env.NEXT_PUBLIC_DEV_WALLET);

const SESSION_FEE_RESERVE = 0.003 * LAMPORTS_PER_SOL;
const SESSION_STORAGE_KEY = 'ludo_session_wallet_secret';

export function useSessionWallet() {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();

    const sessionKeypairRef = useRef(null);
    const [sessionActive, setSessionActive] = useState(false);
    const [sessionBalance, setSessionBalance] = useState(0);
    const [isStartingSession, setIsStartingSession] = useState(false);
    const [isEndingSession, setIsEndingSession] = useState(false);
    const [sessionError, setSessionError] = useState(null);

    // RESTORE SESSION ON LOAD (The "Black Hole" Fix)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedSecret = localStorage.getItem(SESSION_STORAGE_KEY);
            if (storedSecret && !sessionKeypairRef.current) {
                try {
                    const secretArray = JSON.parse(storedSecret);
                    const restoredKeypair = Keypair.fromSecretKey(new Uint8Array(secretArray));
                    sessionKeypairRef.current = restoredKeypair;
                    setSessionActive(true);
                    refreshSessionBalance();
                    console.log('🔄 Session restored from local storage to prevent fund loss.');
                } catch (e) {
                    console.error('Failed to restore session keypair', e);
                    localStorage.removeItem(SESSION_STORAGE_KEY);
                }
            }
        }
    }, [connection]); // run once but depends on connection

    const refreshSessionBalance = useCallback(async () => {
        if (!sessionKeypairRef.current || !connection) return;
        try {
            const sessionATA = await getAssociatedTokenAddress(LUDO_MINT, sessionKeypairRef.current.publicKey);
            const account = await getAccount(connection, sessionATA);
            setSessionBalance(Number(account.amount) / 1_000_000);
        } catch {
            setSessionBalance(0);
        }
    }, [connection]);

    const startSession = useCallback(async (depositAmount) => {
        if (!publicKey || !connection) return false;
        setIsStartingSession(true);
        setSessionError(null);

        try {
            const sessionKeypair = Keypair.generate();
            console.log('🔑 Session keypair generated:', sessionKeypair.publicKey.toBase58());

            const playerATA = await getAssociatedTokenAddress(LUDO_MINT, publicKey);
            const sessionATA = await getAssociatedTokenAddress(LUDO_MINT, sessionKeypair.publicKey);

            const depositLamports = Math.floor(depositAmount * 1_000_000);
            const transaction = new Transaction();

            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: sessionKeypair.publicKey,
                    lamports: SESSION_FEE_RESERVE,
                }),
                createAssociatedTokenAccountInstruction(
                    publicKey,           
                    sessionATA,          
                    sessionKeypair.publicKey, 
                    LUDO_MINT
                ),
                createTransferCheckedInstruction(
                    playerATA,
                    LUDO_MINT,
                    sessionATA,
                    publicKey,
                    depositLamports,
                    6
                )
            );

            // Using 'processed' to avoid long Vercel timeouts in the browser. 
            // We await full confirmed later, but we send it quickly.
            const { blockhash } = await connection.getLatestBlockhash('processed');
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;

            const signature = await sendTransaction(transaction, connection);
            await connection.confirmTransaction({ signature, ...await connection.getLatestBlockhash() }, 'processed');

            sessionKeypairRef.current = sessionKeypair;
            
            // SECURITY: Persist to raw localStorage. It's a throwaway wallet, so risks are low,
            // but it prevents losing the deposit completely if they refresh the tab.
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(Array.from(sessionKeypair.secretKey)));

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

    const sendSessionSpinTransaction = useCallback(async (betAmount) => {
        if (!sessionKeypairRef.current || !sessionActive) {
            throw new Error('No active session');
        }

        const sessionKeypair = sessionKeypairRef.current;
        const sessionPubkey = sessionKeypair.publicKey;

        const sessionATA = await getAssociatedTokenAddress(LUDO_MINT, sessionPubkey);
        const treasuryATA = await getAssociatedTokenAddress(LUDO_MINT, TREASURY_WALLET);
        const devATA = await getAssociatedTokenAddress(LUDO_MINT, DEV_WALLET);

        const totalLamports = Math.floor(betAmount * 1_000_000);
        const burnAmount = Math.floor(totalLamports * 0.03);  
        let devAmount = Math.floor(totalLamports * 0.05);   
        let refAmount = 0;
        let refATA = null;

        const referrerStr = typeof window !== 'undefined' ? localStorage.getItem('ludo_referrer') : null;
        if (referrerStr && referrerStr !== publicKey?.toBase58()) {
            try {
                const refPubkey = new PublicKey(referrerStr);
                refATA = await getAssociatedTokenAddress(LUDO_MINT, refPubkey);
                refAmount = Math.floor(totalLamports * 0.005);
                devAmount -= refAmount;
            } catch (e) {
                console.warn('Invalid referrer', e);
            }
        }

        const treasuryAmount = totalLamports - devAmount - burnAmount - refAmount;

        const transaction = new Transaction().add(
            createTransferCheckedInstruction(sessionATA, LUDO_MINT, treasuryATA, sessionPubkey, treasuryAmount, 6),
            createTransferCheckedInstruction(sessionATA, LUDO_MINT, devATA, sessionPubkey, devAmount, 6),
            createBurnCheckedInstruction(sessionATA, LUDO_MINT, sessionPubkey, burnAmount, 6)
        );

        if (refAmount > 0 && refATA) {
            transaction.add(
                createTransferCheckedInstruction(sessionATA, LUDO_MINT, refATA, sessionPubkey, refAmount, 6)
            );
        }

        const { blockhash } = await connection.getLatestBlockhash('processed');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = sessionPubkey; 

        transaction.sign(sessionKeypair);
        const rawTransaction = transaction.serialize();
        const signature = await connection.sendRawTransaction(rawTransaction, {
            skipPreflight: false,
            preflightCommitment: 'processed',
        });

        // Use processed commitment to beat serverless 10s limits 
        await connection.confirmTransaction(signature, 'processed');
        setSessionBalance(prev => prev - betAmount);

        return signature;
    }, [sessionActive, publicKey, connection]);

    const endSession = useCallback(async () => {
        if (!sessionKeypairRef.current || !publicKey || !connection) return;
        setIsEndingSession(true);

        try {
            const sessionKeypair = sessionKeypairRef.current;
            const sessionPubkey = sessionKeypair.publicKey;
            const sessionATA = await getAssociatedTokenAddress(LUDO_MINT, sessionPubkey);
            const playerATA = await getAssociatedTokenAddress(LUDO_MINT, publicKey);

            let actualBalance;
            try {
                const account = await getAccount(connection, sessionATA);
                actualBalance = Number(account.amount);
            } catch {
                actualBalance = 0;
            }

            if (actualBalance > 0) {
                const transaction = new Transaction().add(
                    createTransferCheckedInstruction(sessionATA, LUDO_MINT, playerATA, sessionPubkey, actualBalance, 6)
                );

                const { blockhash } = await connection.getLatestBlockhash('processed');
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = sessionPubkey;
                transaction.sign(sessionKeypair);

                const rawTransaction = transaction.serialize();
                const signature = await connection.sendRawTransaction(rawTransaction);
                await connection.confirmTransaction(signature, 'processed');

                console.log(`✅ Session ended! Returned ${actualBalance / 1_000_000} $LUDO to player.`);
            }

            sessionKeypairRef.current = null;
            setSessionActive(false);
            setSessionBalance(0);
            localStorage.removeItem(SESSION_STORAGE_KEY);
        } catch (error) {
            console.error('❌ Failed to end session:', error);
            setSessionError(error.message);
        } finally {
            setIsEndingSession(false);
        }
    }, [publicKey, connection]);

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
