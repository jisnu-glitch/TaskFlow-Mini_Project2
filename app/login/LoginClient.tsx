'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getSiteUrl } from '@/lib/site-url';
import { getSupabase, resetSupabaseClient } from '../../lib/supabase';
import { getPendingFirstAdminSetup, pendingFirstAdminMatches } from '@/lib/first-admin-setup';
import {
  hasClientSupabaseConfig,
  getLocalDeviceEnvValues,
  resolveClientEnvValues,
  saveLocalDeviceEnvValues,
  saveSessionDeviceEnvValues,
} from '@/lib/device-env-vault';
import { Modal } from '@/components/ui/Modal';
import 'altcha';
import { apiFetch } from '@/lib/api/fetchWithSupabase';

import { isDemoMode } from '@/lib/demo-db';

export default function LoginClient() {
  const { currentUser, isLoading, authError, setAuthError } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [altchaPayload, setAltchaPayload] = useState<string | null>(null);
  const [altchaVerified, setAltchaVerified] = useState(false);
  const [supabaseConfigModalOpen, setSupabaseConfigModalOpen] = useState(false);
  const [supabaseConfigNotice, setSupabaseConfigNotice] = useState('');
  const [supabaseConfigError, setSupabaseConfigError] = useState('');
  const [supabaseConfigSaving, setSupabaseConfigSaving] = useState(false);
  const [rememberSupabaseConfig, setRememberSupabaseConfig] = useState(true);
  const [supabaseConfigValues, setSupabaseConfigValues] = useState({
    url: '',
    anonKey: '',
  });
  const formRef = useRef<HTMLFormElement | null>(null);
  const altchaRef = useRef<HTMLElement | null>(null);
  const altchaWidgetStyle: React.CSSProperties & Record<`--${string}`, string> = {
    '--altcha-max-width': '100%',
    '--altcha-padding': '0.48rem',
    '--altcha-border-radius': '14px',
    '--altcha-border-color': '#c7d2fe',
    '--altcha-checkbox-size': '18px',
    '--altcha-color-base': '#f8fbff',
    '--altcha-color-base-content': '#111827',
    '--altcha-color-neutral': '#dbeafe',
    '--altcha-color-neutral-content': '#4b5563',
    '--altcha-color-primary': '#2563eb',
    '--altcha-color-success': '#16a34a',
    display: 'block',
    width: '100%',
  };

  useEffect(() => {
    const syncPayloadFromForm = () => {
      const widget =
        altchaRef.current ||
        document.querySelector<HTMLElement>('altcha-widget');
      const formPayload = formRef.current
        ?.querySelector<HTMLInputElement>('input[name="altcha"]')
        ?.value;
      const widgetPayload = widget ? ((widget as any)?.payload as string | undefined) : '';
      const shadowPayload = (widget?.shadowRoot
        ?.querySelector<HTMLInputElement>('input[name="altcha"]')
        ?.value) || '';
      const widgetState = (widget as any)?.getState?.();
      const widgetText = `${widget?.textContent ?? ''} ${widget?.shadowRoot?.textContent ?? ''}`.toLowerCase();
      const nextPayload = formPayload || widgetPayload || shadowPayload;

      if (nextPayload) {
        setAltchaPayload(nextPayload);
        setAltchaVerified(true);
        setError('');
        return true;
      }

      if (widgetState === 'verified' || widgetText.includes('verified')) {
        setAltchaVerified(true);
        setError('');
        return true;
      }

      return false;
    };

    const onVerified = (event: Event) => {
      const detail = (event as CustomEvent<{ payload?: string | null }>).detail;
      const payload = detail?.payload;

      if (payload) {
        setAltchaPayload(payload);
        setAltchaVerified(true);
        setError('');
        return;
      }

      window.setTimeout(syncPayloadFromForm, 0);
    };

    const onStateChange = (event: Event) => {
      const detail = (event as CustomEvent<{ state?: string }>).detail;
      if (!detail?.state) return;

      if (detail.state === 'verified') {
        const payload = (event as CustomEvent<{ payload?: string | null }>).detail.payload;
        if (payload) {
          setAltchaPayload(payload);
          setAltchaVerified(true);
          setError('');
        } else {
          window.setTimeout(syncPayloadFromForm, 0);
        }
        return;
      }

      if (detail.state === 'unverified' || detail.state === 'error' || detail.state === 'expired') {
        setAltchaPayload(null);
        setAltchaVerified(false);
      }
    };

    const onExpired = () => {
      setAltchaPayload(null);
      setAltchaVerified(false);
    };

    const attachListeners = () => {
      const widget =
        altchaRef.current ||
        document.querySelector<HTMLElement>('altcha-widget');
      if (!widget) return null;

      widget.addEventListener('verified', onVerified);
      widget.addEventListener('statechange', onStateChange);
      widget.addEventListener('expired', onExpired);
      return widget;
    };

    let attachedWidget = attachListeners();
    const payloadSyncInterval = window.setInterval(() => {
      if (!attachedWidget) {
        attachedWidget = attachListeners();
      }
      syncPayloadFromForm();
    }, 250);

    return () => {
      window.clearInterval(payloadSyncInterval);
      attachedWidget?.removeEventListener('verified', onVerified);
      attachedWidget?.removeEventListener('statechange', onStateChange);
      attachedWidget?.removeEventListener('expired', onExpired);
    };
  }, []);

  useEffect(() => {
    if (isDemoMode()) {
      router.replace('/dashboard');
      return;
    }
    // Log whether Supabase client config is available on the client.
    try {
      const vals = resolveClientEnvValues();
      const hasConfig = hasClientSupabaseConfig();
      const storedLocal = getLocalDeviceEnvValues();
      const issue = searchParams.get('issue');
      console.debug('[Env] Supabase client config present:', {
        hasConfig,
        url: vals.SUPABASE_URL ? '<present>' : '<missing>',
        anonKeyPresent: vals.SUPABASE_ANON_KEY ? true : false,
      });
      setSupabaseConfigValues({
        url: vals.SUPABASE_URL ?? '',
        anonKey: vals.SUPABASE_ANON_KEY ?? '',
      });
      if (storedLocal?.SUPABASE_URL && storedLocal?.SUPABASE_ANON_KEY) {
        setRememberSupabaseConfig(true);
      }
      if (issue === 'supabase') {
        setSupabaseConfigNotice('Supabase configuration is missing. Enter it to continue.');
      }
      setSupabaseConfigModalOpen(!hasConfig || issue === 'supabase');
    } catch (e) {
      console.debug('[Env] Error checking Supabase client config', e);
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!isLoading && currentUser) {
      const next = searchParams.get('next');
      router.replace(next || '/dashboard');
    }
  }, [currentUser, isLoading, router, searchParams]);

  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  const loginRedirectUrl = getSiteUrl('/login');

  const resetAltcha = () => {
    setAltchaPayload(null);
    setAltchaVerified(false);
    (altchaRef.current as any)?.reset?.();
  };

  const showAltchaRequiredMessage = () => {
    setSuccess('');
    setError('Please complete CAPTCHA verification before signing in.');
  };

  const getAltchaPayload = () => {
    if (altchaPayload) {
      return altchaPayload;
    }

    const formPayload = formRef.current
      ?.querySelector<HTMLInputElement>('input[name="altcha"]')
      ?.value;

    if (formPayload) {
      setAltchaPayload(formPayload);
      setAltchaVerified(true);
      return formPayload;
    }

    return null;
  };

  const verifyAltcha = async () => {
    let payload = getAltchaPayload();

    if (!payload && altchaVerified) {
      const verifyResult = await (altchaRef.current as any)?.verify?.().catch(() => null);
      payload = verifyResult?.payload ?? getAltchaPayload();

      if (payload) {
        setAltchaPayload(payload);
      }
    }

    if (!payload) {
      showAltchaRequiredMessage();
      return false;
    }

    const verifyRes = await apiFetch('/api/altcha/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload })
    });

    const verifyData = await verifyRes.json().catch(() => ({ success: false }));

    if (!verifyRes.ok || !verifyData.success) {
      setError(verifyData.error || 'ALTCHA verification failed. Please try again.');
      resetAltcha();
      return false;
    }

    return true;
  };

  const tryConfirmPendingSetupAdmin = async () => {
    const pendingAdmin = getPendingFirstAdminSetup();
    if (!pendingFirstAdminMatches(pendingAdmin, 'email', email)) {
      return false;
    }

    const envValues = resolveClientEnvValues();
    if (!envValues.SUPABASE_URL || !envValues.SUPABASE_ACCESS_TOKEN) {
      return false;
    }

    const supabase = getSupabase();
    const { data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: loginRedirectUrl,
      },
    });

    if (!data.user?.id) {
      return false;
    }

    const confirmResponse = await apiFetch('/api/setup/confirm-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supabaseUrl: envValues.SUPABASE_URL,
        accessToken: envValues.SUPABASE_ACCESS_TOKEN,
        userId: data.user.id,
        email,
      }),
    });

    return confirmResponse.ok;
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setAuthError('');
    setSubmitting(true);
    let shouldResetAltcha = true;

    try {
      const altchaValid = await verifyAltcha();
      if (!altchaValid) return;

      const supabase = getSupabase();

      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: loginRedirectUrl
          }
        });

        if (signUpError) {
          setError(signUpError.message);
        } else {
          setSuccess('Check your email for a verification link. Once verified, you can sign in.');
          setEmail('');
          setPassword('');
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) {
          if (signInError.message.includes('Email not confirmed')) {
            const confirmed = await tryConfirmPendingSetupAdmin();
            if (confirmed) {
              const { error: retryError } = await supabase.auth.signInWithPassword({
                email,
                password
              });

              if (!retryError) {
                shouldResetAltcha = false;
                setSuccess('Signing you in...');
                router.replace('/dashboard');
                return;
              }
            }

            setError('Please verify your email before signing in. Check your inbox for the verification link.');
          } else {
            setError(signInError.message);
          }
        } else {
          shouldResetAltcha = false;
          setSuccess('Signing you in...');
          router.replace('/dashboard');
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Missing Supabase client configuration')) {
        setError('Supabase client configuration is missing. Please enter it to continue.');
        setSupabaseConfigNotice('Supabase configuration is missing. Enter it to continue.');
        setSupabaseConfigModalOpen(true);
        return;
      }

      setError('An unexpected error occurred. Please try again.');
      console.error('Auth error:', err);
    } finally {
      if (shouldResetAltcha) {
        resetAltcha();
      }
      setSubmitting(false);
    }
  };

  const handleSaveSupabaseConfig = () => {
    const url = supabaseConfigValues.url.trim();
    const anonKey = supabaseConfigValues.anonKey.trim();

    if (!url || !anonKey) {
      setSupabaseConfigError('Enter both the Supabase URL and anon key.');
      return;
    }

    setSupabaseConfigSaving(true);
    setSupabaseConfigError('');

    try {
      const payload = {
        SUPABASE_URL: url,
        SUPABASE_ANON_KEY: anonKey,
      };

      if (rememberSupabaseConfig) {
        saveLocalDeviceEnvValues(payload);
      } else {
        saveSessionDeviceEnvValues(payload);
      }
      resetSupabaseClient();
      setSupabaseConfigNotice('');
      setSupabaseConfigModalOpen(false);
    } catch (err) {
      console.error('[Env] Failed to save Supabase client config', err);
      setSupabaseConfigError('Unable to save Supabase configuration.');
    } finally {
      setSupabaseConfigSaving(false);
    }
  };

  const signInWithGoogle = async () => {
    setError('');
    setSuccess('');
    setAuthError('');
    console.debug('[Auth] signInWithGoogle clicked');
    const altchaValid = await verifyAltcha();
    if (!altchaValid) return;
    try {
      const supabase = getSupabase();
      console.debug('[Auth] calling supabase.auth.signInWithOAuth google', { redirectTo: loginRedirectUrl });
      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: loginRedirectUrl
        }
      });
      console.debug('[Auth] signInWithOAuth result', { data, error: signInError });

      if (signInError) {
        setError(signInError.message);
        resetAltcha();
        return;
      }

      // Some Supabase client versions return a `data.url` instead of performing
      // the redirect automatically. If present, navigate the browser.
      if (data?.url) {
        console.debug('[Auth] redirecting to provider URL', data.url);
        window.location.assign(data.url);
      }
    } catch (e) {
      console.error('[Auth] signInWithOAuth google error', e);
      if (e instanceof Error && e.message.includes('Missing Supabase client configuration')) {
        setError('Supabase client configuration is missing. Please enter it to continue.');
        setSupabaseConfigNotice('Supabase configuration is missing. Enter it to continue.');
        setSupabaseConfigModalOpen(true);
      } else {
        setError('Unable to start Google OAuth.');
      }
      resetAltcha();
    }
  };

  const signInWithGithub = async () => {
    setError('');
    setSuccess('');
    setAuthError('');
    console.debug('[Auth] signInWithGithub clicked');
    const altchaValid = await verifyAltcha();
    if (!altchaValid) return;
    try {
      const supabase = getSupabase();
      console.debug('[Auth] calling supabase.auth.signInWithOAuth github', { redirectTo: loginRedirectUrl });
      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: loginRedirectUrl
        }
      });
      console.debug('[Auth] signInWithOAuth result', { data, error: signInError });

      if (signInError) {
        setError(signInError.message);
        resetAltcha();
        return;
      }

      if (data?.url) {
        console.debug('[Auth] redirecting to provider URL', data.url);
        window.location.assign(data.url);
      }
    } catch (e) {
      console.error('[Auth] signInWithOAuth github error', e);
      if (e instanceof Error && e.message.includes('Missing Supabase client configuration')) {
        setError('Supabase client configuration is missing. Please enter it to continue.');
        setSupabaseConfigNotice('Supabase configuration is missing. Enter it to continue.');
        setSupabaseConfigModalOpen(true);
      } else {
        setError('Unable to start GitHub OAuth.');
      }
      resetAltcha();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen overflow-y-auto flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-6 w-full max-w-md">
        <div className="text-center mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 overflow-hidden">
            <img src="/icon.svg" alt="TaskFlow" className="h-full w-auto" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Welcome to TaskFlow</h1>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'signin' ? 'Sign in to continue' : 'Create your account'}
          </p>
        </div>

        <form ref={formRef} onSubmit={handleEmailAuth} className="space-y-3 mb-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Min 6 characters' : '********'}
              required
              minLength={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
            />
          </div>

          <div>
            <altcha-widget
              ref={altchaRef}
              challenge="/api/altcha/challenge"
              type="checkbox"
              auto="off"
              configuration='{"hideFooter":true}'
              className="block w-full rounded-[15px] shadow-sm ring-1 ring-blue-100"
              style={altchaWidgetStyle}
            />
          </div>

          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="p-2.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !altchaVerified}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
          >
            {submitting ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-white text-gray-400">or continue with</span>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={signInWithGoogle}
            disabled={!altchaVerified}
            className="w-full py-2.5 px-4 border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed text-gray-800 font-medium rounded-xl transition-colors flex items-center justify-center gap-3"
          >
            <img
              src="https://www.svgrepo.com/show/475656/google-color.svg"
              alt="Google"
              className={`w-5 h-5 ${!altchaVerified ? 'opacity-40 grayscale' : ''}`}
            />
            Continue with Google
          </button>

          <button
            onClick={signInWithGithub}
            disabled={!altchaVerified}
            className="w-full py-2.5 px-4 border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed text-gray-800 font-medium rounded-xl transition-colors flex items-center justify-center gap-3"
          >
            <img
              src="https://www.svgrepo.com/show/512317/github-142.svg"
              alt="GitHub"
              className={`w-5 h-5 ${!altchaVerified ? 'opacity-40 grayscale' : ''}`}
            />
            Continue with GitHub
          </button>
        </div>
      </div>

      <Modal
        isOpen={supabaseConfigModalOpen}
        onClose={() => setSupabaseConfigModalOpen(false)}
        title="Missing Supabase configuration"
        maxWidth="max-w-md"
      >
        <div className="p-5 space-y-4">
          {supabaseConfigNotice && (
            <div className="text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg p-2">
              {supabaseConfigNotice}
            </div>
          )}
          <p className="text-sm text-gray-600">
            Enter your Supabase URL and anon key to continue. You can keep it for this session or store it on this device.
          </p>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={rememberSupabaseConfig}
              onChange={(e) => setRememberSupabaseConfig(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Remember on this device (stores in browser storage)
          </label>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supabase URL</label>
              <input
                type="url"
                value={supabaseConfigValues.url}
                onChange={(e) => {
                  setSupabaseConfigError('');
                  setSupabaseConfigNotice('');
                  setSupabaseConfigValues(prev => ({ ...prev, url: e.target.value }));
                }}
                placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supabase anon key</label>
              <input
                type="password"
                value={supabaseConfigValues.anonKey}
                onChange={(e) => {
                  setSupabaseConfigError('');
                  setSupabaseConfigNotice('');
                  setSupabaseConfigValues(prev => ({ ...prev, anonKey: e.target.value }));
                }}
                placeholder="sb_publishable_xxxxxxxxxxxx"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              />
            </div>
          </div>
          {supabaseConfigError && (
            <div className="text-sm text-red-600">{supabaseConfigError}</div>
          )}
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => window.location.assign('/setup')}
              className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Open setup
            </button>
            <button
              type="button"
              onClick={handleSaveSupabaseConfig}
              disabled={supabaseConfigSaving}
              className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {supabaseConfigSaving ? 'Saving...' : 'Save for this session'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
