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
        <div id="wallet-modal" className="modal">
            <div className="modal-backdrop" onClick={() => setShowWalletModal(false)}></div>
            <div className="modal-card glass-panel">
                <h3 className="modal-title">Select Wallet</h3>
                <p className="modal-subtitle">Connect to Web3 to start playing</p>
                <div className="wallet-options">
                    {wallets.map((wallet) => (
                        <button 
                            key={wallet.adapter.name} 
                            className="wallet-item" 
                            onClick={() => handleWalletClick(wallet.adapter.name)}
                        >
                            <div className="wallet-icon">
                                <img src={wallet.adapter.icon} alt={`${wallet.adapter.name} icon`} />
                            </div>
                            <span className="wallet-name">{wallet.adapter.name}</span>
                            <span className="wallet-status">
                                {wallet.readyState === 'Installed' ? 'Detected' : 'Available'}
                            </span>
                        </button>
                    ))}
                </div>
                <button className="close-modal" onClick={() => setShowWalletModal(false)}>✕</button>
            </div>
        </div>
    );
}
