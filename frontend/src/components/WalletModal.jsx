'use client';
import { useGame } from '../context/GameContext';
import { useWallet } from '@solana/wallet-adapter-react';

export default function WalletModal() {
    const { showWalletModal, setShowWalletModal } = useGame();
    const { wallets, select } = useWallet();

    const handleWalletClick = (walletName) => {
        select(walletName);
        setShowWalletModal(false);
    };

    if (!showWalletModal) return null;

    return (
        <div id="wallet-modal" className="modal shadow-2xl">
            <div className="modal-backdrop" onClick={() => setShowWalletModal(false)}></div>
            <div className="modal-card glass-panel">
                <button className="close-modal" onClick={() => setShowWalletModal(false)}>✕</button>
                <h3 className="modal-title">CONNECT WALLET</h3>
                <p className="modal-subtitle">Select your preferred Solana wallet</p>
                <div className="wallet-options">
                    {wallets.map((wallet) => (
                        <button 
                            key={wallet.adapter.name} 
                            className="wallet-item" 
                            onClick={() => handleWalletClick(wallet.adapter.name)}
                        >
                            <div className="wallet-icon">
                                <img src={wallet.adapter.icon} alt={wallet.adapter.name} />
                            </div>
                            <span className="wallet-name">{wallet.adapter.name}</span>
                            <span className="wallet-status">
                                {wallet.readyState === 'Installed' ? 'Installed' : 'Available'}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
