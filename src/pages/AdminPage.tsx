import { useEffect, useState } from 'react';
import { getAgentLogs, computeAgentStats, clearAgentLogs } from '../lib/agentLogger';
import type { AgentLog, AgentStats } from '../lib/agentLogger';

const AGENT_LABELS: Record<string, string> = {
  site:    '🗺️ Site Intelligence',
  utility: '⚡ Utility Rate',
  roi:     '📈 ROI Optimisation',
  market:  '🔭 Market Watch',
  lead:    '🤖 Lead Qualification',
};

function SuccessBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? '#16A34A' : pct >= 70 ? '#D97706' : '#DC2626';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold w-10 text-right" style={{ color }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: '#1A2332' }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function timeAgo(ts: number | null): string {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  return `${Math.round(diff / 3600000)}h ago`;
}

export default function AdminPage() {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [stats, setStats] = useState<AgentStats[]>([]);
  const [window24, setWindow24] = useState<'1h' | '6h' | '24h'>('24h');

  function refresh() {
    const windowMs = window24 === '1h' ? 3600000 : window24 === '6h' ? 21600000 : 86400000;
    const l = getAgentLogs(windowMs);
    setLogs(l);
    setStats(computeAgentStats(l));
  }

  useEffect(() => { refresh(); }, [window24]);

  const totalRuns = logs.length;
  const uniqueAddresses = new Set(logs.map((l) => l.address)).size;
  const overallSuccess = totalRuns
    ? ((logs.filter((l) => l.status === 'done').length / totalRuns) * 100).toFixed(0)
    : '—';
  const avgLatency = stats.length
    ? (stats.reduce((s, a) => s + a.avgLatencyMs, 0) / stats.filter((a) => a.totalRuns > 0).length || 0)
    : 0;

  function handleClear() {
    if (window.confirm('Clear all agent logs from localStorage?')) {
      clearAgentLogs();
      refresh();
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: '#1A2332' }}>Agent Monitor</h2>
          <p className="text-sm text-gray-500 mt-0.5">Pipeline health · latency · error rates</p>
        </div>
        <div className="flex items-center gap-2">
          {(['1h', '6h', '24h'] as const).map((w) => (
            <button
              key={w}
              onClick={() => setWindow24(w)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
              style={
                window24 === w
                  ? { backgroundColor: '#1A2332', color: 'white', borderColor: '#1A2332' }
                  : { backgroundColor: 'white', color: '#6B7280', borderColor: '#E5E7EB' }
              }
            >
              Last {w}
            </button>
          ))}
          <button
            onClick={refresh}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
            style={{ backgroundColor: '#EFF6FF', color: '#2563EB', borderColor: '#BFDBFE' }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Agent Runs" value={String(totalRuns)} sub={`in last ${window24}`} />
        <StatCard label="Sites Analysed" value={String(uniqueAddresses)} />
        <StatCard label="Overall Success" value={`${overallSuccess}%`} />
        <StatCard label="Avg Latency" value={avgLatency > 0 ? `${(avgLatency / 1000).toFixed(1)}s` : '—'} sub="per agent" />
      </div>

      {/* Per-agent breakdown */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold" style={{ color: '#1A2332' }}>Agent Health</h3>
        </div>
        {totalRuns === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            <p className="text-2xl mb-2">📭</p>
            <p>No agent runs recorded in this window.</p>
            <p className="text-xs mt-1">Run a V2 analysis to generate telemetry.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {stats.map((s) => (
              <div key={s.agentId} className="px-5 py-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#1A2332' }}>
                    {AGENT_LABELS[s.agentId] ?? s.agentId}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Last run: {timeAgo(s.lastRun)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Success rate</p>
                  <SuccessBar pct={s.successRate} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Avg latency</p>
                  <p className="text-sm font-semibold" style={{ color: '#1A2332' }}>
                    {s.avgLatencyMs > 0 ? `${(s.avgLatencyMs / 1000).toFixed(2)}s` : '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={
                      s.lastStatus === 'done'
                        ? { backgroundColor: '#F0FDF4', color: '#16A34A' }
                        : s.lastStatus === 'failed'
                        ? { backgroundColor: '#FEF2F2', color: '#DC2626' }
                        : { backgroundColor: '#F8FAFC', color: '#9CA3AF' }
                    }
                  >
                    {s.lastStatus ?? 'no data'}
                  </span>
                  <span className="text-xs text-gray-400">{s.totalRuns} run{s.totalRuns !== 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent log */}
      {logs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-sm font-semibold" style={{ color: '#1A2332' }}>Recent Runs</h3>
            <button onClick={handleClear} className="text-xs text-red-400 hover:text-red-600">
              Clear logs
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-left">
                  <th className="px-5 py-2 font-medium">Agent</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Latency</th>
                  <th className="px-3 py-2 font-medium">Address</th>
                  <th className="px-3 py-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...logs].reverse().slice(0, 30).map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-5 py-2 font-medium text-gray-700">{AGENT_LABELS[l.agentId] ?? l.agentId}</td>
                    <td className="px-3 py-2">
                      <span
                        className="px-1.5 py-0.5 rounded font-semibold"
                        style={
                          l.status === 'done'
                            ? { color: '#16A34A', backgroundColor: '#F0FDF4' }
                            : { color: '#DC2626', backgroundColor: '#FEF2F2' }
                        }
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{(l.durationMs / 1000).toFixed(2)}s</td>
                    <td className="px-3 py-2 text-gray-400 max-w-[180px] truncate">{l.address || '—'}</td>
                    <td className="px-3 py-2 text-gray-400">{timeAgo(l.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-center text-gray-400">
        Logs stored in browser localStorage · cleared on "Clear logs" or manually via DevTools
      </p>
    </div>
  );
}
