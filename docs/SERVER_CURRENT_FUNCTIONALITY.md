# Server Current Functionality

This document describes what the `stocks-server` does today.

---

## Overview

`stocks-server` is a **stock market news-to-tweet automation pipeline** with a **chart pattern scanner** and a **web dashboard**. It is a Node.js/TypeScript application designed to run on a Raspberry Pi (or any server) and do three things:

1. **Automatically generate and post tweets** about stock market news to X (Twitter), promoting the site [learnstockmarket.online](https://learnstockmarket.online).
2. **Scan hundreds of stock tickers for chart patterns** (e.g. head & shoulders) using historical OHLC data and a Python pattern-detection script.
3. **Serve a web dashboard** that displays the latest pattern-scan results.

---

## Components

### 1. Tweet Pipeline (`src/jobs/tweet-job.ts`)

The core automation loop. When triggered, it:

1. **Fetches market news** in parallel from three APIs:
   - **Alpaca News** (`src/services/news/alpaca.ts`) — pulls recent news for symbols like AAPL, TSLA, SPY via Alpaca's v1beta1 news endpoint.
   - **Finnhub** (`src/services/news/finnhub.ts`) — pulls general market news using a free Finnhub API key.
   - **Alpha Vantage** (`src/services/news/alphavantage.ts`) — pulls NEWS_SENTIMENT data for select tickers.

2. **Aggregates and deduplicates** the news items (`src/services/aggregate-news.ts`): combines all sources, removes duplicates by URL/headline, sorts by date, and keeps the top 10 items.

3. **Builds an LLM prompt**: constructs a prompt that includes a description of learnstockmarket.online (chart patterns, trading strategies, lessons) and the aggregated news, asking the model to write a single tweet under 280 characters.

4. **Sends the prompt to Ollama** (`src/services/ollama.ts`): calls an Ollama instance (typically running on a Raspberry Pi) to generate the tweet text. It auto-detects available models (preferring llama3.2, gemma2:2b, mistral, etc.) and has a 2-minute timeout. If the model isn't found, it retries without specifying a model.

5. **Falls back to templates** (`src/services/templates.ts`) if the LLM fails or returns empty: uses a random pre-written template, optionally incorporating the top headline from the fetched news.

6. **Appends trending cash-tags**: uses the Alpaca bars API (`src/services/trending.ts`) to find the top 3 symbols by daily volume from a candidate list, then appends rotating `$SYMBOL` cash-tags to the tweet.

7. **Posts to X/Twitter** (`src/services/x-post.ts`): uses OAuth 1.0a (via the `oauth-1.0a` library) to call the Twitter v2 API. Handles duplicate-content errors (appends a suffix and retries), rate limits (exponential backoff), and server errors (up to 3 attempts). The tweet is truncated to 280 characters before posting.

**Controls:**
- `DRY_RUN=true` — runs the full pipeline but skips posting.
- `SKIP_POST=true` — same as dry run, alternative flag.
- `POST_START_DATE=YYYY-MM-DD` — the job runs on schedule but silently skips posting before this date.

### 2. Chart Pattern Scanner (`src/jobs/pattern-scan-job.ts`)

A batch job that scans stocks for technical chart patterns:

1. **Loads symbols** from `config/stocks-to-scan.json`. Supports either an explicit list of tickers or pulling from the master list of ~3,000+ tickers in `src/stocks.ts`, optionally limited to the first N.

2. **Fetches OHLC bar data** from Alpaca's Market Data API v2 (`src/services/alpaca-bars.ts`) for multiple timeframes:
   - Daily bars, 1-year lookback (1D-1Y)
   - Daily bars, 2-year lookback (1D-2Y)
   - Monthly bars, 3-year lookback (1M-3Y)
   - Monthly bars, 5-year lookback (1M-5Y)

3. **Runs a Python pattern-detection script** (`python/pattern_scan.py`) using the `tradingpattern` library (pandas/numpy). The Node process pipes OHLC JSON to Python via stdin and reads results from stdout.

4. **Batches requests** (100 symbols at a time) with a 3-second delay between batches to respect API limits.

5. **Merges results** across all timeframes and saves output to:
   - `output/pattern-results-YYYY-MM-DD.json` (dated file)
   - `output/latest.json` (always-current file used by the dashboard API)

### 3. Market Movers (`src/jobs/movers-job.ts`)

A utility/test script that fetches the top gainers and losers from Alpaca's Screener API (`src/services/alpaca-movers.ts`) and prints them to the console.

### 4. Dashboard Server (`src/dashboard-server.ts`)

An Express.js (v5) HTTP server on port 3000 that:

- **`GET /api/pattern-results`** — returns the contents of `output/latest.json` (the most recent pattern-scan results).
- **Serves the Vue.js SPA** from `dashboard/dist/` (if built) with SPA fallback routing.
- If the dashboard hasn't been built, serves a simple HTML page with a link to the API endpoint.

The **Vue dashboard** (`dashboard/`) displays pattern-scan results in a card grid, showing each symbol's detected patterns with links to TradingView charts. It includes pagination for large result sets.

### 5. Scheduler (`src/scheduler.ts`)

A `node-cron`-based scheduler that orchestrates the jobs:

- **Pattern scan**: runs daily at 3:00 PM Central.
- **Tweet job**: runs 6 times per day (8:00, 10:00, 12:00, 14:00, 16:00, 18:00) but only if `RUN_TWEET_JOB=true`.

### 6. PM2 Process Management (`ecosystem.config.cjs`)

Production deployment uses PM2 to run two persistent processes:
- `pattern-scheduler` — the cron scheduler
- `dashboard` — the Express web server

---

## External APIs Used

| API | Purpose | Auth |
|-----|---------|------|
| **Alpaca Market Data** | News, OHLC bars, market movers, trending volume | API key + secret |
| **Finnhub** | Market news | API key |
| **Alpha Vantage** | News sentiment | API key |
| **Ollama** (self-hosted) | LLM tweet generation | None (local network) |
| **X/Twitter API v2** | Posting tweets | OAuth 1.0a |

---

## Tech Stack

- **Runtime**: Node.js 18+ (TypeScript via `tsx`)
- **HTTP server**: Express 5
- **Scheduling**: `node-cron`
- **Twitter auth**: `oauth-1.0a`
- **LLM**: Ollama (self-hosted, e.g. on Raspberry Pi)
- **Pattern detection**: Python 3.10+ with `tradingpattern`, `pandas`, `numpy`
- **Dashboard**: Vue.js SPA
- **Process manager**: PM2
