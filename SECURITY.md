# Security hardening — deployment steps

The code changes below are complete, but two of them need action in your Supabase
and Vercel dashboards to take full effect.

## 1. Supabase — apply owner-scoped Row Level Security (REQUIRED)

The old policy (`for all using (true)`) let anyone with the public anon key read,
edit, or delete **every** user's saved analyses. Run this once in the Supabase
SQL editor to scope every row to its owner:

```sql
-- Add an owner column tied to auth.users (skip if it already exists as uuid).
alter table site_analyses
  alter column user_id type uuid using null,           -- if it was text; else skip
  alter column user_id set default auth.uid();
alter table site_analyses
  add constraint site_analyses_user_fk
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table site_analyses enable row level security;

-- Remove the wide-open policy.
drop policy if exists "anon read-write" on site_analyses;

-- Owner-scoped policies.
create policy "own rows select" on site_analyses
  for select using (auth.uid() = user_id);
create policy "own rows insert" on site_analyses
  for insert with check (auth.uid() = user_id);
create policy "own rows update" on site_analyses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows delete" on site_analyses
  for delete using (auth.uid() = user_id);
```

Existing rows with `user_id = 'anonymous'` won't be visible to any account; delete
them or reassign them to a real user id if you need them.

Saving/reading analyses now requires the user to be signed in.

## 2. Vercel — environment variables

**LLM keys (server-side only — never prefix with `VITE_`):**
- `GROQ_API_KEY`
- `ANTHROPIC_API_KEY`

**Data-provider keys — move off the client.** The browser no longer reads these;
`/api/data` does. They work under either name (`process.env.X ?? process.env.VITE_X`),
but rename them to drop `VITE_` so Vite never bundles them into the client:
- `VITE_EIA_API_KEY`  → `EIA_API_KEY`
- `VITE_AFDC_API_KEY` → `AFDC_API_KEY`
- `VITE_OCM_API_KEY`  → `OCM_API_KEY`

**New — request guard:**
- `ALLOWED_ORIGINS` — comma-separated allowlist for the API routes, e.g.
  `https://ev-site-selector.vercel.app,http://localhost:5173`. Defaults to the
  production origin if unset.
- `SUPABASE_JWT_SECRET` — (optional but recommended) when set, the API routes
  require a valid Supabase session JWT. Found in Supabase → Settings → API →
  JWT Secret. The frontend already attaches the token.

**Client (still public, safe):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
The anon key is meant to be public — it is safe **only because** RLS (step 1) now
scopes access.

## What changed in code

| Area | Change |
|------|--------|
| `src/lib/supabase.ts` | Writes stamp `user_id` from the session; reads/writes require auth; RLS migration documented |
| `api/_guard.ts` (new) | Origin allowlist, body-size cap, per-IP rate limit, optional JWT verification |
| `api/chat.ts`, `api/forecast.ts` | Run the guard; CORS restricted to the allowlist; message/context size caps |
| `api/data.ts` (new) | Server-side proxy for EIA / NREL-AFDC / OpenChargeMap so keys stay off the client |
| `src/lib/externalAPIs.ts` | Calls `/api/data` instead of keyed upstreams directly |
| `src/lib/auth.ts` | `authHeader()` helper; callers attach the session token to API calls |
| `vercel.json` | CSP: dropped `script-src 'unsafe-inline'`, trimmed `connect-src` to self+Supabase, added `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'` |
| deps | `npm audit fix` — 0 vulnerabilities |

### Rate-limit note
The limiter in `api/_guard.ts` is per-edge-isolate (in-memory), so it's a speed
bump, not a hard global quota. For a strict limit, back it with Vercel KV or
Upstash Redis — the call site in `guard()` stays the same.
