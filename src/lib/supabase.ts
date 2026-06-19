import { createClient } from '@supabase/supabase-js';
import type { SiteFormInput, ROIResult, RiskLevel, DemandLevel } from '../types';

const supabaseUrl = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
const supabaseAnonKey = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined;

// Client is null when env vars are missing — all functions return graceful no-ops
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// ─── Types ────────────────────────────────────────────────────────────────────

export type SiteStatus = 'analysed' | 'approved' | 'pending';

export interface SiteAnalysis {
  id: string;
  created_at: string;
  user_id: string;
  site_name: string;
  address: string;
  property_type: string;
  charger_type: string;
  site_score: number;
  monthly_net_revenue: number;
  break_even_months: number;
  year3_profit: number;
  forecast_data: ROIResult;
  cost_inputs: SiteFormInput;
  status: SiteStatus;
}

export interface SaveSitePayload {
  siteName: string;
  siteInput: SiteFormInput;
  roiResult: ROIResult;
  siteScore: number;
  evDemandLevel: DemandLevel;
  competitorRisk: RiskLevel;
  aiInsight: string;
}

// ─── SQL schema (run once in Supabase SQL editor) ─────────────────────────────
//
// create table if not exists site_analyses (
//   id               uuid primary key default gen_random_uuid(),
//   created_at       timestamptz not null default now(),
//   user_id          text not null default 'anonymous',
//   site_name        text not null,
//   address          text,
//   property_type    text,
//   charger_type     text,
//   site_score       integer,
//   monthly_net_revenue numeric,
//   break_even_months   numeric,
//   year3_profit        numeric,
//   forecast_data    jsonb,
//   cost_inputs      jsonb,
//   status           text not null default 'analysed'
// );
// alter table site_analyses enable row level security;
// create policy "anon read-write" on site_analyses for all using (true) with check (true);

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function saveSiteAnalysis(payload: SaveSitePayload): Promise<SiteAnalysis | null> {
  if (!supabase) return null;

  const row = {
    user_id: 'anonymous',
    site_name: payload.siteName,
    address: payload.siteInput.address,
    property_type: payload.siteInput.propertyType,
    charger_type: payload.siteInput.chargerType,
    site_score: payload.siteScore,
    monthly_net_revenue: payload.roiResult.monthlyNetRevenue,
    break_even_months: payload.roiResult.breakEvenMonths,
    year3_profit: payload.roiResult.year3NetProfit,
    forecast_data: payload.roiResult,
    cost_inputs: payload.siteInput,
    status: 'analysed' as SiteStatus,
  };

  const { data, error } = await supabase
    .from('site_analyses')
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('saveSiteAnalysis error:', error.message);
    return null;
  }

  return data as SiteAnalysis;
}

export async function getSiteAnalyses(userId = 'anonymous'): Promise<SiteAnalysis[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('site_analyses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getSiteAnalyses error:', error.message);
    return [];
  }

  return (data ?? []) as SiteAnalysis[];
}

export async function getSiteAnalysisById(id: string): Promise<SiteAnalysis | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('site_analyses')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('getSiteAnalysisById error:', error.message);
    return null;
  }

  return data as SiteAnalysis;
}

export async function updateSiteAnalysis(
  id: string,
  updates: Partial<Pick<SiteAnalysis, 'site_name' | 'status' | 'site_score'>>,
): Promise<SiteAnalysis | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('site_analyses')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('updateSiteAnalysis error:', error.message);
    return null;
  }

  return data as SiteAnalysis;
}

export async function deleteSiteAnalysis(id: string): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase.from('site_analyses').delete().eq('id', id);

  if (error) {
    console.error('deleteSiteAnalysis error:', error.message);
    return false;
  }

  return true;
}
