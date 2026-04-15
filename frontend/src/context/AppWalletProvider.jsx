'use client';
import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { 
    PhantomWalletAdapter, 
    SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

export function AppWalletProvider({ children }) {
    // Network from env (defaults to mainnet-beta for production)
    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta';
    
    // Use custom RPC if provided, otherwise default Solana endpoint
    const endpoint = useMemo(() => 
        process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl(network), 
    [network]);
    
    // Initialize standard wallets
    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
        ],
        []
    );


    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect={true}>
                {children}
            </WalletProvider>
        </ConnectionProvider>
    );
}
