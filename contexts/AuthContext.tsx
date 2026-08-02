'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { getSupabase } from '../lib/supabase';
import { User } from '@/types';
import { hasClientSupabaseConfig } from '@/lib/browser-supabase-config';
import { db } from '@/lib/db';
import {
  clearPendingFirstAdminSetup,
  getPendingFirstAdminSetup,
  pendingFirstAdminMatches,
} from '@/lib/first-admin-setup';

import { isDemoMode, getDemoDb, disableDemoMode } from '@/lib/demo-db';

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  isLoading: boolean;
  authError: string;
  login: (user: User) => void;
  logout: () => Promise<void>;
  setCurrentUser: (user: User | null) => void;
  setAuthError: (message: string) => void;
  isLoggingOut: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type ProfileRow = {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  role: 'Admin' | 'Manager' | 'Member';

  skills: string[] | null;
  wellness_score: number | null;
  max_workload: number | null;

  created_at: string | null;

  burnout_risk?: number | null;
  phone?: string | null;
  office_address?: string | null;

  timezone?: string | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  quiet_hours_weekends?: boolean | null;
  two_factor_enabled?: boolean | null;

  burnout_sensitivity?: number | null;
  auto_assign?: boolean | null;
  skill_match_priority?: boolean | null;
  ai_deadlines?: boolean | null;
  dob?: string | null;
};

