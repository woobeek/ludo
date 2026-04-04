'use client';
import { useGame } from '../context/GameContext';

export default function Header() {
    const { totalBurned, balance, isConnected, walletAddress, toggleConnect } = useGame();

    return (
        <header className="glass-header">
            <div className="logo">
                <span className="chip-icon">🪙</span> $LUDO <span className="thin">CASINO</span>
            </div>
            <div className="header-stats">
                <div className="stat-box">
                    <span className="label">TOTAL BURNED 🔥</span>
                    <span className="value burn-value" id="total-burned">
                        {totalBurned.toLocaleString()}
                    </span>
                </div>
            </div>
            <div className="wallet-section">
                <div id="balance-display" className={`glass-panel ${!isConnected ? 'hidden' : ''}`}>
                    <span id="sol-balance">{balance.toLocaleString()}</span> <span className="currency">$LUDO</span>
                </div>
                <button id="connect-btn" className="cyber-btn" onClick={toggleConnect}>
                    <span className="btn-text">
                        {isConnected ? walletAddress : 'CONNECT WALLET'}
                    </span>
                    <span className="btn-glitch"></span>
                </button>
            </div>
        </header>
    );
}
