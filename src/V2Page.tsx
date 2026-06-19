import { useState, lazy, Suspense } from 'react';
import { runAgentPipeline } from './lib/agentOrchestrator';
import { formatCurrency, formatMonths } from './utils/roiCalculator';
import type { AgentId, AgentStatus, AgentUpdate, PipelineOutput } from './lib/agentOrchestrator';

// Leaflet is ~250 kB — lazy load so it doesn't bloat the initial bundle
const SiteMap = lazy(() => import('./components/SiteMap').then((m) => ({ default: m.SiteMap })));
const SiteMapPlaceholder = lazy(() => import('./components/SiteMap').then((m) => ({ default: m.SiteMapPlaceholder })));

// ─── Agent metadata (display only) ───────────────────────────────────────────

interface AgentMeta {
  id: AgentId;
  name: string;
  icon: string;
  description: string;
}

const AGENT_META: AgentMeta[] = [
  { id: 'site',    name: 'Site Intelligence',   icon: '🗺️', description: 'Geocoding address · fetching AFDC competitor stations · EV registrations' },
  { id: 'utility', name: 'Utility Rate',        icon: '⚡', description: 'Querying EIA for state commercial electricity $/kWh' },
  { id: 'roi',     name: 'ROI Optimisation',    icon: '📈', description: 'Selecting optimal charger type & count · running ROI model' },
  { id: 'market',  name: 'Market Watch',        icon: '🔭', description: 'EV adoption trends · available grant programmes' },
  { id: 'lead',    name: 'Lead Qualification',  icon: '🤖', description: 'LLM scoring site against benchmarks · generating insight' },
];

// ─── Agent Row ────────────────────────────────────────────────────────────────

interface AgentRowProps {
  meta: AgentMeta;
  status: AgentStatus;
  summary: string;
  durationMs?: number;
}

