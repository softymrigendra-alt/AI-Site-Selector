// All external API calls — each returns null on failure rather than throwing.
// Timeouts are 5 s unless noted.

const TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms),
    ),
  ]);
}

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

// ─── 1. Geocoding (Nominatim / OpenStreetMap) ─────────────────────────────────

export async function geocodeAddress(address: string): Promise<GeoResult | null> {
  if (!address.trim()) return null;
  try {
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      addressdetails: '1',
      limit: '1',
    });
    const res = await withTimeout(
      fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: { 'User-Agent': 'EVSiteSelector/1.0 (contact@evsite.app)' },
      }),
    );
    if (!res.ok) return null;
    const data = await res.json() as Array<{
      lat: string; lon: string; display_name: string;
      address?: { city?: string; town?: string; state?: string; postcode?: string };
    }>;
    const top = data[0];
    if (!top) return null;
    const addr = top.address ?? {};
    return {
      lat: parseFloat(top.lat),
      lng: parseFloat(top.lon),
      formattedAddress: top.display_name,
      city: addr.city ?? addr.town ?? '',
      state: addr.state ?? '',
      zipCode: addr.postcode ?? '',
    };
  } catch {
    return null;
  }
}

// ─── 2. Competitor Stations (AFDC / NREL) ────────────────────────────────────

export async function getCompetitorStations(
  lat: number,
  lng: number,
  radiusKm = 5,
): Promise<CompetitorStation[]> {
  const apiKey = import.meta.env['VITE_AFDC_API_KEY'] as string | undefined ?? 'DEMO_KEY';
  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      fuel_type: 'ELEC',
      latitude: String(lat),
      longitude: String(lng),
      radius: String(radiusKm * 0.621371), // km → miles
      limit: '10',
      status: 'E',
    });
    const res = await withTimeout(
      fetch(`https://developer.nrel.gov/api/alt-fuel-stations/v1/nearest.json?${params.toString()}`),
    );
    if (!res.ok) return [];
    const data = await res.json() as {
      alt_fuel_stations?: Array<{
        station_name: string; ev_network: string;
        distance: number; ev_connector_types: string[];
        ev_level2_evse_num: number | null; ev_dc_fast_num: number | null;
        latitude: number; longitude: number;
      }>;
    };
    return (data.alt_fuel_stations ?? []).map((s) => ({
      name: s.station_name,
      network: s.ev_network ?? 'Unknown',
      distanceMiles: s.distance,
      chargerType: (s.ev_dc_fast_num ?? 0) > 0 ? 'DC Fast' : 'Level 2',
      portCount: (s.ev_level2_evse_num ?? 0) + (s.ev_dc_fast_num ?? 0),
      lat: s.latitude,
      lng: s.longitude,
    }));
  } catch {
    return [];
  }
}

// ─── 3. Electricity Rate (EIA) ────────────────────────────────────────────────

// State abbreviation → EIA state code mapping (commercial retail sales)
const STATE_ABBREV: Record<string, string> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA',
  Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD',
  Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS',
  Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH',
  'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC',
  'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA',
  'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN',
  Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA',
  'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
};

export async function getElectricityRate(stateName: string): Promise<ElectricityRate | null> {
  const apiKey = import.meta.env['VITE_EIA_API_KEY'] as string | undefined;
  if (!apiKey) {
    // Return US average if no key
    return { ratePerKwh: 0.12, peakRatePerKwh: 0.18, utilityName: 'US Average (est.)', source: 'fallback', lastUpdated: '' };
  }
  const stateCode = STATE_ABBREV[stateName] ?? stateName.toUpperCase().slice(0, 2);
  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      frequency: 'annual',
      data: 'price',
      facets: `[{"stateid":"${stateCode}"},{"sectorid":"COM"}]`,
      sort: '[{"column":"period","direction":"desc"}]',
      length: '1',
    });
    const res = await withTimeout(
      fetch(`https://api.eia.gov/v2/electricity/retail-sales/data/?${params.toString()}`),
    );
    if (!res.ok) return null;
    const json = await res.json() as {
      response?: { data?: Array<{ price: number; period: string }> };
    };
    const row = json.response?.data?.[0];
    if (!row) return null;
    const rate = row.price / 100; // EIA returns cents/kWh
    return {
      ratePerKwh: rate,
      peakRatePerKwh: +(rate * 1.5).toFixed(4),
      utilityName: `${stateCode} Commercial Average`,
      source: 'EIA Retail Sales',
      lastUpdated: row.period,
    };
  } catch {
    return null;
  }
}

// ─── 4. EV Registrations (cached state-level data) ────────────────────────────
// Using a curated static dataset — Data.gov ZIP-level data is not reliably
// queryable client-side. Provides per-state estimates from latest DOE data.

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
  // Simulated async (would hit Data.gov in production)
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
  const apiKey = import.meta.env['VITE_OCM_API_KEY'] as string | undefined ?? '';
  try {
    const params = new URLSearchParams({
      output: 'json',
      latitude: String(lat),
      longitude: String(lng),
      distance: String(radiusKm),
      distanceunit: 'KM',
      maxresults: '8',
      compact: 'true',
      verbose: 'false',
      ...(apiKey ? { key: apiKey } : {}),
    });
    const res = await withTimeout(
      fetch(`https://api.openchargemap.io/v3/poi/?${params.toString()}`),
    );
    if (!res.ok) return [];
    const data = await res.json() as Array<{
      AddressInfo?: { Title?: string; Distance?: number; Latitude?: number; Longitude?: number };
      OperatorInfo?: { Title?: string };
      Connections?: Array<{ ConnectionType?: { Title?: string } }>;
    }>;
    return data.map((s) => ({
      name: s.AddressInfo?.Title ?? 'Unknown Station',
      operator: s.OperatorInfo?.Title ?? 'Unknown',
      distanceKm: s.AddressInfo?.Distance ?? 0,
      connectionTypes: (s.Connections ?? [])
        .map((c) => c.ConnectionType?.Title ?? '')
        .filter(Boolean),
      lat: s.AddressInfo?.Latitude ?? lat,
      lng: s.AddressInfo?.Longitude ?? lng,
    }));
  } catch {
    return [];
  }
}
