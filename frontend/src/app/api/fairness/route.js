import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentServerSeed, rotateServerSeed } from '../../../lib/db';

export async function GET() {
    const serverSeed = await getCurrentServerSeed();
    const hash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    return NextResponse.json({ hash });
}

export async function POST(request) {
    try {
        const { clientSeed, nonce } = await request.json();
        
        const serverSeed = await getCurrentServerSeed();
        const combined = `${serverSeed}:${clientSeed}:${nonce}`;
        const finalHash = crypto.createHash('sha256').update(combined).digest('hex');
        
        const oldSeed = serverSeed;
        const newSeed = await rotateServerSeed();
        const nextHash = crypto.createHash('sha256').update(newSeed).digest('hex');

        return NextResponse.json({ 
            hash: finalHash, 
            serverSeed: oldSeed,
            nextServerHash: nextHash 
        });
    } catch (e) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
