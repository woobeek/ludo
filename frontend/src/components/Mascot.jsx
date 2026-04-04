'use client';
import { useGame } from '../context/GameContext';

export default function Mascot() {
    const { mascotState } = useGame();

    return (
        <div className={`mascot-container ${mascotState.mode === 'win' ? 'win' : ''} ${mascotState.mode === 'lose' ? 'lose' : ''}`} id="mascot">
            <div className={`speech-bubble ${!mascotState.showMessage ? 'hidden' : ''}`} id="mascot-bubble">
                {mascotState.message}
            </div>
            <img src="/LUDO.png" alt="Ludo Mascot" className={`mascot-img ${mascotState.isSpinning ? 'spin' : ''}`} />
        </div>
    );
}
