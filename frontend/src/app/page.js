'use client';
import { GameProvider } from '../context/GameContext';
import AmbientBackground from '../components/AmbientBackground';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Leaderboard from '../components/Leaderboard';
import SocialLinks from '../components/SocialLinks';
import WalletModal from '../components/WalletModal';
import ReferralModal from '../components/ReferralModal';
import CasinoBoard from '../components/CasinoBoard';
import RecentActivity from '../components/RecentActivity';

import { AppWalletProvider } from '../context/AppWalletProvider';

export default function Home() {
    return (
        <AppWalletProvider>
            <GameProvider>
                <AmbientBackground />
                <Header />
                <main>
                    <div className="leaderboard-sidebar">
                        <Leaderboard />
                    </div>
                    
                    <CasinoBoard />
                    
                    <div className="recent-activity-sidebar">
                        <RecentActivity />
                    </div>
                </main>
                <div className="relative z-10 flex flex-col items-center pb-6">
                    <Footer />
                </div>
                <WalletModal />
                <ReferralModal />
            </GameProvider>
        </AppWalletProvider>
    );
}
