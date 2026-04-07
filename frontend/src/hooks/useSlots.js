'use client';
import { useState, useCallback, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { generateSeed, generateSpinResult, generateHash } from '../utils/provablyFair';
import { PublicKey, Transaction } from '@solana/web3.js';
import { createTransferCheckedInstruction, createBurnCheckedInstruction, getAssociatedTokenAddress } from '@solana/spl-token';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

const LUDO_MINT = new PublicKey('Aazg6ZeGs4YEjumFFNis2DGDZs2dF7tNaiJXNDha7dGG');
const TREASURY_WALLET = new PublicKey('EZM3xXLxtCGD4uBXRjd1cre5h79isyJKxptKorKvPuyU');

const SYMBOLS = ['🪙', '🍒', '7️⃣', '💎', '🚀'];
const MULTIPLIERS = { '7️⃣': 20, '💎': 10, '🚀': 5, '🪙': 3, '🍒': 2 };

export function useSlots(reelRefs, winningLineRef, sessionWallet) {
    const { isConnected, balance, updateBalance, updateBurned, playSound, setStatusScreenHtml, setMascotState } = useGame();
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();
    
    const [betAmount, setBetAmount] = useState(100);
    const [autoSpinsCount, setAutoSpinsCount] = useState(0);
    const [isSpinning, setIsSpinning] = useState(false);
    const [autoSpinActive, setAutoSpinActive] = useState(false);

    // Provably Fair & Adaptive Logic
    const [serverSeed, setServerSeed] = useState('');
    const [clientSeed, setClientSeed] = useState('');
    const [nonce, setNonce] = useState(1);
    const [sessionSpins, setSessionSpins] = useState(0);
    const [currentServerHash, setCurrentServerHash] = useState('');

    const DEV_WALLET = new PublicKey('HPHFaAUdftepbXikCyEX45vjSSpE1HHGehp3FTFAvYnV');

    useEffect(() => {
        const sSeed = generateSeed();
        setServerSeed(sSeed);
        setClientSeed(generateSeed());
        generateHash(sSeed).then(setCurrentServerHash);
    }, []);

    const getRandomSymbol = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

    const showMascotMessage = (msg, duration = 3000) => {
        setMascotState(prev => ({ ...prev, message: msg, showMessage: true }));
        setTimeout(() => {
            setMascotState(prev => ({ ...prev, showMessage: false }));
        }, duration);
    };

    const animateReel = (reel, finalSymbol, duration) => {
        return new Promise(resolve => {
            const spinSpeed = 40; 
            reel.classList.add('blur');
            
            const spinInterval = setInterval(() => {
                reel.textContent = getRandomSymbol();
                playSound('spin');
            }, spinSpeed);

            setTimeout(() => {
                clearInterval(spinInterval);
                reel.classList.remove('blur');
                reel.textContent = finalSymbol;
                resolve();
            }, duration);
        });
    };

    const performSpin = async () => {
        if (!isConnected || !publicKey) return false;

        // --- Determine active balance source ---
        const useSession = sessionWallet?.sessionActive;
        const activeBalance = useSession ? sessionWallet.sessionBalance : balance;

        if (betAmount > activeBalance) {
            setStatusScreenHtml({ text: 'INSUFFICIENT $LUDO BALANCE', type: 'lose' });
            playSound('lose');
            setAutoSpinActive(false);
            return false;
        }

        setIsSpinning(true);
        if (winningLineRef.current) winningLineRef.current.classList.remove('active');
        
        try {
            if (useSession) {
                // ✅ SESSION MODE: No wallet popup — signed by ephemeral keypair
                setStatusScreenHtml({ text: 'SPINNING (SESSION)...', type: 'normal' });
                await sessionWallet.sendSessionSpinTransaction(betAmount);
            } else {
                // 🔓 DIRECT MODE: Regular wallet approval (fallback)
                setStatusScreenHtml({ text: 'WAITING FOR APPROVAL...', type: 'normal' });

                const fromATA = await getAssociatedTokenAddress(LUDO_MINT, publicKey);
                const treasuryATA = await getAssociatedTokenAddress(LUDO_MINT, TREASURY_WALLET);
                const devATA = await getAssociatedTokenAddress(LUDO_MINT, DEV_WALLET);
                
                // TRUE DEFLATIONARY SPLIT: 92% Treasury | 5% Dev | 3% Burned forever 🔥
                const totalLamports = Math.floor(betAmount * 1_000_000);
                const burnAmount = Math.floor(totalLamports * 0.03);  // 3% BURNED
                
                let devAmount = Math.floor(totalLamports * 0.05);   // 5% to Dev
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
                    // 92% → Treasury (holds winnings pool)
                    createTransferCheckedInstruction(
                        fromATA, LUDO_MINT, treasuryATA, publicKey, treasuryAmount, 6
                    ),
                    // 4.5% or 5% → Dev wallet (revenue)
                    createTransferCheckedInstruction(
                        fromATA, LUDO_MINT, devATA, publicKey, devAmount, 6
                    ),
                    // 3% → BURNED FOREVER (reduces $LUDO total supply on-chain)
                    createBurnCheckedInstruction(
                        fromATA, LUDO_MINT, publicKey, burnAmount, 6
                    )
                );

                if (refAmount > 0 && refATA) {
                    transaction.add(
                        createTransferCheckedInstruction(
                            fromATA, LUDO_MINT, refATA, publicKey, refAmount, 6
                        )
                    );
                }

                const signature = await sendTransaction(transaction, connection);
                setStatusScreenHtml({ text: 'CONFIRMING ON-CHAIN...', type: 'normal' });
                
                const latestBlockhash = await connection.getLatestBlockhash();
                await connection.confirmTransaction({
                    signature,
                    ...latestBlockhash
                }, 'confirmed');
            }
            
            updateBalance(-betAmount);
            setSessionSpins(prev => prev + 1);
        } catch (error) {
            console.error('❌ Transaction failed:', error);
            setStatusScreenHtml({ text: 'TRANSACTION REJECTED OR FAILED', type: 'lose' });
            setIsSpinning(false);
            setAutoSpinActive(false);
            return false;
        }

        // ---- ADAPTIVE RTP (BAIT & HARVEST) ----
        let difficultyMultiplier = 1.0;
        if (betAmount > 1000) difficultyMultiplier = 0.95;
        if (betAmount > 10000) difficultyMultiplier = 0.90;
        if (sessionSpins > 50) difficultyMultiplier *= 0.98;
        
        const spinPhrases = [
            "Let's gooo!", "Fingers crossed!", "Big win incoming...", "Spinning...", "Come on, jackpot!"
        ];
        
        setMascotState(prev => ({ ...prev, isSpinning: true }));
        showMascotMessage(spinPhrases[Math.floor(Math.random() * spinPhrases.length)], 2000);

        const outcome = await generateSpinResult(serverSeed, clientSeed, nonce);
        let winningSymbol = outcome.winningSymbol;
        const hash = outcome.hash;

        if (winningSymbol && Math.random() > difficultyMultiplier) {
            console.log(`🎰 Adaptive RTP: Winning spin adjusted to loss (Diff: ${difficultyMultiplier})`);
            winningSymbol = null; 
        }

        setNonce(prev => prev + 1);

        let finalSymbols = [];
        
        if (winningSymbol) {
            finalSymbols = [winningSymbol, winningSymbol, winningSymbol];
        } else {
            const loseSym1 = SYMBOLS[parseInt(hash.slice(8, 10), 16) % SYMBOLS.length];
            const loseSym2 = SYMBOLS[parseInt(hash.slice(10, 12), 16) % SYMBOLS.length];
            let loseSym3 = SYMBOLS[parseInt(hash.slice(12, 14), 16) % SYMBOLS.length];
            
            if (loseSym1 === loseSym2 && loseSym2 === loseSym3) {
                loseSym3 = SYMBOLS[(SYMBOLS.indexOf(loseSym3) + 1) % SYMBOLS.length];
            }
            finalSymbols = [loseSym1, loseSym2, loseSym3];
        }

        const p1 = animateReel(reelRefs[0].current, finalSymbols[0], 1000);
        const p2 = animateReel(reelRefs[1].current, finalSymbols[1], 1500);
        const p3 = animateReel(reelRefs[2].current, finalSymbols[2], 2000);

        await Promise.all([p1, p2, p3]);

        setMascotState(prev => ({ ...prev, isSpinning: false }));
        
        if (finalSymbols[0] === finalSymbols[1] && finalSymbols[1] === finalSymbols[2]) {
            const multiplier = MULTIPLIERS[finalSymbols[0]];
            const winAmount = betAmount * multiplier;
            updateBalance(winAmount);
            if (winningLineRef.current) winningLineRef.current.classList.add('active');
            playSound('win');
            setStatusScreenHtml({ text: `PAYOUT SECURED: +${winAmount.toLocaleString()} $LUDO (${multiplier}X)`, type: 'win' });
            
            const winPhrases = ["JACKPOT! We did it!", "Unbelievable!", "That's what I'm talking about!", "Easy money!", "Winner winner!"];
            
            setMascotState(prev => ({ ...prev, mode: 'win' }));
            setTimeout(() => setMascotState(prev => ({ ...prev, mode: 'idle' })), 500);
            showMascotMessage(winPhrases[Math.floor(Math.random() * winPhrases.length)], 4000);
            
            // Record Win to DB
            fetch('/api/spin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: publicKey.toBase58(), amount: winAmount, isWin: true, type: 'spin' })
            }).catch(e => console.error("Failed to record spin", e));
        } else {
            updateBurned(betAmount);
            playSound('lose');
            setStatusScreenHtml({ text: `🔥 ${betAmount.toLocaleString()} $LUDO BURNED FOREVER`, type: 'burn' });
            
            const losePhrases = ["Ouch! Try again!", "Next time for sure.", "Almost had it...", "Don't give up!", "Bad luck..."];
            
            setMascotState(prev => ({ ...prev, mode: 'lose' }));
            setTimeout(() => setMascotState(prev => ({ ...prev, mode: 'idle' })), 500);
            showMascotMessage(losePhrases[Math.floor(Math.random() * losePhrases.length)], 3000);
            
            // Record Burn to DB
            fetch('/api/spin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: publicKey.toBase58(), amount: betAmount, isWin: false, type: 'burn' })
            }).catch(e => console.error("Failed to record burn", e));
        }

        setIsSpinning(false);
        return true;
    };

    return {
        betAmount, setBetAmount,
        autoSpinsCount, setAutoSpinsCount,
        isSpinning,
        autoSpinActive, setAutoSpinActive,
        performSpin,
        provablyFairState: { clientSeed, nonce, currentServerHash }
    };
}
