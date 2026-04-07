'use client';
import { useRef, useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import { useSlots } from '../hooks/useSlots';
import { useSessionWallet } from '../hooks/useSessionWallet';
import { useWallet } from '@solana/wallet-adapter-react';
import Mascot from './Mascot';

const PRESET_DEPOSITS = [1000, 5000, 10000, 25000];

export default function CasinoBoard() {
    const { isConnected, statusScreenHtml, initAudio, playSound, devProfit } = useGame();
    const { publicKey } = useWallet();
    
    const isOwner = publicKey?.toBase58() === 'HPHFaAUdftepbXikCyEX45vjSSpE1HHGehp3FTFAvYnV';
    
    const reel1Ref = useRef(null);
    const reel2Ref = useRef(null);
    const reel3Ref = useRef(null);
    const winningLineRef = useRef(null);

    // Session wallet (ephemeral keypair — zero popups during play)
    const sessionWallet = useSessionWallet();
    const [depositInput, setDepositInput] = useState(5000);
    const [showDepositPanel, setShowDepositPanel] = useState(false);

    const {
        betAmount, setBetAmount,
        autoSpinsCount, setAutoSpinsCount,
        isSpinning,
        autoSpinActive, setAutoSpinActive,
        performSpin,
        provablyFairState
    } = useSlots([reel1Ref, reel2Ref, reel3Ref], winningLineRef, sessionWallet);

    useEffect(() => {
        const handleInit = () => initAudio();
        document.body.addEventListener('click', handleInit, { once: true });
        return () => document.body.removeEventListener('click', handleInit);
    }, [initAudio]);

    const handleBetUp = () => {
        playSound('click');
        if (betAmount < 5000) setBetAmount(prev => prev + 50);
    };
    const handleBetDown = () => {
        playSound('click');
        if (betAmount > 50) setBetAmount(prev => prev - 50);
    };
    const handleAutoUp = () => {
        playSound('click');
        if (autoSpinsCount < 100) setAutoSpinsCount(prev => prev + 1);
    };
    const handleAutoDown = () => {
        playSound('click');
        if (autoSpinsCount > 0) setAutoSpinsCount(prev => prev - 1);
    };

    const autoSpinActiveRef = useRef(false);
    useEffect(() => { autoSpinActiveRef.current = autoSpinActive; }, [autoSpinActive]);
    const isConnectedRef = useRef(false);
    useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);
    const performSpinRef = useRef(performSpin);
    useEffect(() => { performSpinRef.current = performSpin; }, [performSpin]);

    const handleActualSpinClick = async () => {
        if (!isConnected) return;
        playSound('click');
        
        if (autoSpinActive) {
            setAutoSpinActive(false);
            autoSpinActiveRef.current = false;
            return;
        }
        
        if (isSpinning) return;
        
        let currentAuto = autoSpinsCount;
        if (currentAuto > 0) {
            setAutoSpinActive(true);
            autoSpinActiveRef.current = true;
            
            const autoLoop = async (spinsLeft) => {
                if (spinsLeft <= 0 || !autoSpinActiveRef.current || !isConnectedRef.current) {
                    setAutoSpinActive(false);
                    autoSpinActiveRef.current = false;
                    return;
                }
                
                setAutoSpinsCount(spinsLeft - 1);
                const success = await performSpinRef.current();
                
                if (!success || !autoSpinActiveRef.current) {
                    setAutoSpinActive(false);
                    autoSpinActiveRef.current = false;
                    return;
                }
                
                if (isConnectedRef.current && spinsLeft - 1 > 0) {
                    setTimeout(() => autoLoop(spinsLeft - 1), 1500);
                } else {
                    setAutoSpinActive(false);
                    autoSpinActiveRef.current = false;
                }
            };
            
            autoLoop(currentAuto);
        } else {
            await performSpinRef.current();
        }
    };

    const handleStartSession = async () => {
        playSound('click');
        const success = await sessionWallet.startSession(depositInput);
        if (success) {
            setShowDepositPanel(false);
            playSound('win');
        }
    };

    const handleEndSession = async () => {
        playSound('click');
        await sessionWallet.endSession();
    };

    return (
        <div className={`casino-board glass-panel ${isOwner ? 'is-owner' : ''}`}>
            <Mascot />
            
            <div className="board-inner">
                <div className="machine-header">
                    <h2 className="neon-title">PROVABLY FAIR SLOTS</h2>
                    <div className="jackpot-display">
                        <span className="jp-label">GRAND JACKPOT</span>
                        <span className="jp-amount">1,000,000 <span className="jp-currency">$LUDO</span></span>
                    </div>
                </div>

                <div className="slot-machine-frame">
                    <div className="slot-machine-bezel">
                        <div className="reels-window">
                            <div className="reel-blur-overlay" id="blur-overlay"></div>
                            <div className="winning-line" ref={winningLineRef}></div>
                            <div className="reel" id="reel1">
                                <div className="symbol-container"><div className="symbol" ref={reel1Ref}>🍒</div></div>
                            </div>
                            <div className="reel" id="reel2">
                                <div className="symbol-container"><div className="symbol" ref={reel2Ref}>🪙</div></div>
                            </div>
                            <div className="reel" id="reel3">
                                <div className="symbol-container"><div className="symbol" ref={reel3Ref}>7️⃣</div></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SESSION WALLET PANEL */}
                {isConnected && (
                    <div className="session-panel glass-panel">
                        {!sessionWallet.sessionActive ? (
                            <>
                                <div className="session-info">
                                    <span className="session-icon">⚡</span>
                                    <div className="session-text">
                                        <span className="session-title">NO-POPUP SESSION</span>
                                        <span className="session-desc">Deposit once, spin freely — no wallet confirmations</span>
                                    </div>
                                </div>

                                {showDepositPanel ? (
                                    <div className="deposit-controls">
                                        <div className="deposit-presets">
                                            {PRESET_DEPOSITS.map(p => (
                                                <button
                                                    key={p}
                                                    className={`preset-btn ${depositInput === p ? 'active' : ''}`}
                                                    onClick={() => { setDepositInput(p); playSound('click'); }}
                                                >
                                                    {p.toLocaleString()}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="deposit-row">
                                            <input
                                                type="number"
                                                className="deposit-input"
                                                value={depositInput}
                                                onChange={e => setDepositInput(Number(e.target.value))}
                                                min={500}
                                                step={500}
                                            />
                                            <span className="deposit-currency">$LUDO</span>
                                        </div>
                                        <div className="deposit-actions">
                                            <button
                                                className="session-btn session-btn-cancel"
                                                onClick={() => setShowDepositPanel(false)}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                className="session-btn session-btn-start"
                                                onClick={handleStartSession}
                                                disabled={sessionWallet.isStartingSession || depositInput < 500}
                                            >
                                                {sessionWallet.isStartingSession ? '⏳ Starting...' : '⚡ Start Session'}
                                            </button>
                                        </div>
                                        {sessionWallet.sessionError && (
                                            <p className="session-error">{sessionWallet.sessionError}</p>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        className="session-btn session-btn-start"
                                        onClick={() => setShowDepositPanel(true)}
                                    >
                                        ⚡ Start Session
                                    </button>
                                )}
                            </>
                        ) : (
                            /* Active session display */
                            <div className="session-active">
                                <div className="session-active-info">
                                    <span className="session-badge">⚡ SESSION ACTIVE</span>
                                    <span className="session-balance">
                                        {sessionWallet.sessionBalance.toLocaleString()}
                                        <span className="session-bal-currency"> $LUDO</span>
                                    </span>
                                </div>
                                <button
                                    className="session-btn session-btn-end"
                                    onClick={handleEndSession}
                                    disabled={sessionWallet.isEndingSession}
                                >
                                    {sessionWallet.isEndingSession ? '⏳ Returning funds...' : '🏁 End Session'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <div className="control-deck">
                    <div className="bet-station glass-panel">
                        <span className="deck-label">BET AMOUNT ($LUDO)</span>
                        <div className="bet-stepper">
                            <button id="bet-down" className="stepper-btn" onClick={handleBetDown}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 12H4" strokeWidth="2" strokeLinecap="round"/></svg>
                            </button>
                            <input type="number" id="bet-amount" value={betAmount} readOnly />
                            <button id="bet-up" className="stepper-btn" onClick={handleBetUp}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 4v16m8-8H4" strokeWidth="2" strokeLinecap="round"/></svg>
                            </button>
                        </div>
                    </div>
                    
                    <div className="auto-bet-station glass-panel">
                        <span className="deck-label">AUTO SPINS</span>
                        <div className="bet-stepper">
                            <button id="auto-down" className="stepper-btn" onClick={handleAutoDown}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 12H4" strokeWidth="2" strokeLinecap="round"/></svg>
                            </button>
                            <input type="number" id="auto-count" value={autoSpinsCount} readOnly />
                            <button id="auto-up" className="stepper-btn" onClick={handleAutoUp}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 4v16m8-8H4" strokeWidth="2" strokeLinecap="round"/></svg>
                            </button>
                        </div>
                    </div>

                    <div className="action-station">
                        <button 
                            id="spin-btn" 
                            className={`spin-btn ${!isConnected ? 'locked' : ''} ${isSpinning ? 'spinning' : ''}`} 
                            disabled={!isConnected}
                            onClick={handleActualSpinClick}
                        >
                            <div className="spin-btn-inner">
                                <span className="spin-text">
                                    {!isConnected ? 'LOCKED' : autoSpinActive ? 'STOP' : 'SPIN'}
                                </span>
                                <span className="spin-subtext">
                                    {!isConnected
                                        ? 'CONNECT WALLET'
                                        : autoSpinActive
                                            ? `${autoSpinsCount} SPINS LEFT`
                                            : 'PLACE BET'}
                                </span>
                            </div>
                        </button>
                    </div>
                </div>
                
                <div id="status-screen" className="status-screen glass-panel">
                    <div className={`status-content ${statusScreenHtml.type === 'win' ? 'text-win' : statusScreenHtml.type === 'lose' ? 'text-lose' : statusScreenHtml.type === 'burn' ? 'text-burn' : ''}`}>
                        {statusScreenHtml.text}
                    </div>
                </div>

                <div className="provably-fair-badge">
                    <span className="pf-title">🔒 PROVABLY FAIR</span>
                    <span className="pf-hash">Hash: {provablyFairState.currentServerHash ? `${provablyFairState.currentServerHash.slice(0, 16)}...` : 'Generating...'}</span>
                    <span className="pf-nonce">Nonce: {provablyFairState.nonce}</span>
                </div>

                {isConnected && (
                    <div className="referral-dashboard glass-panel">
                        <div className="ref-header">
                            <span className="ref-title">🤝 INVITE & EARN</span>
                            <span className="ref-desc">Earn 0.5% of every spin from players you invite!</span>
                        </div>
                        <div className="ref-actions">
                            <button 
                                className="ref-btn share-x" 
                                onClick={() => {
                                    playSound('click');
                                    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
                                    const refLink = `${baseUrl}/?ref=${publicKey.toBase58()}`;
                                    const text = encodeURIComponent(`I'm playing $LUDO Casino! The ONLY fully on-chain casino that BURNS 3% of every spin 🔥\n\nPlay with my link and let's win together 👇\n${refLink}`);
                                    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
                                }}
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.008 4.15H5.039z"/></svg>
                                SHARE ON X
                            </button>
                            <button 
                                className="ref-btn copy-link" 
                                onClick={() => {
                                    playSound('click');
                                    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
                                    navigator.clipboard.writeText(`${baseUrl}/?ref=${publicKey.toBase58()}`);
                                    alert('Referral link copied!');
                                }}
                            >
                                📋 COPY LINK
                            </button>
                        </div>
                    </div>
                )}


            </div>
        </div>
    );
}
