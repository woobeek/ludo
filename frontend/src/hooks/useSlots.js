'use client';
import { useState, useCallback, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { generateSeed, generateSpinResult, generateHash, SYMBOLS } from '../utils/provablyFair';
import { PublicKey, Transaction } from '@solana/web3.js';
import { createTransferCheckedInstruction, createBurnCheckedInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

// All addresses from env — easy to update after pump.fun launch
const LUDO_MINT = new PublicKey(process.env.NEXT_PUBLIC_LUDO_MINT);
const TREASURY_WALLET = new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET);
const DEV_WALLET = new PublicKey(process.env.NEXT_PUBLIC_DEV_WALLET);

const PAYLINES = [
    [1, 1, 1, 1, 1], // Middle
    [0, 0, 0, 0, 0], // Top
    [2, 2, 2, 2, 2], // Bottom
    [0, 1, 2, 1, 0], // V
    [2, 1, 0, 1, 2], // Inverted V
    [1, 0, 0, 0, 1], // Zigzag 1
    [1, 2, 2, 2, 1], // Zigzag 2
    [0, 0, 1, 2, 2], // Step Down
    [2, 2, 1, 0, 0], // Step Up
    [1, 2, 1, 0, 1]  // W-shape
];

const PAYTABLE = {
    '7️⃣': { 3: 20, 4: 70, 5: 300 },
    '💎': { 3: 15, 4: 50, 5: 150 },
    '🚀': { 3: 10, 4: 30, 5: 100 },
    '🪙': { 3: 6, 4: 15, 5: 50 },
    '🍒': { 3: 2.5, 4: 8, 5: 25 },
    '👑': { 3: 50, 4: 150, 5: 600 }, // Wild matching itself
    '⭐': { 3: 5, 4: 20, 5: 75 }    // Scatter pays multiplier on TOTAL bet
};

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
        // Fetch the initial server hash from our secure server
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

        if (betAmount > activeBalance) {
            setStatusScreenHtml({ text: 'INSUFFICIENT $LUDO BALANCE', type: 'lose' });
            playSound('lose');
            setAutoSpinActive(false);
            return { success: false, winAmount: 0 };
        }

        setIsSpinning(true);
        setWinningPositions([]);
        setWinningLines([]);
        
        try {
            if (useSession) {
                setStatusScreenHtml({ text: 'SPINNING (SESSION)...', type: 'normal' });
                await sessionWallet.sendSessionSpinTransaction(betAmount);
            } else {
                setStatusScreenHtml({ text: 'WAITING FOR APPROVAL...', type: 'normal' });

                const transaction = new Transaction();

                // Helper to ensure ATA exists
                const ensureAta = async (mint, owner, payer) => {
                    const ata = await getAssociatedTokenAddress(mint, owner);
                    try {
                        const account = await connection.getAccountInfo(ata);
                        if (!account) {
                            transaction.add(createAssociatedTokenAccountInstruction(payer, ata, owner, mint));
                        }
                    } catch (e) {}
                    return ata;
                };

                const fromATA = await getAssociatedTokenAddress(LUDO_MINT, publicKey);
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
                    createTransferCheckedInstruction(fromATA, LUDO_MINT, treasuryATA, publicKey, treasuryAmount, 6),
                    createTransferCheckedInstruction(fromATA, LUDO_MINT, devATA, publicKey, devAmount, 6),
                    createBurnCheckedInstruction(fromATA, LUDO_MINT, publicKey, burnAmount, 6)
                );

                if (refAmount > 0 && refATA) {
                    transaction.add(createTransferCheckedInstruction(fromATA, LUDO_MINT, refATA, publicKey, refAmount, 6));
                }

                const signature = await sendTransaction(transaction, connection);
                setStatusScreenHtml({ text: 'CONFIRMING ON-CHAIN...', type: 'normal' });
                
                const latestBlockhash = await connection.getLatestBlockhash();
                await connection.confirmTransaction({ signature, ...latestBlockhash }, 'confirmed');
            }
            updateBalance(-betAmount);

        } catch (error) {
            setStatusScreenHtml({ text: 'TRANSACTION REJECTED OR FAILED', type: 'lose' });
            setIsSpinning(false);
            setAutoSpinActive(false);
            return { success: false, winAmount: 0 };
        }

        const spinPhrases = ["Let's gooo!", "Fingers crossed!", "Big win incoming...", "Spinning...", "Come on, jackpot!"];
        setMascotState(prev => ({ ...prev, isSpinning: true }));
        showMascotMessage(spinPhrases[Math.floor(Math.random() * spinPhrases.length)], 2000);

        // Fetch spin result hash and old seed from server
        const fairnessRes = await fetch('/api/fairness', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientSeed, nonce })
        });
        const fairnessData = await fairnessRes.json();
        
        // Use the hash from server to generate grid
        const outcome = await generateSpinResult(fairnessData.serverSeed, clientSeed, nonce);
        const newGrid = outcome.grid;

        // Update for next spin
        setServerSeed(fairnessData.serverSeed);
        setCurrentServerHash(fairnessData.nextServerHash);
        setNonce(prev => prev + 1);

        const p1 = animateReel(reelRefs[0], newGrid[0], 1000);
        const p2 = animateReel(reelRefs[1], newGrid[1], 1200);
        const p3 = animateReel(reelRefs[2], newGrid[2], 1400);
        const p4 = animateReel(reelRefs[3], newGrid[3], 1600);
        const p5 = animateReel(reelRefs[4], newGrid[4], 1800);

        await Promise.all([p1, p2, p3, p4, p5]);
        setGrid(newGrid);

        // Win Calculation Logic
        let totalWinAmount = 0;
        let newWinningPositions = [];
        let newWinningLines = [];

        // 1. Scatters pay anywhere based on total bet
        let scatterCount = 0;
        let scatterPositions = [];
        newGrid.forEach((col, colIdx) => {
            col.forEach((sym, rowIdx) => {
                if (sym === '⭐') {
                    scatterCount++;
                    scatterPositions.push({ col: colIdx, row: rowIdx });
                }
            });
        });

        if (scatterCount >= 3) {
            const scatterMulti = PAYTABLE['⭐'][scatterCount] || 0;
            if (scatterMulti > 0) {
                totalWinAmount += betAmount * scatterMulti;
                newWinningPositions.push(...scatterPositions);
                newWinningLines.push(scatterPositions.sort((a,b) => a.col - b.col));
            }
        }

        // 2. Paylines Left-to-Right
        const betPerLine = betAmount / PAYLINES.length;

        PAYLINES.forEach((line) => {
            let matchCount = 1;
            let firstSymbol = newGrid[0][line[0]];
            if (firstSymbol === '⭐') return; 
            
            let actualSymbol = firstSymbol;
            let linePositions = [{ col: 0, row: line[0] }];

            for (let i = 1; i < 5; i++) {
                const sym = newGrid[i][line[i]];
                if (sym === '⭐') break; 

                if (actualSymbol === '👑' && sym !== '👑') actualSymbol = sym; // Wild absorbs

                if (sym === actualSymbol || sym === '👑') {
                    matchCount++;
                    linePositions.push({ col: i, row: line[i] });
                } else {
                    break;
                }
            }

            if (matchCount >= 3) {
                const win = betPerLine * (PAYTABLE[actualSymbol]?.[matchCount] || 0);
                if (win > 0) {
                    totalWinAmount += win;
                    newWinningPositions.push(...linePositions);
                    newWinningLines.push([...linePositions]);
                }
            }
        });

        const uniqueWinningPositions = newWinningPositions.filter((v, i, a) => a.findIndex(t => (t.col === v.col && t.row === v.row)) === i);
        setWinningPositions(uniqueWinningPositions);
        setWinningLines(newWinningLines);
        
        totalWinAmount = Math.floor(totalWinAmount);
        setMascotState(prev => ({ ...prev, isSpinning: false }));
        
        if (totalWinAmount > 0) {
            updateBalance(totalWinAmount);
            playSound('win');
            setStatusScreenHtml({ text: `REQUESTING PAYOUT: +${totalWinAmount.toLocaleString()} $LUDO`, type: 'win' });
            
            setMascotState(prev => ({ ...prev, mode: 'win' }));
            setTimeout(() => setMascotState(prev => ({ ...prev, mode: 'idle' })), 500);
            showMascotMessage(["JACKPOT! We did it!", "Unbelievable!", "Easy money!"][Math.floor(Math.random() * 3)], 4000);
            
            // 1. Record win in feed (stats only)
            fetch('/api/spin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: publicKey.toBase58(), amount: totalWinAmount, isWin: true, type: 'spin' })
            }).catch(e => console.error(e));

            // 2. Request actual on-chain token transfer from Treasury
            try {
                const payoutRes = await fetch('/api/payout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ wallet: publicKey.toBase58(), amount: totalWinAmount })
                });
                
                const payoutData = await payoutRes.json();
                if (payoutData.success) {
                    setStatusScreenHtml({ text: `PAYOUT SECURED ON-CHAIN`, type: 'win' });
                } else {
                    console.error("Payout error", payoutData);
                    setStatusScreenHtml({ text: `PAYOUT PENDING (CONTACT SUPPORT)`, type: 'normal' });
                }
            } catch (err) {
                console.error("Payout request failed:", err);
            }

        } else {
            updateBurned(betAmount);
            playSound('lose');
            setStatusScreenHtml({ text: `🔥 ${betAmount.toLocaleString()} $LUDO BURNED FOREVER`, type: 'burn' });
            
            setMascotState(prev => ({ ...prev, mode: 'lose' }));
            setTimeout(() => setMascotState(prev => ({ ...prev, mode: 'idle' })), 500);
            showMascotMessage(["Ouch! Try again!", "Next time for sure.", "Bad luck..."][Math.floor(Math.random() * 3)], 3000);
            
            fetch('/api/spin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: publicKey.toBase58(), amount: betAmount, isWin: false, type: 'burn' })
            }).catch(e => console.error(e));
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
