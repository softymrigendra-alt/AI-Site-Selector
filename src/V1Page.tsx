import { useState } from 'react';
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

const CHARGER_OPTIONS: { type: SiteFormInput['chargerType']; badge: string; desc: string; color: string }[] = [
  { type: 'Level 2 AC', badge: 'L2',  desc: '$8/session · 3/day',  color: '#16A34A' },
  { type: 'DC Fast',    badge: 'DC',  desc: '$18/session · 8/day', color: '#2563EB' },
  { type: 'Ultra-Fast', badge: 'UF',  desc: '$28/session · 12/day',color: '#7C3AED' },
];

const DEFAULT_FORM: SiteFormInput = {
  address: '',
  propertyType: 'parking',
  parkingSpaces: 50,
  dailyFootfall: 500,
  targetChargers: 4,
  chargerType: 'DC Fast',
};

function ScoreRing({ score, loading }: { score: number; loading: boolean }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const pct = loading ? 0 : score / 100;
  const color = score >= 75 ? '#16A34A' : score >= 50 ? '#F59E0B' : '#EF4444';
  const label = score >= 75 ? 'Strong' : score >= 50 ? 'Moderate' : 'Weak';

  return (
    <div className="flex flex-col items-center">
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
    setResult({ roi, siteScore: score, competitorRisk: risk, evDemandLevel: demand, aiInsight: buildInsight(form, roi, score) });
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
                {CHARGER_OPTIONS.map(({ type, badge, desc, color }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => { setForm(p => ({ ...p, chargerType: type })); setResult(null); }}
                    className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-center transition-all"
                    style={form.chargerType === type
                      ? { backgroundColor: color + '15', borderColor: color, color }
                      : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }
                    }
                  >
                    <span className="text-xs font-black tracking-wider" style={{ color: form.chargerType === type ? color : 'var(--text-muted)' }}>{badge}</span>
                    <span className="text-xs font-semibold leading-tight">{type}</span>
                    <span className="text-xs opacity-60 leading-tight">{desc}</span>
                  </button>
                ))}
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
              className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] shadow-md"
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
              {/* Score + headline card */}
              <div className="card p-5 overflow-hidden relative" style={{ background: 'linear-gradient(135deg,#0F172A 0%,#1E3A5F 100%)' }}>
                <div className="absolute top-0 right-0 w-48 h-48 opacity-5 rounded-full" style={{ background: 'radial-gradient(circle,#60A5FA,transparent)', transform: 'translate(30%,-30%)' }} />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#60A5FA' }}>AI Site Assessment</p>
                    <p className="text-white font-bold text-lg mt-1 leading-tight max-w-xs">
                      {form.address || `${form.propertyType.charAt(0).toUpperCase() + form.propertyType.slice(1)} Site`}
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#93C5FD' }}>
                      {form.targetChargers}× {form.chargerType} · {form.parkingSpaces} spaces · {form.dailyFootfall.toLocaleString()} visitors/day
                    </p>
                    <div className="flex gap-2 mt-3">
                      <div className="flex flex-col">
                        <span className="text-xs" style={{ color: '#93C5FD' }}>EV Demand</span>
                        <Badge level={result.evDemandLevel} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs" style={{ color: '#93C5FD' }}>Competitor Risk</span>
                        <Badge level={result.competitorRisk} />
                      </div>
                    </div>
                  </div>
                  <ScoreRing score={result.siteScore} loading={aiLoading} />
                </div>
              </div>

              {/* ROI stat grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Setup Cost',     value: formatCurrency(result.roi.totalSetupCost),    sub: 'one-time capex',        accent: false },
                  { label: 'Monthly Net',    value: formatCurrency(result.roi.monthlyNetRevenue),  sub: 'after OpEx',            accent: false },
                  { label: 'Break-Even',     value: formatMonths(result.roi.breakEvenMonths),     sub: 'to payback',            accent: true  },
                  { label: '3-Year Profit',  value: formatCurrency(result.roi.year3NetProfit),    sub: 'net of setup cost',     accent: false },
                ].map(({ label, value, sub, accent }) => (
                  <div key={label} className="card p-4" style={accent ? { background: 'linear-gradient(135deg,#2563EB,#0EA5E9)', color: 'white' } : {}}>
                    <p className="text-xs font-medium mb-1" style={{ color: accent ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>{label}</p>
                    <p className={`font-black text-xl leading-tight ${accent ? 'text-white' : ''}`} style={accent ? {} : { color: 'var(--text-primary)' }}>{value}</p>
                    <p className="text-xs mt-0.5" style={{ color: accent ? 'rgba(255,255,255,0.65)' : 'var(--text-muted)' }}>{sub}</p>
                  </div>
                ))}
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
