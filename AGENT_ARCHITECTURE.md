# Agent Architecture — V2 Agentic Pipeline

The V2 tab runs a sequential 5-agent pipeline that fetches real-world data and produces a fully-qualified site recommendation without any manual input beyond an address.

---

## Pipeline Overview

```
Address input
     │
     ▼
┌─────────────────────────┐
│  Agent 1: Site Intel    │  Geocode → competitor stations → EV registrations
└────────────┬────────────┘
             │ GeoResult, CompetitorStation[], EVRegistrationData
             ▼
┌─────────────────────────┐
│  Agent 2: Utility Rate  │  EIA electricity rate for the state
└────────────┬────────────┘
             │ ElectricityRate, ratePerKwh
             ▼
┌─────────────────────────┐
│  Agent 3: ROI Optim.    │  Choose charger type + count → calculateROI()
└────────────┬────────────┘
             │ ChargerType, count, reasoning, ROIResult
             ▼
┌─────────────────────────┐
│  Agent 4: Market Watch  │  EV growth rate, grant programs, peak demand
└────────────┬────────────┘
             │ evGrowthRate, availableGrants[], grantValue, peakDemand
             ▼
┌─────────────────────────┐
│  Agent 5: Lead Qual.    │  POST /api/forecast (LLM) → site score + insight
└─────────────────────────┘
             │ siteScore, qualification, aiInsight, evDemandLevel, competitorRisk
             ▼
        PipelineOutput
```

---

## Agent Details

### Agent 1 — Site Intelligence (`site`)

**Source files:** `src/lib/externalAPIs.ts`, `src/lib/agentOrchestrator.ts`

**Data fetched:**
- `geocodeAddress(address)` → Nominatim (OSM) → lat/lng/state/zipCode
- `getCompetitorStations(lat, lng)` → AFDC/NREL API → charger count and types within 5 km
- `getEVRegistrations(state, zip)` → hardcoded DOE state dataset → EV count in region

**Output:** `SiteAgentResult` — `{ geo, competitors[], evRegistrations, nearbyCount }`

---

### Agent 2 — Utility Rate (`utility`)

**Source files:** `src/lib/externalAPIs.ts`

**Data fetched:**
- `getElectricityRate(stateName)` → EIA v2 API → ¢/kWh for the state
- Fallback: `$0.12/kWh` if EIA is unavailable

**Output:** `UtilityAgentResult` — `{ rate, ratePerKwh }`

---

### Agent 3 — ROI Optimisation (`roi`)

**Source files:** `src/lib/agentOrchestrator.ts`, `src/utils/roiCalculator.ts`

**Logic:**
- `chooseChargerType(competitors, evCount)` → deterministic rule set:
  - High EV density + no DC Fast nearby → Ultra-Fast (2 units)
  - EV count > 30k → DC Fast (2–6 units, scaled)
  - Otherwise → Level 2 AC (4 units)
- `calculateROI({ chargerType, targetChargers })` → setup cost, monthly net, break-even, year 1/3/5 projections

**Output:** `ROIAgentResult` — `{ recommendedType, recommendedCount, reasoning, roi }`

---

### Agent 4 — Market Watch (`market`)

**Source files:** `src/lib/agentOrchestrator.ts`, `src/lib/externalAPIs.ts`

**Data fetched:**
- `getGlobalChargers(lat, lng)` → OpenChargeMap API (optional enrichment)
- State-level EV growth rate classification (high-EV states: CA, WA, OR, CO, NY, MA, NJ)
- Hardcoded grant programs: NEVI Formula Program, IRA Section 30C

**Output:** `MarketAgentResult` — `{ evGrowthRate, availableGrants[], grantValue, peakDemand }`

---

### Agent 5 — Lead Qualification (`lead`)

**Source files:** `src/lib/agentOrchestrator.ts`, `api/forecast.ts`

**Logic:**
1. Calls `POST /api/forecast` with the full site context assembled by prior agents
2. LLM cascade: Groq → Anthropic → deterministic score formula
3. Deterministic fallback: score = 50 + EV density bonus + competitor adjustment + break-even adjustment

**Qualification tiers:**
- `strong` — score ≥ 75
- `moderate` — score 50–74
- `weak` — score < 50

**Output:** `LeadAgentResult` — `{ siteScore, confidenceLevel, evDemandLevel, competitorRisk, aiInsight, qualification }`

---

## Streaming Updates

Each agent fires an `onUpdate` callback on both status transitions (`waiting → running → done/failed`) and on completion with full data. The V2 page subscribes to these updates and renders agent rows progressively — Agent 2 starts displaying while Agent 1 is still running.

```ts
runAgentPipeline(address, (update: AgentUpdate) => {
  setStatuses(prev => ({ ...prev, [update.agentId]: update.status }));
  // ...
});
```

---

## Telemetry

Every agent run is logged to `localStorage` via `src/lib/agentLogger.ts`:

```ts
interface AgentLog {
  id: string;        // timestamp + random suffix
  timestamp: number;
  agentId: string;   // 'site' | 'utility' | 'roi' | 'market' | 'lead'
  status: 'done' | 'failed';
  durationMs: number;
  address: string;
  error?: string;
}
```

The **Monitor** tab reads these logs and computes per-agent success rate, average latency, and last-run time using `computeAgentStats()`.

---

## Graceful Degradation

Every agent catches its own errors and produces a safe default result — the pipeline always completes and always returns a `PipelineOutput`, even if all external APIs are unavailable. The UI shows `failed` status badges for degraded agents but still renders the full result panel.
