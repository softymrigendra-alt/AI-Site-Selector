import { useState } from 'react';
import { calculateROI, formatCurrency, formatMonths, CHARGER_CONFIG } from './utils/roiCalculator';
import type { SiteFormInput, SiteResult, RiskLevel, DemandLevel, ROIResult } from './types';

const PROPERTY_TYPES: SiteFormInput['propertyType'][] = [
  'hotel', 'mall', 'parking', 'workplace', 'hospital', 'university', 'residential',
];

const CHARGER_TYPES = Object.keys(CHARGER_CONFIG) as SiteFormInput['chargerType'][];

const DEFAULT_FORM: SiteFormInput = {
  address: '',
  propertyType: 'parking',
  parkingSpaces: 50,
  dailyFootfall: 500,
  targetChargers: 4,
  chargerType: 'DC Fast',
};

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}

function StatCard({ label, value, sub, highlight = false }: StatCardProps) {
  return (
    <div
      className="rounded-xl p-4 shadow-sm border"
      style={{
        backgroundColor: highlight ? '#1A2332' : 'white',
        borderColor: highlight ? '#2563EB' : '#E5E7EB',
        color: highlight ? 'white' : '#1A2332',
      }}
    >
      <p className="text-xs font-medium mb-1" style={{ color: highlight ? '#93C5FD' : '#6B7280' }}>{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: highlight ? '#93C5FD' : '#6B7280' }}>{sub}</p>}
    </div>
  );
}

interface RiskBadgeProps {
  level: RiskLevel | DemandLevel;
}

function RiskBadge({ level }: RiskBadgeProps) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    low:    { bg: '#F0FDF4', text: '#16A34A', border: '#86EFAC' },
    medium: { bg: '#FFFBEB', text: '#D97706', border: '#FCD34D' },
    high:   { bg: '#FEF2F2', text: '#DC2626', border: '#FCA5A5' },
  };
  const c = colors[level] ?? colors['medium']!;
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full border capitalize"
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
    >
      {level}
    </span>
  );
}

function computeSiteScore(form: SiteFormInput, roi: ROIResult): number {
  let score = 50;
  if (form.dailyFootfall > 1000) score += 15;
  else if (form.dailyFootfall > 500) score += 8;
  if (form.propertyType === 'mall' || form.propertyType === 'parking') score += 10;
  if (form.propertyType === 'residential') score -= 10;
  if (roi.breakEvenMonths < 36) score += 10;
  if (roi.breakEvenMonths > 72) score -= 15;
  if (form.parkingSpaces / form.targetChargers > 8) score += 5;
  return Math.min(100, Math.max(0, score));
}

function computeCompetitorRisk(form: SiteFormInput): RiskLevel {
  if (form.dailyFootfall < 200) return 'high';
  if (form.dailyFootfall > 800) return 'low';
  return 'medium';
}

function buildInsight(form: SiteFormInput, roi: ROIResult, siteScore: number): string {
  if (siteScore >= 70) {
    return `This ${form.propertyType} location shows strong EV charging potential with ${form.dailyFootfall.toLocaleString()} daily visitors. Break-even at ${formatMonths(roi.breakEvenMonths)} is competitive for the market. Recommended to proceed with ${form.targetChargers} ${form.chargerType} units.`;
  }
  if (siteScore >= 50) {
    return `Moderate potential at this ${form.propertyType} site. Consider increasing charger count or targeting higher-traffic hours to improve utilisation. Break-even projected at ${formatMonths(roi.breakEvenMonths)}.`;
  }
  return `This site presents challenges — low footfall reduces utilisation below optimal thresholds. Consider a smaller ${form.chargerType} deployment (1–2 units) to reduce capital risk before scaling.`;
}

