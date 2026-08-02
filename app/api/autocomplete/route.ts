import { NextResponse } from 'next/server';
import { getSupabaseForRequest } from '@/lib/server-supabase-helper';

const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : 'Unknown error';

export async function GET(request: Request) {
    try {
        const supabase = getSupabaseForRequest(request);
        const { data, error } = await supabase.rpc('get_autocomplete_data');
        if (!error && data && typeof data === 'object') {
            return NextResponse.json(data);
        }

        const [users, tasks] = await Promise.all([
            supabase.from('users').select('skills'),
            supabase.from('tasks').select('tags, title'),
        ]);
        const skills = Array.from(new Set((users.data || []).flatMap((u: any) => u.skills || [])));
        const tags = Array.from(new Set((tasks.data || []).flatMap((t: any) => t.tags || [])));
        const titles = (tasks.data || []).map((t: any) => t.title);
        return NextResponse.json({ skills, tags, titles });
    } catch (error) {
        console.error('Autocomplete fetch error:', error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
