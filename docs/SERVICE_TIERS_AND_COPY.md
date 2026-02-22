# Service Tiers and User-Facing Copy

Use this for your pricing page and to explain to users what each service provides before they buy.

---

## Database change (Supabase Editor)

Run this in **Supabase → SQL Editor** (or apply `db/migrations/002_service_tiers.sql`):

1. **Create the table** and **insert seed rows** by pasting the contents of `db/migrations/002_service_tiers.sql`.
2. No changes to existing tables (`smart_movers`, `pattern_alerts`, etc.) are required.

The new table is **`service_tiers`**:

| Column        | Type    | Purpose |
|---------------|---------|--------|
| `service_key` | text PK | Id used in code: e.g. `smart_movers`, `pattern_scan` |
| `tier`        | text    | `free`, `4_99`, or `9_99` |
| `name`        | text    | Short display name |
| `description` | text    | 1–2 sentences for “what you get” |
| `table_name`  | text    | Supabase table that holds this service’s data (null if not in DB) |
| `sort_order`  | integer | Order to show in UI |

Frontend can:

- `SELECT * FROM service_tiers ORDER BY sort_order` to build pricing and “what’s included” (with anon key; RLS allows read).
- Gate which data the user can see: e.g. if `user.plan === 'free'`, only show or fetch data for services where `tier === 'free'` (using `table_name` to know which table to query).

---

## What to tell the frontend each service provides

Below is the **user-facing copy** you can show before they buy. The same text is in the `service_tiers.description` seed so the frontend can also read it from Supabase.

---

### Free tier

| Service          | Name              | What the user gets |
|------------------|-------------------|--------------------|
| **smart_movers** | Smart Movers      | Top gainers and losers with volume context, 52-week high proximity, and price tier. Updated every 30 min during market hours. |
| **momentum_scans** | Momentum Scanner | Composite 0–100 momentum score per stock (price, volume, RSI, trend). Refreshed every 30 min during market hours. |
| **sector_momentum** | Sector Momentum | Ranking of 11 GICS sectors with 1-week and 1-month performance and top/bottom stocks. Daily after market close. |

**Data source for frontend:** Supabase tables `smart_movers`, `momentum_scans`, `sector_momentum` (filter by `scan_date`).

---

### $4.99 tier

| Service         | Name           | What the user gets |
|-----------------|----------------|--------------------|
| **pattern_scan** | Pattern Scan   | Head & shoulders and other chart patterns across multiple timeframes (1D 1Y/2Y, 1M 3Y/5Y). Daily after close. |
| **pattern_alerts** | Pattern Alerts | Moving average crossovers (50/200), breakouts, and bullish engulfing alerts per symbol. Daily after close. |
| **stock_picks** | Stock Picks     | Daily and weekly picks that combine movers, patterns, and momentum into ranked ideas with rationale. |

**Data source for frontend:**

- `pattern_scan`: currently **file-based** on the Pi (dashboard API `GET /api/pattern-results`). If you move this to Supabase later, add a table and set `table_name` in `service_tiers`.
- `pattern_alerts`: Supabase `pattern_alerts` (by `scan_date`).
- `stock_picks`: Supabase `stock_picks` (by `pick_date`).

---

### $9.99 tier

| Service          | Name           | What the user gets |
|------------------|----------------|--------------------|
| **market_insights** | Market Insights | Human-style summaries of the day: volume spikes, breakouts, sector rotation, pattern matches, and momentum leaders. |
| **tweet**        | Daily Tweet    | Curated market summary tweet (news + insights) posted to X. Optional; runs only when RUN_TWEET_JOB is enabled. |

**Data source for frontend:**

- `market_insights`: Supabase `market_insights` (by `insight_date`).
- `tweet`: No table; it’s a distribution feature. You can describe it as “daily tweet to X” on the pricing page.

---

## Summary for frontend

- **Tier mapping:** Stored in Supabase `service_tiers`. Use `tier` to show “Free / $4.99 / $9.99” and to decide what data the user can access.
- **Copy:** Use `name` and `description` from `service_tiers` (or the table above) for pricing and “what’s included” text.
- **Data access:** Use `table_name` to know which Supabase table to query for each service (and which date column: `scan_date`, `pick_date`, or `insight_date`). For `pattern_scan`, use the Pi dashboard API until you add a Supabase table. For `tweet`, there is no data table.
