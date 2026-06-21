import { useState, lazy, Suspense } from 'react';
import { branding } from './config/branding';
import V1Page from './V1Page';
import V2Page from './V2Page';
import MySitesPage from './pages/MySitesPage';
import AdminPage from './pages/AdminPage';
import { AuthModal } from './components/AuthModal';
import { OnlineIndicator } from './components/OnlineIndicator';
import { useDarkMode } from './hooks/useDarkMode';
import { useAuth } from './hooks/useAuth';
import { signOut } from './lib/auth';
import { TabPanel } from './components/AnimatedCard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AnimatePresence } from 'framer-motion';

const ReportsPage = lazy(() => import('./pages/ReportsPage'));

type TabId = 'v1' | 'v2' | 'sites' | 'reports' | 'admin';

interface Tab {
  id: TabId;
  icon: string;
  label: string;
  sublabel: string;
}

const TABS: Tab[] = [
  { id: 'v1',      icon: '⚡', label: 'Forecast',  sublabel: 'Manual analysis' },
  { id: 'v2',      icon: '🤖', label: 'AI Agents', sublabel: 'Live pipeline' },
  { id: 'sites',   icon: '📋', label: 'My Sites',  sublabel: 'Saved' },
  { id: 'reports', icon: '📊', label: 'Reports',   sublabel: 'Analytics' },
  { id: 'admin',   icon: '🔍', label: 'Monitor',   sublabel: 'Health' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('v1');
  const { isDark, setTheme } = useDarkMode();
  const { user } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  return (
    <div className="min-h-screen app-bg">
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} />}

      {/* ── Header ────────────────────────────────────────────── */}
      <header className="header-gradient relative overflow-hidden">
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }} />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-lg" style={{ background: 'linear-gradient(135deg,#3B82F6,#06B6D4)' }}>
                ⚡
              </div>
              <div>
                <h1 className="text-base font-bold text-white leading-tight tracking-tight">{branding.companyName}</h1>
                <p className="text-xs leading-tight" style={{ color: '#93C5FD' }}>{branding.tagline}</p>
              </div>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2">
              <OnlineIndicator />
              <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors hover:bg-white/10"
                title={isDark ? 'Light mode' : 'Dark mode'}
              >
                {isDark ? '☀️' : '🌙'}
              </button>
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                    <div className="w-5 h-5 rounded-full bg-blue-400 flex items-center justify-center text-xs text-white font-bold">
                      {user.email?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <span className="text-xs text-blue-100 max-w-[110px] truncate">{user.email}</span>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors text-blue-200 hover:text-white hover:bg-white/10"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuth(true)}
                  className="text-xs px-4 py-2 rounded-lg font-semibold transition-all border text-white hover:bg-white hover:text-blue-700"
                  style={{ borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)' }}
                >
                  Sign in
                </button>
              )}
            </div>
          </div>

          {/* Hero strip */}
          <div className="pb-5 pt-1">
            <p className="text-2xl sm:text-3xl font-bold text-white leading-tight">
              Find your next <span style={{ color: '#67E8F9' }}>EV charging site</span>
            </p>
            <p className="text-sm mt-1" style={{ color: '#93C5FD' }}>
              AI-powered ROI forecasting · live market data · 5-agent analysis pipeline
            </p>
          </div>
        </div>
      </header>

      {/* ── Tab bar ───────────────────────────────────────────── */}
      <div className="tab-bar sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <nav className="flex gap-1 overflow-x-auto no-scrollbar">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-btn flex-shrink-0 flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium transition-all focus:outline-none border-b-2 ${
                  activeTab === tab.id ? 'tab-active' : 'tab-inactive'
                }`}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                <span className="font-semibold">{tab.label}</span>
                <span className="hidden md:block text-xs opacity-60">· {tab.sublabel}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <ErrorBoundary>
          <AnimatePresence mode="wait">
            {activeTab === 'v1'      && <TabPanel tabKey="v1"><V1Page /></TabPanel>}
            {activeTab === 'v2'      && <TabPanel tabKey="v2"><V2Page /></TabPanel>}
            {activeTab === 'sites'   && <TabPanel tabKey="sites"><MySitesPage onGoAnalyse={() => setActiveTab('v1')} /></TabPanel>}
            {activeTab === 'reports' && (
              <TabPanel tabKey="reports">
                <Suspense fallback={<div className="text-center py-20 text-gray-400 text-sm">Loading charts…</div>}>
                  <ReportsPage />
                </Suspense>
              </TabPanel>
            )}
            {activeTab === 'admin' && <TabPanel tabKey="admin"><AdminPage /></TabPanel>}
          </AnimatePresence>
        </ErrorBoundary>
      </main>

      <footer className="text-center text-xs py-8" style={{ color: 'var(--text-muted)' }}>
        EV Site Selector · Built with React + Vite + TypeScript + Groq AI
      </footer>
    </div>
  );
}
