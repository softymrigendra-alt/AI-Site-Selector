import { supabase } from './supabase';
import type { User, Session, AuthError } from '@supabase/supabase-js';

export type { User, Session };

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

const SITE_URL = typeof window !== 'undefined'
  ? window.location.origin
  : 'https://ev-site-selector.vercel.app';

export async function signUp(
  email: string,
  password: string,
): Promise<{ error: AuthError | null; session: Session | null }> {
  if (!supabase) return { error: { name: 'AuthError', message: 'Supabase not configured', status: 0 } as AuthError, session: null };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: SITE_URL },
  });
  // With email confirmation disabled, signUp returns a live session → user is
  // logged in immediately. If confirmation is ever re-enabled, session is null.
  return { error, session: data.session };
}

export async function signIn(email: string, password: string): Promise<{ error: AuthError | null }> {
  if (!supabase) return { error: { name: 'AuthError', message: 'Supabase not configured', status: 0 } as AuthError };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error };
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

// Sends a password-reset email. The link returns the user to the app with a
// recovery token in the URL hash, which fires a PASSWORD_RECOVERY auth event.
export async function resetPassword(email: string): Promise<{ error: AuthError | null }> {
  if (!supabase) return { error: { name: 'AuthError', message: 'Supabase not configured', status: 0 } as AuthError };
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL });
  return { error };
}

// Sets a new password for the currently-authenticated (or recovering) user.
export async function updatePassword(password: string): Promise<{ error: AuthError | null }> {
  if (!supabase) return { error: { name: 'AuthError', message: 'Supabase not configured', status: 0 } as AuthError };
  const { error } = await supabase.auth.updateUser({ password });
  return { error };
}

// Fires when the user lands on the app via a password-recovery link.
export function onPasswordRecovery(cb: () => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') cb();
  });
  return () => data.subscription.unsubscribe();
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Returns an Authorization header for the current session, or {} when signed
// out / unconfigured. Attach to API calls so the Edge routes can verify the
// caller when SUPABASE_JWT_SECRET is set.
export async function authHeader(): Promise<Record<string, string>> {
  const session = await getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export function onAuthStateChange(cb: (user: User | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session?.user ?? null));
  return () => data.subscription.unsubscribe();
}
