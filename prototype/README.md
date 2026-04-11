# Blink Site Selector — Prototype

> AI-powered EV charging site selection and revenue forecasting tool for Blink Charging.

**Live demo:** https://softymrigendra-alt.github.io/AI-Site-Selector/

---

## The Problem

Identifying the right locations for EV charging infrastructure is slow, expensive, and inconsistent. Site evaluation teams currently:

- Manually research footfall, parking capacity, and competitor presence for each candidate site
- Run ROI calculations in spreadsheets using static, often outdated cost assumptions
- Have no automated way to factor in live electricity tariffs, EV adoption rates, or government grant eligibility
- Spend days per site on analysis that could be done in minutes

This results in missed high-potential sites, incorrect revenue forecasts, and slow sales cycles with property partners.

---

## The Solution

**Blink Site Selector** is a progressive web app that gives field teams and business development managers an instant, data-driven site assessment — from address to ROI forecast in under 10 seconds.

It comes in two modes:

### V1 — Site Analyser
A structured manual form where the user enters site details (address, property type, parking capacity, footfall, charger count and type). The app instantly calculates:

- A **site score** (0–100) based on footfall, parking, and charger density
- **Monthly revenue forecast** based on charger type and session assumptions
- **ROI** — annual return on total setup investment, factoring in hardware, install, and operational costs
- **Break-even timeline**
- **EV demand, competitor gap, and confidence score bars**
- An **AI insight** tailored to the property type and charger configuration

### V2 — Agentic AI _(Beta)_
The user enters only an address. Five AI agents run autonomously in sequence and surface data that V1 cannot:

| Agent | What it does |
|---|---|
| Site Intelligence | Fetches EV registrations, scans competitor chargers, estimates footfall from mobility APIs |
| Utility Rate | Pulls live electricity tariffs and grid capacity for the area |
| ROI Optimisation | Runs 847 ROI scenarios across charger types and counts to find the optimal configuration |
| Market Watch | Scans EV adoption trends, government incentive programmes, and seasonal demand patterns |
| Lead Qualification | Scores the site against 2,400 Blink network benchmarks and drafts a partner outreach email |

After the pipeline completes, V2 surfaces an **AI Confidence score**, key metrics, a set of **one-click actions** (send ROI proposal, create CRM deal, apply for grant), and a **proactive alerts panel** for ongoing monitoring.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite 5 |
| Styling | Tailwind CSS (CDN) |
| Language | JavaScript (no TypeScript) |
| Backend | None — mock data and simulated AI responses |
| Hosting | GitHub Pages (via GitHub Actions) |
| PWA | Meta tags + theme colour configured |

---

## Running Locally

**Prerequisites:** Node.js 18+ (v20 recommended)

```bash
# 1. Clone the repo
git clone https://github.com/softymrigendra-alt/AI-Site-Selector.git
cd AI-Site-Selector/prototype

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Open **http://localhost:5173** in your browser.

### Building for production

```bash
npm run build     # outputs to prototype/dist/
npm run preview   # preview the production build locally
```

---

## Deploying (GitHub Pages)

Deployment is fully automated via GitHub Actions. Every push to `main` triggers a build and deploys to GitHub Pages.

**First-time setup (one-off):**

1. Go to your repo on GitHub → **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. Push any commit to `main` — the workflow triggers automatically

The live URL will be:
```
https://softymrigendra-alt.github.io/AI-Site-Selector/
```

---

## Project Structure

```
AI-Site-Selector/
├── .github/
│   └── workflows/
│       └── deploy.yml        # GitHub Actions deploy pipeline
├── prototype/
│   ├── src/
│   │   ├── App.jsx           # All UI components (V1 + V2)
│   │   └── main.jsx          # React entry point
│   ├── index.html            # Tailwind CDN + CSS animations
│   ├── vite.config.js        # Vite config (base path for GH Pages)
│   ├── package.json
│   └── README.md             # This file
└── .gitignore
```

---

## Key Screens

| Screen | Description |
|---|---|
| V1 Form | Address, property type, parking, footfall, charger count + type, collapsible ROI cost inputs |
| V1 Results | Site score badge, 4 metric boxes, ROI field, score bars, AI insight |
| V2 Agent Pipeline | 5 live agent cards activating sequentially with status indicators and a vertical progress track |
| V2 Results | Confidence banner, metrics, AI insights panel, one-click action cards |
| V2 Alerts | 3 proactive monitoring alert cards |

---

## Roadmap / Future Work

- [ ] Real API integrations (EV registration data, utility tariff APIs, Google Maps footfall)
- [ ] Authentication and multi-user support
- [ ] PDF report export
- [ ] HubSpot CRM integration for deal creation
- [ ] NEVI grant eligibility API integration
- [ ] Saved sites dashboard with portfolio-level ROI view
- [ ] Mobile app (React Native)

---

## Colour Palette

| Token | Hex | Usage |
|---|---|---|
| Navy | `#042C53` | Header, headings, primary text |
| Accent Blue | `#185FA5` | Buttons, links, active states |
| Light Blue | `#E6F1FB` | Page background, insight boxes |
| White | `#FFFFFF` | Cards |

---

*Built as an internal prototype for Blink Charging's site selection and business development teams.*
