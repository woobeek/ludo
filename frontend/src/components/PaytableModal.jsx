'use client';
import { useGame } from '../context/GameContext';

export default function PaytableModal({ show, onClose }) {
    if (!show) return null;

    const PAYLINES = [
        { id: 1, name: 'MIDDLE', pts: '1,1,1,1,1' },
        { id: 2, name: 'TOP', pts: '0,0,0,0,0' },
        { id: 3, name: 'BOTTOM', pts: '2,2,2,2,2' },
        { id: 4, name: 'V-SHAPE', pts: '0,1,2,1,0' },
        { id: 5, name: 'INV-V', pts: '2,1,0,1,2' },
        { id: 6, name: 'ZIGZAG 1', pts: '1,0,0,0,1' },
        { id: 7, name: 'ZIGZAG 2', pts: '1,2,2,2,1' },
        { id: 8, name: 'STEP DOWN', pts: '0,0,1,2,2' },
        { id: 9, name: 'STEP UP', pts: '2,2,1,0,0' },
        { id: 10, name: 'W-SHAPE', pts: '1,2,1,0,1' }
    ];

    return (
        <div id="paytable-modal" className="modal shadow-2xl">
            <div className="modal-backdrop" onClick={onClose}></div>
            <div className="modal-card glass-panel paytable-card">
                <button className="close-modal" onClick={onClose}>✕</button>
                <h3 className="modal-title">PAYTABLE & WIN LINES</h3>
                
                <div className="paytable-content">
                    <section className="symbols-grid">
                        <h4 className="section-subtitle">SYMBOLS (x Line Bet)</h4>
                        <div className="symbols-list">
                            <div className="pay-item">
                                <span className="p-sym">👑</span>
                                <div className="p-vals"><span>5: 600x</span><span>4: 150x</span><span>3: 50x</span></div>
                                <span className="p-label">WILD</span>
                            </div>
                            <div className="pay-item">
                                <span className="p-sym">⭐</span>
                                <div className="p-vals"><span>5: 75x</span><span>4: 20x</span><span>3: 5x</span></div>
                                <span className="p-label">SCATTER*</span>
                            </div>
                            <div className="pay-item">
                                <span className="p-sym">7️⃣</span>
                                <div className="p-vals"><span>5: 300x</span><span>4: 70x</span><span>3: 20x</span></div>
                            </div>
                            <div className="pay-item">
                                <span className="p-sym">💎</span>
                                <div className="p-vals"><span>5: 150x</span><span>4: 50x</span><span>3: 15x</span></div>
                            </div>
                            <div className="pay-item">
                                <span className="p-sym">🚀</span>
                                <div className="p-vals"><span>5: 100x</span><span>4: 30x</span><span>3: 10x</span></div>
                            </div>
                            <div className="pay-item">
                                <span className="p-sym">🪙</span>
                                <div className="p-vals"><span>5: 50x</span><span>4: 15x</span><span>3: 6x</span></div>
                            </div>
                            <div className="pay-item">
                                <span className="p-sym">🍒</span>
                                <div className="p-vals"><span>5: 25x</span><span>4: 8x</span><span>3: 2.5x</span></div>
                            </div>
                        </div>
                        <p className="tiny-info">*Scatters pay on TOTAL bet anywhere on screen.</p>
                    </section>

                    <section className="lines-grid">
                        <h4 className="section-subtitle">10 PAYLINES</h4>
                        <div className="lines-visual-grid">
                            {PAYLINES.map(line => (
                                <div key={line.id} className="line-mini">
                                    <div className="line-dots">
                                        {[0,1,2,3,4].map(c => (
                                            <div key={c} className="dot-col">
                                                {[0,1,2].map(r => (
                                                    <div key={r} className={`dot ${line.pts.split(',')[c] == r ? 'active' : ''}`}></div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                    <span>#{line.id}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
