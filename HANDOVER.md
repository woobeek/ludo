# HANDOVER: Project $LUDO (Solana Casino) 🎰🏎️

Welcome, expert! This project is a Provably Fair Casino built on Solana/Next.js.

## 📍 Key Locations:
- **Frontend:** `/frontend` (Next.js 16)
- **Token Logic:** `frontend/src/utils/provablyFair.js`
- **Smart Revenue Hooks:** `frontend/src/hooks/useSlots.js`
- **On-chain Assets:** 
  - $LUDO Mint: `Aazg6ZeGs4YEjumFFNis2DGDZs2dF7tNaiJXNDha7dGG`
  - Treasury: `EZM3xXLxtCGD4uBXRjd1cre5h79isyJKxptKorKvPuyU`
  - Dev Wallet: `HPHFaAUdftepbXikCyEX45vjSSpE1HHGehp3FTFAvYnV`

## 🧠 Smart Revenue Engine:
- **Adaptive RTP:** win chance scales based on `betAmount` and `sessionSpins`. 
- **Split Transactions:** Each spin sends 5% to the Dev Wallet and 95% (including tax) to the Treasury.

## ⚠️ Current Blocker (Vercel Build Error):
Vercel build is failing (`npm run build exited with 1`). 
**Cause:** Likely missing polyfills for `@solana/web3.js` Buffer/BigInt in the serverless build environment. Check `next.config.mjs` and ensure `Buffer` is globally available or transpile the solana packages.

## 🚀 Future:
Ready for Pump.fun launch. The tokenomics are set to deflate supply (3% burn tax) while generating real profit (5% dev fee).

Good luck! 🦾🏎️🎰
