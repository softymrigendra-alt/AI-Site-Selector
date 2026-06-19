# Production Deployment Checklist

## 1. Pre-Deploy

- [ ] All env vars added to Vercel project (Settings → Environment Variables)
  - `GROQ_API_KEY` — required for fast LLM inference
  - `ANTHROPIC_API_KEY` — fallback LLM
  - `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` — required for save/auth
  - `VITE_AFDC_API_KEY` — NREL charging station data
  - `VITE_EIA_API_KEY` — EIA electricity rates
  - `VITE_OCM_API_KEY` — OpenChargeMap (optional)
  - `VITE_COMPANY_NAME` — white-label brand name
- [ ] Supabase SQL schema applied (from `src/lib/supabase.ts` comments)
- [ ] Supabase RLS policies enabled on `site_analyses` table
- [ ] Supabase Auth email confirmation enabled
- [ ] `npm run build` completes with no TypeScript errors

## 2. Vercel Deployment

```bash
npm i -g vercel
vercel --prod
```

Or connect the GitHub repo in the Vercel dashboard for automatic deployments on push to `main`.

**Vercel project settings:**
- Framework Preset: **Vite**
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

## 3. Security

The following headers are applied automatically via `vercel.json`:

| Header | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | camera, mic, geolocation blocked |
| `Content-Security-Policy` | Allowlists self, Tailwind CDN, OSM tiles, Supabase, Groq, Anthropic, NREL, EIA, OCM |
| `Cache-Control` | `immutable` on `/assets/`, `must-revalidate` on `/sw.js` |

**Verify after deploy:**
- [ ] Run [securityheaders.com](https://securityheaders.com) on the live URL — target grade A
- [ ] Confirm API keys are not exposed in browser JS (check Network tab, Sources)
- [ ] Confirm `GROQ_API_KEY` / `ANTHROPIC_API_KEY` are server-only (no `VITE_` prefix)

## 4. Supabase Production Setup

```sql
-- Run in Supabase SQL editor
-- (schema already in src/lib/supabase.ts comments)

-- Confirm RLS is enabled
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'site_analyses';

-- Confirm policy exists
SELECT * FROM pg_policies WHERE tablename = 'site_analyses';
```

- [ ] Enable Email Auth in Supabase Auth → Providers
- [ ] Set Site URL to your Vercel domain in Auth → URL Configuration
- [ ] Add Vercel domain to Redirect URLs

## 5. Post-Deploy Smoke Tests

- [ ] V1 Manual: submit a form, confirm ROI renders and LLM enrichment fires
- [ ] V2 Agentic: enter an address, confirm all 5 agents complete
- [ ] Map renders with competitor pins
- [ ] Reports tab loads Recharts (check for lazy-load spinner then charts)
- [ ] Save Report button saves to Supabase (check My Sites tab)
- [ ] Sign up → confirm email → sign in flow
- [ ] Chat assistant opens and responds
- [ ] Monitor tab shows agent logs after running V2
- [ ] Dark mode toggles and persists on reload
- [ ] App works offline (kill network, reload — PWA cache serves assets)

## 6. Monitoring

- Vercel Analytics — enable in project dashboard (free tier)
- Vercel Functions logs — check for edge function errors after go-live
- Agent Monitor tab — shows client-side pipeline health per-user session
- Supabase Logs — Auth and database query logs in project dashboard

## 7. Custom Domain (optional)

1. Add domain in Vercel → Project → Domains
2. Update Supabase Auth → URL Configuration with the custom domain
3. Update CSP in `vercel.json` if the domain differs from the Vercel-assigned URL
