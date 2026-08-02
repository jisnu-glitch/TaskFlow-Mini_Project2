import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabase-admin';

type ReqLike = { headers?: { get: (name: string) => string | null } } | { headers?: Headers } | undefined;

function getHeader(req: ReqLike, name: string): string | null {
  if (!req || !req.headers) return null;
  const h = req.headers as { get: (n: string) => string | null };
  try {
    return h.get(name);
  } catch {
    return null;
  }
}

function getCookie(req: ReqLike, name: string): string | null {
  const cookieHeader = getHeader(req, 'cookie');
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const entry = part.trim();
    const idx = entry.indexOf('=');
    if (idx === -1) continue;
    const key = entry.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(entry.slice(idx + 1).trim());
    }
  }
  return null;
}

export function getSupabaseForRequest(req?: ReqLike): SupabaseClient {
  // Prefer admin client when server service role is available
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return getSupabaseAdmin();
  }

  // Look for per-request headers supplied by client vault (via apiFetch)
  const headerUrl = getHeader(req, 'x-supabase-url') || getHeader(req, 'x-supabase-url'.toLowerCase());
  const headerAnon = getHeader(req, 'x-supabase-anon-key') || getHeader(req, 'x-supabase-anon-key'.toLowerCase());

  if (headerUrl && headerAnon) {
    return createClient(headerUrl, headerAnon);
  }

  // Fallback to cookies set by the browser vault (for direct requests without apiFetch)
  const cookieUrl = getCookie(req, 'sb_url');
  const cookieAnon = getCookie(req, 'sb_anon_key');
  if (cookieUrl && cookieAnon) {
    return createClient(cookieUrl, cookieAnon);
  }

  // Fallback to environment public keys if present
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const envAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (envUrl && envAnon) {
    return createClient(envUrl, envAnon);
  }

  throw new Error('Missing SUPABASE configuration on server. Provide SUPABASE_SERVICE_ROLE_KEY or send anon keys in request headers.');
}
