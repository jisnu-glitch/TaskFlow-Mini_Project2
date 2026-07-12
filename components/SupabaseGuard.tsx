'use client';

import { useEffect, useState } from 'react';
import {
  hasClientSupabaseConfig,
  saveLocalDeviceEnvValues,
  saveSessionDeviceEnvValues,
} from '@/lib/device-env-vault';
import { resetSupabaseClient } from '@/lib/supabase';
import { Database, Eye, EyeOff, Globe, Loader2, LockKeyhole, Sparkles } from 'lucide-react';
import { enableDemoMode } from '@/lib/demo-db';

export function SupabaseGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleStartDemoMode = () => {
    enableDemoMode();
    window.location.assign('/dashboard');
  };

  // Bypass for public marketing page
  const isLanding = typeof window !== 'undefined' && window.location.pathname === '/landing';

  useEffect(() => {
    try {
      if (isLanding) { setState('ready'); return; }
      setState(hasClientSupabaseConfig() ? 'ready' : 'missing');
    } catch (err) {
      console.error('SupabaseGuard initialization error:', err);
      setState('missing');
    }
  }, [isLanding]);

  const handleConnect = async () => {
    const trimmedUrl = url.trim();
    const trimmedKey = anonKey.trim();

    if (!trimmedUrl || !trimmedKey) {
      setError('Enter both the Supabase URL and anon key.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        SUPABASE_URL: trimmedUrl,
        SUPABASE_ANON_KEY: trimmedKey,
      };

      if (remember) {
        saveLocalDeviceEnvValues(payload);
      } else {
        saveSessionDeviceEnvValues(payload);
      }

      resetSupabaseClient();
      setState('ready');
    } catch {
      setError('Failed to save configuration. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#e8fff5_0,#f7f9fc_38%,#f8f9fc_100%)]">
        <Loader2 size={24} className="animate-spin text-[#119c67]" />
      </div>
    );
  }

  if (state === 'missing') {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#e8fff5_0,#f7f9fc_38%,#f8f9fc_100%)] p-4 overflow-hidden">
        <button
          type="button"
          onClick={handleStartDemoMode}
          className="absolute top-8 right-0 flex items-center gap-2 rounded-l-2xl border border-r-0 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 px-5 py-2.5 text-xs font-black text-blue-700 hover:text-blue-800 transition-colors shadow-sm z-10"
        >
          <Sparkles size={14} />
          Try Dashboard with Demo Data (No Setup Needed)
        </button>
        <div className="w-full max-w-md rounded-[32px] border border-white/80 bg-white/85 p-6 shadow-[0_26px_90px_rgba(15,23,42,0.09)] backdrop-blur sm:p-7">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-[#3ecf8e]/25 bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#119c67] shadow-sm">
              <LockKeyhole size={14} />
              Connect Supabase
            </div>
            <h1 className="text-2xl font-black leading-tight tracking-tight text-gray-950">
              Connect your Supabase project
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-500">
              Enter your Supabase URL and anon key. They will be stored in this browser so you do not need server environment variables.
            </p>
          </div>

          <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_14px_45px_rgba(15,23,42,0.04)]">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9fbf4] text-[#119c67]">
                  <Globe size={18} />
                </div>
                <div className="min-w-0">
                  <label htmlFor="supabase-url" className="block text-sm font-bold text-gray-950">
                    Supabase Project URL <span className="ml-1 text-red-500">*</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="relative">
              <input
                id="supabase-url"
                type="url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(''); }}
                placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
                className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 font-mono text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3ecf8e] focus:bg-white focus:ring-4 focus:ring-[#3ecf8e]/10"
              />
            </div>
          </div>

          <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_14px_45px_rgba(15,23,42,0.04)]">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9fbf4] text-[#119c67]">
                  <Database size={18} />
                </div>
                <div className="min-w-0">
                  <label htmlFor="supabase-anon-key" className="block text-sm font-bold text-gray-950">
                    Supabase Anon Key <span className="ml-1 text-red-500">*</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="relative">
              <input
                id="supabase-anon-key"
                type={showKey ? 'text' : 'password'}
                value={anonKey}
                onChange={(e) => { setAnonKey(e.target.value); setError(''); }}
                placeholder="sb_publishable_xxxxxxxxxxxx"
                className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 pr-12 font-mono text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3ecf8e] focus:bg-white focus:ring-4 focus:ring-[#3ecf8e]/10"
              />
              <button
                type="button"
                onClick={() => setShowKey(prev => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-700"
                aria-label={showKey ? 'Hide anon key' : 'Show anon key'}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <label className="mb-5 flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-[#21b978] focus:ring-[#3ecf8e]"
            />
            Remember on this device (stores in browser storage)
          </label>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleConnect}
            disabled={saving}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#21b978] px-5 py-4 text-sm font-black text-white shadow-lg shadow-[#21b978]/20 transition hover:bg-[#119c67] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Database size={18} />}
            {saving ? 'Connecting...' : 'Connect to Supabase'}
          </button>

          <p className="mt-4 text-center text-xs leading-relaxed text-gray-400">
            Your keys are stored only in this browser. They are never sent to our servers.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
