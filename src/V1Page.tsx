import { useState, useEffect } from 'react';
import { calculateROI, formatCurrency, formatMonths, defaultCostInputs } from './utils/roiCalculator';
import type { ROICostInputs } from './utils/roiCalculator';
import { saveSiteAnalysis } from './lib/supabase';
import { authHeader } from './lib/auth';
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
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
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

const PROPERTY_TYPES: { value: SiteFormInput['propertyType']; label: string }[] = [
  { value: 'mall',        label: 'Shopping Mall' },
  { value: 'hotel',       label: 'Hotel' },
  { value: 'parking',     label: 'Parking Lot' },
  { value: 'workplace',   label: 'Workplace' },
  { value: 'hospital',    label: 'Hospital' },
  { value: 'university',  label: 'University' },
  { value: 'residential', label: 'Residential' },
];

function IconPlug() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="2" x2="6" y2="8" /><line x1="18" y1="2" x2="18" y2="8" />
      <path d="M4 8h16v4a8 8 0 01-16 0V8z" />
      <line x1="12" y1="16" x2="12" y2="22" />
    </svg>
  );
}
function IconBolt() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}
function IconDoubleBolt() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 2L3 12h7l-1 7 9-11H11l1-6z" />
      <path d="M18 6l-5 6h5l-4 6 7-8h-5l4-4z" opacity="0.6" />
    </svg>
  );
}

interface ChargerOption {
  type: SiteFormInput['chargerType'];
  label: string;
  kw: string;
  duration: string;
  bestFor: string;
  Icon: () => React.JSX.Element;
}

const CHARGER_OPTIONS: ChargerOption[] = [
  { type: 'Level 2 AC', label: 'Level 2 AC',     kw: '7–22 kW',   duration: '4–8 hrs',   bestFor: 'Hotels, offices, residential', Icon: IconPlug },
  { type: 'DC Fast',    label: 'DC Fast Charger', kw: '50–150 kW', duration: '20–60 min', bestFor: 'Retail, highways, malls',       Icon: IconBolt },
  { type: 'Ultra-Fast', label: 'Ultra-Fast DC',   kw: '150–350 kW',duration: '10–20 min', bestFor: 'Highways, transit hubs',        Icon: IconDoubleBolt },
];

const DEFAULT_FORM: SiteFormInput = {
  address: '',
  propertyType: 'mall',
  parkingSpaces: 50,
  dailyFootfall: 500,
  targetChargers: 4,
  chargerType: 'Level 2 AC',
};

// Editable cost-input fields shown in the ROI accordion. `pct` fields are stored
// as 0–1 but displayed/edited as whole percentages.
const COST_FIELDS: { key: keyof ROICostInputs; label: string; prefix?: string; suffix?: string; pct?: boolean }[] = [
  { key: 'hardwareCost',       label: 'Hardware cost / unit',     prefix: '$' },
  { key: 'installCost',        label: 'Install cost / unit',      prefix: '$' },
  { key: 'revenuePerSession',  label: 'Revenue / session',        prefix: '$' },
  { key: 'sessionsPerDay',     label: 'Sessions / day / charger' },
  { key: 'monthlyMaintenance', label: 'Monthly maintenance',      prefix: '$' },
  { key: 'utilizationRate',    label: 'Utilisation rate',         suffix: '%', pct: true },
  { key: 'sitePrep',           label: 'Site prep',                prefix: '$' },
  { key: 'permits',            label: 'Permits',                  prefix: '$' },
];

/* ── Score circle (CSS border) ───────────────────────────────── */
function ScoreRing({ score, loading }: { score: number; loading: boolean }) {
  const color   = score >= 75 ? '#16A34A' : score >= 50 ? '#F59E0B' : '#EF4444';
  const bgColor = score >= 75 ? '#DCFCE7' : score >= 50 ? '#FEF9C3' : '#FEE2E2';
  const label   = score >= 75 ? 'Strong'  : score >= 50 ? 'Moderate' : 'Weak';
  return (
    <div className="flex flex-col items-center flex-shrink-0 score-pop">
      <div
        className="relative flex items-center justify-center"
        style={{
          width: 84, height: 84,
          border: `3px solid ${loading ? '#E5E7EB' : color}`,
          borderRadius: '50%',
          background: loading ? '#F5F5F5' : bgColor,
          transition: 'border-color 0.3s, background 0.4s',
        }}
      >
        {loading ? (
          <span className="text-xs animate-pulse" style={{ color: '#9CA3AF' }}>…</span>
        ) : (
          <div className="flex flex-col items-center leading-none">
            <span className="text-2xl font-black" style={{ color }}>{score}</span>
            <span className="text-[10px] font-bold" style={{ color }}>/100</span>
          </div>
        )}
      </div>
      <span className="text-xs font-bold mt-1.5" style={{ color: loading ? '#9CA3AF' : color }}>
        {loading ? 'Scoring…' : label}
      </span>
    </div>
  );
}