export function AuthProvider({ children }: { children: ReactNode }) {

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const currentUserRef = useRef<User | null>(null);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let listener: { subscription: { unsubscribe: () => void } } | null = null;

    const loadSession = async () => {
      try {
        if (isDemoMode()) {
          const demoDb = getDemoDb();
          const allUsers = await demoDb.getUsers();
          const admin = allUsers.find(u => u.id === 'demo-admin-id') || null;
          setCurrentUser(admin);
          setUsers(allUsers);
          setIsLoading(false);
          return;
        }

        if (!hasClientSupabaseConfig()) {
          setCurrentUser(null);
          setIsLoading(false);
          return;
        }

        const supabase = getSupabase();

        const handleAuthChange = async (
          event: string,
          session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']
        ) => {
          try {
            if (event === 'SIGNED_OUT' || !session?.user) {
              setCurrentUser(null);
              setIsLoading(false);
              return;
            }

            if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
              if (!currentUserRef.current) {
                setIsLoading(true);
              }

              console.log('[SignIn] Auth state changed, loading profile for:', session.user.id);
              await loadProfile(
                session.user.id,
                session.user.email ?? null,
                session.user.app_metadata.provider
              );
            }
          } catch (err) {
            console.error('Auth state change error:', err);
            setCurrentUser(null);
          } finally {
            setIsLoading(false);
          }
        };

        const { data: listenerData } = supabase.auth.onAuthStateChange((event, session) => {
          console.log(`[Auth Event] ${event}`, session?.user?.id);

          if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
            return;
          }

          setTimeout(() => {
            void handleAuthChange(event, session);
          }, 0);
        });
        listener = listenerData;

        console.log('[SignIn] Getting session...');
        const { data } = await supabase.auth.getSession();
        console.log('[SignIn] Session data:', data);

        if (!data.session?.user) {
          console.log('[SignIn] No user session found.');
          setCurrentUser(null);
          setIsLoading(false); // Ensure loading state is updated
          return;
        }

        console.log('[SignIn] Loading user profile for:', data.session.user.id);
        await loadProfile(
          data.session.user.id,
          data.session.user.email ?? null,
          data.session.user.app_metadata.provider
        );

        setIsLoading(false); // Ensure loading state is updated after profile load

        // Fetch all users after load profile
        try {
          console.log('[SignIn] Fetching all users...');
          const allUsers = await db.getUsers();
          setUsers(allUsers);
          console.log('[SignIn] All users loaded.');
        } catch (e) {
          console.error('Failed to fetch users in context', e);
        }

      } catch (err) {
        console.error('Auth init error:', err);
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const loadProfile = async (userId: string, email: string | null, provider?: string) => {
    const supabase = getSupabase();
    console.log('[SignIn] Loading profile for user:', userId);
    const { data: profileResult, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single<ProfileRow>();
    let data: ProfileRow | null = profileResult;

    if (error) {
      console.error('[SignIn] Error loading user profile:', error);
    }

    // If the first-admin setup flow just completed, create that admin profile.
    if (error && error.code === 'PGRST116') {
      const normalizedProvider = provider ?? 'email';
      const pendingAdmin = getPendingFirstAdminSetup();
      const shouldCreateFirstAdmin = pendingFirstAdminMatches(
        pendingAdmin,
        normalizedProvider,
        email
      );

      if (provider && provider !== 'email' && !shouldCreateFirstAdmin) {
        setAuthError('You are not an existing user.');
        await supabase.auth.signOut();
        setCurrentUser(null);
        return;
      }

      console.log('[SignIn] Creating new user profile for:', userId);
      const { data: created, error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email,
          name: shouldCreateFirstAdmin
            ? pendingAdmin?.name
            : email?.split('@')[0] ?? 'User',
          role: shouldCreateFirstAdmin ? 'Admin' : 'Member',
          skills: [],
          wellness_score: shouldCreateFirstAdmin ? 85 : 0,
          max_workload: shouldCreateFirstAdmin ? 5 : 0
        })
        .select()
        .single<ProfileRow>();

      if (insertError) {
        console.error('[SignIn] Failed to create profile:', insertError);
        setCurrentUser(null);
        return;
      }

      data = created;
      if (shouldCreateFirstAdmin) {
        clearPendingFirstAdminSetup();
      }
    }

    if (!data) {
      console.error('[SignIn] No user data returned after profile load.');
      setCurrentUser(null);
      return;
    }

    const mappedUser: User = {
      id: data.id,
      name: data.name ?? email ?? 'User',
      email: data.email ?? email ?? '',
      avatarUrl: data.avatar_url ?? undefined,
      role: data.role,

      skills: data.skills ?? [],
      wellnessScore: data.wellness_score ?? 0,
      maxWorkload: data.max_workload ?? 0,

      createdAt: data.created_at ?? undefined,
      burnoutRisk: data.burnout_risk as User['burnoutRisk'],
      phone: data.phone ?? undefined,
      officeAddress: data.office_address ?? undefined,

      timezone: data.timezone ?? undefined,
      quietHoursStart: data.quiet_hours_start ?? undefined,
      quietHoursEnd: data.quiet_hours_end ?? undefined,
      quietHoursWeekends: data.quiet_hours_weekends ?? undefined,
      twoFactorEnabled: data.two_factor_enabled ?? undefined,

      burnoutSensitivity: data.burnout_sensitivity ?? undefined,
      autoAssign: data.auto_assign ?? undefined,
      skillMatchPriority: data.skill_match_priority ?? undefined,
      aiDeadlines: data.ai_deadlines ?? undefined,
      dob: data.dob ?? undefined,

      authProvider: provider
    };

    setAuthError('');
    setCurrentUser(mappedUser);
    console.log('[SignIn] User profile loaded and set:', mappedUser);
  };

  const login = (_user: User) => { };

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const logout = async () => {
    console.log('[Logout] Initiating logout process');
    setIsLoggingOut(true);

    if (isDemoMode()) {
      disableDemoMode();
      setCurrentUser(null);
      setIsLoggingOut(false);
      window.location.assign('/setup');
      return;
    }

    // Instantly clear user state and stop loading
    setCurrentUser(null);
    setIsLoggingOut(false);
    // Run signOut in the background
    const supabase = getSupabase();
    supabase.auth.signOut({ scope: 'local' })
      .then(() => {
        console.log('[Logout] supabase.auth.signOut() completed');
      })
      .catch((error) => {
        console.error('Logout error:', error);
        setAuthError('Supabase server is currently unavailable. Please try again later.');
      });
    // No await, UI is instant
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        isLoading,
        authError,
        login,
        logout,
        setCurrentUser,
        setAuthError,
        isLoggingOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
