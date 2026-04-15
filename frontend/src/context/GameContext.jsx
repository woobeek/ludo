'use client';
import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

const LUDO_MINT = process.env.NEXT_PUBLIC_LUDO_MINT;
const DEV_WALLET_ADDRESS = process.env.NEXT_PUBLIC_DEV_WALLET;

const GameContext = createContext(null);

export function GameProvider({ children }) {
    // ---- AUDIO LAYER ----
    const audioCtxRef = useRef(null);

    const initAudio = useCallback(async () => {
        if (typeof window === 'undefined') return;
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtxRef.current.state === 'suspended') {
            await audioCtxRef.current.resume();
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
    const { connection } = useConnection();
    const { connected, publicKey, disconnect } = useWallet();
    const isConnected = connected;
    const walletAddress = publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : '';
    
    const [balance, setBalance] = useState(0);
    const [totalBurned, setTotalBurned] = useState(0);
    const [devProfit, setDevProfit] = useState(0);
    const [showWalletModal, setShowWalletModal] = useState(false);
    const [mockTx, setMockTx] = useState({ text: 'Wallet D7fE... just burned 500 $LUDO! 🔥', color: 'var(--text-muted)' });
    const [statusScreenHtml, setStatusScreenHtml] = useState({ 
        text: 'WAITING FOR CONNECTION...', 
        type: 'normal' 
    });
    
    const [mascotState, setMascotState] = useState({ mode: 'idle', message: '', isSpinning: false, showMessage: false });

    // ---- BLOCKCHAIN LAYER ----
    const fetchBalance = useCallback(async () => {
        if (!publicKey || !connection) return;
        
        try {
            // 1. Fetch User $LUDO Balance
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                mint: new PublicKey(LUDO_MINT)
            });

            if (tokenAccounts.value.length > 0) {
                const amount = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
                setBalance(amount);
            } else {
                setBalance(0);
            }

            // 2. Fetch Real "Burned" Stats (Initial Supply 1,000,000 - Total Supply)
            const supply = await connection.getTokenSupply(new PublicKey(LUDO_MINT));
            const currentSupply = supply.value.uiAmount;
            const burnedCount = Math.max(0, 1000000 - currentSupply);
            // 3. Fetch Developer Profit (Balance of Dev Wallet)
            const devPublicKey = new PublicKey(DEV_WALLET_ADDRESS);
            const devTokenAccounts = await connection.getParsedTokenAccountsByOwner(devPublicKey, {
                mint: new PublicKey(LUDO_MINT)
            });

            if (devTokenAccounts.value.length > 0) {
                const amount = devTokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
                setDevProfit(amount);
            }

            setTotalBurned(burnedCount);
        } catch (error) {
            console.error('❌ Error fetching blockchain data:', error);
        }
    }, [publicKey, connection]);

    useEffect(() => {
        if (isConnected) {
            fetchBalance();
            setStatusScreenHtml({ text: 'READY TO SPIN', type: 'normal' });
        }
    }, [isConnected, fetchBalance]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const ref = params.get('ref');
            if (ref) {
                try {
                    // Validate basic length
                    if (ref.length > 30) {
                        localStorage.setItem('ludo_referrer', ref);
                        console.log('Referrer tracking active:', ref);
                    }
                } catch (e) {}
            }
        }
    }, []);

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

    const [feedQueue, setFeedQueue] = useState([]);

    useEffect(() => {
        // Fetch real feed from DB initially and every 10s
        const fetchFeed = async () => {
            try {
                const res = await fetch('/api/feed');
                const data = await res.json();
                if (data && data.length > 0) {
                    setFeedQueue(data);
                }
            } catch (e) {
                console.error("Failed to fetch live feed", e);
            }
        };
        fetchFeed();
        const fetchInterval = setInterval(fetchFeed, 10000);
        return () => clearInterval(fetchInterval);
    }, []);

    useEffect(() => {
        if (feedQueue.length === 0) return;
        
        let displayIndex = 0;
        const interval = setInterval(() => {
            const currentItem = feedQueue[displayIndex];
            
            if (currentItem.isWin) {
                setMockTx({ text: `Wallet ${currentItem.wallet} won ${currentItem.amount.toLocaleString()} $LUDO! 💰`, color: 'var(--gold)' });
            } else {
                setMockTx({ text: `Wallet ${currentItem.wallet} burned ${currentItem.amount.toLocaleString()} $LUDO! 🔥`, color: 'var(--text-muted)' });
            }
            
            displayIndex = (displayIndex + 1) % Math.min(feedQueue.length, 10); // Rotate top 10 recent
        }, 4000);
        
        return () => clearInterval(interval);
    }, [feedQueue]);

    const value = {
        initAudio,
        playSound,
        isConnected,
        walletAddress,
        balance,
        totalBurned,
        devProfit,
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
