import { supabase } from './supabase';
import type { User, Session, AuthError } from '@supabase/supabase-js';

export type { User, Session };

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export async function signUp(email: string, password: string): Promise<{ error: AuthError | null }> {
  if (!supabase) return { error: { name: 'AuthError', message: 'Supabase not configured', status: 0 } as AuthError };
  const { error } = await supabase.auth.signUp({ email, password });
  return { error };
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

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(cb: (user: User | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session?.user ?? null));
  return () => data.subscription.unsubscribe();
}
