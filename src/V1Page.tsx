import { useState, useEffect } from 'react';
import { calculateROI, formatCurrency, formatMonths, CHARGER_CONFIG } from './utils/roiCalculator';
import { saveSiteAnalysis } from './lib/supabase';
import { Toast, useToast } from './components/Toast';
import { ROIChatAssistant } from './components/ROIChatAssistant';
import { withRetry, friendlyMessage } from './lib/retry';
import type { SiteFormInput, SiteResult, RiskLevel, DemandLevel, ROIResult } from './types';

interface AIForecastResponse {
  siteScore: number;
  evDemandLevel: DemandLevel;
  competitorRisk: RiskLevel;
  confidenceLevel: number;
  aiInsight: string;
}

async function fetchAIForecast(siteInput: SiteFormInput, roiCalculation: ROIResult): Promise<AIForecastResponse | null> {
  try {
    return await withRetry(async () => {
      const res = await fetch('/api/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteInput, roiCalculation }),
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) throw new Error(`Forecast API ${res.status}`);
      return await res.json() as AIForecastResponse;
    }, { attempts: 2, delayMs: 800, shouldRetry: (e) => !(e instanceof DOMException) });
  } catch (err) {
    console.warn('[fetchAIForecast]', friendlyMessage(err));
    return null;
  }
}

const PROPERTY_TYPES: { value: SiteFormInput['propertyType']; icon: string }[] = [
  { value: 'parking',     icon: '🅿️' },
  { value: 'mall',        icon: '🛍️' },
  { value: 'hotel',       icon: '🏨' },
  { value: 'workplace',   icon: '🏢' },
  { value: 'hospital',    icon: '🏥' },
  { value: 'university',  icon: '🎓' },
  { value: 'residential', icon: '🏘️' },
];

function IconPlug() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="2" x2="6" y2="8" /><line x1="18" y1="2" x2="18" y2="8" />
      <path d="M4 8h16v4a8 8 0 01-16 0V8z" />
      <line x1="12" y1="16" x2="12" y2="22" />
    </svg>
  );
}
function IconBolt() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}
function IconDoubleBolt() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 2L3 12h7l-1 7 9-11H11l1-6z" />
      <path d="M18 6l-5 6h5l-4 6 7-8h-5l4-4z" opacity="0.55" />
    </svg>
  );
}

interface ChargerOption {
  type: SiteFormInput['chargerType'];
  badge: string;
  kw: string;
  duration: string;
  desc: string;
  bestFor: string;
  color: string;
  Icon: () => React.JSX.Element;
}

const CHARGER_OPTIONS: ChargerOption[] = [
  { type: 'Level 2 AC', badge: 'L2', kw: '7–22 kW',    duration: '4–8 hrs',    desc: '$8/session · 3/day',   bestFor: 'Hotels, offices, retail',  color: '#16A34A', Icon: IconPlug },
  { type: 'DC Fast',    badge: 'DC', kw: '50–150 kW',   duration: '20–60 min',  desc: '$18/session · 8/day',  bestFor: 'Parking, highway stops',   color: '#2563EB', Icon: IconBolt },
  { type: 'Ultra-Fast', badge: 'UF', kw: '150–350 kW',  duration: '10–20 min',  desc: '$28/session · 12/day', bestFor: 'Malls, transit hubs',      color: '#7C3AED', Icon: IconDoubleBolt },
];

const DEFAULT_FORM: SiteFormInput = {
  address: '',
  propertyType: 'parking',
  parkingSpaces: 50,
  dailyFootfall: 500,
  targetChargers: 4,
  chargerType: 'DC Fast',
};

