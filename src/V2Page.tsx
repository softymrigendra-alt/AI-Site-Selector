import { useState } from 'react';
import { calculateROI, formatCurrency, formatMonths } from './utils/roiCalculator';
import type { Agent, AgentStatus, V2Forecast, DemandLevel, RiskLevel } from './types';

const AGENTS: Agent[] = [
  {
    id: 'site',
    name: 'Site Intelligence',
    icon: '🗺️',
    description: 'Fetching competitors from AFDC + EV adoption from Data.gov',
    durationMs: 1400,
  },
  {
    id: 'utility',
    name: 'Utility Rate',
    icon: '⚡',
    description: 'Querying EIA for local electricity $/kWh',
    durationMs: 1200,
  },
  {
    id: 'roi',
    name: 'ROI Optimisation',
    icon: '📈',
    description: 'Calculating best charger type and count',
    durationMs: 900,
  },
  {
    id: 'market',
    name: 'Market Watch',
    icon: '🔭',
    description: 'Checking EV adoption trends + available grants',
    durationMs: 1100,
  },
  {
    id: 'lead',
    name: 'Lead Qualification',
    icon: '🤖',
    description: 'LLM scoring site + generating narrative insight',
    durationMs: 1800,
  },
];

const MOCK_RESULTS = {
  site: {
    nearbyChargers: 3,
    evAdoptionPct: 8.4,
    competitorDistance: '0.6 miles',
  },
  utility: {
    ratePerKwh: 0.14,
    utilityName: 'ComEd (simulated)',
    peakRate: 0.22,
  },
  roi: {
    recommendedType: 'DC Fast' as const,
    recommendedCount: 4,
    reasoning: 'High footfall + moderate competitor density favours DC Fast over Level 2.',
  },
  market: {
    evGrowthRate: '34% YoY',
    availableGrants: ['NEVI Formula Program', 'IRA Section 30C'],
    grantValue: '$40,000 potential',
  },
  lead: {
    siteScore: 74,
    confidenceLevel: 81,
    aiInsight:
      'This location demonstrates strong EV charging viability. Proximity to a shopping corridor with 34% annual EV growth and available NEVI grants significantly improves the investment case. Recommend proceeding with a 4-unit DC Fast deployment to capture commuter and shopper demand.',
  },
};

interface AgentRowProps {
  agent: Agent;
  status: AgentStatus;
  result: (typeof MOCK_RESULTS)[keyof typeof MOCK_RESULTS] | undefined;
}

