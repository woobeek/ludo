import { NextResponse } from 'next/server';
import { getLiveFeed } from '../../../lib/db';

export async function GET() {
    const feed = await getLiveFeed();
    return NextResponse.json(feed);
}
