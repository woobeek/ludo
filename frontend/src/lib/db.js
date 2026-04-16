import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

export const supabase = (supabaseUrl && supabaseKey) 
    ? createClient(supabaseUrl, supabaseKey) 
    : null;

// Helper to get or init the global server seed in the DB
export async function getCurrentServerSeed() {
    if (!supabase) return crypto.randomBytes(32).toString('hex');

    const { data } = await supabase
        .from('server_state')
        .select('seed')
        .eq('id', 1)
        .single();
    
    if (!data) {
        const newSeed = crypto.randomBytes(32).toString('hex');
        await supabase.from('server_state').insert({ id: 1, seed: newSeed });
        return newSeed;
    }
    return data.seed;
}

export async function rotateServerSeed() {
    const newSeed = crypto.randomBytes(32).toString('hex');
    if (!supabase) return newSeed;
    await supabase.from('server_state').update({ seed: newSeed }).eq('id', 1);
    return newSeed;
}

export async function recordSpin(wallet, amount, isWin, type, signature = null) {
    if (!supabase) return null;

    if (signature) {
        // Simple replay attack prevention
        const { data } = await supabase.from('spins').select('id').eq('tx_signature', signature).single();
        if (data) throw new Error('Transaction already used for a spin');
    }

    try {
        const { data, error } = await supabase
            .from('spins')
            .insert([{ wallet, amount, is_win: isWin, type, tx_signature: signature }])
            .select('*')
            .single();

        if (error) throw error;
        return data;
    } catch (e) {
        console.error('Failed to record spin to DB', e);
        throw e;
    }
}

export async function getLeaderboard() {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
            .from('spins')
            .select('*')
            .eq('is_win', true)
            .order('amount', { ascending: false })
            .limit(10);
        if (error) return [];
        return data;
    } catch (e) {
        return [];
    }
}

export async function getLiveFeed() {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
            .from('spins')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);
        if (error) return [];
        return data;
    } catch (e) {
        return [];
    }
}
