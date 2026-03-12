# Tweeting Strategy

An automated stock-market tweet pipeline that fetches financial news, enriches it with AI-generated commentary, and posts to X (Twitter) on a schedule during market hours.

---

## 1. Scheduling

Tweets are posted **6 times per day on weekdays** (Mon–Fri) at **8am, 10am, 12pm, 2pm, 4pm, and 6pm CT**, managed via `node-cron` in `src/scheduler.ts`. The job only runs when `RUN_TWEET_JOB=true`. PM2 is used in production via `ecosystem.config.cjs`.

---

## 2. News Aggregation (3 Sources)

Each tweet job fetches news in parallel from three financial APIs:

| Source           | API              | Key File                           |
| ---------------- | ---------------- | ---------------------------------- |
| **Alpaca**       | `v1beta1/news`   | `src/services/news/alpaca.ts`      |
| **Finnhub**      | `api/v1/news`    | `src/services/news/finnhub.ts`     |
| **Alpha Vantage** | `NEWS_SENTIMENT` | `src/services/news/alphavantage.ts` |

The `aggregateNews()` function in `src/services/aggregate-news.ts` then **deduplicates** (by URL or headline prefix), **sorts by date** (newest first), and **caps at 10 items** — all normalized to a common shape (`headline`, `summary`, `url`, `source`, `date`).

---

## 3. Tweet Type Selection

Each run randomly picks one of three tweet types via `pickTweetType()`:

- **`news`** — Commentary on a recent headline.
- **`pattern`** — Promotes a chart pattern (e.g., double bottom, head & shoulders).
- **`strategy`** — Promotes a trading strategy (e.g., momentum, mean reversion).

Patterns and strategies are loaded from `config/patterns-and-strategies.json`, rotated deterministically using a time-based formula: `(dayOfMonth * 24 + hour) % length`.

---

## 4. Symbol & Ticker Selection

- **Candidate symbols** come from `config/stocks-to-scan.json`, which either references a master list in `src/stocks.ts` (up to 500 tickers) or an explicit symbol array.
- **Trending symbols** are determined by daily volume using Alpaca bars (`src/services/trending.ts`).
- **Smart Movers** (`src/services/smart-movers.ts`) use Alpaca's movers endpoint plus volume, 52-week high, and price tier filters as a secondary signal.

---

## 5. AI-Powered Tweet Generation

A prompt is built by `buildPromptForType()` with type-specific instructions (e.g., include a headline for news, include a pattern name/description for pattern tweets). This is sent to a **local Ollama LLM** (default model: `llama3.2:latest`) via `src/services/ollama.ts`.

**Prompt rules enforced:**

- Natural, human tone
- No quotation marks
- Short sentences
- Under 280 characters
- Output only the tweet text

The LLM call has **3 retries** with exponential backoff and a 60-second timeout. If the HTTP API fails, it falls back to the `ollama run` CLI.

---

## 6. Fallback Templates

If the LLM fails or returns empty text, `getFallbackTweet()` in `src/services/templates.ts` picks from a pool of pre-written templates with placeholders like `{headline}`, `{name}`, `{description}`, and `{url}`. Output is truncated to 280 characters.

---

## 7. Cash Tag Enrichment

After generation, cash tags (e.g., `$AAPL`) are appended if the LLM didn't include any:

- **News tweets** — Top 3 tickers from Smart Movers (gainers), falling back to trending, then first 3 candidates.
- **Strategy tweets** — `$SPY $QQQ $XLF`.
- **Pattern tweets** — No tickers appended (keeps focus on the pattern itself).

---

## 8. Deduplication & Posting

- The tweet is compared against `config/last_tweet.txt` — if identical, it's skipped.
- Posting is done via **OAuth 1.0a** to the **X API v2** in `src/services/x-post.ts`.
- `DRY_RUN=true` or `SKIP_POST=true` can suppress actual posting for testing.

---

## Data Flow

```
News APIs (Alpaca, Finnhub, Alpha Vantage)
        │
        ▼
  Aggregate & Deduplicate (10 items max)
        │
        ▼
  Pick Tweet Type (news / pattern / strategy)
        │
        ▼
  Build Prompt + Load Pattern/Strategy config
        │
        ▼
  Ollama LLM ──(fail)──► Fallback Templates
        │
        ▼
  Append Cash Tags (Smart Movers / Trending)
        │
        ▼
  Dedup Check vs last_tweet.txt
        │
        ▼
  Post to X (OAuth 1.0a, API v2)
```

---

## Environment Variables

