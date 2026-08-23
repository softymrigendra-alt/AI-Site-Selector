/// <reference types="node" />
// Server-side proxy for the keyed third-party data APIs. Keeps NREL/AFDC, EIA,
// and OpenChargeMap keys off the client — the browser calls same-origin
// /api/data and never sees a key. Keys are read from non-public env vars, with
// a fallback to the legacy VITE_-prefixed names so existing Vercel config keeps
// working (removing the client references is what stops the leak, not the name).
import { guard, corsHeaders } from './_guard';

export const config = { runtime: 'edge' };

const UPSTREAM_TIMEOUT = 9000;

function key(...names: string[]): string | undefined {
  for (const n of names) {
    const v = (process.env[n] ?? '').trim();
    if (v) return v;
  }
  return undefined;
}

// ─── geocode (Nominatim, no key) ──────────────────────────────────────────────
async function geocode(address: string) {
  if (!address?.trim()) return null;
  const params = new URLSearchParams({ q: address, format: 'json', addressdetails: '1', limit: '1' });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': 'EVSiteSelector/1.0 (contact@evsite.app)' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{
    lat: string; lon: string; display_name: string;
    address?: { city?: string; town?: string; state?: string; postcode?: string };
  }>;
  const top = data[0];
  if (!top) return null;
  const a = top.address ?? {};
  return {
    lat: parseFloat(top.lat), lng: parseFloat(top.lon), formattedAddress: top.display_name,
    city: a.city ?? a.town ?? '', state: a.state ?? '', zipCode: a.postcode ?? '',
  };
}

// ─── competitors (NREL / AFDC) ────────────────────────────────────────────────
async function competitors(lat: number, lng: number, radiusKm = 5) {
  const apiKey = key('AFDC_API_KEY', 'VITE_AFDC_API_KEY') ?? 'DEMO_KEY';
  const params = new URLSearchParams({
    api_key: apiKey, fuel_type: 'ELEC', latitude: String(lat), longitude: String(lng),
    radius: String(radiusKm * 0.621371), limit: '10', status: 'E',
  });
  const res = await fetch(`https://developer.nrel.gov/api/alt-fuel-stations/v1/nearest.json?${params}`, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    alt_fuel_stations?: Array<{
      station_name: string; ev_network: string; distance: number;
      ev_level2_evse_num: number | null; ev_dc_fast_num: number | null;
      latitude: number; longitude: number;
    }>;
  };
  return (data.alt_fuel_stations ?? []).map((s) => ({
    name: s.station_name, network: s.ev_network ?? 'Unknown', distanceMiles: s.distance,
    chargerType: (s.ev_dc_fast_num ?? 0) > 0 ? 'DC Fast' : 'Level 2',
    portCount: (s.ev_level2_evse_num ?? 0) + (s.ev_dc_fast_num ?? 0),
    lat: s.latitude, lng: s.longitude,
  }));
}

// ─── electricity (EIA) ────────────────────────────────────────────────────────
const STATE_ABBREV: Record<string, string> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO',
  Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID',
  Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA',
  Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN',
  Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR',
  Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD',
  Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA',
  'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
};

async function electricity(stateName: string) {
  const apiKey = key('EIA_API_KEY', 'VITE_EIA_API_KEY');
  if (!apiKey) {
    return { ratePerKwh: 0.12, peakRatePerKwh: 0.18, utilityName: 'US Average (est.)', source: 'fallback', lastUpdated: '' };
  }
  const stateCode = STATE_ABBREV[stateName] ?? stateName.toUpperCase().slice(0, 2);
  const params = new URLSearchParams();
  params.set('api_key', apiKey);
  params.set('frequency', 'annual');
  params.append('data[0]', 'price');
  params.append('facets[stateid][]', stateCode);
  params.append('facets[sectorid][]', 'COM');
  params.append('sort[0][column]', 'period');
  params.append('sort[0][direction]', 'desc');
  params.set('length', '1');
  const res = await fetch(`https://api.eia.gov/v2/electricity/retail-sales/data/?${params}`, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { response?: { data?: Array<{ price: number | string; period: string }> } };
  const row = json.response?.data?.[0];
  if (row?.price == null) return null;
  const rate = Number(row.price) / 100;
  return {
    ratePerKwh: rate, peakRatePerKwh: +(rate * 1.5).toFixed(4),
    utilityName: `${stateCode} Commercial Average`, source: 'EIA Retail Sales', lastUpdated: row.period,
  };
}

// ─── chargers (OpenChargeMap) ─────────────────────────────────────────────────
async function chargers(lat: number, lng: number, radiusKm = 5) {
  const apiKey = key('OCM_API_KEY', 'VITE_OCM_API_KEY') ?? '';
  const params = new URLSearchParams({
    output: 'json', latitude: String(lat), longitude: String(lng), distance: String(radiusKm),
    distanceunit: 'KM', maxresults: '8', compact: 'true', verbose: 'false', ...(apiKey ? { key: apiKey } : {}),
  });
  const res = await fetch(`https://api.openchargemap.io/v3/poi/?${params}`, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{
    AddressInfo?: { Title?: string; Distance?: number; Latitude?: number; Longitude?: number };
    OperatorInfo?: { Title?: string };
    Connections?: Array<{ ConnectionType?: { Title?: string } }>;
  }>;
  return data.map((s) => ({
    name: s.AddressInfo?.Title ?? 'Unknown Station', operator: s.OperatorInfo?.Title ?? 'Unknown',
    distanceKm: s.AddressInfo?.Distance ?? 0,
    connectionTypes: (s.Connections ?? []).map((c) => c.ConnectionType?.Title ?? '').filter(Boolean),
    lat: s.AddressInfo?.Latitude ?? lat, lng: s.AddressInfo?.Longitude ?? lng,
  }));
}

interface DataRequest {
  action: 'geocode' | 'competitors' | 'electricity' | 'chargers';
  address?: string;
  stateName?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

export default async function handler(req: Request): Promise<Response> {
  // Data reads fire several times per analysis, so allow a higher rate than the
  // LLM routes. Auth is still enforced when SUPABASE_JWT_SECRET is set.
  const g = await guard(req, { maxBodyBytes: 8 * 1024, rateLimit: 80, windowMs: 60_000 });
  if (!g.ok) return g.response!;
  const headers = corsHeaders(req);
  const b = g.body as DataRequest;

  try {
    let result: unknown;
    switch (b?.action) {
      case 'geocode':
        result = await geocode(b.address ?? '');
        break;
      case 'competitors':
        result = await competitors(Number(b.lat), Number(b.lng), b.radiusKm);
        break;
      case 'electricity':
        result = await electricity(b.stateName ?? '');
        break;
      case 'chargers':
        result = await chargers(Number(b.lat), Number(b.lng), b.radiusKm);
        break;
      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers });
    }
    return new Response(JSON.stringify({ result }), { status: 200, headers });
  } catch {
    // Match the client's graceful-degradation contract: null / empty on failure.
    const empty = b?.action === 'competitors' || b?.action === 'chargers' ? [] : null;
    return new Response(JSON.stringify({ result: empty }), { status: 200, headers });
  }
}
