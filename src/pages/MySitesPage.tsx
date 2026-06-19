import { useEffect, useState, useMemo } from 'react';
import { getSiteAnalyses, deleteSiteAnalysis } from '../lib/supabase';
import { formatCurrency, formatMonths } from '../utils/roiCalculator';
import { Toast, useToast } from '../components/Toast';
import type { SiteAnalysis, SiteStatus } from '../lib/supabase';

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SiteStatus }) {
  const styles: Record<SiteStatus, { bg: string; text: string; border: string; label: string }> = {
    analysed: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', label: 'Analysed' },
    approved: { bg: '#F0FDF4', text: '#16A34A', border: '#86EFAC', label: 'Approved' },
    pending:  { bg: '#FFFBEB', text: '#D97706', border: '#FCD34D', label: 'Pending' },
  };
  const s = styles[status];
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full border"
      style={{ backgroundColor: s.bg, color: s.text, borderColor: s.border }}
    >
      {s.label}
    </span>
  );
}

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 80 ? '#16A34A' : score >= 60 ? '#D97706' : '#DC2626';
  return (
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
      style={{ backgroundColor: color }}
    >
      {score}
    </div>
  );
}

function PropertyBadge({ type }: { type: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full border capitalize"
      style={{ backgroundColor: '#F8FAFC', color: '#475569', borderColor: '#E2E8F0' }}>
      {type}
    </span>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function SiteDetailModal({
  site,
  onClose,
  onDelete,
}: {
  site: SiteAnalysis;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const roi = site.forecast_data;
  const isNeg = (n: number) => n < 0;

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#1A2332' }}>{site.site_name}</h2>
            {site.address && <p className="text-sm text-gray-500 mt-0.5">{site.address}</p>}
            <div className="flex items-center gap-2 mt-2">
              <PropertyBadge type={site.property_type} />
              <span className="text-xs text-gray-400">{site.charger_type}</span>
              <StatusBadge status={site.status} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none mt-1 flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* Scores row */}
        <div className="grid grid-cols-3 gap-4 p-6 border-b border-gray-100">
          <div className="text-center">
            <ScoreCircle score={site.site_score} />
            <p className="text-xs text-gray-500 mt-1">Site Score</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: '#16A34A' }}>
              {formatCurrency(site.monthly_net_revenue)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Monthly Net</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: '#2563EB' }}>
              {formatMonths(site.break_even_months)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Break-Even</p>
          </div>
        </div>

        {/* ROI table */}
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#1A2332' }}>ROI Analysis</h3>
          <div className="rounded-xl overflow-hidden border border-gray-100">
            {[
              { label: 'Total Setup Cost',        value: formatCurrency(roi.totalSetupCost) },
              { label: 'Monthly Gross Revenue',   value: formatCurrency(roi.monthlyGrossRevenue) },
              { label: 'Monthly Net Revenue',     value: formatCurrency(roi.monthlyNetRevenue), highlight: true },
              { label: 'Break-Even',              value: formatMonths(roi.breakEvenMonths) },
              { label: 'Year 1 Net Profit',       value: formatCurrency(roi.year1NetProfit), neg: isNeg(roi.year1NetProfit) },
              { label: 'Year 3 Net Profit',       value: formatCurrency(roi.year3NetProfit), neg: isNeg(roi.year3NetProfit) },
              { label: 'Year 5 Net Profit',       value: formatCurrency(roi.year5NetProfit), neg: isNeg(roi.year5NetProfit) },
            ].map(({ label, value, highlight, neg }, i) => (
              <div
                key={label}
                className="flex justify-between px-4 py-2.5 text-sm"
                style={{ backgroundColor: i % 2 === 0 ? '#F8FAFC' : 'white' }}
              >
                <span className="text-gray-600">{label}</span>
                <span
                  className="font-semibold"
                  style={{ color: neg ? '#DC2626' : highlight ? '#16A34A' : '#1A2332' }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 5-year bars */}
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#1A2332' }}>Year-by-Year Profit</h3>
          <div className="space-y-2">
            {([
              { label: 'Year 1', val: roi.year1NetProfit },
              { label: 'Year 3', val: roi.year3NetProfit },
              { label: 'Year 5', val: roi.year5NetProfit },
            ]).map(({ label, val }) => {
              const max = Math.max(Math.abs(roi.year5NetProfit), 1);
              const pct = Math.min(100, Math.max(0, (Math.abs(val) / max) * 100));
              const neg = val < 0;
              return (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-10 flex-shrink-0">{label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3">
                    <div className="h-3 rounded-full" style={{ width: `${pct}%`, backgroundColor: neg ? '#DC2626' : '#16A34A', minWidth: 4 }} />
                  </div>
                  <span className="text-xs font-semibold w-24 text-right" style={{ color: neg ? '#DC2626' : '#16A34A' }}>
                    {formatCurrency(val)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex gap-3 p-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border text-sm font-semibold transition-colors hover:bg-gray-50"
            style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
          >
            Close
          </button>
          <button
            onClick={() => { onDelete(site.id); onClose(); }}
            className="px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors hover:bg-red-50"
            style={{ borderColor: '#FCA5A5', color: '#DC2626' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Site Card ────────────────────────────────────────────────────────────────

function SiteCard({
  site,
  onView,
}: {
  site: SiteAnalysis;
  onView: () => void;
}) {
  const date = new Date(site.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const isNeg = site.monthly_net_revenue < 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold truncate" style={{ color: '#1A2332' }}>{site.site_name}</h3>
          {site.address && (
            <p className="text-xs text-gray-400 truncate mt-0.5">{site.address}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <PropertyBadge type={site.property_type} />
            <span className="text-xs text-gray-400">{site.charger_type}</span>
          </div>
        </div>
        <ScoreCircle score={site.site_score} />
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Monthly Net</p>
          <p className="text-base font-bold" style={{ color: isNeg ? '#DC2626' : '#16A34A' }}>
            {formatCurrency(site.monthly_net_revenue)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Break-Even</p>
          <p className="text-base font-bold" style={{ color: '#1A2332' }}>
            {formatMonths(site.break_even_months)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">3-Year Profit</p>
          <p className="text-sm font-semibold" style={{ color: '#1A2332' }}>
            {formatCurrency(site.year3_profit)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Saved</p>
          <p className="text-sm text-gray-500">{date}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <StatusBadge status={site.status} />
        <button
          onClick={onView}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors hover:bg-blue-50"
          style={{ color: '#2563EB' }}
        >
          View details →
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type FilterTab = 'all' | SiteStatus;
type SortKey = 'recent' | 'score' | 'revenue' | 'year3';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent',  label: 'Most recent' },
  { value: 'score',   label: 'Highest score' },
  { value: 'revenue', label: 'Best monthly net' },
  { value: 'year3',   label: 'Best 3-year profit' },
];

export default function MySitesPage({ onGoAnalyse }: { onGoAnalyse: () => void }) {
  const [sites, setSites] = useState<SiteAnalysis[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [selected, setSelected] = useState<SiteAnalysis | null>(null);
  const { toasts, addToast, dismissToast } = useToast();

  useEffect(() => {
    setLoading(true);
    getSiteAnalyses().then((data) => {
      setSites(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    const ok = await deleteSiteAnalysis(id);
    if (ok) {
      setSites((prev) => prev.filter((s) => s.id !== id));
      addToast('Site deleted', 'info');
    } else {
      addToast('Could not delete site', 'error');
    }
  }

  const displayed = useMemo(() => {
    let list = [...sites];

    if (filter !== 'all') list = list.filter((s) => s.status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.site_name.toLowerCase().includes(q) ||
          s.address?.toLowerCase().includes(q) ||
          s.property_type.toLowerCase().includes(q),
      );
    }

    list.sort((a, b) => {
      if (sort === 'recent')  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sort === 'score')   return b.site_score - a.site_score;
      if (sort === 'revenue') return b.monthly_net_revenue - a.monthly_net_revenue;
      if (sort === 'year3')   return b.year3_profit - a.year3_profit;
      return 0;
    });

    return list;
  }, [sites, filter, search, sort]);

  const FILTER_TABS: { id: FilterTab; label: string }[] = [
    { id: 'all',       label: `All (${sites.length})` },
    { id: 'analysed',  label: 'Analysed' },
    { id: 'approved',  label: 'Approved' },
    { id: 'pending',   label: 'Pending' },
  ];

  return (
    <>
      <div className="space-y-5">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold" style={{ color: '#1A2332' }}>My Sites</h2>
            <p className="text-sm text-gray-500 mt-0.5">Saved site analyses and ROI forecasts</p>
          </div>
          <button
            onClick={onGoAnalyse}
            className="px-4 py-2 rounded-lg text-white text-sm font-semibold"
            style={{ backgroundColor: '#2563EB' }}
          >
            + Analyse New Site
          </button>
        </div>

        {/* Search + sort bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="search"
            placeholder="Search by name, address, or property type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                filter === tab.id ? 'border border-b-0 border-gray-200' : 'text-gray-500 hover:bg-gray-50'
              }`}
              style={filter === tab.id ? { color: '#2563EB', backgroundColor: '#EFF6FF' } : {}}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="text-3xl mb-3 animate-spin">⚡</div>
            <p className="text-sm">Loading saved sites…</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && sites.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
            <span className="text-5xl mb-4">📍</span>
            <p className="text-base font-semibold text-gray-600">No saved sites yet</p>
            <p className="text-sm mt-1 mb-5">Run a V1 analysis and click Save Report to see it here.</p>
            <button
              onClick={onGoAnalyse}
              className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold"
              style={{ backgroundColor: '#2563EB' }}
            >
              Analyse Your First Site
            </button>
          </div>
        )}

        {/* No search results */}
        {!loading && sites.length > 0 && displayed.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-center">
            <span className="text-4xl mb-3">🔍</span>
            <p className="font-medium text-gray-600">No sites match your search</p>
            <button onClick={() => { setSearch(''); setFilter('all'); }} className="text-sm mt-2" style={{ color: '#2563EB' }}>
              Clear filters
            </button>
          </div>
        )}

        {/* Site grid */}
        {!loading && displayed.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {displayed.map((site) => (
              <SiteCard
                key={site.id}
                site={site}
                onView={() => setSelected(site)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <SiteDetailModal
          site={selected}
          onClose={() => setSelected(null)}
          onDelete={(id) => { void handleDelete(id); }}
        />
      )}

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
