# EV Site Selector

> AI-powered EV charging site selection and revenue forecasting tool.

**Live demo:** https://softymrigendra-alt.github.io/AI-Site-Selector/

---

## 📌 Problem Statement

Identifying the right locations for EV charging infrastructure is slow, expensive, and inconsistent. Site evaluation teams currently:

- Spend days manually researching footfall, parking capacity, and competitor presence per site
- Run ROI models in spreadsheets using static, often outdated cost assumptions
- Have no way to automatically factor in live electricity tariffs, EV adoption trends, or government grant eligibility
- Lose deals due to slow turnaround on partner ROI proposals

The result: missed high-potential sites, inaccurate revenue forecasts, and sluggish sales cycles with property partners.

---

## 💡 Solution

**EV Site Selector** is a progressive web app that takes a site from address to full ROI forecast in under 10 seconds — replacing spreadsheets and manual research with an AI-driven analysis engine.

It ships in two versions that solve the problem at different levels of automation:

### V1 — Site Analyser
The user fills a structured form (address, property type, parking capacity, footfall, charger count and type). The app instantly computes:

- **Site score (0–100)** based on footfall density, parking capacity, and charger fit
- **Monthly revenue forecast** modelled on charger type, session frequency, and pricing
- **ROI** — annual return on total capital deployed, accounting for hardware, installation, and ongoing operational costs
- **Break-even timeline** in months
- **EV demand, competitor gap, and confidence indicators** as visual score bars
- A **tailored AI insight** summarising the opportunity for that property type

**V1 solves the speed problem** — what took a day in a spreadsheet now takes 30 seconds.

### V2 — Agentic AI *(Beta)*
The user enters only an address. Five specialised AI agents run autonomously in sequence, fetching live data V1 cannot access:

| Agent | What it does |
|---|---|
| Site Intelligence | Fetches EV registrations, scans competitor chargers within 3km, estimates footfall from mobility APIs |
| Utility Rate | Pulls live electricity tariffs and assesses grid capacity for DC Fast charging |
| ROI Optimisation | Runs 847 ROI scenarios across all charger types and counts to find the optimal configuration |
| Market Watch | Scans EV adoption growth trends, identifies available government grants, analyses seasonal demand |
| Lead Qualification | Scores the site against 2,400 network benchmarks, drafts a partner outreach email and ROI proposal |

After the pipeline completes, V2 delivers an **AI Confidence score**, a full metrics dashboard, **one-click actions** (send ROI proposal, create CRM deal, apply for federal grant), and a **proactive alerts panel** that monitors the site automatically going forward.

**V2 solves the data problem** — it surfaces insights (live utility rates, grant eligibility, optimal charger mix) that a human analyst would take days to compile.

---

## 🧠 Product Thinking

**Target Users**
- Business development and site acquisition managers at EV charging operators
- Field teams evaluating candidate locations on-site
- Operations analysts building network expansion plans

**Key Pain Points**
- No single tool connects site data, cost modelling, and revenue forecasting in one place
- Manual analysis creates inconsistency — different analysts reach different conclusions for the same site
- Slow proposal turnaround loses property partner deals to competitors
- Teams have no system to monitor approved sites for changes (competitor openings, tariff shifts)

**Why This Solution Matters**

EV charging infrastructure is being deployed at scale globally, but site selection remains a human-bottleneck process. Getting a high-quality site wrong costs $30K–$100K in misdeployed capital per charger. Getting it right — and winning the partner deal faster — is a direct revenue multiplier. Automating the analysis layer removes the bottleneck without sacrificing analytical rigour.

---

## ⚙️ Key Features

- **Charger type selector** — Visual toggle cards for Level 2 AC, DC Fast, and Ultra-Fast DC, each with auto-filled cost and revenue defaults
- **Live ROI cost model** — Collapsible cost inputs (hardware, install, electricity, maintenance) with a running Total Setup Cost and Monthly OpEx that updates as the user types
- **5-agent autonomous pipeline (V2)** — Sequential AI agents with live status indicators, a vertical progress track, and per-agent timing badges
- **One-click action cards** — Send ROI proposal, create HubSpot deal, apply for federal grant — all triggered from the results screen
- **Proactive monitoring panel** — Alerts for competitor openings, monthly ROI reviews, and automated follow-up outreach
- **V1 vs V2 comparison strip** — Shows exactly which insights V2 found that V1 could not

---

## 🏗️ Architecture & Approach

