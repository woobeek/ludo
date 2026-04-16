'use client';
import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { useWallet } from '@solana/wallet-adapter-react';

export default function ReferralModal() {
    const { showReferralModal, setShowReferralModal } = useGame();
    const { publicKey } = useWallet();
    const [copied, setCopied] = useState(false);
    const [refLink, setRefLink] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined' && publicKey) {
            setRefLink(`${window.location.origin}?ref=${publicKey.toBase58()}`);
        } else {
            setRefLink('');
        }
    }, [publicKey]);

    if (!showReferralModal) return null;

    const handleCopy = () => {
        if (refLink) {
            navigator.clipboard.writeText(refLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="modal shadow-2xl" style={{ zIndex: 2000 }}>
            <div className="modal-backdrop" onClick={() => setShowReferralModal(false)}></div>
            <div className="modal-card ref-modal-card glass-panel">
                <button className="close-modal" onClick={() => setShowReferralModal(false)}>✕</button>
                <div className="ref-header">
                    <span className="ref-icon-large">🤝</span>
                    <h3 className="modal-title">INVITE & EARN</h3>
                    <p className="modal-subtitle">Share your link and earn <span className="text-gold">0.5%</span> of every spin automatically straight to your wallet!</p>
                </div>
                
                <div className="ref-content">
                    {publicKey ? (
                        <>
                            <div className="ref-link-box">
                                <input type="text" readOnly value={refLink} className="ref-input" />
                                <button className={`cyber-btn ref-copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
                                    <span className="btn-text">{copied ? 'COPIED!' : 'COPY'}</span>
                                </button>
                            </div>
                            <div className="ref-details">
                                <div className="ref-stat glass-panel">
                                    <span className="ref-stat-label">REWARD RATE</span>
                                    <span className="ref-stat-value text-gold">0.5%</span>
                                </div>
                                <div className="ref-stat glass-panel">
                                    <span className="ref-stat-label">PAYOUTS</span>
                                    <span className="ref-stat-value text-green">INSTANT</span>
                                </div>
                            </div>
                            <p className="ref-disclaimer">Your reward is deducted directly from the Dev Fee (5%) during every on-chain transaction. No waiting, no claiming.</p>
                        </>
                    ) : (
                        <div className="ref-connect-prompt glass-panel">
                            <span className="chip-icon">🚫</span>
                            <p>Connect your wallet to generate your unique referral link.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
