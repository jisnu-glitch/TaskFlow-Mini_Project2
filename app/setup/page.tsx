'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  ExternalLink,
  Globe,
  Github,
  Key,
  Loader2,
  LockKeyhole,
  Mail,
  Shield,
  SlidersHorizontal,
  UserPlus,
  Sparkles,
} from 'lucide-react';
import { enableDemoMode } from '@/lib/demo-db';
import { getSiteUrl } from '@/lib/site-url';
import {
  getCachedDeviceEnvValues,
  getStoredDeviceEnvVault,
  resolveClientEnvValues,
  saveDeviceEnvVault,
  unlockDeviceEnvVault,
  type DeviceEnvValues,
} from '@/lib/device-env-vault';
import { apiFetch } from '@/lib/api/fetchWithSupabase';
import { savePendingFirstAdminSetup, type FirstAdminProvider } from '@/lib/first-admin-setup';
import { resetSupabaseClient } from '@/lib/supabase';

type StepStatus = 'idle' | 'loading' | 'success' | 'error';

type FieldConfig = {
  key: keyof DeviceEnvValues;
  label: string;
  envName: string;
  placeholder: string;
  description: string;
  docsHref: string;
  docsLabel: string;
  icon: React.ReactNode;
  required?: boolean;
};

const FIELD_CONFIGS: FieldConfig[] = [
  {
    key: 'SUPABASE_URL',
    label: 'Supabase Project URL',
    envName: 'NEXT_PUBLIC_SUPABASE_URL',
    placeholder: 'https://xxxxxxxxxxxxxxxxxxxx.supabase.co',
    description: 'Required. Used by the browser app to connect directly to your Supabase project.',
    docsHref: 'https://supabase.com/dashboard/projects',
    docsLabel: 'Supabase project settings',
    icon: <Globe size={18} />,
    required: true,
  },
  {
    key: 'SUPABASE_ANON_KEY',
    label: 'Supabase Publishable / Anon Key',
    envName: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    placeholder: 'sb_publishable_xxxxxxxxxxxx',
    description: 'Required. Paste the key that starts with sb_publishable_. Older Supabase projects may call this the anon public key.',
    docsHref: 'https://supabase.com/docs/guides/api/api-keys',
    docsLabel: 'Supabase API keys',
    icon: <Database size={18} />,
    required: true,
  },
  {
    key: 'SUPABASE_ACCESS_TOKEN',
    label: 'Supabase Access Token',
    envName: 'SUPABASE_ACCESS_TOKEN',
    placeholder: 'sbp_xxxxxxxxxxxx',
    description: 'Required for setup only. Used once to create the database tables through Supabase Management API.',
    docsHref: 'https://supabase.com/dashboard/account/tokens',
    docsLabel: 'Supabase access tokens',
    icon: <Key size={18} />,
    required: true,
  },
  {
    key: 'GITHUB_ACCESS_TOKEN',
    label: 'GitHub Access Token',
    envName: 'GITHUB_ACCESS_TOKEN',
    placeholder: 'github_pat_xxxxxxxxxxxx',
    description: 'Optional. Stored only in this browser vault for GitHub-connected features.',
    docsHref: 'https://github.com/settings/tokens',
    docsLabel: 'GitHub personal access tokens',
    icon: <Key size={18} />,
  },
  {
    key: 'ALTCHA_HMAC_SECRET',
    label: 'ALTCHA HMAC Secret',
    envName: 'ALTCHA_HMAC_SECRET',
    placeholder: 'ALTCHA secret',
    description: 'Optional. Stored only in this browser vault for local ALTCHA-related flows.',
    docsHref: 'https://altcha.org/docs/v2/server-integration/',
    docsLabel: 'ALTCHA docs',
    icon: <Shield size={18} />,
  },
  {
    key: 'ALTCHA_HMAC_KEY_SECRET',
    label: 'ALTCHA HMAC Key Secret',
    envName: 'ALTCHA_HMAC_KEY_SECRET',
    placeholder: 'ALTCHA key secret',
    description: 'Optional. Companion key for ALTCHA signature verification.',
    docsHref: 'https://altcha.org/docs/v2/sentinel/configuration/api-keys/',
    docsLabel: 'ALTCHA sentinel keys',
    icon: <Shield size={18} />,
  },
  {
    key: 'INDIEPITCHER_API_KEY',
    label: 'Email API Key',
    envName: 'INDIEPITCHER_API_KEY',
    placeholder: 'sc_xxxxxxxxxxxx',
    description: 'Optional. Stored only in this browser vault for email-related features.',
    docsHref: 'https://docs.indiepitcher.com/api-reference/introduction',
    docsLabel: 'IndiePitcher API docs',
    icon: <Key size={18} />,
  },
];

