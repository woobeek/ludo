'use client';
import { useRef, useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import { useSlots } from '../hooks/useSlots';
import { useSessionWallet } from '../hooks/useSessionWallet';
import { useWallet } from '@solana/wallet-adapter-react';
import Mascot from './Mascot';
import PaytableModal from './PaytableModal';

const PRESET_DEPOSITS = [1000, 5000, 10000, 25000];

export default function CasinoBoard() {
    const {
        isConnected,
        statusScreenHtml,
        initAudio,
        playSound
    } = useGame();
    const { publicKey } = useWallet();

    const isOwner = publicKey?.toBase58() === process.env.NEXT_PUBLIC_DEV_WALLET;

    const reel1Ref = useRef(null);
    const reel2Ref = useRef(null);
    const reel3Ref = useRef(null);
    const reel4Ref = useRef(null);
    const reel5Ref = useRef(null);
    const reelsArray = [reel1Ref, reel2Ref, reel3Ref, reel4Ref, reel5Ref];
    const reelsWindowRef = useRef(null);

    const sessionWallet = useSessionWallet();
    const [depositInput, setDepositInput] = useState(5000);
    const [showDepositPanel, setShowDepositPanel] = useState(false);
    const [showPaytable, setShowPaytable] = useState(false);
    const [lineCoords, setLineCoords] = useState([]);
    const [bigWin, setBigWin] = useState(null);

    const {
        betAmount, setBetAmount,
        autoSpinsCount, setAutoSpinsCount,
        isSpinning,
        autoSpinActive, setAutoSpinActive,
        performSpin,
        provablyFairState,
        grid, winningPositions, winningLines
    } = useSlots(reelsArray, sessionWallet);

    useEffect(() => {
        const handleInit = () => initAudio();
        document.body.addEventListener('click', handleInit, { once: true });
        return () => document.body.removeEventListener('click', handleInit);
    }, [initAudio]);

    useEffect(() => {
        const updateLines = () => {
            if (isSpinning) {
                setLineCoords([]);
                return;
            }
            if (winningLines && winningLines.length > 0 && reelsWindowRef.current) {
                const parentRect = reelsWindowRef.current.getBoundingClientRect();
                const coords = winningLines.map(line => {
                    return line.map(pos => {
                        const el = document.getElementById(`symbol-${pos.col}-${pos.row}`);
                        if (el) {
                            const rect = el.getBoundingClientRect();
                            return {
                                x: rect.left + rect.width / 2 - parentRect.left,
                                y: rect.top + rect.height / 2 - parentRect.top
                            };
                        }
                        return null;
                    }).filter(Boolean);
                });
                setLineCoords(coords);
            } else {
                setLineCoords([]);
            }
        };

        setTimeout(updateLines, 50); // Small delay to let DOM settle
        window.addEventListener('resize', updateLines);
        return () => window.removeEventListener('resize', updateLines);
    }, [winningLines, grid, isSpinning]);

    const handleBetUp = () => { playSound('click'); if (betAmount < 5000) setBetAmount(prev => prev + 50); };
    const handleBetDown = () => { playSound('click'); if (betAmount > 50) setBetAmount(prev => prev - 50); };
    const handleAutoUp = () => { playSound('click'); if (autoSpinsCount < 100) setAutoSpinsCount(prev => prev + 1); };
    const handleAutoDown = () => { playSound('click'); if (autoSpinsCount > 0) setAutoSpinsCount(prev => prev - 1); };

    const autoSpinActiveRef = useRef(false);
    useEffect(() => { autoSpinActiveRef.current = autoSpinActive; }, [autoSpinActive]);
    const isConnectedRef = useRef(false);
    useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);
    const performSpinRef = useRef(performSpin);
    useEffect(() => { performSpinRef.current = performSpin; }, [performSpin]);



    const handleActualSpinClick = async () => {
        if (!isConnected) return;
        initAudio(); // Initialize on first interaction
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
                    return;
                }
                setAutoSpinsCount(spinsLeft - 1);
                const result = await performSpinRef.current();

                // Show BIG WIN if win > 5x bet
                if (result && result.winAmount > betAmount * 5) {
                    setBigWin(result.winAmount);
                    setTimeout(() => setBigWin(null), 3000);
                }

                if (!result || !autoSpinActiveRef.current) {
                    setAutoSpinActive(false);
                    return;
                }
                if (isConnectedRef.current && spinsLeft - 1 > 0) {
                    setTimeout(() => autoLoop(spinsLeft - 1), 1500);
                } else {
                    setAutoSpinActive(false);
                }
            };
            autoLoop(currentAuto);
        } else {
            const result = await performSpinRef.current();
            if (result && result.winAmount > betAmount * 5) {
                setBigWin(result.winAmount);
                setTimeout(() => setBigWin(null), 3500);
            }
        }
    };


    return (
        <div className={`casino-board glass-panel ${isOwner ? 'is-owner' : ''}`}>
            {bigWin && (
                <div className="big-win-overlay">
                    <div className="bw-inner">
                        <span className="bw-text">BIG WIN!</span>
                        <span className="bw-amount">+{bigWin.toLocaleString()} $LUDO</span>
                    </div>
                </div>
            )}

            <div className="board-inner">
                <div className="machine-header">
                    <h2 className="neon-title" style={{ margin: '1rem 0' }}>PROVABLY FAIR SLOTS</h2>
                    <div className="jackpot-display">
                        <span className="jp-label">GRAND JACKPOT</span>
                        <span className="jp-amount">1,000,000 <span className="jp-currency">$LUDO</span></span>
                    </div>
                </div>

                <div className="slot-machine-frame">
                    <div className="slot-machine-bezel">
                        <div className="reels-window glass-panel" ref={reelsWindowRef}>
                            <svg className="win-lines-overlay">
                                {lineCoords.map((line, i) => (
                                    <polyline
                                        key={i}
                                        points={line.map(p => `${p.x},${p.y}`).join(' ')}
                                        className="neon-win-line"
                                    />
                                ))}
                            </svg>
                            {grid.map((col, colIdx) => (
                                <div className="reel" ref={reelsArray[colIdx]} key={colIdx}>
                                    {col.map((sym, rowIdx) => {
                                        const isWin = winningPositions.some(p => p.col === colIdx && p.row === rowIdx);
                                        return (
                                            <div
                                                id={`symbol-${colIdx}-${rowIdx}`}
                                                key={rowIdx}
                                                className={`symbol-container ${isWin ? 'winning-symbol' : ''}`}
                                            >
                                                <div className="symbol">{sym}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {isConnected && (
                    <div className="session-panel glass-panel" style={{ marginBottom: '20px' }}>
                        {!sessionWallet.sessionActive ? (
                            <>
                                <div className="session-info">
                                    <span className="session-icon">⚡</span>
                                    <div className="session-text">
                                        <span className="session-title">NO-POPUP SESSION</span>
                                        <span className="session-desc">Deposit once, spin freely</span>
                                    </div>
                                </div>

                                {showDepositPanel ? (
                                    <div className="deposit-controls">
                                        <div className="deposit-presets">
                                            {PRESET_DEPOSITS.map(p => (
                                                <button key={p} className={`preset-btn ${depositInput === p ? 'active' : ''}`} onClick={() => { setDepositInput(p); playSound('click'); }}>
                                                    {p.toLocaleString()}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="deposit-row">
                                            <input type="number" className="deposit-input" value={depositInput} onChange={e => setDepositInput(Number(e.target.value))} min={500} step={500} />
                                            <span className="deposit-currency">$LUDO</span>
                                        </div>
                                        <div className="deposit-actions">
                                            <button className="session-btn session-btn-cancel" onClick={() => setShowDepositPanel(false)}>Cancel</button>
                                            <button className="session-btn session-btn-start" onClick={async () => { playSound('click'); if (await sessionWallet.startSession(depositInput)) { setShowDepositPanel(false); playSound('win'); } }} disabled={sessionWallet.isStartingSession || depositInput < 500}>
                                                {sessionWallet.isStartingSession ? '⏳ Starting...' : '⚡ Start Session'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button className="session-btn session-btn-start" onClick={() => setShowDepositPanel(true)}>⚡ Start Session</button>
                                )}
                            </>
                        ) : (
                            <div className="session-active">
                                <div className="session-active-info">
                                    <span className="session-badge">⚡ SESSION ACTIVE</span>
                                    <span className="session-balance">{sessionWallet.sessionBalance.toLocaleString()}<span className="session-bal-currency"> $LUDO</span></span>
                                </div>
                                <button className="session-btn session-btn-end" onClick={async () => { playSound('click'); await sessionWallet.endSession(); }} disabled={sessionWallet.isEndingSession}>
                                    {sessionWallet.isEndingSession ? '⏳ Returning...' : '🏁 End Session'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <div className="control-deck">
                    {/* PAYTABLE STATION */}
                    <div className="paytable-station glass-panel" onClick={() => { playSound('click'); setShowPaytable(true); }} style={{ cursor: 'pointer' }}>
                        <div className="pay-trigger-inner">
                            <span className="deck-label">GAME RULES</span>
                            <div className="pay-btn-content">
                                <span className="pay-text">PAYTABLE</span>
                            </div>
                        </div>
                    </div>

                    <div className="bet-station glass-panel">
                        <span className="deck-label">BET AMOUNT ($LUDO)</span>
                        <div className="bet-stepper">
                            <button className="stepper-btn" onClick={handleBetDown}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 12H4" strokeWidth="2" strokeLinecap="round" /></svg></button>
                            <input type="number" value={betAmount} readOnly id="bet-amount" />
                            <button className="stepper-btn" onClick={handleBetUp}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 4v16m8-8H4" strokeWidth="2" strokeLinecap="round" /></svg></button>
                        </div>
                    </div>

                    <div className="auto-bet-station glass-panel">
                        <span className="deck-label">AUTO SPINS</span>
                        <div className="bet-stepper">
                            <button className="stepper-btn" onClick={handleAutoDown}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 12H4" strokeWidth="2" strokeLinecap="round" /></svg></button>
                            <input type="number" value={autoSpinsCount} readOnly id="auto-count" />
                            <button className="stepper-btn" onClick={handleAutoUp}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 4v16m8-8H4" strokeWidth="2" strokeLinecap="round" /></svg></button>
                        </div>
                    </div>

                    <div className="action-station">
                        <Mascot />
                        <button className={`spin-btn ${!isConnected ? 'locked' : ''} ${isSpinning ? 'spinning' : ''}`} disabled={!isConnected} onClick={handleActualSpinClick}>
                            <div className="spin-btn-inner">
                                <span className="spin-text">{!isConnected ? 'LOCKED' : autoSpinActive ? 'STOP' : 'SPIN'}</span>
                                <span className="spin-subtext">{!isConnected ? 'CONNECT WALLET' : autoSpinActive ? `${autoSpinsCount} SPINS LEFT` : 'PLACE BET'}</span>
                            </div>
                        </button>
                    </div>
                </div>

                <div id="status-screen" className="status-screen glass-panel" style={{ margin: '20px 0', minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className={`status-content ${statusScreenHtml.type === 'win' ? 'text-win' : statusScreenHtml.type === 'lose' ? 'text-lose' : statusScreenHtml.type === 'burn' ? 'text-burn' : ''}`} style={{ fontSize: '18px', fontWeight: 'bold' }}>
                        {statusScreenHtml.text || (isSpinning ? '🎲 SPINNING...' : 'READY TO PLAY')}
                    </div>
                </div>

                <div className="pf-bar">
                    <div className="pf-info">
                        <span className="pf-title-green">🔒 PROVABLY FAIR 5x3 ENGINE</span>
                        <span className="pf-hash-text">
                            Server Hash: {provablyFairState.currentServerHash ? `${provablyFairState.currentServerHash.slice(0, 16)}...` : 'Generating...'}
                        </span>
                    </div>
                    <div className="pf-stats">
                        <div className="pf-info" style={{ alignItems: 'flex-end' }}>
                            <span className="pf-title-green">NONCE: {provablyFairState.nonce}</span>
                            <span className="pf-hash-text" style={{ fontSize: '9px' }}>👑 WILDS | ⭐ SCATTERS | 10 PAYLINES</span>
                        </div>
                    </div>
                </div>
            </div>
            <PaytableModal show={showPaytable} onClose={() => setShowPaytable(false)} />
        </div>
    );
}
