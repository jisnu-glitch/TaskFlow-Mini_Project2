import {
  clearCachedDeviceEnvValues,
  hasClientSupabaseConfig as hasVaultSupabaseConfig,
  resolveClientEnvValues,
} from './device-env-vault';

export type BrowserSupabaseConfig = {
  url: string;
  anonKey: string;
};

function normalizeConfig(config: Partial<BrowserSupabaseConfig> | null | undefined) {
  const url = typeof config?.url === 'string' ? config.url.trim() : '';
  const anonKey = typeof config?.anonKey === 'string' ? config.anonKey.trim() : '';

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export function getStoredSupabaseConfig(): BrowserSupabaseConfig | null {
  const values = resolveClientEnvValues();
  return normalizeConfig({
    url: values.SUPABASE_URL,
    anonKey: values.SUPABASE_ANON_KEY,
  });
}

export function resolveClientSupabaseConfig(): BrowserSupabaseConfig | null {
  return getStoredSupabaseConfig();
}

export function hasClientSupabaseConfig(): boolean {
  return hasVaultSupabaseConfig();
}

export function saveSupabaseConfig(): void {
  throw new Error('saveSupabaseConfig has been replaced by saveDeviceEnvVault.');
}

export function clearSupabaseConfig(): void {
  clearCachedDeviceEnvValues();
}
