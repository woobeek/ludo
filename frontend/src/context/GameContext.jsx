'use client';
import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

const GameContext = createContext(null);

export function GameProvider({ children }) {
    // ---- AUDIO LAYER ----
    const audioCtxRef = useRef(null);

    const initAudio = useCallback(() => {
        if (!audioCtxRef.current && typeof window !== 'undefined') {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
    }, []);

    const playSound = useCallback((type) => {
        const audioCtx = audioCtxRef.current;
        if (!audioCtx) return;

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        const now = audioCtx.currentTime;
        if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
            gainNode.gain.setValueAtTime(0.3, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'spin') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.1);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.linearRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'win') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(554, now + 0.1);
            osc.frequency.setValueAtTime(659, now + 0.2);
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.linearRampToValueAtTime(0.01, now + 0.6);
            osc.start(now);
            osc.stop(now + 0.6);
        } else if (type === 'lose') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.4);
            gainNode.gain.setValueAtTime(0.3, now);
            gainNode.gain.linearRampToValueAtTime(0.01, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        }
    }, []);

    // ---- STATE LAYER ----
    const { connected, publicKey, disconnect } = useWallet();
    const isConnected = connected;
    const walletAddress = publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : '';
    
    const [balance, setBalance] = useState(5000);
    const [totalBurned, setTotalBurned] = useState(1240500);
    const [showWalletModal, setShowWalletModal] = useState(false);
    const [mockTx, setMockTx] = useState({ text: 'Wallet D7fE... just burned 500 $LUDO! 🔥', color: 'var(--text-muted)' });
    const [statusScreenHtml, setStatusScreenHtml] = useState({ 
        text: 'WAITING FOR CONNECTION...', 
        type: 'normal' 
    });
    
    const [mascotState, setMascotState] = useState({ mode: 'idle', message: '', isSpinning: false, showMessage: false });

    const updateBalance = useCallback((amount) => setBalance(prev => prev + amount), []);
    const updateBurned = useCallback((amount) => setTotalBurned(prev => prev + amount), []);

    const toggleConnect = useCallback(() => {
        playSound('click');
        if (!isConnected) {
            setShowWalletModal(true);
        } else {
            disconnect();
            setStatusScreenHtml({ text: 'WAITING FOR CONNECTION...', type: 'normal' });
        }
    }, [isConnected, playSound, disconnect]);

    // We remove the hardcoded connectPhantom function as WalletModal handles connection directly.

    useEffect(() => {
        const interval = setInterval(() => {
            const chars = 'abcdef0123456789';
            let addr = '';
            for (let i = 0; i < 4; i++) addr += chars[Math.floor(Math.random() * chars.length)];
            const isBurn = Math.random() > 0.3;
            const amount = [50, 100, 500, 1000][Math.floor(Math.random() * 4)];

            if (isBurn) {
                setMockTx({ text: `Wallet ${addr}... just burned ${amount} $LUDO! 🔥`, color: 'var(--text-muted)' });
            } else {
                setMockTx({ text: `Wallet ${addr}... won ${amount * 5} $LUDO! 💰`, color: 'var(--gold)' });
            }
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    const value = {
        initAudio,
        playSound,
        isConnected,
        walletAddress,
        balance,
        totalBurned,
        updateBalance,
        updateBurned,
        showWalletModal,
        setShowWalletModal,
        toggleConnect,
        mockTx,
        statusScreenHtml,
        setStatusScreenHtml,
        mascotState,
        setMascotState
    };

    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
    return useContext(GameContext);
}
