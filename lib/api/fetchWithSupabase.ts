import { resolveClientEnvValues, getCachedDeviceEnvValues } from '@/lib/device-env-vault';
import { isDemoMode, handleDemoApiRequest } from '@/lib/demo-db';

export async function apiFetch(input: RequestInfo, init?: RequestInit) {
  if (isDemoMode()) {
    const url = typeof input === 'string' ? input : (input as Request).url;
    try {
      const mockResult = await handleDemoApiRequest(url, init);
      if (mockResult !== null) {
        return new Response(JSON.stringify(mockResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (e) {
      console.error('Error handling mock API request:', e);
    }
  }

  const origHeaders = new Headers(init?.headers as HeadersInit || {});

  const env = resolveClientEnvValues();
  const cached = getCachedDeviceEnvValues();

  const supabaseUrl = env.SUPABASE_URL || cached?.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnon = env.SUPABASE_ANON_KEY || env.SUPABASE_ACCESS_TOKEN || cached?.SUPABASE_ANON_KEY || cached?.SUPABASE_ACCESS_TOKEN || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (supabaseUrl && supabaseAnon) {
    origHeaders.set('x-supabase-url', supabaseUrl);
    origHeaders.set('x-supabase-anon-key', supabaseAnon);
  }

  const merged: RequestInit = { ...(init || {}), headers: origHeaders };
  return fetch(input, merged);
}
