export default function Leaderboard() {
    const topWins = [
        { wallet: '8xK9...2mP', amount: 250000 },
        { wallet: 'D7fE...3aB', amount: 150000 },
        { wallet: '4vNx...9qL', amount: 85000 },
        { wallet: '1aBc...7zY', amount: 40000 },
        { wallet: '9pRt...5wK', amount: 20000 }
    ];

    return (
        <div className="leaderboard glass-panel">
            <h3 className="leaderboard-title">TOP WINS TODAY</h3>
            <ul className="leaderboard-list" id="leaderboard-list">
                {topWins.map((win, idx) => (
                    <li className="lb-item" key={idx}>
                        <span className="lb-wallet">{win.wallet}</span>
                        <span className="lb-amount">+{win.amount.toLocaleString()} $LUDO</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