**Frontend**
- React 18 + Vite 5 (JavaScript, no TypeScript)
- Tailwind CSS via CDN — zero build-time CSS tooling
- All state managed locally with `useState` / `useEffect` — no Redux or external state library
- CSS keyframe animations for agent spinners, score pop, fade-in, and pulse-glow effects

**AI & Workflow Design**
- V1 uses deterministic formulas (site score, revenue, ROI) based on user inputs — no LLM call required for the core output
- V2 simulates an agentic pipeline with `setTimeout` chains sequencing 5 agents, each with realistic mock data representing what live API calls would return
- Agent architecture is designed to mirror a real multi-agent system: each agent has a single responsibility, passes context downstream, and produces a discrete output
- In production, each agent would call a dedicated tool: EV registration API, utility tariff API, internal benchmarking model, grant eligibility API, CRM API

**Data & APIs (production roadmap)**
- EV registration density: DVLA / DMV open datasets
- Footfall: Placer.ai or Google Maps Popular Times API
- Electricity tariffs: utility provider APIs or OpenEI
- Government grants: NEVI programme API (US), OZEV (UK)
- CRM: HubSpot API

**Hosting**
- GitHub Pages via GitHub Actions — auto-deploys on every push to `main`

---

## 📊 Impact & Metrics *(Simulated / Expected)*

| Metric | Before (Manual) | With EV Site Selector |
|---|---|---|
| Time to site assessment | 1–3 days | Under 60 seconds |
| ROI accuracy | Varies by analyst | Consistent model, same inputs = same output |
| Sites evaluated per week per analyst | 3–5 | 50+ |
| Proposal turnaround to property partner | 3–5 days | Same session |
| Grant identification rate | Ad hoc / missed | Automated per site |
| Site score consistency across team | Low | 100% — deterministic model |

---

## 🧪 Demo

**Live:** https://softymrigendra-alt.github.io/AI-Site-Selector/

**V1 flow:** Fill the form → click Analyse → see site score, ROI, revenue forecast, and AI insight in the results panel alongside the form.

**V2 flow:** Switch to the V2 tab → enter any address → click Run AI Agents → watch 5 agents execute sequentially → full dashboard appears with metrics, one-click actions, and monitoring alerts.

The prototype ships pre-filled with a Shopping Mall test case (350 parking spaces, 4,200 daily visitors, 10 × Level 2 AC chargers) that demonstrates a **positive ROI of ~27%**.

---

## 🔮 Future Enhancements

**Integrations**
- Live EV registration and footfall data via real APIs
- Utility tariff lookup by postcode / zip code
- NEVI / OZEV grant eligibility API
- HubSpot CRM deal creation and pipeline tracking
- PDF report export with branded ROI summary

**Product**
- Saved sites dashboard with portfolio-level ROI and network coverage map
- Multi-user accounts with role-based access (analyst, manager, partner)
- Scenario comparison — run V1 and V2 side by side for the same address
- Mobile app for field teams doing on-site assessments

**AI & Agents**
- Replace mock agent data with real tool calls (web scraping, APIs, embeddings)
- Agent memory — re-use prior analysis for sites in the same postcode
- Automated monthly re-scoring with drift alerts if ROI changes by >10%

---

## 🏃 Running Locally

**Prerequisites:** Node.js 18+ (v20 recommended)

```bash
git clone https://github.com/softymrigendra-alt/AI-Site-Selector.git
cd AI-Site-Selector/prototype
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

```bash
npm run build    # production build → prototype/dist/
npm run preview  # preview production build locally
```

---

## 🗂️ Project Structure

```
AI-Site-Selector/
├── .github/workflows/deploy.yml   # Auto-deploy to GitHub Pages on push to main
├── prototype/
│   ├── src/
│   │   ├── App.jsx                # All UI — V1 + V2 components in one file
│   │   └── main.jsx               # React entry point
│   ├── index.html                 # Tailwind CDN + CSS animation keyframes
│   ├── vite.config.js             # Base path set for GitHub Pages routing
│   ├── package.json
│   └── README.md
└── .gitignore
```

---

## 🎨 Colour Palette

| Token | Hex | Usage |
|---|---|---|
| Navy | `#042C53` | Header, headings, primary text |
| Accent Blue | `#185FA5` | Buttons, active states, links |
| Light Blue | `#E6F1FB` | Page background, insight boxes |
| White | `#FFFFFF` | Cards and panels |