function AgentRow({ meta, status, summary, durationMs }: AgentRowProps) {
  const styles: Record<AgentStatus, { bg: string; border: string; dot: string; label: string }> = {
    waiting: { bg: 'white',   border: '#E5E7EB', dot: '#9CA3AF', label: 'waiting' },
    running: { bg: '#EFF6FF', border: '#BFDBFE', dot: '#2563EB', label: 'running' },
    done:    { bg: '#F0FDF4', border: '#86EFAC', dot: '#16A34A', label: 'done' },
    failed:  { bg: '#FEF2F2', border: '#FCA5A5', dot: '#DC2626', label: 'failed' },
  };
  const s = styles[status];

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-xl border transition-all duration-300"
      style={{ backgroundColor: s.bg, borderColor: s.border }}
    >
      <div className="text-xl mt-0.5 flex-shrink-0">{meta.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold" style={{ color: '#1A2332' }}>{meta.name}</span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {durationMs !== undefined && (
              <span className="text-xs text-gray-400">{(durationMs / 1000).toFixed(1)}s</span>
            )}
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: s.dot }}
            />
            <span className="text-xs font-mono" style={{ color: s.dot }}>{s.label}</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{meta.description}</p>
        {status === 'running' && (
          <div className="mt-2 h-1 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-1 rounded-full animate-pulse" style={{ width: '60%', backgroundColor: '#2563EB' }} />
          </div>
        )}
        {(status === 'done' || status === 'failed') && summary && (
          <div
            className="mt-1.5 text-xs rounded-lg px-2 py-1 border"
            style={{
              backgroundColor: status === 'failed' ? '#FEF2F2' : 'white',
              borderColor: status === 'failed' ? '#FCA5A5' : '#E5E7EB',
              color: status === 'failed' ? '#DC2626' : '#374151',
            }}
          >
            {summary}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSummary(agentId: AgentId, data: AgentUpdate['data']): string {
  if (!data) return '';
  switch (agentId) {
    case 'site': {
      const d = data as import('./lib/agentOrchestrator').SiteAgentResult;
      const city = d.geo ? `${d.geo.city}, ${d.geo.state}` : 'address geocoded';
      return `${city} · ${d.nearbyCount} competitor station(s) · ${(d.evRegistrations?.evCount ?? 0).toLocaleString()} EVs registered`;
    }
    case 'utility': {
      const d = data as import('./lib/agentOrchestrator').UtilityAgentResult;
      return d.rate
        ? `${d.rate.utilityName} · $${d.rate.ratePerKwh.toFixed(3)}/kWh avg · $${d.rate.peakRatePerKwh.toFixed(3)}/kWh peak`
        : `US average rate applied: $${d.ratePerKwh.toFixed(3)}/kWh`;
    }
    case 'roi': {
      const d = data as import('./lib/agentOrchestrator').ROIAgentResult;
      return `${d.recommendedCount}× ${d.recommendedType} · ${formatCurrency(d.roi.monthlyNetRevenue)}/mo net · break-even ${formatMonths(d.roi.breakEvenMonths)}`;
    }
    case 'market': {
      const d = data as import('./lib/agentOrchestrator').MarketAgentResult;
      return `EV growth ${d.evGrowthRate} · ${d.availableGrants.length} grant(s) · ${d.grantValue}`;
    }
    case 'lead': {
      const d = data as import('./lib/agentOrchestrator').LeadAgentResult;
      return `Site score ${d.siteScore}/100 · ${d.qualification.toUpperCase()} · confidence ${d.confidenceLevel}%`;
    }
    default:
      return '';
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Phase = 'idle' | 'running' | 'done' | 'error';

export default function V2Page() {
  const [address, setAddress] = useState<string>('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [statuses, setStatuses] = useState<Partial<Record<AgentId, AgentStatus>>>({});
  const [summaries, setSummaries] = useState<Partial<Record<AgentId, string>>>({});
  const [durations, setDurations] = useState<Partial<Record<AgentId, number>>>({});
  const [output, setOutput] = useState<PipelineOutput | null>(null);
  const [totalMs, setTotalMs] = useState<number>(0);

  async function handleRun() {
    if (!address.trim() || phase === 'running') return;
    setPhase('running');
    setStatuses({});
    setSummaries({});
    setDurations({});
    setOutput(null);

    const start = Date.now();
    try {
      const result = await runAgentPipeline(address, (update: AgentUpdate) => {
        setStatuses((p) => ({ ...p, [update.agentId]: update.status }));
        if (update.data) {
          setSummaries((p) => ({ ...p, [update.agentId]: buildSummary(update.agentId, update.data) }));
        }
        if (update.error) {
          setSummaries((p) => ({ ...p, [update.agentId]: `Failed: ${update.error}` }));
        }
        if (update.durationMs !== undefined) {
          setDurations((p) => ({ ...p, [update.agentId]: update.durationMs! }));
        }
      });
      setOutput(result);
      setTotalMs(Date.now() - start);
      setPhase('done');
    } catch {
      setPhase('error');
    }
  }

  const lead = output?.lead;
  const roi = output?.roi;
  const market = output?.market;
  const site = output?.site;

  return (
    <div className="space-y-5">
      {/* Header + search */}
      <div className="rounded-2xl p-5 text-white" style={{ backgroundColor: '#1A2332' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">V2 Agentic Pipeline</h2>
            <p className="text-sm mt-1" style={{ color: '#93C5FD' }}>
              5 AI agents fetch live competitor data, electricity rates, EV registrations, and generate a real ROI forecast.
            </p>
          </div>
          <span
            className="flex-shrink-0 text-xs px-2 py-1 rounded-full"
            style={{ backgroundColor: phase === 'done' ? '#16A34A' : '#2563EB' }}
          >
            {phase === 'done' ? `✓ Live · ${(totalMs / 1000).toFixed(1)}s` : 'Live APIs'}
          </span>
        </div>
        <div className="mt-4 flex gap-3">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && phase !== 'running' && void handleRun()}
            placeholder="Enter site address (e.g. 400 N Michigan Ave, Chicago, IL)"
            className="flex-1 rounded-lg px-4 py-2.5 text-sm text-gray-900 border-0 focus:outline-none focus:ring-2 focus:ring-blue-400"
            disabled={phase === 'running'}
          />
          <button
            onClick={() => void handleRun()}
            disabled={phase === 'running' || !address.trim()}
            className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#2563EB' }}
          >
            {phase === 'running' ? 'Running…' : 'Analyse Site ⚡'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Agent pipeline column */}
        <div className="lg:col-span-2 space-y-2">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Agent Pipeline</h3>
          {AGENT_META.map((meta) => (
            <AgentRow
              key={meta.id}
              meta={meta}
              status={statuses[meta.id] ?? 'waiting'}
              summary={summaries[meta.id] ?? ''}
              durationMs={durations[meta.id]}
            />
          ))}
        </div>

        {/* Results column */}
        <div className="lg:col-span-3">
          {phase === 'idle' && (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 flex flex-col items-center justify-center text-gray-400 text-center h-full">
              <span className="text-5xl mb-3">🤖</span>
              <p className="font-medium">Enter an address to start the live pipeline</p>
              <p className="text-sm mt-1">Agents call AFDC, EIA, and Nominatim APIs in real time</p>
            </div>
          )}

          {phase === 'running' && !output && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col items-center justify-center text-center h-full">
              <div className="text-4xl mb-3 animate-bounce">⚡</div>
              <p className="font-semibold" style={{ color: '#2563EB' }}>Agents working…</p>
              <p className="text-sm text-gray-400 mt-1">Fetching live data from AFDC, EIA, and Nominatim</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="bg-white rounded-2xl border border-red-200 p-8 flex flex-col items-center justify-center text-center">
              <span className="text-4xl mb-3">⚠️</span>
              <p className="font-semibold text-red-600">Pipeline failed</p>
              <p className="text-sm text-gray-400 mt-1">Check your network connection and try again.</p>
            </div>
          )}

          {output && lead && roi && market && (
            <div className="space-y-4">
              {/* Recommendation banner */}
              <div className="rounded-xl p-4 text-white" style={{ backgroundColor: '#16A34A' }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1 opacity-80">Agent Recommendation</p>
                <p className="font-bold text-lg">{roi.recommendedCount}× {roi.recommendedType} Chargers</p>
                <p className="text-sm mt-1 opacity-90">{roi.reasoning}</p>
              </div>

              {/* ROI grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([
                  { label: 'Setup Cost',    value: formatCurrency(roi.roi.totalSetupCost) },
                  { label: 'Monthly Net',   value: formatCurrency(roi.roi.monthlyNetRevenue) },
                  { label: 'Break-Even',    value: formatMonths(roi.roi.breakEvenMonths) },
                  { label: '3-Year Profit', value: formatCurrency(roi.roi.year3NetProfit) },
                ] as const).map(({ label, value }) => (
                  <div key={label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-200 text-center">
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className="text-base font-bold" style={{ color: '#1A2332' }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Scores + AI insight */}
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <h4 className="text-sm font-semibold mb-3" style={{ color: '#1A2332' }}>AI Assessment</h4>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-3xl font-bold" style={{ color: '#2563EB' }}>{lead.siteScore}</p>
                    <p className="text-xs text-gray-500">Site Score</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold" style={{ color: '#16A34A' }}>{lead.confidenceLevel}%</p>
                    <p className="text-xs text-gray-500">Confidence</p>
                  </div>
                  <div className="text-center">
                    <p
                      className="text-base font-bold capitalize"
                      style={{ color: lead.qualification === 'strong' ? '#16A34A' : lead.qualification === 'moderate' ? '#D97706' : '#DC2626' }}
                    >
                      {lead.qualification}
                    </p>
                    <p className="text-xs text-gray-500">Qualification</p>
                  </div>
                </div>
                <div className="rounded-lg p-3 text-sm leading-relaxed" style={{ backgroundColor: '#EFF6FF', color: '#1A2332' }}>
                  <p className="text-xs font-medium mb-1" style={{ color: '#2563EB' }}>LLM Insight</p>
                  {lead.aiInsight}
                </div>
              </div>

              {/* Live data sources */}
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <h4 className="text-sm font-semibold mb-3" style={{ color: '#1A2332' }}>Live Data Sources</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {site?.geo && (
                    <div className="flex items-center gap-2">
                      <span className="text-green-500 font-bold">✓</span>
                      <span className="text-gray-600">
                        <span className="font-medium">Location:</span> {site.geo.city}, {site.geo.state}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-green-500 font-bold">✓</span>
                    <span className="text-gray-600">
                      <span className="font-medium">Competitors:</span> {site?.nearbyCount ?? 0} within 5 miles (AFDC)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-500 font-bold">✓</span>
                    <span className="text-gray-600">
                      <span className="font-medium">EV registrations:</span> {(site?.evRegistrations?.evCount ?? 0).toLocaleString()} (DOE)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={output.utility.rate ? 'text-green-500 font-bold' : 'text-amber-500 font-bold'}>
                      {output.utility.rate ? '✓' : '~'}
                    </span>
                    <span className="text-gray-600">
                      <span className="font-medium">Electricity:</span> ${output.utility.ratePerKwh.toFixed(3)}/kWh
                      {output.utility.rate?.source ? ` (${output.utility.rate.source})` : ' (estimate)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Map — lazy loaded to keep initial bundle small */}
              <Suspense fallback={<div className="rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 text-sm" style={{ height: 280 }}>Loading map…</div>}>
                {site?.geo ? (
                  <SiteMap
                    lat={site.geo.lat}
                    lng={site.geo.lng}
                    siteAddress={site.geo.formattedAddress}
                    competitors={site.competitors}
                  />
                ) : (
                  <SiteMapPlaceholder reason="Address could not be geocoded — check spelling and try again." />
                )}
              </Suspense>

              {/* Grants */}
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <h4 className="text-sm font-semibold mb-2" style={{ color: '#1A2332' }}>
                  Available Grants <span className="text-xs font-normal text-gray-400">(Market Watch agent)</span>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {market.availableGrants.map((g) => (
                    <span key={g} className="text-xs px-2 py-1 rounded-full border"
                      style={{ backgroundColor: '#F0FDF4', color: '#16A34A', borderColor: '#86EFAC' }}>
                      {g}
                    </span>
                  ))}
                  <span className="text-xs px-2 py-1 rounded-full border font-semibold"
                    style={{ backgroundColor: '#EFF6FF', color: '#2563EB', borderColor: '#BFDBFE' }}>
                    {market.grantValue}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-2">Peak demand: {market.peakDemand}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
