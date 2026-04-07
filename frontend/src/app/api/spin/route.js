import { NextResponse } from 'next/server';
import { recordSpin } from '../../../lib/db';

export async function POST(request) {
    try {
        const body = await request.json();
        const { wallet, amount, isWin, type } = body;
        
        if (!wallet || amount === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        
        const feedItem = recordSpin(wallet, amount, isWin, type);
        return NextResponse.json({ success: true, feedItem });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to record spin' }, { status: 500 });
    }
}
