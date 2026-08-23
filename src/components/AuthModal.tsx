import { useState } from 'react';
import { signIn, signUp, resetPassword, updatePassword } from '../lib/auth';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  initialMode?: Mode;
}

type Mode = 'signin' | 'signup' | 'reset' | 'update';

export function AuthModal({ onClose, onSuccess, initialMode = 'signin' }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);   // password-reset email sent
  const [done, setDone] = useState(false);    // password successfully updated

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // ── Request a password-reset email ──────────────────────────────────────
    if (mode === 'reset') {
      if (!email) { setError('Enter your email address.'); return; }
      setLoading(true);
      try {
        const { error: err } = await resetPassword(email);
        if (err) { setError(err.message); return; }
        setSent(true);
      } finally { setLoading(false); }
      return;
    }

    // ── Set a new password (after clicking the recovery link) ────────────────
    if (mode === 'update') {
      if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
      setLoading(true);
      try {
        const { error: err } = await updatePassword(password);
        if (err) { setError(err.message); return; }
        setDone(true);
      } finally { setLoading(false); }
      return;
    }

    // ── Sign in / sign up ───────────────────────────────────────────────────
    if (!email || !password) { setError('Email and password are required.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error: err, session } = await signUp(email, password);
        if (err) { setError(err.message); return; }
        if (session) { onSuccess(); onClose(); return; }
        setSent(true);
      } else {
        const { error: err } = await signIn(email, password);
        if (err) { setError(err.message); return; }
        onSuccess();
        onClose();
      }
    } finally {
      setLoading(false);
    }
  }

  const titles: Record<Mode, { title: string; sub: string }> = {
    signin: { title: 'Sign in', sub: 'Access your saved analyses' },
    signup: { title: 'Create account', sub: 'Save analyses across devices' },
    reset:  { title: 'Reset password', sub: 'We’ll email you a reset link' },
    update: { title: 'Set new password', sub: 'Choose a new password for your account' },
  };
  const { title, sub } = titles[mode];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#1A2332' }}>{title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {done ? (
          /* Password updated */
          <div className="text-center py-6">
            <p className="text-3xl mb-3">✅</p>
            <p className="text-sm font-semibold text-gray-700">Password updated</p>
            <p className="text-xs text-gray-400 mt-1">You can now sign in with your new password.</p>
            <button
              onClick={() => { setDone(false); setPassword(''); setMode('signin'); }}
              className="mt-4 text-sm font-semibold"
              style={{ color: '#2563EB' }}
            >
              Continue to sign in
            </button>
          </div>
        ) : sent ? (
          /* Reset email sent (or signup confirmation fallback) */
          <div className="text-center py-6">
            <p className="text-3xl mb-3">📧</p>
            <p className="text-sm font-semibold text-gray-700">Check your email</p>
            <p className="text-xs text-gray-400 mt-1">
              {mode === 'reset'
                ? <>A password-reset link has been sent to <strong>{email}</strong>. Click it to choose a new password.</>
                : <>A confirmation link has been sent to <strong>{email}</strong>. Click it to activate your account, then sign in.</>}
            </p>
            <button
              onClick={() => { setSent(false); setMode('signin'); }}
              className="mt-4 text-sm font-semibold"
              style={{ color: '#2563EB' }}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email — hidden in update mode (user already identified by recovery token) */}
            {mode !== 'update' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': '#2563EB' } as React.CSSProperties}
                  autoComplete="email"
                  required
                />
              </div>
            )}

            {/* Password — hidden in reset mode */}
            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-600">
                    {mode === 'update' ? 'New password' : 'Password'}
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => { setMode('reset'); setError(''); }}
                      className="text-xs font-semibold"
                      style={{ color: '#2563EB' }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': '#2563EB' } as React.CSSProperties}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  minLength={8}
                  required
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#2563EB' }}
            >
              {loading ? 'Please wait…'
                : mode === 'signin' ? 'Sign in'
                : mode === 'signup' ? 'Create account'
                : mode === 'reset' ? 'Send reset link'
                : 'Update password'}
            </button>

            {/* Supabase not configured notice */}
            {!import.meta.env.VITE_SUPABASE_URL && (
              <p className="text-xs text-center text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                Supabase not configured — add VITE_SUPABASE_URL to .env.local to enable auth.
              </p>
            )}

            {/* Footer link */}
            {mode === 'reset' ? (
              <p className="text-xs text-center text-gray-500">
                Remembered it?{' '}
                <button type="button" onClick={() => { setMode('signin'); setError(''); }} className="font-semibold" style={{ color: '#2563EB' }}>
                  Back to sign in
                </button>
              </p>
            ) : mode !== 'update' && (
              <p className="text-xs text-center text-gray-500">
                {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  type="button"
                  onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
                  className="font-semibold"
                  style={{ color: '#2563EB' }}
                >
                  {mode === 'signin' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
