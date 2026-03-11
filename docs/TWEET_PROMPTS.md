# Tweet Generation: Prompts and Tweet Types

The tweet job uses an LLM (Ollama) plus current market news to generate tweets. To improve views, follows, and page landings, tweets are **rotated by type** and follow strict prompt rules.

---

## Goal of tweet improvements (feature/tweet-improvements-pattern-strategy)

- **Varied cash tags** — News tweets: LLM suggests affected tickers (limit 3); fallback to Smart Movers. Strategy tweets: LLM may include ETFs; fallback to SPY/QQQ/XLF. Pattern tweets: no tickers.
- **Pattern/strategy promo** — **Pattern** tweets promote one pattern (no tickers). **Strategy** tweets promote one strategy (can include tickers/ETFs). Both use `/tw/` URL.
- **Testability** — A script (`npm run test:trending`) shows exactly which symbols would be used as “popular/trending” and as movers, so we can verify behavior without posting.

---

## Goals (content)

- **Educate and build trust** — not every tweet should be an ad.
- **No run-on sentences** — short, punchy copy. No quotation marks (looks real).
- **Separate news from promo** — news tweets are news-only; pattern/strategy tweets promote the site.
- **Mix content** — news, pattern promo, and strategy promo so the feed feels varied and engaging.

---

## Tweet Types (Rotation)

Each run picks one type via **time-based rotation** (`pickTweetType()` in `aggregate-news.ts`): `(dayOfMonth * 24 + hour) % 3`.

| Type      | Purpose | Website link? | Cash tags? |
|-----------|---------|----------------|------------|
| **news**  | Lead with important/current news. Optional sector angle (e.g. Iran → oil). | No | Optional 1–3 (e.g. $XOM $USO $OIL); job may append more |
| **website** | Promote the site with **one** specific pattern or strategy and a concrete hook (e.g. “Head & Shoulders has ~70% success rate when confirmed”). | Yes | No |
| **stocks** | Give a reason to watch 2–4 tickers; tie to news or momentum. | No | Yes (2–4 in tweet); job appends 3 more |

- **news** and **stocks** get **cash tags appended** by the job. Source of those 3 symbols:
  - **news**: top 3 by **volume** from the candidate list (`getTrendingSymbols`).
  - **stocks**: **Smart Movers** (top gainers from Alpaca) when available, else top 3 by volume from candidates. That way topical names (e.g. oil) can show when they’re moving.
- **website** tweets never get cash tags appended.

---

## Symbol selection (candidates and appended cash tags)

- **Candidate list** comes from `config/stocks-to-scan.json`:
  - **`useMasterList: true`** — Use `STOCKS` from `src/stocks.ts` (optionally `limit`, default cap 500 for the tweet job).
  - **`symbols`** — Explicit array of tickers; only symbols present in `STOCKS` are used.
  - If neither yields symbols, fallback is `['SPY', 'AAPL', 'QQQ']`.
- **“Trending”** in this codebase means **top N by latest daily volume** from the candidate list, not “in the news.” So with a tiny list you always get the same names.
- **Test script** — To see what symbols would be returned without posting:
  ```bash
  npm run test:trending
  ```
  Shows: config → candidate count, `getTrendingSymbols(candidates, N)` result, and `getSmartMovers()` top gainers/losers. Env: `TRENDING_TOP=5`, `MOVERS_TOP=10`.

---

## Prompt Rules (All Types)

- Write like a real person. **Do not use quotation marks.**
- Short, punchy sentences. **Under 280 characters** total.
- Output **only** the tweet text. No explanation, no quotes around the tweet.

---

## Type-Specific Instructions (LLM)

- **news**: NEWS ONLY. No website link or CTA. If news suggests a sector (e.g. Iran, conflict, energy), may include 1–3 cash tags like $XOM $USO $OIL.
- **website**: Do NOT paste a long news headline. Focus on **one** pattern or strategy (e.g. Head & Shoulders, double top/bottom). Add a concrete hook (e.g. “known to have roughly a 70% success rate when confirmed”). When config supplies a pattern/strategy (name, description, /tw/ URL), use that URL; otherwise end with site URL.
- **stocks**: Reason to watch 2–4 tickers. Include 2–4 cash tags. Tie to news, momentum, or theme. No website link. Suggested tickers come from config + sector-relevant (e.g. $XOM $USO $OIL for oil).

---

## Files

| File | Role |
|------|------|
| `config/patterns-and-strategies.json` | Reference: pattern/strategy id, name, slug, one-line description. Used to pick one item per pattern/strategy tweet and build `/tw/` URLs. |
| `src/services/pattern-strategy-pick.ts` | `pickPattern()` and `pickStrategy()` for pattern/strategy tweets. Returns name, description, url (`/tw/pattern/:slug` or `/tw/strategy/:slug`). |
| `src/services/aggregate-news.ts` | `buildPromptForType()`, `pickTweetType()`, `buildPrompt()` (defaults to news). Pattern/strategy prompts accept optional `patternOrStrategy`. |
| `src/services/templates.ts` | Fallback templates per type; pattern/strategy fallbacks use `patternOrStrategy` for name, description, url. |
| `src/jobs/tweet-job.ts` | Fetches news, picks type, for pattern/strategy picks pattern or strategy, builds prompt, calls Ollama, appends tickers only when appropriate (news: smart movers fallback; strategy: ETFs fallback; pattern: never). |

---

## Tuning

- **Low views**: Ensure rotation is working (not every tweet is website). Check that news and stocks tweets are punchy and don’t look like ads.
- **More engagement**: Prompts already ask for “real person” tone and no quotes. For website tweets, keep one pattern/strategy + one stat (e.g. 70% success rate).
- **News → sectors**: The prompt tells the LLM to connect themes (e.g. Iran, fighting) to sectors (e.g. oil) and suggest tickers like $XOM $USO $OIL when relevant.
- **Same tickers every time**: Ensure `config/stocks-to-scan.json` has either `"useMasterList": true` (and optional `"limit"`) or a `"symbols"` array. Run `npm run test:trending` to see which symbols the job would use for trending and movers.
