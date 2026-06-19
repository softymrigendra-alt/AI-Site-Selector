export const config = { runtime: 'edge' };

interface ForecastRequest {
  siteInput: {
    address: string;
    propertyType: string;
    parkingSpaces: number;
    dailyFootfall: number;
    targetChargers: number;
    chargerType: string;
  };
  roiCalculation: {
    totalSetupCost: number;
    monthlyGrossRevenue: number;
    monthlyNetRevenue: number;
    breakEvenMonths: number;
    year1NetProfit: number;
    year3NetProfit: number;
    year5NetProfit: number;
  };
}

interface ForecastResponse {
  siteScore: number;
  evDemandLevel: 'low' | 'medium' | 'high';
  competitorRisk: 'low' | 'medium' | 'high';
  confidenceLevel: number;
  aiInsight: string;
}

const FALLBACK: ForecastResponse = {
  siteScore: 65,
  evDemandLevel: 'medium',
  competitorRisk: 'medium',
  confidenceLevel: 60,
  aiInsight:
    'AI insight unavailable — using deterministic fallback. The ROI figures above are accurate and calculated from your inputs.',
};

function buildPrompt(req: ForecastRequest): string {
  const { siteInput: s, roiCalculation: r } = req;
  const breakEven = isFinite(r.breakEvenMonths)
    ? `${r.breakEvenMonths.toFixed(1)} months`
    : 'never (negative cash flow)';

  return `You are an expert EV charging infrastructure analyst. Evaluate this site for EV charging viability and return a JSON object only — no markdown, no explanation, just raw JSON.

SITE DATA:
- Address: ${s.address || 'not provided'}
- Property type: ${s.propertyType}
- Parking spaces: ${s.parkingSpaces}
- Daily footfall: ${s.dailyFootfall.toLocaleString()} people/day
- Charger type: ${s.chargerType}
- Number of chargers: ${s.targetChargers}

ROI CALCULATION (deterministic, do not recalculate):
- Total setup cost: $${r.totalSetupCost.toLocaleString()}
- Monthly gross revenue: $${r.monthlyGrossRevenue.toLocaleString()}
- Monthly net revenue: $${r.monthlyNetRevenue.toLocaleString()}
- Break-even: ${breakEven}
- Year 1 net profit: $${r.year1NetProfit.toLocaleString()}
- Year 3 net profit: $${r.year3NetProfit.toLocaleString()}
- Year 5 net profit: $${r.year5NetProfit.toLocaleString()}

Return ONLY this JSON (no markdown fences):
{
  "siteScore": <integer 0-100 based on footfall, property type, break-even speed, parking ratio>,
  "evDemandLevel": <"low"|"medium"|"high" based on footfall and property type>,
  "competitorRisk": <"low"|"medium"|"high" — infer from property type and location if address provided>,
  "confidenceLevel": <integer 0-100 — how confident you are in this assessment>,
  "aiInsight": <2-3 sentence insight referencing the actual numbers above. Be specific and actionable.>
}`;
}

async function callGroq(prompt: string, apiKey: string): Promise<ForecastResponse> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 400,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`Groq error ${res.status}`);

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  const raw = data.choices[0]?.message?.content ?? '';
  return parseAndValidate(raw);
}

async function callAnthropic(prompt: string, apiKey: string): Promise<ForecastResponse> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>;
  };
  const raw = data.content.find((b) => b.type === 'text')?.text ?? '';
  return parseAndValidate(raw);
}

function parseAndValidate(raw: string): ForecastResponse {
  // Strip markdown fences if present
  const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned) as Partial<ForecastResponse>;

  const validLevels = ['low', 'medium', 'high'] as const;

  return {
    siteScore: clamp(Number(parsed.siteScore ?? 65), 0, 100),
    evDemandLevel: validLevels.includes(parsed.evDemandLevel as typeof validLevels[number])
      ? (parsed.evDemandLevel as ForecastResponse['evDemandLevel'])
      : 'medium',
    competitorRisk: validLevels.includes(parsed.competitorRisk as typeof validLevels[number])
      ? (parsed.competitorRisk as ForecastResponse['competitorRisk'])
      : 'medium',
    confidenceLevel: clamp(Number(parsed.confidenceLevel ?? 70), 0, 100),
    aiInsight: typeof parsed.aiInsight === 'string' && parsed.aiInsight.length > 10
      ? parsed.aiInsight
      : FALLBACK.aiInsight,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, isNaN(n) ? min : n));
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  let body: ForecastRequest;
  try {
    body = await request.json() as ForecastRequest;
  } catch {
    return new Response(JSON.stringify(FALLBACK), { status: 200, headers: corsHeaders });
  }

  const groqKey = process.env['GROQ_API_KEY'];
  const anthropicKey = process.env['ANTHROPIC_API_KEY'];
  const prompt = buildPrompt(body);

  // Try Groq first, Anthropic second, fallback third
  if (groqKey) {
    try {
      const result = await callGroq(prompt, groqKey);
      return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders });
    } catch (err) {
      console.error('Groq failed:', err);
    }
  }

  if (anthropicKey) {
    try {
      const result = await callAnthropic(prompt, anthropicKey);
      return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders });
    } catch (err) {
      console.error('Anthropic failed:', err);
    }
  }

  return new Response(JSON.stringify(FALLBACK), { status: 200, headers: corsHeaders });
}
