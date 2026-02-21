# Services Registry

This document tracks every service in the stocks-server platform. Each service fetches, processes, or combines market data and stores results in Supabase so the website can query them.

---

## Service Overview

| # | Service | File | Schedule | DB Table | Status |
|---|---------|------|----------|----------|--------|
| 1 | **Smart Movers** | `src/services/smart-movers.ts` | Every 30 min (market hours) | `smart_movers` | Active |
| 2 | **Pattern Alerts** | `src/services/pattern-alerts.ts` + `python/pattern_scan.py` | Daily 3 PM CT | `pattern_alerts` | Active |
| 3 | **Sector Momentum** | `src/services/sector-momentum.ts` | Daily 4 PM CT | `sector_momentum` | Active |
| 4 | **Momentum Scanner** | `src/services/momentum-scanner.ts` | Every 30 min (market hours) | `momentum_scans` | Active |
| 5 | **Stock Picks** | `src/services/stock-picks.ts` | Daily 5 PM CT | `stock_picks` | Active |
| 6 | **Market Insights** | `src/services/market-insights.ts` | Daily 5:30 PM CT | `market_insights` | Active |

---

## 1. Smart Movers

**What it does:** Goes beyond a raw top-gainers list. Fetches Alpaca movers, then enriches each mover with volume ratio (today vs 20-day average), 52-week high proximity, and float/market-cap tier classification.

**Filters available (stored per row):**
- `unusual_volume` — volume > 2× the 20-day average
- `near_52w_high` — price within 5% of 52-week high
- `price_tier` — `penny` (< $5), `small` ($5–$20), `mid` ($20–$100), `large` (> $100)

**Why it's valuable:** Traders don't want a raw list — they want *actionable* setups. A stock up 8% on normal volume is noise; a stock up 8% on 3× volume near its 52-week high is a signal.

**Data flow:**
1. Fetch top 20 gainers and losers from `alpaca-movers.ts`
2. For each mover, fetch 30-day daily bars to compute avg volume and 52-week high
3. Tag with filters, compute `volume_ratio`
4. Store all rows in `smart_movers` table
5. Website queries by date, filter, or tier

---

## 2. Pattern Alerts

**What it does:** Scans a universe of stocks for chart patterns across multiple timeframes (daily 1Y/2Y, monthly 3Y/5Y). Detects head & shoulders, inverse head & shoulders, and more via the Python `tradingpatterns` library.

**Enhancements over raw scan:**
- Adds moving-average crossover detection (50/200 SMA golden/death cross)
- Adds breakout detection (close above 20-day high on volume spike)
- Results stored per-symbol per-pattern with the timeframe label

**Why it's valuable:** Pattern detection is the core educational product. Showing "AAPL formed a golden cross today on the daily chart" ties directly into the lessons at learnstockmarket.online/patterns.

**Data flow:**
1. Load symbol universe from config
2. Fetch bars from Alpaca in batches (100 symbols, 3s delay)
3. Run Python pattern scan (head & shoulders)
4. Run JS-side MA crossover and breakout detection
5. Merge all pattern hits, store in `pattern_alerts`
6. Website shows "Today's Detected Patterns" page

---

## 3. Sector Momentum

**What it does:** Groups stocks into 11 GICS sectors, pulls recent performance (1-week and 1-month % change) for representative stocks in each sector, ranks sectors by average momentum, and highlights top/bottom 3.

**Sectors tracked:** Technology, Healthcare, Financials, Consumer Discretionary, Consumer Staples, Energy, Industrials, Materials, Real Estate, Utilities, Communication Services.

**Why it's valuable:** Sector rotation is a foundational concept. Showing "Energy outperforming this week — watch XOM, CVX, SLB" teaches rotation while giving actionable ideas.

**Data flow:**
1. Use hardcoded sector → representative stocks mapping
2. Fetch 30-day daily bars for all representatives
3. Compute 1-week and 1-month % change per stock, average per sector
4. Rank sectors, pick top/bottom 3
5. Store sector rankings + driver stocks in `sector_momentum`

---

## 4. Momentum Scanner

