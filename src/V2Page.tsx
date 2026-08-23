import { useState, Suspense } from 'react';
import { runAgentPipeline } from './lib/agentOrchestrator';
import { OCM_LIVE, EIA_KEY_LIVE } from './lib/externalAPIs';
import { formatCurrency, formatMonths } from './utils/roiCalculator';
import type { AgentId, AgentStatus, AgentUpdate, PipelineOutput } from './lib/agentOrchestrator';

// Leaflet is ~250 kB — lazy load so it doesn't bloat the initial bundle
import { lazyWithReload } from './lib/lazyWithReload';
const SiteMap = lazyWithReload(() => import('./components/SiteMap').then((m) => ({ default: m.SiteMap })));
const SiteMapPlaceholder = lazyWithReload(() => import('./components/SiteMap').then((m) => ({ default: m.SiteMapPlaceholder })));

// ─── Agent metadata (display only) ───────────────────────────────────────────

interface AgentMeta {
  id: AgentId;
  name: string;
  icon: string;
  description: string;
  color: string;
}

const AGENT_META: AgentMeta[] = [
  { id: 'site',    name: 'Site Intelligence',  icon: '🗺️', description: 'Geocoding address · fetching OpenChargeMap competitor stations · EV registrations', color: '#2563EB' },
  { id: 'utility', name: 'Utility Rate',       icon: '⚡', description: 'Querying EIA for state commercial electricity $/kWh',                       color: '#0D9488' },
  { id: 'roi',     name: 'ROI Optimisation',   icon: '📈', description: 'Selecting optimal charger type & count · running ROI model',                 color: '#7C3AED' },
  { id: 'market',  name: 'Market Watch',       icon: '🔭', description: 'EV adoption trends · available grant programmes',                             color: '#D97706' },
  { id: 'lead',    name: 'Lead Qualification', icon: '🤖', description: 'LLM scoring site against benchmarks · generating insight',                    color: '#16A34A' },
];

// ─── Agent Row ────────────────────────────────────────────────────────────────

interface AgentRowProps {
  meta: AgentMeta;
  status: AgentStatus;
  summary: string;
  durationMs?: number;
}

