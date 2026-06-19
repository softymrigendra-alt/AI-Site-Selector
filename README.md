# EV Site Selector — AI-Powered EV Charging Site Selection & Revenue Forecasting

A white-label portfolio application demonstrating AI-augmented site analysis for EV charging deployments. Built with React 19 + Vite 8 + TypeScript + Tailwind CDN.

Live demo: deploy to Vercel with one click (see [Deployment](#deployment)).

---

## Features

| Feature | Details |
|---|---|
| **V1 Manual Analysis** | Form-based ROI forecast with instant deterministic maths + LLM enrichment |
| **V2 Agentic Pipeline** | 5-agent sequential pipeline: geocoding → utility rates → ROI → market data → LLM qualification |
| **Interactive Map** | Leaflet map showing site location, competitor pins, 5 km radius |
| **My Sites** | Save, filter, sort, and delete analyses; detail modal with year-by-year bar charts |
| **Reports** | Portfolio-level Recharts analytics: revenue bar, break-even line, charger-type pie, radar |
| **ROI Chat Assistant** | Floating chat bubble powered by Groq/Anthropic, pre-loaded with site context |
| **Dark Mode** | CSS custom properties, system-preference detection, toggle in header |
| **PWA** | Offline-capable via vite-plugin-pwa + Workbox service worker |
| **Auth** | Supabase email auth (sign-up, sign-in, sign-out) |
| **Agent Monitor** | localStorage-based agent telemetry dashboard (success rate, latency, recent runs) |

---

## Tech Stack

- **Frontend** — React 19, Vite 8, TypeScript (strict), Tailwind CDN
- **Maps** — Leaflet + React Leaflet (lazy-loaded)
- **Charts** — Recharts (lazy-loaded)
- **Animations** — Framer Motion
- **Backend** — Vercel Edge Functions (`api/forecast.ts`, `api/chat.ts`)
- **LLMs** — Groq `llama-3.3-70b-versatile` → Anthropic `claude-haiku-4-5-20251001` → deterministic fallback
- **Database** — Supabase (Postgres + Auth); graceful no-op when env vars absent
- **External APIs** — Nominatim geocoding, AFDC/NREL charging stations, EIA electricity rates, OpenChargeMap

---

## Quick Start

```bash
git clone https://github.com/softymrigendra-alt/AI-Site-Selector
cd AI-Site-Selector/ev-site-selector
npm install
cp .env.local.example .env.local   # add your API keys
npm run dev                         # http://localhost:5173
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Recommended | LLM inference (fast, free tier available) |
| `ANTHROPIC_API_KEY` | Optional | Fallback LLM if Groq unavailable |
| `VITE_SUPABASE_URL` | Optional | Enables save/load and auth |
| `VITE_SUPABASE_ANON_KEY` | Optional | Supabase anon key |
| `VITE_AFDC_API_KEY` | Optional | NREL charging station data (`DEMO_KEY` works) |
| `VITE_EIA_API_KEY` | Optional | EIA electricity rate data |
| `VITE_OCM_API_KEY` | Optional | OpenChargeMap global charger data |
| `VITE_COMPANY_NAME` | Optional | White-label brand name (default: "EV Site Selector") |

---

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL schema from `src/lib/supabase.ts` (lines 1–40 in comments) in the SQL editor
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local`
4. Enable email auth in Supabase Auth settings

---

## Deployment

### Vercel (recommended)

```bash
npm i -g vercel
vercel --prod
```

Add all environment variables in the Vercel project dashboard under Settings → Environment Variables. The `api/` directory is automatically deployed as Edge Functions.

### Manual build

```bash
npm run build   # outputs to dist/
```

---

## Project Structure

```
ev-site-selector/
├── api/
│   ├── forecast.ts          # Edge Function: LLM site scoring
│   └── chat.ts              # Edge Function: ROI chat assistant
├── src/
│   ├── components/
│   │   ├── AnimatedCard.tsx # Framer Motion primitives
│   │   ├── AuthModal.tsx    # Sign-in / sign-up modal
│   │   ├── ErrorBoundary.tsx
│   │   ├── OnlineIndicator.tsx
│   │   ├── ROIChatAssistant.tsx
│   │   ├── SiteMap.tsx      # Leaflet map (lazy-loaded)
│   │   └── Toast.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useDarkMode.ts
│   │   └── useOnlineStatus.ts
│   ├── lib/
│   │   ├── agentLogger.ts   # localStorage telemetry
│   │   ├── agentOrchestrator.ts  # 5-agent pipeline
│   │   ├── auth.ts          # Supabase auth helpers
│   │   ├── externalAPIs.ts  # Geocoding, AFDC, EIA, OCM
│   │   ├── retry.ts         # withRetry + error helpers
│   │   └── supabase.ts      # Supabase client + CRUD
│   ├── pages/
│   │   ├── AdminPage.tsx    # Agent monitor dashboard
│   │   ├── MySitesPage.tsx  # Saved analyses
│   │   └── ReportsPage.tsx  # Recharts portfolio analytics
│   ├── types/index.ts       # All domain types
│   ├── utils/roiCalculator.ts
│   ├── config/branding.ts
│   ├── App.tsx
│   ├── V1Page.tsx
│   └── V2Page.tsx
├── .env.local.example
├── vercel.json
└── vite.config.ts
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server at localhost:5173 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |

---

## Architecture

See [AGENT_ARCHITECTURE.md](./AGENT_ARCHITECTURE.md) for the V2 agent pipeline design and [API_REFERENCE.md](./API_REFERENCE.md) for the Edge Function API docs.