const EMPTY_VALUES: DeviceEnvValues = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  SUPABASE_ACCESS_TOKEN: '',
  GITHUB_ACCESS_TOKEN: '',
  ALTCHA_HMAC_SECRET: '',
  ALTCHA_HMAC_KEY_SECRET: '',
  INDIEPITCHER_API_KEY: '',
};

const REQUIRED_FIELDS = FIELD_CONFIGS.filter(field => field.required);
const OPTIONAL_FIELDS = FIELD_CONFIGS.filter(field => !field.required);

export default function SetupPage() {
  const [values, setValues] = useState<DeviceEnvValues>(EMPTY_VALUES);
  const [activeStep, setActiveStep] = useState<1 | 2>(1);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [showAdvancedKeys, setShowAdvancedKeys] = useState(false);
  const [vaultPassword, setVaultPassword] = useState('');
  const [hasStoredVault, setHasStoredVault] = useState(false);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<StepStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [schemaModalOpen, setSchemaModalOpen] = useState(false);
  const [schemaStepIndex, setSchemaStepIndex] = useState(0);
  const [schemaError, setSchemaError] = useState('');
  const [adminProvider, setAdminProvider] = useState<FirstAdminProvider>('email');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [oauthProviderEnabled, setOauthProviderEnabled] = useState(false);
  const [adminStatus, setAdminStatus] = useState<StepStatus>('idle');
  const [adminStatusMessage, setAdminStatusMessage] = useState('');
  const [unlockingVault, setUnlockingVault] = useState(false);

  useEffect(() => {
    const resolvedValues = resolveClientEnvValues();
    const sessionValues = getCachedDeviceEnvValues();
    setValues(resolvedValues);
    setHasStoredVault(Boolean(getStoredDeviceEnvVault()));

    if (sessionValues?.SUPABASE_URL && sessionValues.SUPABASE_ANON_KEY) {
      setSaved(true);
      setActiveStep(2);
      setStatus('success');
      setStatusMessage('Device vault already unlocked for this browser session.');
    }
  }, []);

  const handleStartDemoMode = () => {
    enableDemoMode();
    window.location.assign('/dashboard');
  };

  const requiredReady = useMemo(
    () => Boolean(values.SUPABASE_URL && values.SUPABASE_ANON_KEY && values.SUPABASE_ACCESS_TOKEN),
    [values.SUPABASE_ACCESS_TOKEN, values.SUPABASE_ANON_KEY, values.SUPABASE_URL]
  );

  const adminReady = useMemo(() => {
    const baseReady = Boolean(adminName.trim() && adminEmail.trim());
    if (adminProvider === 'email') {
      return baseReady && adminPassword.length >= 6;
    }

    return baseReady;
  }, [adminEmail, adminName, adminPassword, adminProvider]);

  const handleChange = (key: keyof DeviceEnvValues, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setSaved(false);
    setStatus('idle');
    setStatusMessage('');
  };

  const handleUnlockVault = async () => {
    if (!vaultPassword.trim()) {
      setStatus('error');
      setStatusMessage('Enter your device vault password to unlock saved keys.');
      return;
    }

    setUnlockingVault(true);
    setStatus('idle');
    setStatusMessage('');

    try {
      const unlockedValues = await unlockDeviceEnvVault(vaultPassword.trim());
      if (!unlockedValues) {
        setStatus('error');
        setStatusMessage('No saved device vault was found in this browser.');
        return;
      }

      setValues(unlockedValues);
      resetSupabaseClient();
      setSaved(true);
      setActiveStep(2);
      setStatus('success');
      setStatusMessage('Saved keys unlocked for this browser session.');
    } catch {
      setStatus('error');
      setStatusMessage('Unable to unlock the saved device vault. Check the password and try again.');
    } finally {
      setUnlockingVault(false);
    }
  };

  const handleTestAndSave = async () => {
    if (!requiredReady) {
      setStatus('error');
      setStatusMessage('Enter the Supabase URL, publishable key, and access token first.');
      return;
    }

    if (!vaultPassword.trim()) {
      setStatus('error');
      setStatusMessage('Enter a device vault password so the keys can be encrypted locally.');
      return;
    }

    setSchemaModalOpen(true);
    setSchemaStepIndex(0);
    setSchemaError('');
    setStatus('loading');
    setStatusMessage('');

    try {
      setSchemaStepIndex(1);
      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(values.SUPABASE_URL, values.SUPABASE_ANON_KEY);
      const { error } = await client.from('users').select('id').limit(1);

      if (error && (error.message?.includes('Unable to connect') || error.message?.includes('fetch'))) {
        setStatus('error');
        setStatusMessage('Could not reach Supabase. Check the URL and make sure the project is active.');
        setSchemaError('Could not reach Supabase. Check the URL and publishable key.');
        return;
      }

      setSchemaStepIndex(2);
      const schemaResponse = await apiFetch('/api/setup/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabaseUrl: values.SUPABASE_URL,
          accessToken: values.SUPABASE_ACCESS_TOKEN,
        }),
      });
      const schemaResult = await schemaResponse.json().catch(() => ({ ok: false }));

      if (!schemaResponse.ok || !schemaResult.ok) {
        const schemaMessage = schemaResult.error || 'Could not create the database tables.';
        setStatus('error');
        setStatusMessage(schemaMessage);
        setSchemaError(schemaMessage);
        return;
      }

      setSchemaStepIndex(3);
      await saveDeviceEnvVault(vaultPassword.trim(), values);
      resetSupabaseClient();
      setSaved(true);
      setHasStoredVault(true);
      setActiveStep(2);
      setSchemaStepIndex(4);
      setStatus('success');
      setStatusMessage(
        schemaResult.skipped
          ? 'Tables already exist. Keys saved in this browser vault.'
          : 'Database tables created and keys saved in this browser vault.'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed. Check your keys and try again.';
      setStatus('error');
      setStatusMessage(message);
      setSchemaError(message);
    }
  };

  const savePendingAdmin = () => {
    savePendingFirstAdminSetup({
      provider: adminProvider,
      email: adminEmail,
      name: adminName,
    });
  };

  const handleCreateAdmin = async () => {
    if (!saved && status !== 'success') {
      setAdminStatus('error');
      setAdminStatusMessage('Save the encrypted Supabase vault before creating the admin login.');
      return;
    }

    if (!adminReady) {
      setAdminStatus('error');
      setAdminStatusMessage(
        adminProvider === 'email'
          ? 'Enter the admin name, email, and a password with at least 6 characters.'
          : 'Enter the admin name and the email used by the Google or GitHub account.'
      );
      return;
    }

    if (adminProvider !== 'email' && !oauthProviderEnabled) {
      setAdminStatus('error');
      setAdminStatusMessage(
        `Enable the ${adminProvider === 'google' ? 'Google' : 'GitHub'} provider in Supabase Auth first, then tick the confirmation box below.`
      );
      return;
    }

    setAdminStatus('loading');
    setAdminStatusMessage('');

    try {
      const { getSupabase } = await import('@/lib/supabase');
      const supabase = getSupabase();
      savePendingAdmin();

      if (adminProvider === 'email') {
        const createAdminResponse = await apiFetch('/api/setup/create-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supabaseUrl: values.SUPABASE_URL,
            accessToken: values.SUPABASE_ACCESS_TOKEN,
            name: adminName.trim(),
            email: adminEmail.trim(),
            password: adminPassword,
          }),
        });
        const createAdminResult = await createAdminResponse.json().catch(() => ({ ok: false }));

        if (!createAdminResponse.ok || !createAdminResult.ok) {
          setAdminStatus('error');
          setAdminStatusMessage(createAdminResult.error || 'Unable to create the admin login.');
          return;
        }

        setAdminStatus('success');
        setAdminStatusMessage('Admin login is ready. Continue to login and sign in with this email.');
        return;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: adminProvider,
        options: {
          redirectTo: getSiteUrl('/login'),
        },
      });

      if (error) {
        setAdminStatus('error');
        setAdminStatusMessage(error.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create the admin login.';
      setAdminStatus('error');
      setAdminStatusMessage(message);
    }
  };

  const continueToNextStep = () => {
    const params = new URLSearchParams(window.location.search);
    const nextPath = params.get('next') || '/login';
    window.location.assign(nextPath);
  };

  const renderField = (field: FieldConfig, compact = false) => {
    const isSecretField = field.key !== 'SUPABASE_URL';
    const isVisible = showKey[field.key] ?? false;

    return (
      <div key={field.key} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_14px_45px_rgba(15,23,42,0.04)]">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9fbf4] text-[#119c67]">
              {field.icon}
            </div>
            <div className="min-w-0">
              <label htmlFor={field.key} className="block text-sm font-bold text-gray-950">
                {field.label}
                {field.required ? <span className="ml-1 text-red-500">*</span> : null}
              </label>
              <code className="block truncate text-[11px] font-semibold text-gray-400">{field.envName}</code>
            </div>
          </div>
          <a
            href={field.docsHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-[#119c67]"
            aria-label={field.docsLabel}
          >
            Docs
            <ExternalLink size={12} />
          </a>
        </div>

        {!compact && <p className="mb-3 text-sm leading-relaxed text-gray-500">{field.description}</p>}

        <div className="relative">
          <input
            id={field.key}
            type={!isSecretField ? 'url' : isVisible ? 'text' : 'password'}
            value={values[field.key]}
            onChange={(event) => handleChange(field.key, event.target.value)}
            placeholder={field.placeholder}
            className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 pr-12 font-mono text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3ecf8e] focus:bg-white focus:ring-4 focus:ring-[#3ecf8e]/10"
          />
          {isSecretField && (
            <button
              type="button"
              onClick={() =>
                setShowKey(prev => ({ ...prev, [field.key]: !prev[field.key] }))
              }
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-700"
              aria-label={isVisible ? `Hide ${field.label}` : `Show ${field.label}`}
            >
              {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
      </div>
    );
  };

  const setupSaved = saved || status === 'success';

  const schemaSteps = [
    'Checking required setup values',
    'Testing Supabase connection',
    'Creating TaskFlow database tables',
    'Encrypting keys on this device',
    'Setup is ready',
  ];

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top_left,#e8fff5_0,#f7f9fc_38%,#f8f9fc_100%)] px-4 py-8 font-poppins text-gray-950 sm:px-6 lg:px-8 overflow-hidden">
      <button
        type="button"
        onClick={handleStartDemoMode}
        className="absolute top-8 right-0 flex items-center gap-2 rounded-l-2xl border border-r-0 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 px-5 py-2.5 text-xs font-black text-blue-700 hover:text-blue-800 transition-colors shadow-sm"
      >
        <Sparkles size={14} />
        Try Dashboard with Demo Data (No Setup Needed)
      </button>

      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#3ecf8e]/25 bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#119c67] shadow-sm">
            <LockKeyhole size={14} />
            Setup
          </div>
          <h1 className="text-4xl font-black leading-tight tracking-tight text-gray-950 md:text-5xl">
            {activeStep === 2 ? 'Create your first admin' : 'Connect your Supabase project'}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-relaxed text-gray-600">
            {activeStep === 2
              ? 'Your Supabase keys are saved on this device. Now choose how the Admin will sign in.'
              : 'Paste your Supabase URL, publishable key, access token, then choose a vault password. TaskFlow will create the tables for you.'}
          </p>
        </motion.div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveStep(1)}
            className={`rounded-2xl border p-4 text-left shadow-sm transition hover:border-[#3ecf8e]/60 ${
            activeStep === 1
              ? 'border-[#3ecf8e]/40 bg-white'
              : 'border-[#3ecf8e]/25 bg-[#effdf7]'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
                setupSaved ? 'bg-[#3ecf8e] text-white' : 'bg-gray-950 text-white'
              }`}>
                {setupSaved ? <CheckCircle2 size={18} /> : <Database size={18} />}
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-gray-400">Step 1</p>
                <p className="font-black text-gray-950">Create tables and save keys</p>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              if (setupSaved) setActiveStep(2);
            }}
            disabled={!setupSaved}
            className={`rounded-2xl border p-4 text-left shadow-sm transition enabled:hover:border-[#3ecf8e]/60 disabled:cursor-not-allowed disabled:opacity-60 ${
            activeStep === 2
              ? 'border-[#3ecf8e]/40 bg-white'
              : 'border-gray-200 bg-white/65'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
                activeStep === 2 ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                <UserPlus size={18} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-gray-400">Step 2</p>
                <p className="font-black text-gray-950">Create Admin login</p>
              </div>
            </div>
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-white/80 bg-white/85 p-5 shadow-[0_26px_90px_rgba(15,23,42,0.09)] backdrop-blur sm:p-7"
          >
            {activeStep === 1 ? (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-black tracking-tight text-gray-950">Step 1: paste your keys</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
                    You need the project URL, the key that starts with sb_publishable_, and a Supabase access token. The password below encrypts them in this browser.
                  </p>
                </div>

                <div className="grid gap-4">
                  {REQUIRED_FIELDS.map(field => renderField(field))}
                </div>

                <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <label htmlFor="vaultPassword" className="mb-2 block text-sm font-bold text-gray-950">
                    Create a vault password
                  </label>
                  <input
                    id="vaultPassword"
                    type="password"
                    value={vaultPassword}
                    onChange={(event) => setVaultPassword(event.target.value)}
                    placeholder="Password used to unlock this browser later"
                    className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3ecf8e] focus:ring-4 focus:ring-[#3ecf8e]/10"
                  />
                  <p className="mt-2 text-xs leading-relaxed text-gray-500">
                    This password is not sent to Supabase. It only locks the local encrypted vault.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTestAndSave}
                  disabled={status === 'loading'}
                  className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#21b978] px-5 py-4 text-sm font-black text-white shadow-lg shadow-[#21b978]/20 transition hover:bg-[#119c67] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {status === 'loading' ? <Loader2 size={18} className="animate-spin" /> : <LockKeyhole size={18} />}
                    Create tables, save keys, and go to Step 2
                </button>



                {hasStoredVault && (
                  <button
                    type="button"
                    onClick={handleUnlockVault}
                    disabled={unlockingVault}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition hover:border-[#3ecf8e] hover:text-[#119c67] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {unlockingVault ? <Loader2 size={16} className="animate-spin" /> : <LockKeyhole size={16} />}
                    I already saved keys on this device
                  </button>
                )}

                {status !== 'idle' && (
                  <div
                    className={`mt-4 rounded-2xl border p-4 text-sm ${
                      status === 'success'
                        ? 'border-[#3ecf8e]/25 bg-[#3ecf8e]/10 text-[#166534]'
                        : status === 'error'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-gray-200 bg-gray-50 text-gray-600'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {status === 'success' ? (
                        <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                      ) : status === 'error' ? (
                        <AlertCircle size={18} className="mt-0.5 shrink-0" />
                      ) : (
                        <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin" />
                      )}
                      <span>{statusMessage}</span>
                    </div>
                  </div>
                )}

                <div className="mt-5 rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 p-3">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedKeys(prev => !prev)}
                    className="flex w-full items-center justify-between gap-4 rounded-xl px-2 py-2 text-left"
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-gray-600 shadow-sm">
                        <SlidersHorizontal size={17} />
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-gray-950">Optional keys</span>
                        <span className="block text-xs font-medium text-gray-500">Skip this unless you need GitHub, ALTCHA, or email features now.</span>
                      </span>
                    </span>
                    <ChevronDown
                      size={18}
                      className={`shrink-0 text-gray-400 transition-transform ${showAdvancedKeys ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {showAdvancedKeys && (
                    <div className="mt-3 grid gap-3">
                      {OPTIONAL_FIELDS.map(field => renderField(field, true))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-black tracking-tight text-gray-950">Step 2: choose the Admin login</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
                    This account becomes the first Admin in TaskFlow. Use email/password, Google, or GitHub.
                  </p>
                </div>

                <div className="mb-5 grid grid-cols-3 gap-2 rounded-2xl bg-gray-100 p-1.5">
                  {([
                    { value: 'email', label: 'Email', icon: <Mail size={16} /> },
                    { value: 'google', label: 'Google', icon: <Globe size={16} /> },
                    { value: 'github', label: 'GitHub', icon: <Github size={16} /> },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setAdminProvider(option.value);
                        setOauthProviderEnabled(false);
                        setAdminStatus('idle');
                        setAdminStatusMessage('');
                      }}
                      className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${
                        adminProvider === option.value
                          ? 'bg-white text-gray-950 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {option.icon}
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    value={adminName}
                    onChange={(event) => setAdminName(event.target.value)}
                    placeholder="Admin full name"
                    className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3ecf8e] focus:bg-white focus:ring-4 focus:ring-[#3ecf8e]/10"
                  />
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(event) => setAdminEmail(event.target.value)}
                    placeholder={
                      adminProvider === 'email'
                        ? 'Admin email'
                        : `Email on the admin ${adminProvider === 'google' ? 'Google' : 'GitHub'} account`
                    }
                    className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3ecf8e] focus:bg-white focus:ring-4 focus:ring-[#3ecf8e]/10"
                  />
                  {adminProvider === 'email' && (
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(event) => setAdminPassword(event.target.value)}
                      placeholder="Admin password"
                      minLength={6}
                      className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3ecf8e] focus:bg-white focus:ring-4 focus:ring-[#3ecf8e]/10"
                    />
                  )}
                </div>

                {adminProvider !== 'email' && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-bold">
                      Enable {adminProvider === 'google' ? 'Google' : 'GitHub'} in Supabase first
                    </p>
                    <p className="mt-1 leading-relaxed">
                      Go to Supabase Dashboard - Authentication - Providers, enable {adminProvider === 'google' ? 'Google' : 'GitHub'}, and add that provider&apos;s client ID and secret. Otherwise Supabase returns &quot;Unsupported provider&quot;.
                    </p>
                    <label className="mt-3 flex items-start gap-2 font-semibold">
                      <input
                        type="checkbox"
                        checked={oauthProviderEnabled}
                        onChange={(event) => setOauthProviderEnabled(event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-amber-300 text-amber-700 focus:ring-amber-500"
                      />
                      <span>I enabled this provider in Supabase Auth</span>
                    </label>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCreateAdmin}
                  disabled={adminStatus === 'loading'}
                  className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gray-950 px-5 py-4 text-sm font-black text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {adminStatus === 'loading' ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                  {adminProvider === 'email' ? 'Create Admin and continue' : `Continue with ${adminProvider === 'google' ? 'Google' : 'GitHub'}`}
                </button>

                {adminStatus === 'success' && (
                  <button
                    type="button"
                    onClick={continueToNextStep}
                    className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#3ecf8e]/40 bg-[#effdf7] px-5 text-sm font-black text-gray-950 transition hover:border-[#3ecf8e]"
                  >
                    Go to login
                    <ArrowRight size={18} />
                  </button>
                )}

                {adminStatus !== 'idle' && (
                  <div
                    className={`mt-4 rounded-2xl border p-4 text-sm ${
                      adminStatus === 'success'
                        ? 'border-[#3ecf8e]/25 bg-[#3ecf8e]/10 text-[#166534]'
                        : adminStatus === 'error'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-gray-200 bg-gray-50 text-gray-600'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {adminStatus === 'success' ? (
                        <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                      ) : adminStatus === 'error' ? (
                        <AlertCircle size={18} className="mt-0.5 shrink-0" />
                      ) : (
                        <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin" />
                      )}
                      <span>{adminStatusMessage}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-[28px] border border-white/80 bg-white/75 p-5 text-sm shadow-sm backdrop-blur lg:sticky lg:top-8 lg:self-start"
          >
            <h2 className="font-black text-gray-950">What you need</h2>
            <ol className="mt-4 space-y-4 text-gray-600">
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-950 text-xs font-black text-white">1</span>
                <span><strong className="text-gray-950">Supabase URL</strong><br />Found in Supabase Project Settings.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-950 text-xs font-black text-white">2</span>
                <span><strong className="text-gray-950">Supabase publishable key</strong><br />Use the browser-safe key that starts with sb_publishable_.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-950 text-xs font-black text-white">3</span>
                <span><strong className="text-gray-950">Supabase access token</strong><br />Used once to create the tables.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-950 text-xs font-black text-white">4</span>
                <span><strong className="text-gray-950">Admin login</strong><br />Email/password, Google, or GitHub.</span>
              </li>
            </ol>
            <div className="mt-5 rounded-2xl bg-[#effdf7] p-4 text-sm leading-relaxed text-[#166534]">
              No service-role key is needed on this page. Setup values are encrypted in this browser after tables are created.
            </div>
          </motion.div>
        </div>
      </div>

      {schemaModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-950/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_30px_100px_rgba(15,23,42,0.35)]">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#effdf7] text-[#119c67]">
                {schemaError ? <AlertCircle size={22} /> : schemaStepIndex >= 4 ? <CheckCircle2 size={22} /> : <Loader2 size={22} className="animate-spin" />}
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-950">
                  {schemaError ? 'Setup stopped' : schemaStepIndex >= 4 ? 'Database ready' : 'Creating database'}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-gray-500">
                  {schemaError
                    ? 'Fix the issue below, then run setup again.'
                    : 'Keep this popup open while TaskFlow creates the tables it needs.'}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {schemaSteps.map((step, index) => {
                const isDone = index < schemaStepIndex || (!schemaError && schemaStepIndex >= 4 && index === 4);
                const isActive = !schemaError && index === schemaStepIndex && schemaStepIndex < 4;

                return (
                  <div key={step} className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full ${
                      isDone
                        ? 'bg-[#21b978] text-white'
                        : isActive
                        ? 'bg-gray-950 text-white'
                        : 'bg-white text-gray-400'
                    }`}>
                      {isDone ? <CheckCircle2 size={15} /> : isActive ? <Loader2 size={15} className="animate-spin" /> : <span className="text-xs font-black">{index + 1}</span>}
                    </div>
                    <span className={`text-sm font-bold ${isDone || isActive ? 'text-gray-950' : 'text-gray-400'}`}>
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>

            {schemaError && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                {schemaError}
              </div>
            )}

            {(schemaError || schemaStepIndex >= 4) && (
              <button
                type="button"
                onClick={() => setSchemaModalOpen(false)}
                className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-gray-950 px-5 text-sm font-black text-white transition hover:bg-gray-800"
              >
                {schemaError ? 'Close and fix details' : 'Continue to Step 2'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
