import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts';
import { getSiteAnalyses } from '../lib/supabase';
import type { SiteAnalysis } from '../lib/supabase';

const PALETTE = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2'];

function formatK(v: number) {
  return v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
      <p className="text-2xl mb-1">📊</p>
      <p className="text-sm">{message}</p>
    </div>
  );
}

function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold mb-0.5" style={{ color: '#1A2332' }}>{title}</h3>
      {sub && <p className="text-xs text-gray-400 mb-4">{sub}</p>}
      {!sub && <div className="mb-4" />}
      {children}
    </div>
  );
}

// ── Chart 1: Year-3 revenue by site ──────────────────────────────────────────

function RevenueBarChart({ sites }: { sites: SiteAnalysis[] }) {
  const data = useMemo(
    () =>
      sites
        .filter((s) => s.roi_data?.year3Revenue)
        .sort((a, b) => (b.roi_data?.year3Revenue ?? 0) - (a.roi_data?.year3Revenue ?? 0))
        .slice(0, 10)
        .map((s) => ({
          name: s.address.split(',')[0].trim().slice(0, 20),
          revenue: Math.round((s.roi_data?.year3Revenue ?? 0) / 12),
        })),
    [sites],
  );

  if (!data.length) return <EmptyState message="Save V1 analyses to see revenue comparison." />;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF' }} angle={-35} textAnchor="end" interval={0} />
        <YAxis tickFormatter={formatK} tick={{ fontSize: 10, fill: '#9CA3AF' }} width={45} />
        <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}/mo`, 'Monthly Revenue']} />
        <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Chart 2: Break-even scatter / line ───────────────────────────────────────

function BreakEvenChart({ sites }: { sites: SiteAnalysis[] }) {
  const data = useMemo(
    () =>
      sites
        .filter((s) => s.roi_data?.breakEvenMonths)
        .sort((a, b) => (a.roi_data?.breakEvenMonths ?? 0) - (b.roi_data?.breakEvenMonths ?? 0))
        .slice(0, 10)
        .map((s, i) => ({
          name: s.address.split(',')[0].trim().slice(0, 14),
          months: Math.round(s.roi_data?.breakEvenMonths ?? 0),
          rank: i + 1,
        })),
    [sites],
  );

  if (!data.length) return <EmptyState message="Save V1 analyses to see break-even comparison." />;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF' }} angle={-35} textAnchor="end" interval={0} />
        <YAxis unit=" mo" tick={{ fontSize: 10, fill: '#9CA3AF' }} width={45} />
        <Tooltip formatter={(v: number) => [`${v} months`, 'Break-Even']} />
        <Line type="monotone" dataKey="months" stroke="#16A34A" strokeWidth={2} dot={{ r: 4, fill: '#16A34A' }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Chart 3: Charger-type distribution pie ────────────────────────────────────

function ChargerPieChart({ sites }: { sites: SiteAnalysis[] }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of sites) {
      const t = s.charger_type ?? 'Unknown';
      counts[t] = (counts[t] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [sites]);

  if (!data.length) return <EmptyState message="Save analyses to see charger mix." />;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
          {data.map((_entry, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Chart 4: Site score radar (top 5 sites) ───────────────────────────────────

function SiteRadarChart({ sites }: { sites: SiteAnalysis[] }) {
  const top5 = useMemo(
    () => [...sites].sort((a, b) => (b.site_score ?? 0) - (a.site_score ?? 0)).slice(0, 5),
    [sites],
  );

  const radarData = useMemo(() => {
    const axes = ['Site Score', 'Year-1 Profit', 'Year-3 Revenue', 'Break-Even', 'Chargers'];
    return axes.map((axis) => {
      const entry: Record<string, string | number> = { axis };
      top5.forEach((s, i) => {
        const label = `Site ${i + 1}`;
        if (axis === 'Site Score') entry[label] = s.site_score ?? 0;
        else if (axis === 'Year-1 Profit') entry[label] = Math.min(100, ((s.roi_data?.year1Profit ?? 0) / 50000) * 100);
        else if (axis === 'Year-3 Revenue') entry[label] = Math.min(100, ((s.roi_data?.year3Revenue ?? 0) / 150000) * 100);
        else if (axis === 'Break-Even') entry[label] = Math.max(0, 100 - ((s.roi_data?.breakEvenMonths ?? 60) / 60) * 100);
        else if (axis === 'Chargers') entry[label] = Math.min(100, ((s.target_chargers ?? 0) / 10) * 100);
      });
      return entry;
    });
  }, [top5]);

  if (!top5.length) return <EmptyState message="Save analyses to compare site profiles." />;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={radarData} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
        <PolarGrid stroke="#E5E7EB" />
        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        {top5.map((s, i) => (
          <Radar
            key={s.id}
            name={s.address.split(',')[0].slice(0, 16)}
            dataKey={`Site ${i + 1}`}
            stroke={PALETTE[i % PALETTE.length]}
            fill={PALETTE[i % PALETTE.length]}
            fillOpacity={0.08}
            strokeWidth={2}
          />
        ))}
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Tooltip />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ── Summary stat cards ────────────────────────────────────────────────────────

function SummaryCards({ sites }: { sites: SiteAnalysis[] }) {
  const stats = useMemo(() => {
    if (!sites.length) return null;
    const totalY3 = sites.reduce((s, a) => s + (a.roi_data?.year3Revenue ?? 0), 0);
    const avgScore = sites.reduce((s, a) => s + (a.site_score ?? 0), 0) / sites.length;
    const avgBE = sites.filter((a) => a.roi_data?.breakEvenMonths).reduce((s, a) => s + (a.roi_data?.breakEvenMonths ?? 0), 0) / sites.filter((a) => a.roi_data?.breakEvenMonths).length;
    const strongCount = sites.filter((a) => (a.site_score ?? 0) >= 75).length;
    return { totalY3, avgScore, avgBE, strongCount };
  }, [sites]);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: 'Total Sites', value: String(sites.length) },
        { label: 'Strong Leads', value: String(stats.strongCount), sub: 'score ≥ 75' },
        { label: 'Avg Site Score', value: stats.avgScore.toFixed(0), sub: 'out of 100' },
        { label: 'Avg Break-Even', value: `${stats.avgBE.toFixed(0)} mo`, sub: 'across all sites' },
      ].map((c) => (
        <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">{c.label}</p>
          <p className="text-2xl font-bold" style={{ color: '#1A2332' }}>{c.value}</p>
          {c.sub && <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const sites: SiteAnalysis[] = useMemo(() => {
    try { return getSiteAnalyses ? [] : []; } catch { return []; }
  }, []);

  // Load from localStorage fallback (same key used by MySitesPage when Supabase is absent)
  const localSites: SiteAnalysis[] = useMemo(() => {
    try {
      const raw = localStorage.getItem('ev-site-analyses');
      if (!raw) return [];
      return JSON.parse(raw) as SiteAnalysis[];
    } catch {
      return [];
    }
  }, []);

  const allSites = sites.length ? sites : localSites;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold" style={{ color: '#1A2332' }}>Portfolio Reports</h2>
        <p className="text-sm text-gray-500 mt-0.5">Visual analytics across all saved site analyses</p>
      </div>

      <SummaryCards sites={allSites} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <ChartCard title="Year-3 Monthly Revenue" sub="Top 10 sites by projected revenue">
          <RevenueBarChart sites={allSites} />
        </ChartCard>

        <ChartCard title="Break-Even Timeline" sub="Months to payback — sorted fastest to slowest">
          <BreakEvenChart sites={allSites} />
        </ChartCard>

        <ChartCard title="Charger Type Mix" sub="Distribution across all saved analyses">
          <ChargerPieChart sites={allSites} />
        </ChartCard>

        <ChartCard title="Site Profile Radar" sub="Top 5 sites scored across 5 dimensions">
          <SiteRadarChart sites={allSites} />
        </ChartCard>
      </div>

      {!allSites.length && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📈</p>
          <p className="text-base font-medium text-gray-500">No saved analyses yet</p>
          <p className="text-sm mt-1">Run a V1 analysis and click "Save Report" to populate charts.</p>
        </div>
      )}

      <p className="text-xs text-center text-gray-400">
        Data sourced from saved site analyses · charts update in real time as you save new analyses
      </p>
    </div>
  );
}