function AgentRow({ meta, status, summary, durationMs }: AgentRowProps) {
  const c = meta.color;
  const styles: Record<AgentStatus, { bg: string; border: string; dot: string; label: string }> = {
    waiting: { bg: 'white',       border: '#E5E7EB',  dot: '#9CA3AF', label: 'waiting' },
    running: { bg: c + '0D',      border: c,          dot: c,         label: 'running' },
    done:    { bg: c + '08',      border: c + '70',   dot: c,         label: 'done'    },
    failed:  { bg: '#FEF2F2',     border: '#FCA5A5',  dot: '#DC2626', label: 'failed'  },
  };
  const s = styles[status];

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-xl transition-all duration-300"
      style={{
        backgroundColor: s.bg,
        border: `1px solid ${s.border}`,
        borderLeft: `4px solid ${(status === 'running' || status === 'done') ? c : '#E5E7EB'}`,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold" style={{ color: (status === 'running' || status === 'done') ? c : '#1A2332' }}>{meta.name}</span>
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
            <div className="h-1 rounded-full animate-pulse" style={{ width: '60%', backgroundColor: c }} />
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

// ─── Data-source provenance row ───────────────────────────────────────────────
// `live` = fetched from a real external API this run. Otherwise it's a curated
// estimate/reference value — labelled honestly so the forecast stays credible.

function SourceRow({ label, value, live, note }: { label: string; value: string; live: boolean; note: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
        style={live
          ? { backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #86EFAC' }
          : { backgroundColor: '#FEF9C3', color: '#A16207', border: '1px solid #FDE68A' }}
      >
        {live ? 'LIVE' : 'EST'}
      </span>
      <span style={{ color: 'var(--text-secondary)' }}>
        <span className="font-medium">{label}:</span> {value}
        <span style={{ color: 'var(--text-muted)' }}> · {note}</span>
      </span>
    </div>
  );
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
  // True only when the EIA call actually returned live data this run (not the fallback object)
  const eiaLive = EIA_KEY_LIVE && output?.utility.rate?.source === 'EIA Retail Sales';
  const completedCount = AGENT_META.filter(m => statuses[m.id] === 'done' || statuses[m.id] === 'failed').length;

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-bold" style={{ color: '#2563EB' }}>⚡</span>
          <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: '#2563EB' }}>Powered by Agentic AI</p>
        </div>
        <h2 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>Autonomous Site Analysis</h2>
        <p className="text-sm mt-1 mb-5" style={{ color: 'var(--text-secondary)' }}>
          AI agents will automatically fetch EV demand, competitor data, utility rates and generate your forecast — no manual inputs needed.
        </p>
        <div className="flex gap-3">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && phase !== 'running' && void handleRun()}
            placeholder="Enter site address (e.g. 400 N Michigan Ave, Chicago, IL)"
            className="flex-1 rounded-lg px-4 py-2.5 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-400 form-input"
            disabled={phase === 'running'}
          />
          <button
            onClick={() => void handleRun()}
            disabled={phase === 'running' || !address.trim()}
            className={`px-6 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-50${phase === 'idle' ? ' btn-pulse-glow' : ''}`}
            style={{ backgroundColor: '#1A2332' }}
          >
            {phase === 'running' ? 'Running…' : 'Run AI Agents ⚡'}
          </button>
        </div>
      </div>

      {/* ── Idle placeholder ───────────────────────────────────── */}
      {phase === 'idle' && (
        <div className="card p-12 flex flex-col items-center justify-center text-center" style={{ minHeight: '280px' }}>
          <span className="text-5xl mb-4">🤖</span>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Enter an address to start the live pipeline</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Agents call OpenChargeMap, EIA, and Nominatim APIs in real time</p>
        </div>
      )}

      {/* ── Pipeline card ──────────────────────────────────────── */}
      {phase !== 'idle' && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Live Agent Pipeline</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Agents working in sequence — no manual inputs needed</p>
            </div>
            <span className="text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-2 flex-shrink-0"
              style={{
                backgroundColor: phase === 'done' ? '#F0FDF4' : '#EFF6FF',
                color: phase === 'done' ? '#16A34A' : '#2563EB',
                border: `1px solid ${phase === 'done' ? '#86EFAC' : '#BFDBFE'}`,
              }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: phase === 'done' ? '#16A34A' : '#2563EB' }} />
              {completedCount}/5 complete
            </span>
          </div>

          <div className="relative">
            <div className="absolute left-4 top-5 bottom-5 w-0.5" style={{ backgroundColor: 'var(--border)' }} />
            <div className="space-y-2">
              {AGENT_META.map((meta) => {
                const status = statuses[meta.id] ?? 'waiting';
                const isDone = status === 'done';
                const isRunning = status === 'running';
                return (
                  <div key={meta.id} className="relative flex items-start gap-2.5">
                    <div
                      className="relative z-10 w-8 h-8 mt-2.5 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all duration-300"
                      style={{
                        backgroundColor: isDone ? meta.color : isRunning ? meta.color + '18' : 'white',
                        borderColor: (isDone || isRunning) ? meta.color : '#E5E7EB',
                      }}>
                      {isRunning && <div className="w-3 h-3 rounded-full animate-ping" style={{ backgroundColor: meta.color }} />}
                      {isDone && <span className="text-white text-xs font-black">✓</span>}
                      {!isDone && !isRunning && <span className="text-sm">{meta.icon}</span>}
                    </div>
                    <div className="flex-1">
                      <AgentRow meta={meta} status={status} summary={summaries[meta.id] ?? ''} durationMs={durations[meta.id]} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {phase === 'done' && (
            <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <span>All agents completed</span>
              <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Total: {(totalMs / 1000).toFixed(1)}s</span>
            </div>
          )}
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────── */}
      {phase === 'error' && (
        <div className="card p-8 flex flex-col items-center justify-center text-center">
          <span className="text-4xl mb-3">⚠️</span>
          <p className="font-semibold text-red-600">Pipeline failed</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Check your network connection and try again.</p>
        </div>
      )}

      {/* ── Results ────────────────────────────────────────────── */}
      {output && lead && roi && market && (
        <div className="space-y-4">

          {/* AI Confidence */}
          <div className="card p-5">
            <div className="flex items-start justify-between mb-3 gap-4">
              <div>
                <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>AI Confidence: {lead.confidenceLevel}%</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Based on live geocoding, LLM analysis and comparison against similar sites
                </p>
              </div>
              <span className="text-xs px-3 py-1.5 rounded-full font-semibold flex-shrink-0"
                style={{
                  backgroundColor: lead.confidenceLevel >= 80 ? '#F0FDF4' : '#FEF9C3',
                  color: lead.confidenceLevel >= 80 ? '#16A34A' : '#A16207',
                  border: `1px solid ${lead.confidenceLevel >= 80 ? '#86EFAC' : '#FDE68A'}`,
                }}>
                {lead.confidenceLevel >= 80 ? 'High confidence' : 'Moderate confidence'}
              </span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-muted)' }}>
              <div className="h-3 rounded-full" style={{ width: `${lead.confidenceLevel}%`, background: 'linear-gradient(90deg,#1A2332,#2563EB)', transition: 'width 1s cubic-bezier(0.22,1,0.36,1)' }} />
            </div>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([
              { label: 'SITE SCORE',    value: `${lead.siteScore}/100`,                        vc: '#2563EB' },
              { label: 'MONTHLY NET',   value: formatCurrency(roi.roi.monthlyNetRevenue),      vc: '#16A34A' },
              { label: 'BREAK-EVEN',    value: formatMonths(roi.roi.breakEvenMonths),          vc: '#D97706' },
              { label: 'YEAR 3 PROFIT', value: formatCurrency(roi.roi.year3NetProfit),         vc: 'var(--text-primary)' },
            ]).map(({ label, value, vc }) => (
              <div key={label} className="card p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className="text-xl font-black" style={{ color: vc }}>{value}</p>
              </div>
            ))}
          </div>

          {/* What AI found + What AI recommends */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-5">
              <h4 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>What AI found automatically</h4>
              <div className="space-y-2">
                {[
                  site?.geo ? `${site.geo.city}, ${site.geo.state} — location geocoded (live)` : null,
                  `${site?.nearbyCount ?? 0} competitor stations within 5 mi (OpenChargeMap — live)`,
                  site?.evRegistrations?.evCount ? `${site.evRegistrations.evCount.toLocaleString()} EV registrations in state (estimate)` : null,
                  `Electricity: $${output.utility.ratePerKwh.toFixed(3)}/kWh (${eiaLive ? 'EIA live' : 'US average estimate'})`,
                  `${roi.recommendedCount}× ${roi.recommendedType} optimal — ${Math.round((roi.roi.year1NetProfit / roi.roi.totalSetupCost) * 100)}% annual ROI`,
                ].filter(Boolean).map((fact) => (
                  <div key={fact as string} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-bold flex-shrink-0 mt-0.5" style={{ color: '#16A34A' }}>·</span>
                    <span>{fact}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h4 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>What AI recommends doing next</h4>
              <div className="space-y-2.5">
                {[
                  { title: 'Send ROI proposal',   badge: 'Draft ready', desc: `${roi.recommendedCount}× ${roi.recommendedType} · ${formatMonths(roi.roi.breakEvenMonths)} payback` },
                  { title: 'Apply for grant',      badge: 'Available',   desc: `${market.grantValue} — ${market.availableGrants[0] ?? 'federal incentive'}` },
                  { title: 'Schedule site visit',  badge: 'Next step',   desc: 'Confirm parking layout and grid connection capacity' },
                ].map(({ title, badge, desc }) => (
                  <div key={title} className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-muted)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>{badge}</span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* LLM Insight */}
          <div className="card p-4" style={{ border: '1px solid #BFDBFE', background: 'linear-gradient(135deg,var(--accent-light) 0%,var(--bg-card) 100%)' }}>
            <p className="text-xs font-bold mb-2 capitalize" style={{ color: '#2563EB' }}>
              LLM Insight · {lead.qualification.toUpperCase()} · confidence {lead.confidenceLevel}%
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{lead.aiInsight}</p>
          </div>

          {/* Data sources — honest LIVE vs ESTIMATE provenance */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Data Sources</h4>
              <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                <span style={{ color: '#16A34A' }}>LIVE</span> = fetched this run · <span style={{ color: '#A16207' }}>EST</span> = curated estimate
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {site?.geo && (
                <SourceRow label="Location" value={`${site.geo.city}, ${site.geo.state}`} live={true} note="Nominatim / OSM" />
              )}
              <SourceRow
                label="Competitors"
                value={`${site?.nearbyCount ?? 0} within 5 mi`}
                live={OCM_LIVE}
                note="OpenChargeMap (800k+ stations globally)"
              />
              <SourceRow
                label="EV registrations"
                value={(site?.evRegistrations?.evCount ?? 0).toLocaleString()}
                live={false}
                note="state-level reference"
              />
              <SourceRow
                label="Electricity"
                value={`$${output.utility.ratePerKwh.toFixed(3)}/kWh`}
                live={eiaLive}
                note={eiaLive ? 'EIA Retail Sales' : 'US average estimate'}
              />
              <SourceRow label="Grants" value={market.grantValue} live={false} note="NEVI / IRA reference" />
            </div>
            {!eiaLive && (
              <p className="text-[11px] mt-3 pt-2.5 border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                Some sources use curated estimates.{!eiaLive ? ' Add an EIA API key to upgrade electricity rates to live data.' : ''}
              </p>
            )}
          </div>

          {/* Map */}
          <Suspense fallback={<div className="rounded-xl border flex items-center justify-center text-sm" style={{ height: 280, borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Loading map…</div>}>
            {site?.geo ? (
              <SiteMap lat={site.geo.lat} lng={site.geo.lng} siteAddress={site.geo.formattedAddress} competitors={site.competitors} />
            ) : (
              <SiteMapPlaceholder reason="Address could not be geocoded — check spelling and try again." />
            )}
          </Suspense>

          {/* Grants */}
          <div className="card p-4">
            <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              Available Grants <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>(Market Watch agent)</span>
            </h4>
            <div className="flex flex-wrap gap-2">
              {market.availableGrants.map((g) => (
                <span key={g} className="text-xs px-2 py-1 rounded-full border" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', borderColor: '#86EFAC' }}>{g}</span>
              ))}
              <span className="text-xs px-2 py-1 rounded-full border font-semibold" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', borderColor: '#BFDBFE' }}>
                {market.grantValue}
              </span>
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Peak demand: {market.peakDemand}</p>
          </div>

          {/* V1 vs V2 strip */}
          <div className="rounded-xl p-4" style={{ backgroundColor: '#1A2332' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: '#60A5FA' }}>What V2 found that V1 couldn't</p>
            <div className="flex flex-wrap gap-2">
              {[
                `${eiaLive ? 'Live' : 'Est.'} electricity: $${output.utility.ratePerKwh.toFixed(3)}/kWh`,
                `${site?.nearbyCount ?? 0} competitor stations (OpenChargeMap live)`,
                `Optimal mix: ${roi.recommendedCount}× ${roi.recommendedType}`,
                `${(site?.evRegistrations?.evCount ?? 0).toLocaleString()} EVs registered in state`,
              ].map((fact) => (
                <span key={fact} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: 'rgba(37,99,235,0.15)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.3)' }}>
                  ✓ {fact}
                </span>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
