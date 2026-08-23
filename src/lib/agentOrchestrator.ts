import {
  geocodeAddress,
  getElectricityRate,
  getEVRegistrations,
  getGlobalChargers,
} from './externalAPIs';
import { logAgentRun } from './agentLogger';
import { authHeader } from './auth';
import { calculateROI } from '../utils/roiCalculator';
import type { GeoResult, CompetitorStation, ElectricityRate, EVRegistrationData, OpenChargeStation } from './externalAPIs';
import type { ROIResult, ChargerType, DemandLevel, RiskLevel } from '../types';

function ocmToCompetitor(s: OpenChargeStation): CompetitorStation {
  const isDCFast = s.connectionTypes.some((t) => /chademo|ccs|dc.fast|level.3/i.test(t));
  return {
    name: s.name,
    network: s.operator,
    distanceMiles: +(s.distanceKm * 0.621371).toFixed(2),
    chargerType: isDCFast ? 'DC Fast' : 'Level 2',
    portCount: s.connectionTypes.length || 1,
    lat: s.lat,
    lng: s.lng,
  };
}

// ─── Public types ─────────────────────────────────────────────────────────────

export type AgentId = 'site' | 'utility' | 'roi' | 'market' | 'lead';
export type AgentStatus = 'waiting' | 'running' | 'done' | 'failed';

export interface AgentUpdate {
  agentId: AgentId;
  status: AgentStatus;
  data?: AgentResult;
  error?: string;
  durationMs?: number;
}

export interface SiteAgentResult {
  geo: GeoResult | null;
  competitors: CompetitorStation[];
  evRegistrations: EVRegistrationData | null;
  nearbyCount: number;
}

export interface UtilityAgentResult {
  rate: ElectricityRate | null;
  ratePerKwh: number;
}

export interface ROIAgentResult {
  recommendedType: ChargerType;
  recommendedCount: number;
  reasoning: string;
  roi: ROIResult;
}

export interface MarketAgentResult {
  evGrowthRate: string;
  availableGrants: string[];
  grantValue: string;
  peakDemand: string;
}

export interface LeadAgentResult {
  siteScore: number;
  confidenceLevel: number;
  evDemandLevel: DemandLevel;
  competitorRisk: RiskLevel;
  aiInsight: string;
  qualification: 'strong' | 'moderate' | 'weak';
}

export type AgentResult =
  | SiteAgentResult
  | UtilityAgentResult
  | ROIAgentResult
  | MarketAgentResult
  | LeadAgentResult;

