import { useState, lazy, Suspense } from 'react';
import { branding } from './config/branding';
import V1Page from './V1Page';
import V2Page from './V2Page';
import MySitesPage from './pages/MySitesPage';
import AdminPage from './pages/AdminPage';

const ReportsPage = lazy(() => import('./pages/ReportsPage'));
import { OnlineIndicator } from './components/OnlineIndicator';
import { useDarkMode } from './hooks/useDarkMode';

type TabId = 'v1' | 'v2' | 'sites' | 'reports' | 'admin';

interface Tab {
  id: TabId;
  label: string;
  sublabel: string;
}

const TABS: Tab[] = [
  { id: 'v1',      label: 'V1 Manual',  sublabel: 'Enter data, instant forecast' },
  { id: 'v2',      label: 'V2 Agentic', sublabel: 'AI agents fetch everything' },
  { id: 'sites',   label: 'My Sites',   sublabel: 'Saved analyses' },
  { id: 'reports', label: 'Reports',    sublabel: 'Portfolio analytics' },
  { id: 'admin',   label: 'Monitor',    sublabel: 'Agent pipeline health' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('v1');
  const { isDark, setTheme } = useDarkMode();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#EFF6FF' }}>
      <header style={{ backgroundColor: '#1A2332' }} className="text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h1 className="text-lg font-bold leading-tight">{branding.companyName}</h1>
              <p className="text-xs leading-tight" style={{ color: '#93C5FD' }}>{branding.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <OnlineIndicator />
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="text-lg leading-none px-2 py-1 rounded-lg transition-colors hover:bg-white/10"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle dark mode"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            <span className="hidden sm:block text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#2563EB' }}>
              Phase 1
            </span>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-1 pt-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 rounded-t-lg text-sm font-medium transition-colors focus:outline-none ${
                  activeTab === tab.id
                    ? 'bg-[#EFF6FF] border border-b-0 border-gray-200'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
                style={activeTab === tab.id ? { color: '#2563EB' } : {}}
              >
                <span className="font-semibold">{tab.label}</span>
                <span className="hidden sm:inline text-xs ml-2 text-gray-400">— {tab.sublabel}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === 'v1' && <V1Page />}
        {activeTab === 'v2' && <V2Page />}
        {activeTab === 'sites' && (
          <MySitesPage onGoAnalyse={() => setActiveTab('v1')} />
        )}
        {activeTab === 'reports' && (
          <Suspense fallback={<div className="text-center py-20 text-gray-400 text-sm">Loading charts…</div>}>
            <ReportsPage />
          </Suspense>
        )}
        {activeTab === 'admin' && <AdminPage />}
      </main>

      <footer className="text-center text-xs text-gray-400 py-6">
        Phase 2 · White-label EV Site Selection · Built with React + Vite + TypeScript
      </footer>
    </div>
  );
}
