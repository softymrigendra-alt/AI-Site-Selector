/// <reference types="node" />
// Shared request guard for the Edge API routes. Underscore-prefixed files in
// api/ are NOT treated as routes by Vercel, so this is import-only.
//
// Layers, cheapest first:
//   1. Origin/Referer allowlist  — blocks cross-site browser abuse & embedding.
//   2. Body size cap             — blocks oversized payloads before parsing.
//   3. Best-effort rate limit    — per-IP sliding window, in-isolate memory.
//   4. Optional JWT verification — enforced only when SUPABASE_JWT_SECRET is set.
//
// The rate limiter is per-edge-isolate (Vercel spins up many), so it is a
// speed bump, not a hard quota. For a strict global limit, back it with a shared
// store (Upstash Redis / Vercel KV) — the interface here stays the same.

export interface GuardOptions {
  maxBodyBytes?: number; // reject bodies larger than this (default 16 KB)
  rateLimit?: number;    // requests allowed per window per IP (default 20)
  windowMs?: number;     // sliding window length (default 60_000)
  requireAuth?: boolean; // force auth even if no JWT secret is configured
}

// Comma-separated list, e.g. "https://ev-site-selector.vercel.app,http://localhost:5173".
// Falls back to the production origin so a missing env var fails closed-ish.
function allowedOrigins(): string[] {
  const raw = (process.env.ALLOWED_ORIGINS ?? 'https://ev-site-selector.vercel.app').trim();
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = allowedOrigins();
  const allow = allowed.includes(origin) ? origin : allowed[0] ?? '';
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
}

// ─── Rate limiting (per-isolate, best-effort) ─────────────────────────────────
const hits = new Map<string, number[]>();

function clientIp(req: Request): string {
  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

function rateLimited(req: Request, limit: number, windowMs: number): boolean {
  const ip = clientIp(req);
  const cutoff = Date.now() - windowMs;
  const recent = (hits.get(ip) ?? []).filter((t) => t > cutoff);
  recent.push(Date.now());
  hits.set(ip, recent);
  // Opportunistic cleanup so the map can't grow without bound.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => t <= cutoff)) hits.delete(k);
  }
  return recent.length > limit;
}

// ─── JWT verification (Supabase HS256) ────────────────────────────────────────
function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyJwt(token: string, secret: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [headerB64, payloadB64, sigB64] = parts;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      b64urlToBytes(sigB64) as unknown as ArrayBuffer,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`) as unknown as ArrayBuffer,
    );
    if (!valid) return false;
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64))) as {
      exp?: number;
    };
    if (payload.exp && payload.exp * 1000 < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

export interface GuardResult {
  ok: boolean;
  response?: Response; // set when the request should be rejected
  body?: unknown;      // parsed JSON body when ok
}

// Runs all guard layers. On rejection, returns a ready-to-send Response.
export async function guard(req: Request, opts: GuardOptions = {}): Promise<GuardResult> {
  const {
    maxBodyBytes = 16 * 1024,
    rateLimit = 20,
    windowMs = 60_000,
    requireAuth = false,
  } = opts;
  const headers = corsHeaders(req);
  const reject = (status: number, message: string): GuardResult => ({
    ok: false,
    response: new Response(JSON.stringify({ error: message }), { status, headers }),
  });

  if (req.method === 'OPTIONS') {
    return { ok: false, response: new Response(null, { status: 204, headers }) };
  }
  if (req.method !== 'POST') return reject(405, 'Method not allowed');

  // 1. Origin allowlist. Browsers always send Origin on cross-origin POSTs;
  // same-origin fetches may omit it, so an empty Origin is allowed through
  // (it cannot come from another website), but a present, non-listed one is not.
  const origin = req.headers.get('origin');
  if (origin && !allowedOrigins().includes(origin)) {
    return reject(403, 'Origin not allowed');
  }

  // 2. Body size cap.
  const declaredLen = Number(req.headers.get('content-length') ?? '0');
  if (declaredLen > maxBodyBytes) return reject(413, 'Payload too large');
  const raw = await req.text();
  if (raw.length > maxBodyBytes) return reject(413, 'Payload too large');

  // 3. Rate limit.
  if (rateLimited(req, rateLimit, windowMs)) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...headers, 'Retry-After': String(Math.ceil(windowMs / 1000)) },
      }),
    };
  }

  // 4. Optional JWT verification.
  const jwtSecret = (process.env.SUPABASE_JWT_SECRET ?? '').trim();
  if (jwtSecret || requireAuth) {
    const auth = req.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return reject(401, 'Authentication required');
    if (!jwtSecret) return reject(500, 'Auth not configured');
    if (!(await verifyJwt(token, jwtSecret))) return reject(401, 'Invalid token');
  }

  // Parse JSON body for the handler.
  try {
    return { ok: true, body: raw ? JSON.parse(raw) : {} };
  } catch {
    return reject(400, 'Bad request');
  }
}
