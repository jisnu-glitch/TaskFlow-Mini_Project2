import { createClient } from '@supabase/supabase-js';

export type SchemaProbeResult =
  | { status: 'exists' }
  | { status: 'missing' }
  | { status: 'error'; error: string };

export async function probeSupabaseSchema(url: string, anonKey: string): Promise<SchemaProbeResult> {
  const client = createClient(url.trim(), anonKey.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await client.from('users').select('id').limit(1);

  if (!error) return { status: 'exists' };

  const code = typeof (error as any)?.code === 'string' ? (error as any).code : '';
  const message = typeof (error as any)?.message === 'string' ? (error as any).message : '';

  if (
    code === '42P01' ||
    code === 'PGRST205' ||
    /relation "?public\.users"? does not exist/i.test(message)
  ) {
    return { status: 'missing' };
  }

  if (/unable to connect|failed to fetch|network|fetch/i.test(message)) {
    return { status: 'error', error: 'Could not reach Supabase. Check the URL and make sure the project is active.' };
  }

  return { status: 'exists' };
}