**What it does:** Computes a composite momentum score for a watchlist of stocks using multiple factors: price change %, volume ratio, RSI(14), and distance from recent highs.

**Scoring formula:**
- `price_score` — % change from 5 days ago (0–30 points)
- `volume_score` — current volume / 20-day avg volume (0–30 points)
- `rsi_score` — RSI(14) between 30–70 scores highest (inverted U, 0–20 points)
- `trend_score` — price above 20-day SMA (0–20 points)
- **Total: 0–100**

**Filters the website can apply:**
- Min score threshold (e.g., > 70)
- Price tier (penny / small / mid / large)
- Volume ratio minimum

**Why it's valuable:** This is "trader infrastructure" — a custom scanner that retail traders would pay for. Saved scans, custom filters, and backtesting logic are premium features.

**Data flow:**
1. Fetch 30-day daily bars for the stock universe
2. Compute RSI(14), 20-day SMA, avg volume, % change
3. Score each stock 0–100
4. Store all scored rows in `momentum_scans`
5. Website renders as a sortable, filterable table

---

## 5. Stock Picks (Stock of the Day/Week)

**What it does:** Combines signals from Smart Movers + Pattern Alerts + Momentum Scanner to select 1–3 "Stock of the Day" picks and 1–3 weekly picks. Each pick includes the chart data, key stats, detected patterns, and a short rationale.

**Selection criteria:**
- Must appear in today's movers OR have a momentum score > 70
- Must have at least one detected pattern (MA crossover, breakout, or chart pattern)
- Price > $5 (no penny stocks)
- Volume > 1.5× average
- Ranked by momentum score; top 3 daily, top 3 weekly (best of the week's dailies)

**Why it's valuable:** This is the premium product. "Top 5 day trade candidates every morning" with rationale directly ties into lessons. It's interpretation + curation, not raw data.

**Data flow:**
1. Read today's smart movers, pattern alerts, and momentum scans from DB
2. Cross-reference: find symbols that appear in multiple services
3. Rank by composite score, apply filters
4. Generate rationale string per pick
5. Store in `stock_picks`

---

## 6. Market Insights

**What it does:** Generates rules-based "AI-style" interpretations of the day's market activity. Instead of "TSLA up 5%", it produces "TSLA up 5% on 3× volume, breaking weekly resistance — momentum scanner score 85."

**Insight types:**
- `volume_spike` — "XYZ surged on 4× average volume"
- `breakout` — "XYZ broke above 20-day high"
- `sector_rotation` — "Energy sector leading, up 2.3% this week"
- `pattern_match` — "XYZ showing golden cross on daily chart"
- `momentum_leader` — "Top momentum score: XYZ at 92/100"

**Why it's valuable:** People pay for *interpretation*, not data. A daily summary email or "market open recap" with these insights is a high-value deliverable.

**Data flow:**
1. Read today's results from all other services (movers, patterns, sectors, momentum)
2. Apply rules to generate insight strings
3. Group by type, limit to top 10 insights
4. Store in `market_insights`
5. Website shows daily insights feed; can also power email digests

---

## Existing Services (Unchanged)

| Service | File | Purpose |
|---------|------|---------|
| Alpaca Bars | `src/services/alpaca-bars.ts` | Fetch OHLC bar data from Alpaca |
| Alpaca Movers | `src/services/alpaca-movers.ts` | Fetch raw top gainers/losers |
| Trending | `src/services/trending.ts` | Top N symbols by volume |
| Aggregate News | `src/services/aggregate-news.ts` | Merge news from Alpaca/Finnhub/AlphaVantage |
| Ollama | `src/services/ollama.ts` | LLM tweet generation |
| X Post | `src/services/x-post.ts` | Post to Twitter/X |
| Templates | `src/services/templates.ts` | Fallback tweet templates |

---

## Adding a New Service

1. Create the service file in `src/services/`
2. Create a job file in `src/jobs/` that calls the service and stores results
3. Add the Supabase table in `db/migrations/`
4. Add a cron entry in `src/scheduler.ts`
5. Add an API endpoint in `src/dashboard-server.ts`
6. Update this document
