// Audio Context Setup (Simple synth sounds to simulate AAA feeling)
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'spin') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.1);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'win') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554, now + 0.1); // C#
        osc.frequency.setValueAtTime(659, now + 0.2); // E
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
    } else if (type === 'lose') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.4);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
    }
}

// Global Interaction Init
document.body.addEventListener('click', () => { initAudio(); }, { once: true });

// Game Logic
const SYMBOLS = ['🪙', '🍒', '7️⃣', '💎', '🚀'];
const MULTIPLIERS = { '7️⃣': 20, '💎': 10, '🚀': 5, '🪙': 3, '🍒': 2 };

// DOM Elements
const connectBtn = document.getElementById('connect-btn');
const phantomConnect = document.getElementById('phantom-connect');
const walletModal = document.getElementById('wallet-modal');
const balanceDisplay = document.getElementById('balance-display');
const solBalance = document.getElementById('sol-balance');
const spinBtn = document.getElementById('spin-btn');
const betAmountInput = document.getElementById('bet-amount');
const betUpBtn = document.getElementById('bet-up');
const betDownBtn = document.getElementById('bet-down');
const autoCountInput = document.getElementById('auto-count');
const autoUpBtn = document.getElementById('auto-up');
const autoDownBtn = document.getElementById('auto-down');
const statusScreen = document.querySelector('.status-content');
const totalBurnedEl = document.getElementById('total-burned');

const mascot = document.getElementById('mascot');
const mascotBubble = document.getElementById('mascot-bubble');
const mascotImg = document.querySelector('.mascot-img');

const reels = [
    document.getElementById('reel1').querySelector('.symbol'),
    document.getElementById('reel2').querySelector('.symbol'),
    document.getElementById('reel3').querySelector('.symbol')
];
const winningLine = document.querySelector('.winning-line');
const mockTx = document.getElementById('mock-tx');

// State
let isConnected = false;
let balance = 5000;
let totalBurned = 1240500;
let isSpinning = false;
let autoSpinActive = false;

// Wallet Logic
connectBtn.addEventListener('click', () => {
    playSound('click');
    if (!isConnected) {
        walletModal.classList.remove('hidden');
    } else {
        isConnected = false;
        connectBtn.querySelector('.btn-text').textContent = 'CONNECT WALLET';
        balanceDisplay.classList.add('hidden');
        
        spinBtn.classList.add('locked');
        spinBtn.disabled = true;
        spinBtn.querySelector('.spin-text').textContent = 'LOCKED';
        spinBtn.querySelector('.spin-subtext').textContent = 'CONNECT WALLET';
        statusScreen.textContent = 'WAITING FOR CONNECTION...';
        statusScreen.className = 'status-content';
    }
});

window.closeModal = function() {
    playSound('click');
    walletModal.classList.add('hidden');
}

phantomConnect.addEventListener('click', () => {
    playSound('click');
    phantomConnect.querySelector('.wallet-status').textContent = 'Connecting...';
    setTimeout(() => {
        closeModal();
        isConnected = true;
        connectBtn.querySelector('.btn-text').textContent = 'D7fE...3aB9';
        balanceDisplay.classList.remove('hidden');
        updateBalance(0);
        
        spinBtn.classList.remove('locked');
        spinBtn.disabled = false;
        spinBtn.querySelector('.spin-text').textContent = 'SPIN';
        spinBtn.querySelector('.spin-subtext').textContent = 'PLACE BET';
        statusScreen.textContent = 'READY TO PLAY. INITIALIZING SMART CONTRACT...';
        phantomConnect.querySelector('.wallet-status').textContent = 'Detected';
        
        setTimeout(() => {
            if(!isSpinning) statusScreen.textContent = 'AWAITING YOUR SPIN.';
        }, 2000);
    }, 800);
});

// Bets
betUpBtn.addEventListener('click', () => {
    playSound('click');
    let val = parseInt(betAmountInput.value);
    if(val < 5000) betAmountInput.value = val + 50;
});

