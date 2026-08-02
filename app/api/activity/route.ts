import { NextResponse } from 'next/server';
import { getSupabaseForRequest } from '@/lib/server-supabase-helper';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        const supabase = getSupabaseForRequest(request);
        const { data: logs } = userId ? await supabase.from('activity_logs').select('*').eq('user_id', userId) : await supabase.from('activity_logs').select('*');
        return NextResponse.json(logs || []);
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to fetch activity' }, { status: 500 });
    }
}
