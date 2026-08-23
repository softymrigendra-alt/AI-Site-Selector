// In-memory + localStorage agent run log (no Supabase required)

export interface AgentLog {
  id: string;
  timestamp: number;
  agentId: string;
  status: 'done' | 'failed';
  durationMs: number;
  address: string;
  error?: string;
}

const KEY = 'ev-agent-logs';
const MAX_LOGS = 200;

function load(): AgentLog[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as AgentLog[];
  } catch {
    return [];
  }
}

function save(logs: AgentLog[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(logs.slice(-MAX_LOGS)));
  } catch { /* storage full — ignore */ }
}

export function logAgentRun(log: Omit<AgentLog, 'id'>): void {
  const logs = load();
  logs.push({ ...log, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
  save(logs);
}

export function getAgentLogs(sinceMs = 24 * 60 * 60 * 1000): AgentLog[] {
  const cutoff = Date.now() - sinceMs;
  return load().filter((l) => l.timestamp >= cutoff);
}

export function clearAgentLogs(): void {
  localStorage.removeItem(KEY);
}

export interface AgentStats {
  agentId: string;
  totalRuns: number;
  successRate: number;
  avgLatencyMs: number;
  lastRun: number | null;
  lastStatus: 'done' | 'failed' | null;
}

export function computeAgentStats(logs: AgentLog[]): AgentStats[] {
  const agentIds = ['site', 'utility', 'roi', 'market', 'lead'];
  return agentIds.map((agentId) => {
    const runs = logs.filter((l) => l.agentId === agentId);
    const successes = runs.filter((l) => l.status === 'done');
    const sorted = [...runs].sort((a, b) => b.timestamp - a.timestamp);
    return {
      agentId,
      totalRuns: runs.length,
      successRate: runs.length ? (successes.length / runs.length) * 100 : 100,
      avgLatencyMs: runs.length
        ? runs.reduce((s, r) => s + r.durationMs, 0) / runs.length
        : 0,
      lastRun: sorted[0]?.timestamp ?? null,
      lastStatus: sorted[0]?.status ?? null,
    };
  });
}