export default function V1Page() {
  const [form, setForm] = useState<SiteFormInput>(DEFAULT_FORM);
  const [result, setResult] = useState<SiteResult | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: ['parkingSpaces', 'dailyFootfall', 'targetChargers'].includes(name)
        ? Number(value)
        : value,
    }));
    setResult(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const roi = calculateROI(form);
    const siteScore = computeSiteScore(form, roi);
    const competitorRisk = computeCompetitorRisk(form);
    const evDemandLevel: DemandLevel = form.dailyFootfall > 800 ? 'high' : form.dailyFootfall > 300 ? 'medium' : 'low';
    const aiInsight = buildInsight(form, roi, siteScore);
    setResult({ roi, siteScore, competitorRisk, evDemandLevel, aiInsight });
  }

  const labelClass = 'block text-sm font-medium mb-1';
  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Form */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-base font-bold mb-1" style={{ color: '#1A2332' }}>Site Details</h2>
          <p className="text-xs text-gray-500 mb-4">Fill in your site data for an instant forecast.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>Address / Location</label>
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="e.g. 123 Main St, Chicago, IL"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Property Type</label>
              <select name="propertyType" value={form.propertyType} onChange={handleChange} className={inputClass}>
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Parking Spaces</label>
                <input type="number" name="parkingSpaces" min="1" value={form.parkingSpaces} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Daily Footfall</label>
                <input type="number" name="dailyFootfall" min="0" value={form.dailyFootfall} onChange={handleChange} className={inputClass} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Charger Type</label>
              <select name="chargerType" value={form.chargerType} onChange={handleChange} className={inputClass}>
                {CHARGER_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {form.chargerType === 'Level 2 AC' && 'Hardware $1.2K · $8/session · 3/day avg'}
                {form.chargerType === 'DC Fast'    && 'Hardware $25K · $18/session · 8/day avg'}
                {form.chargerType === 'Ultra-Fast' && 'Hardware $75K · $28/session · 12/day avg'}
              </p>
            </div>

            <div>
              <label className={labelClass}>Number of Chargers</label>
              <input type="number" name="targetChargers" min="1" max="100" value={form.targetChargers} onChange={handleChange} className={inputClass} />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg text-white font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#2563EB' }}
            >
              Generate Forecast ⚡
            </button>
          </form>
        </div>
      </div>

      {/* Results */}
      <div className="lg:col-span-3 space-y-4">
        {!result ? (
          <div className="bg-white rounded-2xl shadow-sm border border-dashed border-gray-300 p-12 flex flex-col items-center justify-center text-gray-400 text-center">
            <span className="text-4xl mb-3">📊</span>
            <p className="font-medium">Fill in the form and click Generate Forecast</p>
            <p className="text-sm mt-1">ROI projections appear here instantly</p>
          </div>
        ) : (
          <>
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">ROI Forecast</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Setup Cost"   value={formatCurrency(result.roi.totalSetupCost)} />
                <StatCard label="Monthly Net"  value={formatCurrency(result.roi.monthlyNetRevenue)} sub="after OpEx" />
                <StatCard label="Break-Even"   value={formatMonths(result.roi.breakEvenMonths)} highlight />
                <StatCard label="3-Year Profit" value={formatCurrency(result.roi.year3NetProfit)} sub="net of setup" />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#1A2332' }}>Year-by-Year Profit</h3>
              <div className="space-y-2">
                {(
                  [
                    { label: 'Year 1', val: result.roi.year1NetProfit },
                    { label: 'Year 3', val: result.roi.year3NetProfit },
                    { label: 'Year 5', val: result.roi.year5NetProfit },
                  ] as const
                ).map(({ label, val }) => {
                  const maxVal = result.roi.year5NetProfit;
                  const pct = maxVal > 0 ? Math.max(0, (val / maxVal) * 100) : 0;
                  const isNeg = val < 0;
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-10 flex-shrink-0">{label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3">
                        <div
                          className="h-3 rounded-full"
                          style={{
                            width: `${isNeg ? 5 : pct}%`,
                            backgroundColor: isNeg ? '#DC2626' : '#16A34A',
                            minWidth: '4px',
                          }}
                        />
                      </div>
                      <span
                        className="text-xs font-semibold w-24 text-right"
                        style={{ color: isNeg ? '#DC2626' : '#16A34A' }}
                      >
                        {formatCurrency(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#1A2332' }}>Site Intelligence</h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center">
                  <p className="text-3xl font-bold" style={{ color: '#2563EB' }}>{result.siteScore}</p>
                  <p className="text-xs text-gray-500">Site Score /100</p>
                </div>
                <div className="text-center">
                  <div className="flex justify-center mb-1"><RiskBadge level={result.evDemandLevel} /></div>
                  <p className="text-xs text-gray-500">EV Demand</p>
                </div>
                <div className="text-center">
                  <div className="flex justify-center mb-1"><RiskBadge level={result.competitorRisk} /></div>
                  <p className="text-xs text-gray-500">Competitor Risk</p>
                </div>
              </div>
              <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: '#EFF6FF', color: '#1A2332' }}>
                <p className="font-medium text-xs mb-1" style={{ color: '#2563EB' }}>AI Insight (Phase 1: rule-based → Phase 2: live LLM)</p>
                <p className="text-sm leading-relaxed">{result.aiInsight}</p>
              </div>
            </div>

            <details className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
              <summary className="text-sm font-medium cursor-pointer text-gray-500 select-none">
                Calculation Assumptions
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
                <div>Utilisation rate: 65%</div>
                <div>Site prep: $5,000</div>
                <div>Permits: $2,500</div>
                <div>Software fee: $30/charger/mo</div>
                <div>Sessions modelled: {form.targetChargers} × {CHARGER_CONFIG[form.chargerType].sessionsPerDay}/day</div>
                <div>Monthly OpEx excludes electricity cost</div>
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
