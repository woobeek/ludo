'use client';
import { useGame } from '../context/GameContext';

export default function Footer() {
    const { mockTx } = useGame();

    return (
        <footer className="glass-footer">
            <div className="live-feed">
                <div className="feed-badge">LIVE</div>
                <div className="feed-scroller">
                    <span 
                        id="mock-tx" 
                        className="tx-text" 
                        style={{ color: mockTx.color, transition: "opacity 0.5s" }}
                    >
                        {mockTx.text}
                    </span>
                </div>
            </div>
            <div className="network-stats">
                <span className="status-dot"></span> SOLANA MAINNET
            </div>
        </footer>
    );
}
