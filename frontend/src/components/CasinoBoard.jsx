'use client';
import { useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { useSlots } from '../hooks/useSlots';
import Mascot from './Mascot';

export default function CasinoBoard() {
    const { isConnected, statusScreenHtml, initAudio, playSound } = useGame();
    
    const reel1Ref = useRef(null);
    const reel2Ref = useRef(null);
    const reel3Ref = useRef(null);
    const winningLineRef = useRef(null);

    const {
        betAmount, setBetAmount,
        autoSpinsCount, setAutoSpinsCount,
        isSpinning,
        autoSpinActive, setAutoSpinActive,
        performSpin,
        provablyFairState
    } = useSlots([reel1Ref, reel2Ref, reel3Ref], winningLineRef);

    // Initialize audio on first click on the document/board
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
    useEffect(() => {
        autoSpinActiveRef.current = autoSpinActive;
    }, [autoSpinActive]);

    const isConnectedRef = useRef(false);
    useEffect(() => {
        isConnectedRef.current = isConnected;
    }, [isConnected]);

    const performSpinRef = useRef(performSpin);
    useEffect(() => {
        performSpinRef.current = performSpin;
    }, [performSpin]);

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

    return (
        <div className="casino-board glass-panel">
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
                                    {!isConnected ? 'CONNECT WALLET' : autoSpinActive ? `${autoSpinsCount} SPINS LEFT` : 'PLACE BET'}
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
            </div>
        </div>
    );
}
