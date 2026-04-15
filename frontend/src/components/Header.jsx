'use client';
import { useGame } from '../context/GameContext';

export default function Header() {
    const { totalBurned, balance, isConnected, walletAddress, toggleConnect } = useGame();

    return (
        <header className="slim-nav">
            <div className="slim-logo">
                <span className="chip-icon">🪙</span> $LUDO <span className="thin" style={{opacity: 0.6, fontWeight: 400}}>CASINO</span>
            </div>
            <div className="slim-stats">
                <span className="stat-label">BURNED:</span>
                <span className="stat-value">{totalBurned.toLocaleString()}</span>
            </div>
            <div className="slim-wallet">
                <div id="balance-display" className={`glass-panel slim-balance ${!isConnected ? 'hidden' : ''}`}>
                    <span id="sol-balance">{balance.toLocaleString()}</span> <span className="currency">$LUDO</span>
                </div>
                <button id="connect-btn" className="cyber-btn slim-btn" onClick={toggleConnect}>
                    <span className="btn-text">
                        {isConnected ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : 'CONNECT'}
                    </span>
                    <span className="btn-glitch"></span>
                </button>
            </div>
        </header>
    );
}
