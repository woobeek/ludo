'use client';
import { GameProvider } from '../context/GameContext';
import AmbientBackground from '../components/AmbientBackground';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Leaderboard from '../components/Leaderboard';
import SocialLinks from '../components/SocialLinks';
import WalletModal from '../components/WalletModal';
import CasinoBoard from '../components/CasinoBoard';

import { AppWalletProvider } from '../context/AppWalletProvider';

export default function Home() {
    return (
        <AppWalletProvider>
            <GameProvider>
                <AmbientBackground />
                <Header />
                <main>
                    <Leaderboard />
                    <SocialLinks />
                    <CasinoBoard />
                </main>
                <Footer />
                <WalletModal />
            </GameProvider>
        </AppWalletProvider>
    );
}