| Variable                        | Purpose                                  |
| ------------------------------- | ---------------------------------------- |
| `VITE_ALPACA_API_KEY`           | Alpaca news + market data                |
| `VITE_ALPACA_SECRET_KEY`        | Alpaca authentication                    |
| `VITE_ALPACA_HISTORY_BASE_URL`  | Alpaca base URL                          |
| `FINNHUB_API_KEY`               | Finnhub news                             |
| `ALPHA_VANTAGE_API_KEY`         | Alpha Vantage news                       |
| `X_API_KEY`                     | Twitter OAuth consumer key               |
| `X_API_SECRET`                  | Twitter OAuth consumer secret            |
| `X_ACCESS_TOKEN`                | Twitter OAuth user token                 |
| `X_ACCESS_TOKEN_SECRET`         | Twitter OAuth user token secret          |
| `OLLAMA_BASE_URL`               | Ollama endpoint (default `localhost:11434`) |
| `OLLAMA_MODEL`                  | LLM model (default `llama3.2:latest`)    |
| `OLLAMA_REQUEST_TIMEOUT_MS`     | LLM timeout (default `60000`)            |
| `OLLAMA_MAX_RETRIES`            | LLM retries (default `3`)               |
| `PROMO_WEBSITE_URL`             | Site URL for pattern/strategy links      |
| `DRY_RUN`                       | Skip posting to X                        |
| `SKIP_POST`                     | Skip posting (still writes `last_tweet`) |
| `POST_START_DATE`               | First date to post (`YYYY-MM-DD`)        |
| `RUN_TWEET_JOB`                 | Enable tweet job in scheduler            |

---

## Testing

- **`npm run test:trending`** — Shows candidate symbols, trending (by volume), and Smart Movers without posting.
- **`DRY_RUN=true npm run tweet`** — Runs the full pipeline without posting.
- **`tests/aggregate-news.test.ts`** — Tests aggregation, `buildNewsString`, and `buildPrompt`.
- **`tests/templates.test.ts`** — Tests fallback templates per type.

---

# Boosting the Strategy

A prioritized roadmap for amplifying engagement, emotional resonance, and algorithmic signals. The goal is a mix of automation and human oversight, evolving toward full automation as data accumulates.

---

## 1. Enhance Engagement and Emotional Appeal

### Add CTAs in Prompts/Templates

Modify `buildPromptForType()` to always include a question or opinion prompt at the end, e.g.:

> "Bullish or bearish? Drop your take below!"

This taps into ego and community behavior, boosting replies (a top algo factor). For emotional hooks, use words like **"explosive," "crash,"** or **"hidden gem"** to evoke excitement and fear.

### Incorporate Polls

For 20–30% of tweets (e.g., `news` or `strategy` types), generate polls via the X API (add poll support to `x-post.ts`). Prompt the AI to output poll options, like:

> "Will $AAPL hit $200? Yes / No / Maybe"

Polls skyrocket interactions and are heavily favored by X's algorithm.

### Emotional Framing

Update AI prompts to emphasize behavioral psychology — e.g.:

> "Frame the commentary to highlight greed, fear, or overconfidence in markets."

Test variations with A/B via `DRY_RUN` before going live.

---

## 2. Integrate Multimedia for Algo Boost

### Add Chart Generation

For `pattern`/`strategy` tweets, integrate a library like **Chart.js** or the **QuickChart API** in `src/services/` to auto-generate simple charts (e.g., based on Alpaca bars data). Attach as media to posts. For `news`, pull stock charts via Alpha Vantage. Visuals make abstract concepts tangible, triggering curiosity.

### Image Attachments for News

Use **Unsplash** or a free stock image API to fetch relevant thumbnails (e.g., bull/bear icons). This could double reach, as X prioritizes visual content in feeds.

### Video Potential

For high-engagement days, experiment with short GIFs of price action (generated via **FFmpeg** or similar in Node). Start manual, then automate once the pipeline proves effective.

---

## 3. Refine Scheduling and Selection Logic

### Adaptive Timing

Use X Analytics (manual at first) to identify peak engagement windows — e.g., shift to **9am, 11am, 1pm, 3pm, 5pm, 7pm** if data shows better results. Add logic in `scheduler.ts` to skip posts during low-volatility periods (query Alpaca for market status).

### Weighted Type Selection

Replace the random pick with weighted probabilities in `pickTweetType()`:

| Type       | Weight | Rationale                |
| ---------- | ------ | ------------------------ |
| `news`     | 50%    | Timely and emotional     |
| `pattern`  | 30%    | Educational and evergreen |
| `strategy` | 20%    | Promotional              |

Track performance via a simple log file and adjust weights monthly.

### Event-Driven Triggers

Add a webhook or polling for major events (e.g., Fed announcements via Finnhub) to trigger extra posts, capitalizing on emotional spikes in the market.

---

## 4. Improve Discoverability and Variety

### Hashtags Strategically

Append 1–2 relevant hashtags (e.g., `#StockMarket` `#TradingTips`) only if not exceeding the character limit — overuse dilutes impact. For cashtags, limit to 2–3 to avoid spam flags.

### Threads for Depth

For complex news/patterns, have the AI generate 2–3 tweet threads (use X API's thread endpoint). Threads keep users engaged longer, signaling quality to the algorithm.

### Audience Targeting

In `stocks-to-scan.json`, prioritize sectors based on trends (e.g., tech during earnings season). Use `exclude_usernames` in X tools if integrating feedback loops.

---

## 5. Monitoring and Iteration

### Add Analytics Integration

Post-pipeline, fetch engagement data via X API v2 (e.g., impressions, likes) and log to a file or database. Use this to auto-adjust weights and timing in future runs.

### Human Oversight

Start with `DRY_RUN=true` for a week, review outputs manually for tone and emotional impact, then go live. Periodically fine-tune Ollama prompts based on what resonates (e.g., more hype for gainers).

### Compliance and A/B Testing

Ensure tweets disclose automation if needed (to build trust). Test variations: e.g., one week with visuals vs. without, and measure the uplift in engagement metrics.
