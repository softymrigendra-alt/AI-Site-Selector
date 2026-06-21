/// <reference types="node" />
export const config = { runtime: 'edge' };

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  systemContext?: string;
}

async function callGroqChat(
  messages: ChatMessage[],
  system: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: 512,
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json() as { choices: [{ message: { content: string } }] };
  return data.choices[0].message.content.trim();
}

async function callAnthropicChat(
  messages: ChatMessage[],
  system: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system,
      messages,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json() as { content: [{ text: string }] };
  return data.content[0].text.trim();
}

function deterministicReply(userMsg: string, ctx: string): string {
  const q = userMsg.toLowerCase();
  if (q.includes('break') || q.includes('payback')) {
    const match = ctx.match(/break.?even[:\s]+(\d+)/i);
    return match
      ? `Based on the analysis, the break-even point is around ${match[1]} months. This assumes stable utilisation rates and current electricity pricing.`
      : 'Break-even timing depends on charger utilisation and local electricity rates. Typically 24–60 months for EV charging sites.';
  }
  if (q.includes('grant') || q.includes('fund') || q.includes('incentive')) {
    return 'Key funding sources include the NEVI Formula Program (up to $100k per charger), IRA Section 30C Tax Credit (30% of install cost, max $100k commercial), and state-level utility rebates. Check pluginamerica.org for your state.';
  }
  if (q.includes('revenue') || q.includes('profit') || q.includes('earn')) {
    const match = ctx.match(/monthly net[:\s]+\$?([\d,]+)/i);
    return match
      ? `The projected monthly net revenue is $${match[1]}. This compounds as EV adoption grows — year-3 revenue typically runs 30–40% above year-1.`
      : 'Revenue depends on charger type, utilisation rate, and your pricing model. DC Fast chargers typically yield $800–$2,500/month per unit.';
  }
  if (q.includes('risk') || q.includes('competitor') || q.includes('competition')) {
    return 'Competitor risk is highest when 6+ stations exist within 5 km. Differentiate with amenities (retail, food), 24/7 reliability guarantees, and network loyalty programmes.';
  }
  if (q.includes('charger') && (q.includes('type') || q.includes('choose') || q.includes('best'))) {
    return 'DC Fast (50–150 kW) suits highway corridors and retail destinations with 20–60 min dwell time. Level 2 AC (7–22 kW) fits workplaces and multifamily with 2–8 h stays. Ultra-Fast (150–350 kW) maximises revenue at premium locations with high EV density.';
  }
  return 'I can answer questions about ROI, break-even timing, charger types, grants, and competitor risk based on this site analysis. What would you like to know?';
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body: ChatRequest;
  try {
    body = await req.json() as ChatRequest;
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const { messages, systemContext = '' } = body;
  if (!messages?.length) return new Response('No messages', { status: 400 });

  const system = `You are an EV charging site selection expert assistant. Answer concisely (2-4 sentences). Stay focused on EV charging economics, site viability, ROI, and regulatory context. Here is the current site analysis context:\n\n${systemContext}`;

  const groqKey = (process.env.GROQ_API_KEY ?? '').trim();
  const anthropicKey = (process.env.ANTHROPIC_API_KEY ?? '').trim();
  const lastUser = messages[messages.length - 1]?.content ?? '';

  let reply: string;
  if (groqKey) {
    try { reply = await callGroqChat(messages, system, groqKey); }
    catch { reply = anthropicKey ? await callAnthropicChat(messages, system, anthropicKey).catch(() => deterministicReply(lastUser, systemContext)) : deterministicReply(lastUser, systemContext); }
  } else if (anthropicKey) {
    try { reply = await callAnthropicChat(messages, system, anthropicKey); }
    catch { reply = deterministicReply(lastUser, systemContext); }
  } else {
    reply = deterministicReply(lastUser, systemContext);
  }

  return new Response(JSON.stringify({ reply }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
