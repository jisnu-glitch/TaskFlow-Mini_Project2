export type DeviceEnvValues = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_ACCESS_TOKEN: string;
  GITHUB_ACCESS_TOKEN: string;
  ALTCHA_HMAC_SECRET: string;
  ALTCHA_HMAC_KEY_SECRET: string;
  INDIEPITCHER_API_KEY: string;
};

type StoredDeviceEnvVault = {
  version: 1;
  salt: string;
  iv: string;
  cipherText: string;
  updatedAt: string;
};

const DEVICE_ENV_VAULT_STORAGE_KEY = 'taskflow.device.env.vault.v1';
const DEVICE_ENV_SESSION_CACHE_KEY = 'taskflow.device.env.cache.v1';
const DEVICE_ENV_LOCAL_STORAGE_KEY = 'taskflow.device.env.local.v1';

const EMPTY_DEVICE_ENV_VALUES: DeviceEnvValues = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  SUPABASE_ACCESS_TOKEN: '',
  GITHUB_ACCESS_TOKEN: '',
  ALTCHA_HMAC_SECRET: '',
  ALTCHA_HMAC_KEY_SECRET: '',
  INDIEPITCHER_API_KEY: '',
};

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

function normalizeEnvValues(
  values: Partial<DeviceEnvValues> | null | undefined
): DeviceEnvValues {
  const getStr = (val: any) => typeof val === 'string' ? val.trim() : '';
  return {
    SUPABASE_URL: getStr(values?.SUPABASE_URL),
    SUPABASE_ANON_KEY: getStr(values?.SUPABASE_ANON_KEY),
    SUPABASE_ACCESS_TOKEN: getStr(values?.SUPABASE_ACCESS_TOKEN),
    GITHUB_ACCESS_TOKEN: getStr(values?.GITHUB_ACCESS_TOKEN),
    ALTCHA_HMAC_SECRET: getStr(values?.ALTCHA_HMAC_SECRET),
    ALTCHA_HMAC_KEY_SECRET: getStr(values?.ALTCHA_HMAC_KEY_SECRET),
    INDIEPITCHER_API_KEY: getStr(values?.INDIEPITCHER_API_KEY),
  };
}

async function deriveVaultKey(secret: string, salt: ArrayBuffer) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 250000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptVault(secret: string, values: DeviceEnvValues) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveVaultKey(secret, toArrayBuffer(salt));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    encoder.encode(JSON.stringify(values))
  );

  return {
    version: 1,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    cipherText: bytesToBase64(new Uint8Array(cipherBuffer)),
    updatedAt: new Date().toISOString(),
  } satisfies StoredDeviceEnvVault;
}

async function decryptVault(secret: string, vault: StoredDeviceEnvVault) {
  const decoder = new TextDecoder();
  const key = await deriveVaultKey(secret, toArrayBuffer(base64ToBytes(vault.salt)));
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(vault.iv)) },
    key,
    toArrayBuffer(base64ToBytes(vault.cipherText))
  );

  return normalizeEnvValues(
    JSON.parse(decoder.decode(decryptedBuffer)) as Partial<DeviceEnvValues>
  );
}

function getPublicEnvFallback(): Partial<DeviceEnvValues> {
  return {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  };
}

export function getCachedDeviceEnvValues(): DeviceEnvValues | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(DEVICE_ENV_SESSION_CACHE_KEY);
    if (!raw) {
      return null;
    }

    return normalizeEnvValues(JSON.parse(raw) as Partial<DeviceEnvValues>);
  } catch {
    return null;
  }
}

export function getLocalDeviceEnvValues(): DeviceEnvValues | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(DEVICE_ENV_LOCAL_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return normalizeEnvValues(JSON.parse(raw) as Partial<DeviceEnvValues>);
  } catch {
    return null;
  }
}

function setCachedDeviceEnvValues(values: DeviceEnvValues) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(
    DEVICE_ENV_SESSION_CACHE_KEY,
    JSON.stringify(normalizeEnvValues(values))
  );
}

export function clearCachedDeviceEnvValues() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(DEVICE_ENV_SESSION_CACHE_KEY);
}

function setSupabaseCookies(values: Partial<DeviceEnvValues>, persist: boolean) {
  if (typeof window === 'undefined') return;

  const url = values.SUPABASE_URL?.trim();
  const anonKey = values.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return;

  const maxAge = persist ? '; maxAge=2592000; path=/; sameSite=lax' : '; path=/; sameSite=lax';
  const secure = window.location.protocol === 'https:' ? '; secure' : '';

  document.cookie = `sb_url=${encodeURIComponent(url)}${maxAge}${secure}`;
  document.cookie = `sb_anon_key=${encodeURIComponent(anonKey)}${maxAge}${secure}`;
}

export function saveLocalDeviceEnvValues(values: Partial<DeviceEnvValues>) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    DEVICE_ENV_LOCAL_STORAGE_KEY,
    JSON.stringify(normalizeEnvValues(values))
  );

  setSupabaseCookies(values, true);
}

export function clearLocalDeviceEnvValues() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(DEVICE_ENV_LOCAL_STORAGE_KEY);
}

export function getStoredDeviceEnvVault(): StoredDeviceEnvVault | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(DEVICE_ENV_VAULT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as StoredDeviceEnvVault;
  } catch {
    return null;
  }
}

export function hasStoredDeviceEnvVault(): boolean {
  return getStoredDeviceEnvVault() !== null;
}

export async function saveDeviceEnvVault(secret: string, values: DeviceEnvValues) {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = normalizeEnvValues(values);
  const encryptedVault = await encryptVault(secret, normalized);
  window.localStorage.setItem(
    DEVICE_ENV_VAULT_STORAGE_KEY,
    JSON.stringify(encryptedVault)
  );
  setCachedDeviceEnvValues(normalized);
}

export async function unlockDeviceEnvVault(secret: string) {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedVault = getStoredDeviceEnvVault();
  if (!storedVault) {
    return null;
  }

  const values = await decryptVault(secret, storedVault);
  setCachedDeviceEnvValues(values);
  setSupabaseCookies(values, true);
  return values;
}

export function clearDeviceEnvVault() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(DEVICE_ENV_VAULT_STORAGE_KEY);
  clearCachedDeviceEnvValues();
}

export function resolveClientEnvValues(): DeviceEnvValues {
  const cachedValues = getCachedDeviceEnvValues();
  const localValues = getLocalDeviceEnvValues();
  return normalizeEnvValues({
    ...getPublicEnvFallback(),
    ...localValues,
    ...cachedValues,
  });
}

export function saveSessionDeviceEnvValues(values: Partial<DeviceEnvValues>) {
  const normalized = normalizeEnvValues(values);
  setCachedDeviceEnvValues(normalized);
  setSupabaseCookies(normalized, false);
}

export function hasClientSupabaseConfig(): boolean {
  const values = resolveClientEnvValues();
  return Boolean(values.SUPABASE_URL && values.SUPABASE_ANON_KEY);
}
