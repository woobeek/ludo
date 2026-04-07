import { NextResponse } from 'next/server';
import { getFeed } from '../../../lib/db';

export async function GET() {
    return NextResponse.json(getFeed());
}
