// Client-side data access. Keyed providers (NREL/AFDC, EIA, OpenChargeMap) are
// reached through the same-origin /api/data proxy so their API keys never ship
// to the browser. Each call returns null/[] on failure rather than throwing.

import { authHeader } from './auth';

// ─── Provenance flags ─────────────────────────────────────────────────────────
// The client no longer holds the keys, so it can't know from config whether a
// provider is "live". Provenance is derived from the proxy's response instead:
// e.g. an electricity rate with source 'EIA Retail Sales' means real EIA data.
// These constants remain for existing call sites; the response's `source` field
// is the real signal.
export const EIA_KEY_LIVE = true;
// OpenChargeMap works without any API key — competitor data is always live.
export const OCM_LIVE = true;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeoResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface CompetitorStation {
  name: string;
  network: string;
  distanceMiles: number;
  chargerType: string;
  portCount: number;
  lat: number;
  lng: number;
}

export interface ElectricityRate {
  ratePerKwh: number;
  peakRatePerKwh: number;
  utilityName: string;
  source: string;
  lastUpdated: string;
}

export interface EVRegistrationData {
  evCount: number;
  zipCode: string;
  source: string;
}

export interface OpenChargeStation {
  name: string;
  operator: string;
  distanceKm: number;
  connectionTypes: string[];
  lat: number;
  lng: number;
}

// ─── Proxy helper ─────────────────────────────────────────────────────────────

async function callProxy<T>(body: Record<string, unknown>, fallback: T): Promise<T> {
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(11000),
    });
    if (!res.ok) return fallback;
    const json = (await res.json()) as { result?: T };
    return (json.result ?? fallback) as T;
  } catch {
    return fallback;
  }
}

// ─── 1. Geocoding ─────────────────────────────────────────────────────────────

export async function geocodeAddress(address: string): Promise<GeoResult | null> {
  if (!address.trim()) return null;
  return callProxy<GeoResult | null>({ action: 'geocode', address }, null);
}

// ─── 2. Competitor Stations (AFDC / NREL) ─────────────────────────────────────

export async function getCompetitorStations(
  lat: number,
  lng: number,
  radiusKm = 5,
): Promise<CompetitorStation[]> {
  return callProxy<CompetitorStation[]>({ action: 'competitors', lat, lng, radiusKm }, []);
}

// ─── 3. Electricity Rate (EIA) ────────────────────────────────────────────────

export async function getElectricityRate(stateName: string): Promise<ElectricityRate | null> {
  return callProxy<ElectricityRate | null>({ action: 'electricity', stateName }, null);
}

// ─── 4. EV Registrations (cached state-level data) ────────────────────────────
// Static curated dataset from latest DOE data — no key, stays client-side.

const EV_REGISTRATIONS_BY_STATE: Record<string, number> = {
  CA: 1200000, TX: 220000, FL: 180000, NY: 175000, WA: 160000,
  IL: 85000,  CO: 120000, NJ: 140000, GA: 95000,  AZ: 110000,
  OR: 90000,  MA: 105000, VA: 80000,  NC: 70000,  MI: 55000,
  MN: 45000,  OH: 50000,  PA: 70000,  MD: 75000,  NV: 65000,
};

export async function getEVRegistrations(
  stateCode: string,
  _zipCode?: string,
): Promise<EVRegistrationData> {
  await new Promise<void>((r) => setTimeout(r, 200));
  const code = stateCode.toUpperCase().slice(0, 2);
  const evCount = EV_REGISTRATIONS_BY_STATE[code] ?? 30000;
  return {
    evCount,
    zipCode: _zipCode ?? '',
    source: 'DOE Alt Fuels Data (state-level estimate)',
  };
}

// ─── 5. Global Chargers (OpenChargeMap) ───────────────────────────────────────

export async function getGlobalChargers(
  lat: number,
  lng: number,
  radiusKm = 5,
): Promise<OpenChargeStation[]> {
  return callProxy<OpenChargeStation[]>({ action: 'chargers', lat, lng, radiusKm }, []);
}