/* ── Animated score bars ─────────────────────────────────────── */
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
    { label: 'EV Demand',      pct: demandPct, color: '#185FA5', badge: result.evDemandLevel },
    { label: 'Competitor Gap', pct: gapPct,    color: '#7C3AED', badge: result.competitorRisk === 'low' ? 'low risk' : result.competitorRisk === 'medium' ? 'moderate' : 'high risk' },
    { label: 'Confidence',     pct: confPct,   color: '#16A34A', badge: `${confPct}%` },
  ];

  return (
    <div>
      <h3 className="text-base font-bold mb-4" style={{ color: '#042C53' }}>Site Intelligence Scores</h3>
      {aiLoading ? (
        <p className="text-sm animate-pulse" style={{ color: '#9CA3AF' }}>AI scoring in progress…</p>
      ) : (
        <div className="space-y-4">
          {bars.map(({ label, pct, color, badge }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium" style={{ color: '#6B7280' }}>{label}</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full capitalize" style={{ backgroundColor: color + '18', color }}>
                  {badge}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#F0F4FF' }}>
                <div
                  className="h-2 rounded-full"
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

/* ── Helpers ─────────────────────────────────────────────────── */
function Badge({ level }: { level: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    low:    { bg: '#DCFCE7', text: '#15803D' },
    medium: { bg: '#FEF9C3', text: '#A16207' },
    high:   { bg: '#FEE2E2', text: '#B91C1C' },
  };
  const c = map[level] ?? map['medium']!;
  return (
    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: c.bg, color: c.text }}>
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

const inputCls = 'w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all';
const inputStyle = { borderColor: '#E5E7EB', color: '#042C53', backgroundColor: 'white' };

export default function V1Page() {
  const [form, setForm]           = useState<SiteFormInput>(DEFAULT_FORM);
  const [costs, setCosts]         = useState<ROICostInputs>(() => defaultCostInputs(DEFAULT_FORM.chargerType));
  const [costsEdited, setCostsEdited] = useState(false);
  const [result, setResult]       = useState<SiteResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [showCostInputs, setShowCostInputs] = useState(false);
  const { toasts, addToast, dismissToast } = useToast();

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: ['parkingSpaces', 'dailyFootfall', 'targetChargers'].includes(name) ? Number(value) : value }));
    setResult(null);
  }

  // Switch charger type → reset cost inputs to that type's suggested defaults
  // (hardware/revenue differ hugely between L2 and Ultra-Fast).
  function selectChargerType(type: SiteFormInput['chargerType']) {
    setForm(p => ({ ...p, chargerType: type }));
    setCosts(defaultCostInputs(type));
    setCostsEdited(false);
    setResult(null);
  }

  function handleCostChange(key: keyof ROICostInputs, raw: string, pct?: boolean) {
    const num = raw === '' ? 0 : Number(raw);
    if (Number.isNaN(num)) return;
    setCosts(prev => ({ ...prev, [key]: pct ? num / 100 : num }));
    setCostsEdited(true);
    setResult(null);
  }

  function resetCosts() {
    setCosts(defaultCostInputs(form.chargerType));
    setCostsEdited(false);
    setResult(null);
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const roi   = calculateROI(form, costs);
    const score = computeSiteScore(form, roi);
    const risk: RiskLevel   = form.dailyFootfall < 200 ? 'high' : form.dailyFootfall > 800 ? 'low' : 'medium';
    const demand: DemandLevel = form.dailyFootfall > 800 ? 'high' : form.dailyFootfall > 300 ? 'medium' : 'low';
    setResult({
      roi, siteScore: score, competitorRisk: risk, evDemandLevel: demand,
      aiInsight: buildInsight(form, roi, score),
      address: form.address, chargerType: form.chargerType,
      targetChargers: form.targetChargers, propertyType: form.propertyType,
    });
    setAiLoading(true);
    const ai = await fetchAIForecast(form, roi);
    setAiLoading(false);
    if (ai) setResult(prev => prev ? { ...prev, siteScore: ai.siteScore, competitorRisk: ai.competitorRisk, evDemandLevel: ai.evDemandLevel, aiInsight: ai.aiInsight } : prev);
    setTimeout(() => document.getElementById('v1-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    const saved = await saveSiteAnalysis({
      siteName: form.address.trim() || `${form.propertyType} · ${new Date().toLocaleDateString()}`,
      siteInput: form, roiResult: result.roi, siteScore: result.siteScore,
      evDemandLevel: result.evDemandLevel, competitorRisk: result.competitorRisk, aiInsight: result.aiInsight,
    });
    setSaving(false);
    saved ? addToast('Analysis saved!', 'success') : addToast('Save failed — check Supabase config', 'error');
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-6 items-start">
      {/* ── Form card ─────────────────────────────────────────── */}
      <div>
        <div className="card p-8 md:p-10">
          <h2 className="text-2xl font-extrabold mb-1" style={{ color: '#042C53' }}>
            Analyse a site for EV charging potential
          </h2>
          <p className="text-sm mb-8" style={{ color: '#9CA3AF' }}>
            Enter site details to get an AI-powered revenue forecast.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Address */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>Address</label>
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Nexus Mall, Koramangala, Bengaluru"
                className={inputCls}
                style={inputStyle}
              />
            </div>

            {/* Property type */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>Property Type</label>
              <div className="relative">
                <select
                  name="propertyType"
                  value={form.propertyType}
                  onChange={handleChange}
                  className={inputCls + ' appearance-none pr-10 cursor-pointer'}
                  style={inputStyle}
                >
                  {PROPERTY_TYPES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M4.5 7l4.5 4.5L13.5 7" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Parking + Footfall */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>Parking Spaces</label>
                <input type="number" name="parkingSpaces" min="1" value={form.parkingSpaces} onChange={handleChange} className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>Daily Visitors</label>
                <input type="number" name="dailyFootfall" min="0" value={form.dailyFootfall} onChange={handleChange} className={inputCls} style={inputStyle} />
              </div>
            </div>

            {/* Charger count slider */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
                Chargers to Install: <span className="font-extrabold" style={{ color: '#185FA5' }}>{form.targetChargers}</span>
              </label>
              <input
                type="range" name="targetChargers" min="2" max="20" step="1"
                value={form.targetChargers} onChange={handleChange}
                className="w-full" style={{ accentColor: '#185FA5' }}
              />
              <div className="flex justify-between text-xs mt-1" style={{ color: '#9CA3AF' }}>
                <span>2</span><span>20</span>
              </div>
            </div>

            {/* Charger type cards */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>Charger Type</label>
              <div className="grid grid-cols-3 gap-3">
                {CHARGER_OPTIONS.map(({ type, label, kw, duration, bestFor, Icon }) => {
                  const active = form.chargerType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => selectChargerType(type)}
                      className="flex flex-col items-start text-left transition-all"
                      style={{
                        padding: '16px 14px',
                        borderRadius: 12,
                        border: `2px solid ${active ? '#185FA5' : '#E5E7EB'}`,
                        background: active ? '#EBF3FF' : 'white',
                      }}
                    >
                      <div
                        className="flex items-center justify-center mb-3"
                        style={{ width: 44, height: 44, borderRadius: 10, background: active ? '#185FA520' : '#F5F5F5', color: active ? '#185FA5' : '#9CA3AF' }}
                      >
                        <Icon />
                      </div>
                      <p className="text-sm font-bold leading-tight" style={{ color: active ? '#185FA5' : '#042C53' }}>{label}</p>
                      <p className="text-xs mt-1" style={{ color: active ? '#185FA5' : '#6B7280' }}>{kw} · {duration}</p>
                      <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Best for: {bestFor}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cost Inputs accordion */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
              <button
                type="button"
                onClick={() => setShowCostInputs(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors"
                style={{ background: showCostInputs ? '#F9FAFB' : 'white' }}
              >
                <span className="text-sm font-medium" style={{ color: '#374151' }}>
                  Cost Inputs for ROI Calculation
                  <span className="ml-2 text-xs font-normal" style={{ color: costsEdited ? '#185FA5' : '#9CA3AF' }}>
                    {costsEdited ? '· edited' : '· suggested defaults'}
                  </span>
                </span>
                <svg
                  width="18" height="18" viewBox="0 0 18 18" fill="none"
                  style={{ transform: showCostInputs ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: '#9CA3AF' }}
                >
                  <path d="M4.5 7l4.5 4.5L13.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {showCostInputs && (
                <div className="px-5 pb-5 pt-3" style={{ background: '#F9FAFB', borderTop: '1px solid #E5E7EB' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>
                      Pre-filled for {form.chargerType} — edit any value to refine your forecast.
                    </p>
                    {costsEdited && (
                      <button
                        type="button"
                        onClick={resetCosts}
                        className="text-xs font-semibold flex-shrink-0 ml-3"
                        style={{ color: '#185FA5' }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {COST_FIELDS.map(({ key, label, prefix, suffix, pct }) => {
                      const displayVal = pct ? Math.round(costs[key] * 100) : costs[key];
                      return (
                        <div key={key}>
                          <label className="block text-xs mb-1" style={{ color: '#6B7280' }}>{label}</label>
                          <div className="relative">
                            {prefix && (
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: '#9CA3AF' }}>{prefix}</span>
                            )}
                            <input
                              type="number"
                              min="0"
                              value={displayVal}
                              onChange={(e) => handleCostChange(key, e.target.value, pct)}
                              className="w-full border rounded-lg py-2 text-xs font-semibold focus:outline-none focus:ring-2"
                              style={{
                                borderColor: '#E5E7EB',
                                color: '#042C53',
                                backgroundColor: 'white',
                                paddingLeft: prefix ? 22 : 10,
                                paddingRight: suffix ? 24 : 10,
                                // @ts-expect-error CSS var for Tailwind ring
                                '--tw-ring-color': '#185FA5',
                              }}
                            />
                            {suffix && (
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: '#9CA3AF' }}>{suffix}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-4 rounded-xl text-white font-bold text-base transition-all hover:opacity-90 active:scale-[0.98] shadow-md"
              style={{ background: '#185FA5', borderRadius: 14 }}
            >
              Analyse This Site
            </button>
          </form>
        </div>
      </div>

      {/* ── Results column ────────────────────────────────────── */}
      <div id="v1-results">
      {!result ? (
        /* Empty state */
        <div className="card p-10 flex flex-col items-center justify-center text-center" style={{ minHeight: 400 }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#E6F1FB' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#185FA5"><path d="M13 2L4 14h8l-1 8 10-13h-8l1-7z" /></svg>
          </div>
          <p className="text-base font-bold" style={{ color: '#042C53' }}>Ready to analyse your site</p>
          <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>Fill in the form and click Analyse This Site</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Score headline */}
          <div className="card p-8">
            <div className="flex items-center gap-5 mb-7">
              <ScoreRing score={result.siteScore} loading={aiLoading} />
              <div className="flex-1 min-w-0">
                <p className="text-xl font-extrabold leading-tight" style={{ color: result.siteScore >= 75 ? '#16A34A' : result.siteScore >= 50 ? '#F59E0B' : '#EF4444' }}>
                  {result.siteScore >= 75 ? 'Strong Potential' : result.siteScore >= 50 ? 'Moderate Potential' : 'Weak Potential'}
                </p>
                <p className="text-base font-semibold mt-1 truncate" style={{ color: '#042C53' }}>
                  {form.address || `${PROPERTY_TYPES.find(p => p.value === form.propertyType)?.label ?? form.propertyType} Site`}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                  {PROPERTY_TYPES.find(p => p.value === form.propertyType)?.label} · {form.chargerType}
                </p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Badge level={result.evDemandLevel} />
                  <Badge level={result.competitorRisk} />
                </div>
              </div>
            </div>

            {/* Charger banner */}
            {(() => {
              const opt = CHARGER_OPTIONS.find(o => o.type === form.chargerType)!;
              return (
                <div className="flex items-center gap-3 rounded-xl p-4" style={{ background: '#E6F1FB', border: '1px solid #BFDBFE' }}>
                  <div className="flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 10, background: '#DBEAFE', color: '#185FA5' }}>
                    <opt.Icon />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#185FA5' }}>
                      {form.targetChargers}× {opt.label} · {opt.kw} · {opt.duration}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#3B82F6' }}>Best for: {opt.bestFor}</p>
                  </div>
                </div>
              );
            })()}

            {/* 4 metric cards */}
            <div className="grid grid-cols-2 gap-3 mt-5">
              {[
                { label: 'Monthly Revenue',   value: formatCurrency(result.roi.monthlyNetRevenue),  sub: 'net after OpEx',    vc: '#042C53' },
                { label: 'Break-Even',        value: formatMonths(result.roi.breakEvenMonths),      sub: 'to payback',        vc: '#D97706' },
                { label: 'EV Drivers Nearby', value: Math.round(form.dailyFootfall * 0.35).toLocaleString(), sub: 'estimated in area', vc: '#042C53' },
                { label: 'Utilisation Rate',  value: form.dailyFootfall > 2000 ? '90%' : form.dailyFootfall > 1000 ? '75%' : form.dailyFootfall > 500 ? '62%' : '45%', sub: 'avg session rate', vc: '#042C53' },
              ].map(({ label, value, sub, vc }) => (
                <div key={label} className="rounded-xl p-4" style={{ background: '#F5F5F5' }}>
                  <p className="text-xs font-medium mb-1" style={{ color: '#9CA3AF' }}>{label}</p>
                  <p className="text-xl font-extrabold" style={{ color: vc }}>{value}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{sub}</p>
                </div>
              ))}
            </div>

            {/* ROI callout */}
            <div className="flex items-center justify-between mt-5 px-5 py-4 rounded-xl" style={{ background: '#E6F1FB', border: '2px solid #185FA5' }}>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest mb-0.5" style={{ color: '#185FA5' }}>ROI</p>
                <p className="text-xs" style={{ color: '#6B7280' }}>Annual return on total setup investment</p>
                <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                  Setup: {formatCurrency(result.roi.totalSetupCost)} · OpEx: {formatCurrency(Math.round(result.roi.monthlyGrossRevenue - result.roi.monthlyNetRevenue))}/mo
                </p>
              </div>
              <p className="text-3xl font-black flex-shrink-0 ml-4" style={{ color: '#185FA5' }}>
                {result.roi.totalSetupCost > 0 ? Math.round((result.roi.year1NetProfit / result.roi.totalSetupCost) * 100) : 0}%
              </p>
            </div>
          </div>

          {/* Score bars */}
          <div className="card p-8">
            <ScoreBars result={result} aiLoading={aiLoading} />
          </div>

          {/* Year-by-year */}
          <div className="card p-8">
            <h3 className="text-base font-bold mb-4" style={{ color: '#042C53' }}>Year-by-Year Net Profit</h3>
            <div className="space-y-3">
              {[
                { label: 'Year 1', val: result.roi.year1NetProfit },
                { label: 'Year 3', val: result.roi.year3NetProfit },
                { label: 'Year 5', val: result.roi.year5NetProfit },
              ].map(({ label, val }) => {
                const max = result.roi.year5NetProfit;
                const pct = max > 0 ? Math.max(0, (val / max) * 100) : 0;
                const neg = val < 0;
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-12 flex-shrink-0" style={{ color: '#6B7280' }}>{label}</span>
                    <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: '#F0F4FF' }}>
                      <div className="h-2 rounded-full transition-all duration-700"
                        style={{ width: `${neg ? 6 : pct}%`, background: neg ? '#EF4444' : '#185FA5', minWidth: 4 }} />
                    </div>
                    <span className="text-sm font-extrabold w-24 text-right" style={{ color: neg ? '#EF4444' : '#042C53' }}>
                      {formatCurrency(val)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Insight */}
          <div className="card p-8" style={{ border: '1px solid #BFDBFE', background: '#E6F1FB' }}>
            <p className="text-xs font-extrabold uppercase tracking-widest mb-3" style={{ color: '#185FA5' }}>AI Insight</p>
            {aiLoading ? (
              <p className="text-sm italic animate-pulse" style={{ color: '#6B7280' }}>AI is thinking…</p>
            ) : (
              <p className="text-sm italic leading-relaxed" style={{ color: '#042C53' }}>"{result.aiInsight}"</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pb-8">
            <button
              onClick={() => { setResult(null); setForm(DEFAULT_FORM); setCosts(defaultCostInputs(DEFAULT_FORM.chargerType)); setCostsEdited(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="flex-1 py-3.5 rounded-xl text-sm font-bold border transition-all hover:bg-blue-50"
              style={{ borderColor: '#185FA5', color: '#185FA5' }}
            >
              Analyse Another Site
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={saving || aiLoading}
              className="flex-1 py-3.5 rounded-xl text-white text-sm font-bold transition-all shadow-md disabled:opacity-50"
              style={{ background: '#185FA5' }}
            >
              {saving ? 'Saving…' : 'Save Report'}
            </button>
          </div>
        </div>
      )}
      </div>

      </div>{/* end grid */}

      <Toast toasts={toasts} onDismiss={dismissToast} />
      {result && <ROIChatAssistant siteResult={result} />}
    </>
  );
}