export interface PipelineOutput {
  site: SiteAgentResult;
  utility: UtilityAgentResult;
  roi: ROIAgentResult;
  market: MarketAgentResult;
  lead: LeadAgentResult;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeCompetitorRisk(count: number): RiskLevel {
  if (count >= 6) return 'high';
  if (count >= 3) return 'medium';
  return 'low';
}

function computeDemandLevel(evCount: number, footfall: number): DemandLevel {
  const score = (evCount / 10000) + (footfall / 500);
  if (score >= 8) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

function chooseChargerType(
  competitors: CompetitorStation[],
  evCount: number,
): { type: ChargerType; count: number; reasoning: string } {
  const hasDCFast = competitors.some((c) => c.chargerType === 'DC Fast');
  const highEV = evCount > 80000;

  if (highEV && !hasDCFast) {
    return {
      type: 'Ultra-Fast',
      count: 2,
      reasoning: 'High EV density with no nearby fast-charging options — Ultra-Fast maximises revenue per stall.',
    };
  }
  if (evCount > 30000) {
    return {
      type: 'DC Fast',
      count: Math.min(6, Math.max(2, Math.floor(evCount / 20000))),
      reasoning: 'Strong EV adoption in area favours DC Fast for dwell-time match.',
    };
  }
  return {
    type: 'Level 2 AC',
    count: 4,
    reasoning: 'Moderate EV density suits Level 2 AC — lower capex, good utilisation at this traffic level.',
  };
}

async function callLeadQualificationLLM(
  address: string,
  site: SiteAgentResult,
  _utility: UtilityAgentResult,
  roi: ROIAgentResult,
  market: MarketAgentResult,
): Promise<LeadAgentResult> {
  const competitorRisk = computeCompetitorRisk(site.nearbyCount);
  const evDemand = computeDemandLevel(
    site.evRegistrations?.evCount ?? 30000,
    500,
  );

  try {
    const res = await fetch('/api/forecast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({
        siteInput: {
          address,
          propertyType: 'parking',
          parkingSpaces: 50,
          dailyFootfall: 500,
          targetChargers: roi.recommendedCount,
          chargerType: roi.recommendedType,
        },
        roiCalculation: roi.roi,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json() as {
        siteScore?: number;
        confidenceLevel?: number;
        evDemandLevel?: DemandLevel;
        competitorRisk?: RiskLevel;
        aiInsight?: string;
      };
      const score = data.siteScore ?? 70;
      return {
        siteScore: score,
        confidenceLevel: data.confidenceLevel ?? 75,
        evDemandLevel: data.evDemandLevel ?? evDemand,
        competitorRisk: data.competitorRisk ?? competitorRisk,
        aiInsight: data.aiInsight ?? buildFallbackInsight(address, roi, market),
        qualification: score >= 75 ? 'strong' : score >= 50 ? 'moderate' : 'weak',
      };
    }
  } catch {
    // fall through to deterministic result
  }

  const score = Math.min(
    100,
    50 +
      (site.evRegistrations?.evCount ?? 0) / 10000 +
      (site.nearbyCount < 3 ? 10 : site.nearbyCount > 6 ? -10 : 0) +
      (roi.roi.breakEvenMonths < 36 ? 15 : roi.roi.breakEvenMonths > 60 ? -10 : 5),
  );

  return {
    siteScore: Math.round(score),
    confidenceLevel: 65,
    evDemandLevel: evDemand,
    competitorRisk,
    aiInsight: buildFallbackInsight(address, roi, market),
    qualification: score >= 75 ? 'strong' : score >= 50 ? 'moderate' : 'weak',
  };
}

function buildFallbackInsight(
  address: string,
  roi: ROIAgentResult,
  market: MarketAgentResult,
): string {
  return `Analysis for ${address || 'this location'} recommends ${roi.recommendedCount}× ${roi.recommendedType} chargers. With ${market.evGrowthRate} EV growth and ${market.availableGrants.length} grant programme(s) available, break-even is projected at ${Math.round(roi.roi.breakEvenMonths)} months. ${market.grantValue} in grants could significantly improve returns.`;
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export async function runAgentPipeline(
  address: string,
  onUpdate: (update: AgentUpdate) => void,
): Promise<PipelineOutput> {
  const tick = (agentId: AgentId, status: AgentStatus, data?: AgentResult, error?: string, durationMs?: number) =>
    onUpdate({ agentId, status, data, error, durationMs });

  // ── Agent 1: Site Intelligence ────────────────────────────────────────────
  tick('site', 'running');
  const t1 = Date.now();
  let siteResult: SiteAgentResult;
  try {
    const geo = await geocodeAddress(address);
    const [ocmStations, evReg] = await Promise.all([
      geo ? getGlobalChargers(geo.lat, geo.lng) : Promise.resolve([]),
      geo ? getEVRegistrations(geo.state, geo.zipCode) : Promise.resolve(null),
    ]);
    const competitors = ocmStations.map(ocmToCompetitor);
    siteResult = { geo, competitors, evRegistrations: evReg, nearbyCount: competitors.length };
    const d1 = Date.now() - t1;
    tick('site', 'done', siteResult, undefined, d1);
    logAgentRun({ timestamp: Date.now(), agentId: 'site', status: 'done', durationMs: d1, address });
  } catch (e) {
    const d1 = Date.now() - t1;
    siteResult = { geo: null, competitors: [], evRegistrations: null, nearbyCount: 0 };
    tick('site', 'failed', undefined, String(e), d1);
    logAgentRun({ timestamp: Date.now(), agentId: 'site', status: 'failed', durationMs: d1, address, error: String(e) });
  }

  // ── Agent 2: Utility Rate ─────────────────────────────────────────────────
  tick('utility', 'running');
  const t2 = Date.now();
  let utilityResult: UtilityAgentResult;
  try {
    const stateName = siteResult.geo?.state ?? '';
    const rate = await getElectricityRate(stateName);
    utilityResult = { rate, ratePerKwh: rate?.ratePerKwh ?? 0.12 };
    const d2 = Date.now() - t2;
    tick('utility', 'done', utilityResult, undefined, d2);
    logAgentRun({ timestamp: Date.now(), agentId: 'utility', status: 'done', durationMs: d2, address });
  } catch (e) {
    const d2 = Date.now() - t2;
    utilityResult = { rate: null, ratePerKwh: 0.12 };
    tick('utility', 'failed', undefined, String(e), d2);
    logAgentRun({ timestamp: Date.now(), agentId: 'utility', status: 'failed', durationMs: d2, address, error: String(e) });
  }

  // ── Agent 3: ROI Optimisation ─────────────────────────────────────────────
  tick('roi', 'running');
  const t3 = Date.now();
  let roiResult: ROIAgentResult;
  try {
    const evCount = siteResult.evRegistrations?.evCount ?? 30000;
    const chosen = chooseChargerType(siteResult.competitors, evCount);
    const roi = calculateROI({ chargerType: chosen.type, targetChargers: chosen.count });
    roiResult = { recommendedType: chosen.type, recommendedCount: chosen.count, reasoning: chosen.reasoning, roi };
    const d3 = Date.now() - t3;
    tick('roi', 'done', roiResult, undefined, d3);
    logAgentRun({ timestamp: Date.now(), agentId: 'roi', status: 'done', durationMs: d3, address });
  } catch (e) {
    const d3 = Date.now() - t3;
    const roi = calculateROI({ chargerType: 'DC Fast', targetChargers: 4 });
    roiResult = { recommendedType: 'DC Fast', recommendedCount: 4, reasoning: 'Default recommendation.', roi };
    tick('roi', 'failed', undefined, String(e), d3);
    logAgentRun({ timestamp: Date.now(), agentId: 'roi', status: 'failed', durationMs: d3, address, error: String(e) });
  }

  // ── Agent 4: Market Watch ─────────────────────────────────────────────────
  tick('market', 'running');
  const t4 = Date.now();
  let marketResult: MarketAgentResult;
  try {
    if (siteResult.geo) await getGlobalChargers(siteResult.geo.lat, siteResult.geo.lng);
    const stateCode = siteResult.geo?.state?.toUpperCase().slice(0, 2) ?? 'US';
    const highEVStates = ['CA', 'WA', 'OR', 'CO', 'NY', 'MA', 'NJ'];
    marketResult = {
      evGrowthRate: highEVStates.includes(stateCode) ? '38% YoY' : '24% YoY',
      availableGrants: ['NEVI Formula Program', 'IRA Section 30C Tax Credit'],
      grantValue: '$30,000–$100,000 potential',
      peakDemand: 'Weekday evenings (5–9 PM) & weekend afternoons',
    };
    const d4 = Date.now() - t4;
    tick('market', 'done', marketResult, undefined, d4);
    logAgentRun({ timestamp: Date.now(), agentId: 'market', status: 'done', durationMs: d4, address });
  } catch (e) {
    const d4 = Date.now() - t4;
    marketResult = {
      evGrowthRate: '24% YoY',
      availableGrants: ['NEVI Formula Program'],
      grantValue: '$30,000 potential',
      peakDemand: 'Weekday evenings',
    };
    tick('market', 'failed', undefined, String(e), d4);
    logAgentRun({ timestamp: Date.now(), agentId: 'market', status: 'failed', durationMs: d4, address, error: String(e) });
  }

  // ── Agent 5: Lead Qualification (LLM) ────────────────────────────────────
  tick('lead', 'running');
  const t5 = Date.now();
  let leadResult: LeadAgentResult;
  try {
    leadResult = await callLeadQualificationLLM(address, siteResult, utilityResult, roiResult, marketResult);
    const d5 = Date.now() - t5;
    tick('lead', 'done', leadResult, undefined, d5);
    logAgentRun({ timestamp: Date.now(), agentId: 'lead', status: 'done', durationMs: d5, address });
  } catch (e) {
    const d5 = Date.now() - t5;
    leadResult = {
      siteScore: 65, confidenceLevel: 60, evDemandLevel: 'medium', competitorRisk: 'medium',
      aiInsight: buildFallbackInsight(address, roiResult, marketResult), qualification: 'moderate',
    };
    tick('lead', 'failed', undefined, String(e), d5);
    logAgentRun({ timestamp: Date.now(), agentId: 'lead', status: 'failed', durationMs: d5, address, error: String(e) });
  }

  return { site: siteResult, utility: utilityResult, roi: roiResult, market: marketResult, lead: leadResult };
}
