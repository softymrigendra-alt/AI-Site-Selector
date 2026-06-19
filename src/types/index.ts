export type ChargerType = 'Level 2 AC' | 'DC Fast' | 'Ultra-Fast';

export type PropertyType =
  | 'hotel'
  | 'mall'
  | 'parking'
  | 'workplace'
  | 'hospital'
  | 'university'
  | 'residential';

export type RiskLevel = 'low' | 'medium' | 'high';
export type DemandLevel = 'low' | 'medium' | 'high';

export interface ChargerConfig {
  hardwareCost: number;
  installCost: number;
  revenuePerSession: number;
  sessionsPerDay: number;
  monthlyMaintenance: number;
}

export interface SiteFormInput {
  address: string;
  propertyType: PropertyType;
  parkingSpaces: number;
  dailyFootfall: number;
  targetChargers: number;
  chargerType: ChargerType;
}

export interface ROIResult {
  totalSetupCost: number;
  monthlyGrossRevenue: number;
  monthlyNetRevenue: number;
  breakEvenMonths: number;
  year1NetProfit: number;
  year3NetProfit: number;
  year5NetProfit: number;
}

export interface SiteResult {
  roi: ROIResult;
  siteScore: number;
  competitorRisk: RiskLevel;
  evDemandLevel: DemandLevel;
  aiInsight: string;
}

/** Shape returned by the Lead Qualification agent (V2 mock) */
export interface AgentLeadResult {
  siteScore: number;
  confidenceLevel: number;
  aiInsight: string;
}

export interface V2Forecast {
  roi: ROIResult;
  siteScore: number;
  confidenceLevel: number;
  evDemandLevel: DemandLevel;
  competitorRisk: RiskLevel;
  aiInsight: string;
  recommendation: {
    recommendedCount: number;
    recommendedType: ChargerType;
    reasoning: string;
  };
}

export type AgentStatus = 'idle' | 'running' | 'done' | 'error';

export interface Agent {
  id: string;
  name: string;
  icon: string;
  description: string;
  durationMs: number;
}

export interface Branding {
  companyName: string;
  tagline: string;
  colors: {
    primary: string;
    accent: string;
    light: string;
    success: string;
    warning: string;
    danger: string;
  };
}
