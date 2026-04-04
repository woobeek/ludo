import { useState, useCallback, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { generateSeed, generateSpinResult, generateHash } from '../utils/provablyFair';

const SYMBOLS = ['🪙', '🍒', '7️⃣', '💎', '🚀'];
const MULTIPLIERS = { '7️⃣': 20, '💎': 10, '🚀': 5, '🪙': 3, '🍒': 2 };

export function useSlots(reelRefs, winningLineRef) {
    const { isConnected, balance, updateBalance, updateBurned, playSound, setStatusScreenHtml, setMascotState } = useGame();
    
    const [betAmount, setBetAmount] = useState(100);
    const [autoSpinsCount, setAutoSpinsCount] = useState(0);
    const [isSpinning, setIsSpinning] = useState(false);
    const [autoSpinActive, setAutoSpinActive] = useState(false);

    // Provably Fair State
    const [serverSeed, setServerSeed] = useState('');
    const [clientSeed, setClientSeed] = useState('');
    const [nonce, setNonce] = useState(1);
    const [currentServerHash, setCurrentServerHash] = useState('');

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
        if (!isConnected) return false;
        if (betAmount > balance) {
            setStatusScreenHtml({ text: 'INSUFFICIENT $LUDO BALANCE', type: 'lose' });
            playSound('lose');
            setAutoSpinActive(false);
            return false;
        }

        setIsSpinning(true);
        if (winningLineRef.current) winningLineRef.current.classList.remove('active');
        updateBalance(-betAmount);
        setStatusScreenHtml({ text: 'EXECUTING TRANSACTION...', type: 'normal' });
        
        const spinPhrases = [
            "Let's gooo!", "Fingers crossed!", "Big win incoming...", "Spinning...", "Come on, jackpot!"
        ];
        
        setMascotState(prev => ({ ...prev, isSpinning: true }));
        showMascotMessage(spinPhrases[Math.floor(Math.random() * spinPhrases.length)], 2000);

        const { hash, winningSymbol } = await generateSpinResult(serverSeed, clientSeed, nonce);
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
        } else {
            updateBurned(betAmount);
            playSound('lose');
            setStatusScreenHtml({ text: `🔥 ${betAmount.toLocaleString()} $LUDO BURNED FOREVER`, type: 'burn' });
            
            const losePhrases = ["Ouch! Try again!", "Next time for sure.", "Almost had it...", "Don't give up!", "Bad luck..."];
            
            setMascotState(prev => ({ ...prev, mode: 'lose' }));
            setTimeout(() => setMascotState(prev => ({ ...prev, mode: 'idle' })), 500);
            showMascotMessage(losePhrases[Math.floor(Math.random() * losePhrases.length)], 3000);
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
