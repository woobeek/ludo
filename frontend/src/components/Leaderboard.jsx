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
        const interval = setInterval(fetchLeaderboard, 10000);
        return () => clearInterval(interval);
    }, []);

    const rankEmoji = ['🥇', '🥈', '🥉'];

    return (
        <div className="leaderboard glass-panel">
            <h3 className="leaderboard-title">🏆 TOP WINS TODAY</h3>
            <ul className="leaderboard-list" id="leaderboard-list">
                {topWins.length === 0 ? (
                    [...Array(5)].map((_, i) => (
                        <li className="lb-item loading-skeleton" key={i} style={{ opacity: 0.3 }}>
                            <span className="lb-rank">#?</span>
                            <span className="lb-wallet">Loading...</span>
                            <span className="lb-amount">---</span>
                        </li>
                    ))
                ) : (
                    topWins.map((win, idx) => (
                        <li className="lb-item" key={idx}>
                            <span className="lb-rank">{rankEmoji[idx] ?? `#${idx + 1}`}</span>
                            <span className="lb-wallet">{win.wallet}</span>
                            <span className="lb-amount">+{win.amount.toLocaleString()}</span>
                        </li>
                    ))
                )}
            </ul>
        </div>
    );
}
