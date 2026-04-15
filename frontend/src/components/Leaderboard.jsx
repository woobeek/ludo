'use client';
import { useState, useEffect } from 'react';

export default function Leaderboard() {
    const [topWins, setTopWins] = useState([]);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const res = await fetch('/api/leaderboard');
                const data = await res.json();
                if (data && data.length > 0) {
                    setTopWins(data);
                }
            } catch (e) {
                console.error("Failed to fetch leaderboard", e);
            }
        };
        fetchLeaderboard();
        const interval = setInterval(fetchLeaderboard, 30000);
        return () => clearInterval(interval);
    }, []);

    const rankClasses = ['rank-gold', 'rank-silver', 'rank-bronze'];
    const rankEmojis = ['🥇', '🥈', '🥉'];

    return (
        <div className="leaderboard-sidebar-inner">
            <h3 className="sidebar-title">🏆 GLOBAL LEADERS</h3>
            <ul className="lb-list">
                {topWins.length === 0 ? (
                    [...Array(5)].map((_, i) => (
                        <li className="lb-item skeleton" key={i}>
                            <span className="lb-rank">#?</span>
                            <span className="activity-wallet" style={{background: '#333', color: 'transparent', borderRadius: '4px'}}>-----</span>
                        </li>
                    ))
                ) : (
                    topWins.map((win, idx) => (
                        <li className="lb-item" key={idx}>
                            <span className={`lb-rank ${rankClasses[idx] || ''}`}>
                                {rankEmojis[idx] || `#${idx + 1}`}
                            </span>
                            <div className="activity-details">
                                <span className="activity-wallet">{win.wallet.slice(0,6)}...</span>
                                <span className="activity-amount">{win.amount.toLocaleString()} LUDO</span>
                            </div>
                        </li>
                    ))
                )}
            </ul>
        </div>
    );
}