function AgentRow({ agent, status, result }: AgentRowProps) {
  const statusStyles: Record<AgentStatus, { color: string; icon: string }> = {
    idle:    { color: '#9CA3AF', icon: '○' },
    running: { color: '#2563EB', icon: '◌' },
    done:    { color: '#16A34A', icon: '✓' },
    error:   { color: '#DC2626', icon: '✗' },
  };
  const s = statusStyles[status];

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-xl border transition-all"
      style={{
        backgroundColor: status === 'done' ? '#F0FDF4' : status === 'running' ? '#EFF6FF' : 'white',
        borderColor: status === 'done' ? '#86EFAC' : status === 'running' ? '#BFDBFE' : '#E5E7EB',
      }}
    >
      <div className="text-xl mt-0.5">{agent.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold" style={{ color: '#1A2332' }}>{agent.name}</span>
          <span className="text-xs font-mono font-bold" style={{ color: s.color }}>
            {s.icon} {status}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{agent.description}</p>

        {status === 'running' && (
          <div className="mt-2 h-1 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-1 rounded-full animate-pulse" style={{ width: '60%', backgroundColor: '#2563EB' }} />
          </div>
        )}

        {status === 'done' && result && (
          <div className="mt-2 text-xs text-gray-600 bg-white rounded-lg px-2 py-1 border border-gray-100">
            {agent.id === 'site' && (() => {
              const r = result as typeof MOCK_RESULTS.site;
              return `${r.nearbyChargers} nearby chargers · EV adoption ${r.evAdoptionPct}% · nearest competitor ${r.competitorDistance}`;
            })()}
            {agent.id === 'utility' && (() => {
              const r = result as typeof MOCK_RESULTS.utility;
              return `${r.utilityName} · $${r.ratePerKwh}/kWh avg · $${r.peakRate}/kWh peak`;
            })()}
            {agent.id === 'roi' && (() => {
              const r = result as typeof MOCK_RESULTS.roi;
              return `Recommended: ${r.recommendedCount}× ${r.recommendedType} · ${r.reasoning}`;
            })()}
            {agent.id === 'market' && (() => {
              const r = result as typeof MOCK_RESULTS.market;
              return `EV growth ${r.evGrowthRate} · Grants: ${r.availableGrants.join(', ')} (${r.grantValue})`;
            })()}
            {agent.id === 'lead' && (() => {
              const r = result as typeof MOCK_RESULTS.lead;
              return `Site score ${r.siteScore}/100 · Confidence ${r.confidenceLevel}%`;
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

type AgentStatusMap = Partial<Record<string, AgentStatus>>;
type AgentResultMap = Partial<Record<string, (typeof MOCK_RESULTS)[keyof typeof MOCK_RESULTS]>>;

export default function V2Page() {
  const [address, setAddress] = useState<string>('');
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [agentStatuses, setAgentStatuses] = useState<AgentStatusMap>({});
  const [agentResults, setAgentResults] = useState<AgentResultMap>({});
  const [forecast, setForecast] = useState<V2Forecast | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  async function runAgents() {
    if (!address.trim()) return;
    setPhase('running');
    setAgentStatuses({});
    setAgentResults({});
    setForecast(null);

    const start = Date.now();

    for (const agent of AGENTS) {
      setAgentStatuses((prev) => ({ ...prev, [agent.id]: 'running' }));
      await new Promise<void>((r) => setTimeout(r, agent.durationMs));
      setAgentStatuses((prev) => ({ ...prev, [agent.id]: 'done' }));
      setAgentResults((prev) => ({ ...prev, [agent.id]: MOCK_RESULTS[agent.id as keyof typeof MOCK_RESULTS] }));
    }

    setElapsedMs(Date.now() - start);

    const roi = calculateROI({
      chargerType: MOCK_RESULTS.roi.recommendedType,
      targetChargers: MOCK_RESULTS.roi.recommendedCount,
    });

    const competitorRisk: RiskLevel =
      MOCK_RESULTS.site.nearbyChargers > 5 ? 'high'
      : MOCK_RESULTS.site.nearbyChargers > 2 ? 'medium'
      : 'low';

    const evDemandLevel: DemandLevel =
      MOCK_RESULTS.site.evAdoptionPct > 10 ? 'high'
      : MOCK_RESULTS.site.evAdoptionPct > 5 ? 'medium'
      : 'low';

    setForecast({
      roi,
      siteScore: MOCK_RESULTS.lead.siteScore,
      confidenceLevel: MOCK_RESULTS.lead.confidenceLevel,
      aiInsight: MOCK_RESULTS.lead.aiInsight,
      competitorRisk,
      evDemandLevel,
      recommendation: MOCK_RESULTS.roi,
    });

    setPhase('done');
  }

  return (
    <div className="space-y-5">
      {/* Header banner */}
      <div className="rounded-2xl p-5 text-white" style={{ backgroundColor: '#1A2332' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">V2 Agentic Pipeline</h2>
            <p className="text-sm mt-1" style={{ color: '#93C5FD' }}>
              Enter an address — 5 AI agents automatically fetch competitor data, electricity rates, EV adoption stats, and generate an ROI forecast.
            </p>
          </div>
          <span className="flex-shrink-0 text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#2563EB' }}>
            Simulated · Phase 1
          </span>
        </div>

        <div className="mt-4 flex gap-3">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && phase !== 'running' && void runAgents()}
            placeholder="Enter site address (e.g. 400 N Michigan Ave, Chicago, IL)"
            className="flex-1 rounded-lg px-4 py-2.5 text-sm text-gray-900 border-0 focus:outline-none focus:ring-2 focus:ring-blue-400"
            disabled={phase === 'running'}
          />
          <button
            onClick={() => void runAgents()}
            disabled={phase === 'running' || !address.trim()}
            className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#2563EB' }}
          >
            {phase === 'running' ? 'Running…' : 'Analyse Site ⚡'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Agent pipeline */}
        <div className="lg:col-span-2 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Agent Pipeline</h3>
            {phase === 'done' && (
              <span className="text-xs font-medium" style={{ color: '#16A34A' }}>
                ✓ Complete in {(elapsedMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
          {AGENTS.map((agent) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              status={agentStatuses[agent.id] ?? 'idle'}
              result={agentResults[agent.id]}
            />
          ))}
        </div>

        {/* Results */}
        <div className="lg:col-span-3">
          {phase === 'idle' && (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 flex flex-col items-center justify-center text-gray-400 text-center h-full">
              <span className="text-5xl mb-3">🤖</span>
              <p className="font-medium">Enter an address to start the agent pipeline</p>
              <p className="text-sm mt-1">All 5 agents run automatically — takes ~8 seconds</p>
            </div>
          )}

          {phase === 'running' && !forecast && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col items-center justify-center text-center h-full">
              <div className="text-4xl mb-3 animate-bounce">⚡</div>
              <p className="font-semibold" style={{ color: '#2563EB' }}>Agents working…</p>
              <p className="text-sm text-gray-400 mt-1">Fetching live data from AFDC, EIA, and Data.gov</p>
            </div>
          )}

          {forecast && (
            <div className="space-y-4">
              <div className="rounded-xl p-4 text-white" style={{ backgroundColor: '#16A34A' }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1 opacity-80">Agent Recommendation</p>
                <p className="font-bold text-lg">
                  {forecast.recommendation.recommendedCount}× {forecast.recommendation.recommendedType} Chargers
                </p>
                <p className="text-sm mt-1 opacity-90">{forecast.recommendation.reasoning}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(
                  [
                    { label: 'Setup Cost',   value: formatCurrency(forecast.roi.totalSetupCost) },
                    { label: 'Monthly Net',  value: formatCurrency(forecast.roi.monthlyNetRevenue) },
                    { label: 'Break-Even',   value: formatMonths(forecast.roi.breakEvenMonths) },
                    { label: '3-Year Profit', value: formatCurrency(forecast.roi.year3NetProfit) },
                  ] as const
                ).map(({ label, value }) => (
                  <div key={label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-200 text-center">
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className="text-lg font-bold" style={{ color: '#1A2332' }}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <h4 className="text-sm font-semibold mb-3" style={{ color: '#1A2332' }}>AI Scores</h4>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-3xl font-bold" style={{ color: '#2563EB' }}>{forecast.siteScore}</p>
                    <p className="text-xs text-gray-500">Site Score</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold" style={{ color: '#16A34A' }}>{forecast.confidenceLevel}%</p>
                    <p className="text-xs text-gray-500">Confidence</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold capitalize" style={{ color: '#D97706' }}>{forecast.evDemandLevel}</p>
                    <p className="text-xs text-gray-500">EV Demand</p>
                  </div>
                </div>
                <div className="rounded-lg p-3 text-sm leading-relaxed" style={{ backgroundColor: '#EFF6FF', color: '#1A2332' }}>
                  <p className="text-xs font-medium mb-1" style={{ color: '#2563EB' }}>LLM Narrative (Phase 1: template → Phase 2: live Groq)</p>
                  {forecast.aiInsight}
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <h4 className="text-sm font-semibold mb-2" style={{ color: '#1A2332' }}>
                  Available Grants{' '}
                  <span className="text-xs font-normal text-gray-400">(Market Watch agent)</span>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {MOCK_RESULTS.market.availableGrants.map((g) => (
                    <span
                      key={g}
                      className="text-xs px-2 py-1 rounded-full border"
                      style={{ backgroundColor: '#F0FDF4', color: '#16A34A', borderColor: '#86EFAC' }}
                    >
                      {g}
                    </span>
                  ))}
                  <span
                    className="text-xs px-2 py-1 rounded-full border font-semibold"
                    style={{ backgroundColor: '#EFF6FF', color: '#2563EB', borderColor: '#BFDBFE' }}
                  >
                    {MOCK_RESULTS.market.grantValue}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
