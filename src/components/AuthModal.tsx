import { useState } from 'react';
import { signIn, signUp } from '../lib/auth';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

type Mode = 'signin' | 'signup';

export function AuthModal({ onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError('Email and password are required.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error: err } = await signUp(email, password);
        if (err) { setError(err.message); return; }
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
            <h2 className="text-lg font-bold" style={{ color: '#1A2332' }}>
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {mode === 'signin' ? 'Access your saved analyses' : 'Save analyses across devices'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {sent ? (
          <div className="text-center py-6">
            <p className="text-3xl mb-3">📧</p>
            <p className="text-sm font-semibold text-gray-700">Check your email</p>
            <p className="text-xs text-gray-400 mt-1">
              A confirmation link has been sent to <strong>{email}</strong>.<br />
              Click it to activate your account, then sign in.
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
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': '#2563EB' } as React.CSSProperties}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={8}
                required
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#2563EB' }}
            >
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>

            {/* Supabase not configured notice */}
            {!import.meta.env.VITE_SUPABASE_URL && (
              <p className="text-xs text-center text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                Supabase not configured — add VITE_SUPABASE_URL to .env.local to enable auth.
              </p>
            )}

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
          </form>
        )}
      </div>
    </div>
  );
}
