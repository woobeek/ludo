'use client';
import { useState, useCallback, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { generateSeed, SYMBOLS } from '../utils/provablyFair';
import { PublicKey, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { createTransferCheckedInstruction, createBurnCheckedInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

const LUDO_MINT = new PublicKey(process.env.NEXT_PUBLIC_LUDO_MINT);
const TREASURY_WALLET = new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET);
const DEV_WALLET = new PublicKey(process.env.NEXT_PUBLIC_DEV_WALLET);

export function useSlots(reelRefs, sessionWallet) {
    const { isConnected, balance, updateBalance, updateBurned, playSound, setStatusScreenHtml, setMascotState } = useGame();
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();
    
    const [betAmount, setBetAmount] = useState(100);
    const [autoSpinsCount, setAutoSpinsCount] = useState(0);
    const [isSpinning, setIsSpinning] = useState(false);
    const [autoSpinActive, setAutoSpinActive] = useState(false);

    const [grid, setGrid] = useState([
        ['🍒', '🍒', '🍒'],
        ['🪙', '🪙', '🪙'],
        ['7️⃣', '7️⃣', '7️⃣'],
        ['💎', '💎', '💎'],
        ['🚀', '🚀', '🚀']
    ]);
    const [winningPositions, setWinningPositions] = useState([]);
    const [winningLines, setWinningLines] = useState([]);

    const [serverSeed, setServerSeed] = useState('');
    const [clientSeed, setClientSeed] = useState('');
    const [nonce, setNonce] = useState(1);
    const [currentServerHash, setCurrentServerHash] = useState('');

    useEffect(() => {
        fetch('/api/fairness')
            .then(res => res.json())
            .then(data => {
                setCurrentServerHash(data.hash);
            });
        setClientSeed(generateSeed());
    }, []);

    const showMascotMessage = (msg, duration = 3000) => {
        setMascotState(prev => ({ ...prev, message: msg, showMessage: true }));
        setTimeout(() => setMascotState(prev => ({ ...prev, showMessage: false })), duration);
    };

    const animateReel = (reelRef, finalSymbols, duration) => {
        return new Promise(resolve => {
            const spinSpeed = 40; 
            const el = reelRef.current;
            if (!el) return resolve();

            el.classList.add('blur');
            
            const spinInterval = setInterval(() => {
                Array.from(el.children).forEach(child => {
                    const symEl = child.querySelector('.symbol');
                    if(symEl) symEl.textContent = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
                });
                playSound('spin');
            }, spinSpeed);

            setTimeout(() => {
                clearInterval(spinInterval);
                el.classList.remove('blur');
                Array.from(el.children).forEach((child, idx) => {
                    const symEl = child.querySelector('.symbol');
                    if(symEl) symEl.textContent = finalSymbols[idx];
                });
                resolve();
            }, duration);
        });
    };

    const performSpin = async () => {
        if (!isConnected || !publicKey) return { success: false, winAmount: 0 };

        const useSession = sessionWallet?.sessionActive;
        const activeBalance = useSession ? sessionWallet.sessionBalance : balance;
        const activeWalletAddress = useSession ? sessionWallet.sessionAddress : publicKey.toBase58();

        if (betAmount > activeBalance) {
            setStatusScreenHtml({ text: 'INSUFFICIENT $LUDO BALANCE', type: 'lose' });
            playSound('lose');
            setAutoSpinActive(false);
            return { success: false, winAmount: 0 };
        }

        setIsSpinning(true);
        setWinningPositions([]);
        setWinningLines([]);
        
        let txSignature = null;

        try {
            if (useSession) {
                setStatusScreenHtml({ text: 'SPINNING (SESSION)...', type: 'normal' });
                txSignature = await sessionWallet.sendSessionSpinTransaction(betAmount);
            } else {
                setStatusScreenHtml({ text: 'WAITING FOR APPROVAL...', type: 'normal' });

                const transaction = new Transaction().add(
                    ComputeBudgetProgram.setComputeUnitLimit({ units: 300000 }),
                    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000000 })
                );
                const ensureAta = async (mint, owner, payer) => {
                    const ata = await getAssociatedTokenAddress(mint, owner, false, TOKEN_2022_PROGRAM_ID);
                    const accountInfo = await connection.getAccountInfo(ata);
                    if (!accountInfo) {
                         transaction.add(createAssociatedTokenAccountInstruction(payer, ata, owner, mint, TOKEN_2022_PROGRAM_ID));
                    }
                    return ata;
                };

                const fromATA = await getAssociatedTokenAddress(LUDO_MINT, publicKey, false, TOKEN_2022_PROGRAM_ID);
                const treasuryATA = await ensureAta(LUDO_MINT, TREASURY_WALLET, publicKey);
                const devATA = await ensureAta(LUDO_MINT, DEV_WALLET, publicKey);
                
                const totalLamports = Math.floor(betAmount * 1_000_000);
                const burnAmount = Math.floor(totalLamports * 0.03);  
                let devAmount = Math.floor(totalLamports * 0.05);   
                let refAmount = 0;
                let refATA = null;

                const referrerStr = typeof window !== 'undefined' ? localStorage.getItem('ludo_referrer') : null;
                if (referrerStr && referrerStr !== publicKey.toBase58()) {
                    try {
                        const refPubkey = new PublicKey(referrerStr);
                        refATA = await ensureAta(LUDO_MINT, refPubkey, publicKey);
                        refAmount = Math.floor(totalLamports * 0.005);
                        devAmount -= refAmount; 
                    } catch (e) { console.warn('Invalid referrer', e); }
                }

                const treasuryAmount = totalLamports - devAmount - burnAmount - refAmount;

                transaction.add(
                    createTransferCheckedInstruction(fromATA, LUDO_MINT, treasuryATA, publicKey, treasuryAmount, 6, TOKEN_2022_PROGRAM_ID),
                    createTransferCheckedInstruction(fromATA, LUDO_MINT, devATA, publicKey, devAmount, 6, TOKEN_2022_PROGRAM_ID),
                    createBurnCheckedInstruction(fromATA, LUDO_MINT, publicKey, burnAmount, 6, TOKEN_2022_PROGRAM_ID)
                );

                if (refAmount > 0 && refATA) {
                    transaction.add(createTransferCheckedInstruction(fromATA, LUDO_MINT, refATA, publicKey, refAmount, 6, TOKEN_2022_PROGRAM_ID));
                }

                const latestBlockhash = await connection.getLatestBlockhash('processed');
                
                txSignature = await sendTransaction(transaction, connection, { maxRetries: 10 });
                setStatusScreenHtml({ text: 'CONFIRMING ON-CHAIN...', type: 'normal' });
                
                await connection.confirmTransaction({ 
                    signature: txSignature, 
                    blockhash: latestBlockhash.blockhash,
                    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
                }, 'processed');
            }

            if (!useSession) updateBalance(-betAmount);

        } catch (error) {
            console.error('SPIN ERROR DETAIL:', error);
            const errorMsg = error?.message || 'TRANSACTION REJECTED';
            setStatusScreenHtml({ text: `ERROR: ${errorMsg.slice(0, 40)}...`, type: 'lose' });
            setIsSpinning(false);
            setAutoSpinActive(false);
            return { success: false, winAmount: 0 };
        }

        const spinPhrases = ["Let's gooo!", "Fingers crossed!", "Big win incoming...", "Spinning...", "Come on, jackpot!"];
        setMascotState(prev => ({ ...prev, isSpinning: true }));
        showMascotMessage(spinPhrases[Math.floor(Math.random() * spinPhrases.length)], 2000);

        // DELIVER AUTHORITY TO BACKEND: Send the signature and seed data for secure resolution
        let spinData = null;
        try {
            const spinRes = await fetch('/api/spin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    signature: txSignature,
                    betAmount,
                    clientSeed, 
                    nonce,
                    wallet: activeWalletAddress,
                    isSession: useSession
                })
            });
            spinData = await spinRes.json();
            if(!spinData.success) {
                setStatusScreenHtml({ text: 'SERVER REJECTED SPIN (REPLAY OR INVALID)', type: 'lose' });
                setIsSpinning(false);
                setAutoSpinActive(false);
                return { success: false, winAmount: 0 };
            }
        } catch (e) {
            console.error(e);
            setStatusScreenHtml({ text: 'SERVER CONNECTION LOST', type: 'lose' });
            setIsSpinning(false);
            setAutoSpinActive(false);
            return { success: false, winAmount: 0 };
        }

        const { grid: newGrid, winAmount: totalWinAmount, serverSeed: returnedServerSeed, nextServerHash } = spinData;

        setServerSeed(returnedServerSeed);
        setCurrentServerHash(nextServerHash);
        setNonce(prev => prev + 1);

        const p1 = animateReel(reelRefs[0], newGrid[0], 1000);
        const p2 = animateReel(reelRefs[1], newGrid[1], 1200);
        const p3 = animateReel(reelRefs[2], newGrid[2], 1400);
        const p4 = animateReel(reelRefs[3], newGrid[3], 1600);
        const p5 = animateReel(reelRefs[4], newGrid[4], 1800);

        await Promise.all([p1, p2, p3, p4, p5]);
        setGrid(newGrid);

        // Since the server doesn't send winningPositions (to save bandwidth), we highlight visually if winAmount > 0.
        // A robust MVP would have the server return winningPositions too, but for now we just use a big visual popup.
        // We will just leave winningPositions empty, or flash the whole board if winAmount > 0.
        
        setMascotState(prev => ({ ...prev, isSpinning: false }));
        
        if (totalWinAmount > 0) {
            if (!useSession) updateBalance(totalWinAmount);
            playSound('win');
            setStatusScreenHtml({ text: `PAYOUT SECURED ON-CHAIN: +${totalWinAmount.toLocaleString()} $LUDO`, type: 'win' });
            
            setMascotState(prev => ({ ...prev, mode: 'win' }));
            setTimeout(() => setMascotState(prev => ({ ...prev, mode: 'idle' })), 500);
            showMascotMessage(["JACKPOT! We did it!", "Unbelievable!", "Easy money!"][Math.floor(Math.random() * 3)], 4000);

        } else {
            updateBurned(betAmount);
            playSound('lose');
            setStatusScreenHtml({ text: `🔥 ${betAmount.toLocaleString()} $LUDO BURNED FOREVER`, type: 'burn' });
            
            setMascotState(prev => ({ ...prev, mode: 'lose' }));
            setTimeout(() => setMascotState(prev => ({ ...prev, mode: 'idle' })), 500);
            showMascotMessage(["Ouch! Try again!", "Next time for sure.", "Bad luck..."][Math.floor(Math.random() * 3)], 3000);
        }

        setIsSpinning(false);
        return { success: true, winAmount: totalWinAmount };
    };

    return {
        betAmount, setBetAmount,
        autoSpinsCount, setAutoSpinsCount,
        isSpinning,
        autoSpinActive, setAutoSpinActive,
        performSpin,
        provablyFairState: { clientSeed, nonce, currentServerHash },
        grid, winningPositions, winningLines
    };
}
