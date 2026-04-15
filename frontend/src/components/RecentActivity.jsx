'use client';
import { useState, useEffect } from 'react';

export default function RecentActivity() {
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
                console.error("Failed to fetch activity", e);
            }
        };
        fetchLeaderboard();
        const interval = setInterval(fetchLeaderboard, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="recent-activity-sidebar glass-panel">
            <h3 className="sidebar-title">⚡ RECENT ACTIVITY</h3>
            <ul className="activity-list">
                {topWins.length === 0 ? (
                    [...Array(6)].map((_, i) => (
                        <li className="activity-item skeleton" key={i}>
                            <div className="activity-dot" style={{background: '#333', boxShadow: 'none'}}></div>
                            <div className="activity-details">
                                <span className="activity-wallet" style={{background: '#333', color: 'transparent', borderRadius: '4px'}}>-----</span>
                                <span className="activity-amount" style={{background: '#333', color: 'transparent', borderRadius: '4px', marginTop: '4px'}}>-----</span>
                            </div>
                        </li>
                    ))
                ) : (
                    topWins.map((win, idx) => (
                        <li className="activity-item" key={idx}>
                            <div className="activity-dot"></div>
                            <div className="activity-details">
                                <span className="activity-wallet">
                                    {win.wallet.slice(0,4)}...{win.wallet.slice(-4)}
                                </span>
                                <span className="activity-amount">+{win.amount.toLocaleString()} LUDO</span>
                            </div>
                        </li>
                    ))
                )}
            </ul>
        </div>
    );
}