function ScoreBars({ result, aiLoading }: { result: SiteResult; aiLoading: boolean }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(t);
  }, [result.siteScore]);

  const demandPct = result.evDemandLevel === 'high' ? 84 : result.evDemandLevel === 'medium' ? 54 : 24;
  const gapPct    = result.competitorRisk === 'low'  ? 80 : result.competitorRisk === 'medium' ? 50 : 20;
  const confPct   = Math.min(94, result.siteScore + 4);

  const bars = [
    { label: 'EV Demand',      pct: demandPct, color: '#16A34A', badge: result.evDemandLevel },
    { label: 'Competitor Gap', pct: gapPct,    color: '#2563EB', badge: result.competitorRisk === 'low' ? 'low risk' : result.competitorRisk === 'medium' ? 'moderate' : 'high risk' },
    { label: 'Confidence',     pct: confPct,   color: '#7C3AED', badge: `${confPct}%` },
  ];

  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Site Intelligence Scores</h3>
      {aiLoading ? (
        <p className="text-xs animate-pulse" style={{ color: 'var(--text-muted)' }}>AI scoring in progress…</p>
      ) : (
        <div className="space-y-3.5">
          {bars.map(({ label, pct, color, badge }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full capitalize" style={{ backgroundColor: color + '18', color }}>
                  {badge}
                </span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-muted)' }}>
                <div
                  className="h-3 rounded-full"
                  style={{ width: ready ? `${pct}%` : '0%', backgroundColor: color, transition: 'width 0.9s cubic-bezier(0.22, 1, 0.36, 1)' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreRing({ score, loading }: { score: number; loading: boolean }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const pct = loading ? 0 : score / 100;
  const color = score >= 75 ? '#16A34A' : score >= 50 ? '#F59E0B' : '#EF4444';
  const label = score >= 75 ? 'Strong' : score >= 50 ? 'Moderate' : 'Weak';

  return (
    <div className="flex flex-col items-center score-pop">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#E5E7EB" strokeWidth="10" />
          <circle
            cx="50" cy="50" r={r} fill="none"
            stroke={loading ? '#E5E7EB' : color}
            strokeWidth="10"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {loading ? (
            <span className="text-xs text-gray-400 animate-pulse">…</span>
          ) : (
            <>
              <span className="text-2xl font-black" style={{ color }}>{score}</span>
              <span className="text-xs text-gray-400 -mt-0.5">/ 100</span>
            </>
          )}
        </div>
      </div>
      <span className="text-xs font-semibold mt-1" style={{ color: loading ? '#9CA3AF' : color }}>{loading ? 'Scoring…' : label}</span>
    </div>
  );
}

function Badge({ level }: { level: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    low:    { bg: '#DCFCE7', text: '#15803D' },
    medium: { bg: '#FEF9C3', text: '#A16207' },
    high:   { bg: '#FEE2E2', text: '#B91C1C' },
  };
  const c = map[level] ?? map['medium']!;
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide" style={{ backgroundColor: c.bg, color: c.text }}>
      {level}
    </span>
  );
}

function computeSiteScore(form: SiteFormInput, roi: ROIResult): number {
  let s = 50;
  if (form.dailyFootfall > 1000) s += 15;
  else if (form.dailyFootfall > 500) s += 8;
  if (form.propertyType === 'mall' || form.propertyType === 'parking') s += 10;
  if (form.propertyType === 'residential') s -= 10;
  if (roi.breakEvenMonths < 36) s += 10;
  if (roi.breakEvenMonths > 72) s -= 15;
  if (form.parkingSpaces / form.targetChargers > 8) s += 5;
  return Math.min(100, Math.max(0, s));
}

function buildInsight(form: SiteFormInput, roi: ROIResult, score: number): string {
  if (score >= 70) return `This ${form.propertyType} location shows strong EV charging potential with ${form.dailyFootfall.toLocaleString()} daily visitors. Break-even at ${formatMonths(roi.breakEvenMonths)} is competitive. Recommended to proceed with ${form.targetChargers}× ${form.chargerType}.`;
  if (score >= 50) return `Moderate potential at this ${form.propertyType} site. Consider increasing charger count or targeting higher-traffic hours. Break-even projected at ${formatMonths(roi.breakEvenMonths)}.`;
  return `This site presents challenges — low footfall reduces utilisation below optimal thresholds. Consider a smaller ${form.chargerType} deployment (1–2 units) to reduce capital risk.`;
}

export default function V1Page() {
  const [form, setForm]       = useState<SiteFormInput>(DEFAULT_FORM);
  const [result, setResult]   = useState<SiteResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const { toasts, addToast, dismissToast } = useToast();

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: ['parkingSpaces', 'dailyFootfall', 'targetChargers'].includes(name) ? Number(value) : value }));
    setResult(null);
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const roi = calculateROI(form);
    const score = computeSiteScore(form, roi);
    const risk: RiskLevel = form.dailyFootfall < 200 ? 'high' : form.dailyFootfall > 800 ? 'low' : 'medium';
    const demand: DemandLevel = form.dailyFootfall > 800 ? 'high' : form.dailyFootfall > 300 ? 'medium' : 'low';
    setResult({ roi, siteScore: score, competitorRisk: risk, evDemandLevel: demand, aiInsight: buildInsight(form, roi, score), address: form.address, chargerType: form.chargerType, targetChargers: form.targetChargers, propertyType: form.propertyType });
    setAiLoading(true);
    const ai = await fetchAIForecast(form, roi);
    setAiLoading(false);
    if (ai) setResult(prev => prev ? { ...prev, siteScore: ai.siteScore, competitorRisk: ai.competitorRisk, evDemandLevel: ai.evDemandLevel, aiInsight: ai.aiInsight } : prev);
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    const saved = await saveSiteAnalysis({ siteName: form.address.trim() || `${form.propertyType} · ${new Date().toLocaleDateString()}`, siteInput: form, roiResult: result.roi, siteScore: result.siteScore, evDemandLevel: result.evDemandLevel, competitorRisk: result.competitorRisk, aiInsight: result.aiInsight });
    setSaving(false);
    saved ? addToast('Analysis saved!', 'success') : addToast('Save failed — check Supabase config', 'error');
  }

  const inputCls = 'w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all form-input';

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">

        {/* ── Form panel ─────────────────────────────────────── */}
        <div className="card p-6 space-y-5">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Site Details</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Fill in your site data for an AI-powered forecast.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Address */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>📍 Address / Location</label>
              <input name="address" value={form.address} onChange={handleChange} placeholder="e.g. 123 Main St, Chicago, IL" className={inputCls} />
            </div>

            {/* Property type grid */}
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>🏢 Property Type</label>
              <div className="grid grid-cols-4 gap-1.5">
                {PROPERTY_TYPES.map(({ value, icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setForm(p => ({ ...p, propertyType: value })); setResult(null); }}
                    className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-xs font-medium border transition-all"
                    style={form.propertyType === value
                      ? { backgroundColor: '#EFF6FF', borderColor: '#2563EB', color: '#2563EB' }
                      : { backgroundColor: 'transparent', borderColor: 'var(--border)', color: 'var(--text-secondary)' }
                    }
                  >
                    <span className="text-base">{icon}</span>
                    <span className="capitalize leading-tight text-center">{value}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Numbers row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>🅿️ Parking Spaces</label>
                <input type="number" name="parkingSpaces" min="1" value={form.parkingSpaces} onChange={handleChange} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>👥 Daily Footfall</label>
                <input type="number" name="dailyFootfall" min="0" value={form.dailyFootfall} onChange={handleChange} className={inputCls} />
              </div>
            </div>

            {/* Charger type selector */}
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>🔌 Charger Type</label>
              <div className="grid grid-cols-3 gap-2">
                {CHARGER_OPTIONS.map(({ type, badge, kw, duration, desc, bestFor, color, Icon }) => {
                  const active = form.chargerType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => { setForm(p => ({ ...p, chargerType: type })); setResult(null); }}
                      className="flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all"
                      style={active
                        ? { backgroundColor: color + '12', borderColor: color, borderWidth: '2px' }
                        : { borderColor: 'var(--border)', borderWidth: '1px', backgroundColor: 'transparent' }
                      }
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: active ? color + '22' : 'var(--bg-muted)', color: active ? color : 'var(--text-muted)' }}>
                          <Icon />
                        </div>
                        <span className="text-xs font-black tracking-widest" style={{ color: active ? color : 'var(--text-muted)' }}>{badge}</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold leading-tight" style={{ color: active ? color : 'var(--text-primary)' }}>{type}</p>
                        <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--text-muted)' }}>{kw} · {duration}</p>
                        <p className="text-[10px] font-semibold leading-tight mt-0.5" style={{ color: active ? color : 'var(--text-secondary)' }}>{desc}</p>
                        <p className="text-[10px] leading-tight mt-0.5 italic" style={{ color: 'var(--text-muted)' }}>Best: {bestFor}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Charger count */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                🔢 Number of Chargers
                <span className="ml-2 font-bold text-sm" style={{ color: '#2563EB' }}>{form.targetChargers}</span>
              </label>
              <input
                type="range"
                name="targetChargers"
                min="1" max="20" step="1"
                value={form.targetChargers}
                onChange={handleChange}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                <span>1</span><span>20</span>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-4 rounded-xl text-white font-bold text-base transition-all hover:opacity-90 active:scale-[0.98] shadow-md"
              style={{ background: 'linear-gradient(135deg,#2563EB,#0EA5E9)' }}
            >
              Generate AI Forecast ⚡
            </button>
          </form>
        </div>

        {/* ── Results panel ──────────────────────────────────── */}
        <div className="space-y-4">
          {!result ? (
            <div className="card p-12 flex flex-col items-center justify-center text-center min-h-[400px]"
              style={{ background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--accent-light) 100%)' }}>
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-5 shadow-lg"
                style={{ background: 'linear-gradient(135deg,#2563EB,#0EA5E9)' }}>
                ⚡
              </div>
              <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Ready to analyse your site</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Fill in the form and click Generate Forecast</p>
              <div className="mt-6 grid grid-cols-3 gap-3 w-full max-w-sm">
                {[['Instant ROI','deterministic calc'],['AI Scoring','Groq LLM'],['Save & Track','Supabase']].map(([t, s]) => (
                  <div key={t} className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--bg-muted)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{t}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Score + headline */}
              <div className="card p-5">
                <div className="flex items-center gap-5">
                  <ScoreRing score={result.siteScore} loading={aiLoading} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xl font-black" style={{ color: result.siteScore >= 75 ? '#16A34A' : result.siteScore >= 50 ? '#F59E0B' : '#EF4444' }}>
                      {result.siteScore >= 75 ? 'Strong Potential' : result.siteScore >= 50 ? 'Moderate Potential' : 'Weak Potential'}
                    </p>
                    <p className="text-sm font-semibold mt-0.5 truncate" style={{ color: 'var(--text-primary)' }}>
                      {form.address || `${form.propertyType.charAt(0).toUpperCase() + form.propertyType.slice(1)} Site`}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {form.propertyType.charAt(0).toUpperCase() + form.propertyType.slice(1)} · {form.chargerType}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge level={result.evDemandLevel} />
                      <Badge level={result.competitorRisk} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Charger banner */}
              {(() => {
                const opt = CHARGER_OPTIONS.find(o => o.type === form.chargerType)!;
                return (
                  <div className="rounded-xl p-3.5 flex items-center gap-3" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                      <opt.Icon />
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: '#1D4ED8' }}>
                        {form.targetChargers}× {form.chargerType} · {opt.kw} · {opt.duration}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#3B82F6' }}>
                        {opt.desc} · Best for: {opt.bestFor}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* 4 metric cards */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'MONTHLY REVENUE',   value: formatCurrency(result.roi.monthlyNetRevenue),  sub: 'net after OpEx',    vc: 'var(--text-primary)' },
                  { label: 'BREAK-EVEN',        value: formatMonths(result.roi.breakEvenMonths),      sub: 'to payback',        vc: '#D97706' },
                  { label: 'EV DRIVERS NEARBY', value: Math.round(form.dailyFootfall * 0.35).toLocaleString(), sub: 'estimated in area', vc: 'var(--text-primary)' },
                  { label: 'UTILISATION RATE',  value: form.dailyFootfall > 2000 ? '90%' : form.dailyFootfall > 1000 ? '75%' : form.dailyFootfall > 500 ? '62%' : '45%', sub: 'avg session rate', vc: 'var(--text-primary)' },
                ].map(({ label, value, sub, vc }) => (
                  <div key={label} className="card p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
                    <p className="text-2xl font-black leading-tight" style={{ color: vc }}>{value}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
                  </div>
                ))}
              </div>

              {/* ROI callout */}
              <div className="card p-4 flex items-center justify-between gap-4" style={{ borderLeft: '4px solid #16A34A' }}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#16A34A' }}>ROI</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Annual return on total setup investment</p>
                  <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                    Setup: {formatCurrency(result.roi.totalSetupCost)} · OpEx: {formatCurrency(Math.round(result.roi.monthlyGrossRevenue - result.roi.monthlyNetRevenue))}/mo
                  </p>
                </div>
                <p className="text-4xl font-black flex-shrink-0" style={{ color: '#16A34A' }}>
                  {result.roi.totalSetupCost > 0 ? Math.round((result.roi.year1NetProfit / result.roi.totalSetupCost) * 100) : 0}%
                </p>
              </div>

              {/* Year-by-year bars */}
              <div className="card p-5">
                <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Year-by-Year Net Profit</h3>
                <div className="space-y-3">
                  {([
                    { label: 'Year 1', val: result.roi.year1NetProfit },
                    { label: 'Year 3', val: result.roi.year3NetProfit },
                    { label: 'Year 5', val: result.roi.year5NetProfit },
                  ]).map(({ label, val }) => {
                    const max = result.roi.year5NetProfit;
                    const pct = max > 0 ? Math.max(0, (val / max) * 100) : 0;
                    const neg = val < 0;
                    return (
                      <div key={label} className="flex items-center gap-3">
                        <span className="text-xs font-medium w-12 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                        <div className="flex-1 rounded-full h-4 overflow-hidden" style={{ backgroundColor: 'var(--bg-muted)' }}>
                          <div
                            className="h-4 rounded-full transition-all duration-700"
                            style={{ width: `${neg ? 6 : pct}%`, background: neg ? 'linear-gradient(90deg,#EF4444,#F87171)' : 'linear-gradient(90deg,#16A34A,#4ADE80)', minWidth: '4px' }}
                          />
                        </div>
                        <span className="text-xs font-black w-24 text-right" style={{ color: neg ? '#EF4444' : '#16A34A' }}>
                          {formatCurrency(val)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Score bars */}
              <ScoreBars result={result} aiLoading={aiLoading} />

              {/* AI Insight */}
              <div className="card p-5" style={{ border: '1px solid #BFDBFE', background: 'linear-gradient(135deg,var(--accent-light) 0%,var(--bg-card) 100%)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: 'linear-gradient(135deg,#2563EB,#0EA5E9)' }}>
                    🤖
                  </div>
                  <p className="text-sm font-bold" style={{ color: '#1D4ED8' }}>AI Insight</p>
                  {aiLoading && <span className="text-xs animate-pulse" style={{ color: '#60A5FA' }}>· thinking…</span>}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{result.aiInsight}</p>
              </div>

              {/* Assumptions */}
              <details className="card px-5 py-3">
                <summary className="text-xs font-medium cursor-pointer select-none" style={{ color: 'var(--text-muted)' }}>
                  ▸ Calculation Assumptions
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>Utilisation: 65%</span>
                  <span>Site prep: $5,000</span>
                  <span>Permits: $2,500</span>
                  <span>Software: $30/charger/mo</span>
                  <span>Sessions: {form.targetChargers}× {CHARGER_CONFIG[form.chargerType].sessionsPerDay}/day</span>
                  <span>Excludes electricity cost</span>
                </div>
              </details>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => { setResult(null); setForm(DEFAULT_FORM); }}
                  className="flex-1 py-3 rounded-xl text-sm font-bold border transition-all hover:bg-blue-50"
                  style={{ borderColor: '#2563EB', color: '#2563EB' }}
                >
                  ← New Analysis
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving || aiLoading}
                  className="flex-1 py-3 rounded-xl text-white text-sm font-bold transition-all shadow-md disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#16A34A,#22C55E)' }}
                >
                  {saving ? 'Saving…' : '💾 Save Report'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <Toast toasts={toasts} onDismiss={dismissToast} />
      {result && <ROIChatAssistant siteResult={result} />}
    </>
  );
}
