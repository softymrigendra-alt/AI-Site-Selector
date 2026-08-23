import { useState, useEffect, Suspense } from 'react';
import { branding } from './config/branding';
import V1Page from './V1Page';
import V2Page from './V2Page';
import MySitesPage from './pages/MySitesPage';
import { AuthModal } from './components/AuthModal';
import { useDarkMode } from './hooks/useDarkMode';
import { useAuth } from './hooks/useAuth';
import { signOut, onPasswordRecovery } from './lib/auth';
import { TabPanel } from './components/AnimatedCard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AnimatePresence } from 'framer-motion';
import { lazyWithReload } from './lib/lazyWithReload';

const ReportsPage = lazyWithReload(() => import('./pages/ReportsPage'));
const AdminPage   = lazyWithReload(() => import('./pages/AdminPage'));

type TabId = 'v1' | 'v2' | 'sites' | 'reports' | 'admin';

const TABS: { id: TabId; label: string; beta?: boolean }[] = [
  { id: 'v1',      label: 'V1 — Site Analyser' },
  { id: 'v2',      label: 'V2 — Agentic AI',  beta: true },
  { id: 'sites',   label: 'My Sites' },
  { id: 'reports', label: 'Reports' },
  { id: 'admin',   label: 'Monitor' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('v1');
  const { isDark, setTheme } = useDarkMode();
  const { user } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [recovering, setRecovering] = useState(false);

  // When the user returns via a password-reset link, open the modal in
  // "set new password" mode automatically.
  useEffect(() => onPasswordRecovery(() => { setRecovering(true); setShowAuth(true); }), []);

  return (
    <div className="min-h-screen app-bg">
      {showAuth && (
        <AuthModal
          initialMode={recovering ? 'update' : 'signin'}
          onClose={() => { setShowAuth(false); setRecovering(false); }}
          onSuccess={() => { setShowAuth(false); setRecovering(false); }}
        />
      )}

      {/* ── Header ────────────────────────────────────────────── */}
      <header className="header-gradient">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#185FA5' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M13 2L4 14h8l-1 8 10-13h-8l1-7z" />
                </svg>
              </div>
              <h1 className="text-base font-bold text-white leading-tight tracking-tight">{branding.companyName}</h1>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors hover:bg-white/10"
                title={isDark ? 'Light mode' : 'Dark mode'}
              >
                {isDark ? '☀️' : '🌙'}
              </button>
              {user ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs hidden sm:block" style={{ color: '#93C5FD' }}>{user.email}</span>
                  <button onClick={() => signOut()} className="text-xs px-3 py-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors">
                    Sign out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuth(true)}
                  className="text-xs px-4 py-1.5 rounded-lg font-semibold text-white border border-white/30 hover:bg-white/10 transition-colors"
                >
                  Sign in
                </button>
              )}
              <span className="text-xs px-2 py-1 rounded-full font-medium hidden sm:block" style={{ color: '#93C5FD', backgroundColor: 'rgba(255,255,255,0.08)' }}>
                {branding.tagline}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Tab bar ───────────────────────────────────────────── */}
      <div className="tab-bar sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <nav className="flex overflow-x-auto no-scrollbar">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-btn flex-shrink-0 flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-all focus:outline-none border-b-[3px] ${
                  activeTab === tab.id ? 'tab-active' : 'tab-inactive'
                }`}
              >
                {tab.label}
                {tab.beta && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                    Beta
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <ErrorBoundary>
          <AnimatePresence mode="wait">
            {activeTab === 'v1'    && <TabPanel tabKey="v1"><V1Page /></TabPanel>}
            {activeTab === 'v2'    && <TabPanel tabKey="v2"><V2Page /></TabPanel>}
            {activeTab === 'sites' && (
              <TabPanel tabKey="sites">
                <MySitesPage onGoAnalyse={() => setActiveTab('v1')} />
              </TabPanel>
            )}
            {activeTab === 'reports' && (
              <TabPanel tabKey="reports">
                <Suspense fallback={<div className="text-center py-16 text-sm" style={{ color: '#9CA3AF' }}>Loading Reports…</div>}>
                  <ReportsPage />
                </Suspense>
              </TabPanel>
            )}
            {activeTab === 'admin' && (
              <TabPanel tabKey="admin">
                <Suspense fallback={<div className="text-center py-16 text-sm" style={{ color: '#9CA3AF' }}>Loading Monitor…</div>}>
                  <AdminPage />
                </Suspense>
              </TabPanel>
            )}
          </AnimatePresence>
        </ErrorBoundary>
      </main>
    </div>
  );
}