betDownBtn.addEventListener('click', () => {
    playSound('click');
    let val = parseInt(betAmountInput.value);
    if(val > 50) betAmountInput.value = val - 50;
});

autoUpBtn.addEventListener('click', () => {
    playSound('click');
    let val = parseInt(autoCountInput.value);
    if(val < 100) autoCountInput.value = val + 1;
});

autoDownBtn.addEventListener('click', () => {
    playSound('click');
    let val = parseInt(autoCountInput.value);
    if(val > 0) autoCountInput.value = val - 1;
});

function updateBalance(amount) {
    balance += amount;
    solBalance.textContent = balance.toLocaleString();
}

function updateBurned(amount) {
    totalBurned += amount;
    totalBurnedEl.textContent = totalBurned.toLocaleString();
}

function getRandomSymbol() {
    return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function showMascotMessage(msg, duration = 3000) {
    mascotBubble.textContent = msg;
    mascotBubble.classList.remove('hidden');
    setTimeout(() => {
        mascotBubble.classList.add('hidden');
    }, duration);
}

function animateReel(reel, finalSymbol, duration) {
    return new Promise(resolve => {
        const spinSpeed = 40; 
        reel.classList.add('blur');
        
        const spinInterval = setInterval(() => {
            reel.textContent = getRandomSymbol();
            playSound('spin');
        }, spinSpeed);

        setTimeout(() => {
            clearInterval(spinInterval);
            reel.classList.remove('blur');
            reel.textContent = finalSymbol;
            resolve();
        }, duration);
    });
}

async function performSpin() {
    if (!isConnected) return;
    
    const bet = parseInt(betAmountInput.value);
    if (bet > balance) {
        statusScreen.innerHTML = '<span class="text-lose">INSUFFICIENT $LUDO BALANCE</span>';
        playSound('lose');
        autoSpinActive = false;
        return;
    }

    isSpinning = true;
    spinBtn.classList.add('spinning');
    winningLine.classList.remove('active');
    updateBalance(-bet);
    statusScreen.innerHTML = 'EXECUTING TRANSACTION...';
    
    const spinPhrases = [
        "Let's gooo!",
        "Fingers crossed!",
        "Big win incoming...",
        "Spinning...",
        "Come on, jackpot!"
    ];
    mascotImg.classList.add('spin');
    showMascotMessage(spinPhrases[Math.floor(Math.random() * spinPhrases.length)], 2000);

    const isWin = Math.random() < 0.25; // 25% win rate for demo
    let finalSymbols = [];
    
    if (isWin) {
        const winSymbol = getRandomSymbol();
        finalSymbols = [winSymbol, winSymbol, winSymbol];
    } else {
        finalSymbols = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
        if (finalSymbols[0] === finalSymbols[1] && finalSymbols[1] === finalSymbols[2]) {
            finalSymbols[2] = SYMBOLS[(SYMBOLS.indexOf(finalSymbols[2]) + 1) % SYMBOLS.length];
        }
    }

    const p1 = animateReel(reels[0], finalSymbols[0], 1000);
    const p2 = animateReel(reels[1], finalSymbols[1], 1500);
    const p3 = animateReel(reels[2], finalSymbols[2], 2000);

    await Promise.all([p1, p2, p3]);

    mascotImg.classList.remove('spin');
    if (finalSymbols[0] === finalSymbols[1] && finalSymbols[1] === finalSymbols[2]) {
        const multiplier = MULTIPLIERS[finalSymbols[0]];
        const winAmount = bet * multiplier;
        updateBalance(winAmount);
        winningLine.classList.add('active');
        playSound('win');
        statusScreen.innerHTML = `<span class="text-win">PAYOUT SECURED: +${winAmount.toLocaleString()} $LUDO (${multiplier}X)</span>`;
        
        const winPhrases = [
            "JACKPOT! We did it!",
            "Unbelievable!",
            "That's what I'm talking about!",
            "Easy money!",
            "Winner winner!"
        ];
        
        mascot.classList.add('win');
        setTimeout(() => mascot.classList.remove('win'), 500);
        showMascotMessage(winPhrases[Math.floor(Math.random() * winPhrases.length)], 4000);
    } else {
        updateBurned(bet);
        playSound('lose');
        statusScreen.innerHTML = `<span class="text-burn">🔥 ${bet.toLocaleString()} $LUDO BURNED FOREVER</span>`;
        
        const losePhrases = [
            "Ouch! Try again!",
            "Next time for sure.",
            "Almost had it...",
            "Don't give up!",
            "Bad luck..."
        ];
        
        mascot.classList.add('lose');
        setTimeout(() => mascot.classList.remove('lose'), 500);
        showMascotMessage(losePhrases[Math.floor(Math.random() * losePhrases.length)], 3000);
    }

    isSpinning = false;
    spinBtn.classList.remove('spinning');
}

spinBtn.addEventListener('click', async () => {
    if (!isConnected) return;
    playSound('click');
    
    if (autoSpinActive) {
        autoSpinActive = false;
        statusScreen.innerHTML = 'AUTO SPIN STOPPED';
        spinBtn.querySelector('.spin-text').textContent = 'SPIN';
        spinBtn.querySelector('.spin-subtext').textContent = 'PLACE BET';
        return;
    }

    if (isSpinning) return;
    
    let autoSpins = parseInt(autoCountInput.value);
    
    if (autoSpins > 0) {
        autoSpinActive = true;
        spinBtn.querySelector('.spin-text').textContent = 'STOP';
        
        while (autoSpins > 0 && autoSpinActive && isConnected) {
            autoSpins--;
            autoCountInput.value = autoSpins;
            spinBtn.querySelector('.spin-subtext').textContent = `${autoSpins} SPINS LEFT`;
            
            await performSpin();
            
            if (autoSpins > 0 && autoSpinActive && isConnected) {
                await new Promise(r => setTimeout(r, 1500));
            }
        }
        
        autoSpinActive = false;
        if (isConnected) {
            spinBtn.querySelector('.spin-text').textContent = 'SPIN';
            spinBtn.querySelector('.spin-subtext').textContent = 'PLACE BET';
        }
    } else {
        await performSpin();
    }
});

// Leaderboard Mock
const leaderboardList = document.getElementById('leaderboard-list');
let topWins = [
    { wallet: '8xK9...2mP', amount: 250000 },
    { wallet: 'D7fE...3aB', amount: 150000 },
    { wallet: '4vNx...9qL', amount: 85000 },
    { wallet: '1aBc...7zY', amount: 40000 },
    { wallet: '9pRt...5wK', amount: 20000 }
];

function renderLeaderboard() {
    leaderboardList.innerHTML = '';
    topWins.forEach((win) => {
        const li = document.createElement('li');
        li.className = 'lb-item';
        li.innerHTML = `
            <span class="lb-wallet">${win.wallet}</span>
            <span class="lb-amount">+${win.amount.toLocaleString()} $LUDO</span>
        `;
        leaderboardList.appendChild(li);
    });
}
renderLeaderboard();

// Mock Feed
setInterval(() => {
    const chars = 'abcdef0123456789';
    let addr = '';
    for(let i=0; i<4; i++) addr += chars[Math.floor(Math.random()*chars.length)];
    const isBurn = Math.random() > 0.3;
    const amount = [50, 100, 500, 1000][Math.floor(Math.random()*4)];
    
    mockTx.style.opacity = 0;
    setTimeout(() => {
        if(isBurn) {
            mockTx.textContent = `Wallet ${addr}... just burned ${amount} $LUDO! 🔥`;
            mockTx.style.color = 'var(--text-muted)';
        } else {
            mockTx.textContent = `Wallet ${addr}... won ${amount * 5} $LUDO! 💰`;
            mockTx.style.color = 'var(--gold)';
        }
        mockTx.style.opacity = 1;
        mockTx.style.transition = "opacity 0.5s";
    }, 500);
}, 4000);