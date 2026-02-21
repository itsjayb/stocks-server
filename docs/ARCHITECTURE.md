# Architecture

How the stocks-server platform is structured, how data flows, and how services interact.

---

## High-Level Flow

```
Alpaca API ──► Services (fetch + compute) ──► Supabase DB ──► Dashboard API ──► Website
                     │
              Python scripts
              (pattern detection)
```

### Data Sources
- **Alpaca Market Data API** (free tier) — OHLC bars, snapshots, movers screener
- **Finnhub** — market news
- **Alpha Vantage** — news/sentiment
- **Ollama LLM** — tweet generation (runs on Raspberry Pi or local)

### Compute Layer
All services run as Node.js (TypeScript) modules. Pattern detection uses a Python subprocess (`python/pattern_scan.py`). Each service:
1. Fetches raw data from APIs
2. Processes/scores/filters it
3. Returns typed results

### Storage Layer
**Supabase** (PostgreSQL) stores every service's output. Each service has its own table. The website queries Supabase directly (via the anon key + RLS) or through the dashboard API.

### Scheduling
`node-cron` runs jobs at configured intervals. The scheduler (`src/scheduler.ts`) spawns each job as a child process. PM2 keeps the scheduler alive.

---

## Directory Structure

```
stocks-server/
├── config/                    # Runtime configuration
│   └── stocks-to-scan.json   # Symbol universe for scans
├── dashboard/                 # Vue.js frontend (built separately)
├── db/
│   └── migrations/           # Supabase SQL migrations
│       └── 001_create_tables.sql
├── docs/
│   ├── ARCHITECTURE.md       # This file
│   ├── DATABASE.md           # Schema reference
│   └── SERVICES.md           # Service registry
├── output/                    # Local JSON output (pattern results)
├── python/
│   ├── pattern_scan.py       # Pattern detection script
│   └── requirements.txt
├── src/
│   ├── db/
│   │   └── supabase.ts       # Supabase client + storage functions
│   ├── jobs/
│   │   ├── movers-job.ts
│   │   ├── pattern-scan-job.ts
│   │   ├── smart-movers-job.ts
│   │   ├── sector-momentum-job.ts
│   │   ├── momentum-scanner-job.ts
│   │   ├── stock-picks-job.ts
│   │   ├── market-insights-job.ts
│   │   └── tweet-job.ts
│   ├── services/
│   │   ├── alpaca-bars.ts         # Fetch OHLC bars
│   │   ├── alpaca-movers.ts       # Fetch raw movers
│   │   ├── smart-movers.ts        # Enhanced movers with filters
│   │   ├── sector-momentum.ts     # Sector rotation tracking
│   │   ├── momentum-scanner.ts    # Multi-factor momentum scoring
│   │   ├── stock-picks.ts         # Stock of the day/week
│   │   ├── market-insights.ts     # Rules-based interpretations
│   │   ├── pattern-alerts.ts      # Enhanced pattern detection
│   │   ├── aggregate-news.ts      # News aggregation
│   │   ├── trending.ts            # Volume-based trending
│   │   ├── ollama.ts              # LLM integration
│   │   ├── x-post.ts              # Twitter/X posting
│   │   └── templates.ts           # Fallback templates
│   ├── dashboard-server.ts        # Express API server
│   ├── scheduler.ts               # Cron job scheduler
│   ├── stocks.ts                  # Master stock list
│   └── types.ts                   # Shared TypeScript types
├── tests/
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Service Dependency Graph

```
alpaca-bars.ts ◄──── alpaca-movers.ts
       │
       ├──► smart-movers.ts ────────┐
       │                            │
       ├──► pattern-alerts.ts ──────┤
       │    (+ python/pattern_scan) │
       │                            ├──► stock-picks.ts ──► market-insights.ts
       ├──► sector-momentum.ts ─────┤
       │                            │
       └──► momentum-scanner.ts ────┘
```

- `smart-movers` uses `alpaca-movers` + `alpaca-bars`
- `pattern-alerts` uses `alpaca-bars` + Python subprocess
- `sector-momentum` uses `alpaca-bars`
- `momentum-scanner` uses `alpaca-bars`
- `stock-picks` reads from smart-movers, pattern-alerts, and momentum-scanner
- `market-insights` reads from all services

---

## Scheduling Timeline (Central Time)

| Time | Job | Frequency |
|------|-----|-----------|
| Market hours (9:30–16:00) every 30 min | Smart Movers | ~13×/day |
| Market hours every 30 min | Momentum Scanner | ~13×/day |
| 15:00 | Pattern Scan | Daily |
| 16:00 | Sector Momentum | Daily |
| 17:00 | Stock Picks | Daily |
| 17:30 | Market Insights | Daily |
| 8,10,12,14,16,18 | Tweet Job | 6×/day (when enabled) |

---

## Rate Limit Strategy (Alpaca Free Tier)

- **200 calls/min** — plenty for all services
- Batch bars requests: 100 symbols per call, 3s delay between batches
- Cache results: each service stores to DB, downstream services read from DB instead of re-fetching
- WebSocket for real-time (up to 30 symbols) — reserved for future pre-market scanner
- Pattern scan runs overnight/after-hours to avoid market-hours congestion

---

## Environment Variables

See `.env.example` for the full list. Key additions for the new services:

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key (for website reads) |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (for server writes) |
| `VITE_ALPACA_API_KEY` | Alpaca API key |
| `VITE_ALPACA_SECRET_KEY` | Alpaca secret key |
