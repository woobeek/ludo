import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Server-side seed persistence (In-memory for simplicity on Vercel)
// In a high-traffic app, this should be in Redis/KV.
let serverSeed = crypto.randomBytes(32).toString('hex');

export async function GET() {
    // Return ONLY the hash of the server seed (commitment)
    // The player sees the hash, but doesn't know the seed yet.
    const hash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    return NextResponse.json({ hash });
}

export async function POST(request) {
    try {
        const { clientSeed, nonce } = await request.json();
        
        // Generate the result using the server seed
        const combined = `${serverSeed}:${clientSeed}:${nonce}`;
        const finalHash = crypto.createHash('sha256').update(combined).digest('hex');
        
        // NEW server seed for the NEXT spin
        const oldSeed = serverSeed;
        serverSeed = crypto.randomBytes(32).toString('hex');
        const nextHash = crypto.createHash('sha256').update(serverSeed).digest('hex');

        return NextResponse.json({ 
            hash: finalHash, 
            serverSeed: oldSeed, // Reveal the OLD seed so the player can verify
            nextServerHash: nextHash 
        });
    } catch (e) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
