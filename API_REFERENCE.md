# API Reference — EV Site Selector Edge Functions

Both functions run as Vercel Edge Functions (Node.js Edge Runtime). They are deployed automatically from the `api/` directory.

---

## POST /api/forecast

Generates an AI site score and qualitative analysis for a given location + ROI calculation.

### Request

```json
{
  "siteInput": {
    "address": "123 Main St, Seattle, WA",
    "propertyType": "parking",
    "parkingSpaces": 50,
    "dailyFootfall": 800,
    "targetChargers": 4,
    "chargerType": "DC Fast"
  },
  "roiCalculation": {
    "setupCost": 120000,
    "monthlyNet": 3200,
    "breakEvenMonths": 37,
    "year1Profit": 18400,
    "year3Revenue": 115200,
    "year5Revenue": 192000
  }
}
```

### Response

```json
{
  "siteScore": 82,
  "evDemandLevel": "high",
  "competitorRisk": "medium",
  "confidenceLevel": 88,
  "aiInsight": "This high-traffic parking location in a dense EV market..."
}
```

### Fields

| Field | Type | Range / Values | Description |
|---|---|---|---|
| `siteScore` | number | 0–100 | Overall site viability score |
| `evDemandLevel` | string | `low` / `medium` / `high` | Local EV adoption level |
| `competitorRisk` | string | `low` / `medium` / `high` | Nearby competitor density |
| `confidenceLevel` | number | 0–100 | LLM confidence in the analysis |
| `aiInsight` | string | — | 2–4 sentence qualitative summary |

### LLM Cascade

1. Groq `llama-3.3-70b-versatile` (8 s timeout)
2. Anthropic `claude-haiku-4-5-20251001` (10 s timeout)
3. Deterministic fallback (always succeeds)

---

## POST /api/chat

Conversational assistant pre-loaded with a site's analysis context. Answers follow-up questions about ROI, grants, competitor risk, and charger recommendations.

### Request

```json
{
  "messages": [
    { "role": "user", "content": "When will this site break even?" }
  ],
  "systemContext": "Address: 123 Main St...\nBreak-even: 37 months\n..."
}
```

### Response

```json
{
  "reply": "Based on the analysis, break-even is projected at 37 months..."
}
```

### Notes

- Conversation history is sent in full on each request (stateless server).
- `systemContext` is a newline-separated key-value summary of the current site analysis, built client-side by `ROIChatAssistant.tsx`.
- Same 3-tier LLM cascade as `/api/forecast`.
- Max response: 512 tokens.

---

## Error Handling

Both endpoints return HTTP 200 with a valid JSON body on all paths — including when the LLM is unavailable. The deterministic fallback always produces a structurally valid response so the frontend never needs to handle a 5xx.

HTTP 400 is returned only for malformed JSON or missing required fields. HTTP 405 for non-POST requests.
