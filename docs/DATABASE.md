# Database Schema

All service results are stored in Supabase (PostgreSQL). Each service has its own table. The website reads via the Supabase JS client (anon key + RLS). The server writes via the service role key.

---

## Tables

### `smart_movers`

Enriched top gainers/losers with volume analysis and classification.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` (PK) | Auto-generated |
| `scan_date` | `date` | Date of the scan |
| `scanned_at` | `timestamptz` | Exact timestamp |
| `symbol` | `text` | Ticker symbol |
| `direction` | `text` | `gainer` or `loser` |
| `percent_change` | `numeric` | % change from previous close |
| `price` | `numeric` | Current/last price |
| `change` | `numeric` | Dollar change |
| `volume` | `bigint` | Today's volume |
| `avg_volume_20d` | `bigint` | 20-day average volume |
| `volume_ratio` | `numeric` | volume / avg_volume_20d |
| `high_52w` | `numeric` | 52-week high |
| `pct_from_52w_high` | `numeric` | % distance from 52-week high |
| `unusual_volume` | `boolean` | volume_ratio > 2.0 |
| `near_52w_high` | `boolean` | Within 5% of 52-week high |
| `price_tier` | `text` | `penny`, `small`, `mid`, `large` |

**Indexes:** `scan_date`, `symbol`, `direction`, `unusual_volume`, `price_tier`

---

### `pattern_alerts`

Detected chart patterns per symbol per timeframe.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` (PK) | Auto-generated |
| `scan_date` | `date` | Date of the scan |
| `scanned_at` | `timestamptz` | Exact timestamp |
| `symbol` | `text` | Ticker symbol |
| `pattern_type` | `text` | e.g. `head_shoulder`, `golden_cross`, `breakout` |
| `timeframe` | `text` | e.g. `1D-1Y`, `1D-2Y`, `1M-3Y` |
| `pattern_date` | `text` | Date the pattern occurred |
| `details` | `jsonb` | Extra info (e.g. crossover values, breakout level) |

**Indexes:** `scan_date`, `symbol`, `pattern_type`

---

### `sector_momentum`

Sector-level momentum rankings.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` (PK) | Auto-generated |
| `scan_date` | `date` | Date of the scan |
| `scanned_at` | `timestamptz` | Exact timestamp |
| `sector` | `text` | Sector name (e.g. `Technology`) |
| `rank` | `integer` | 1 = best momentum |
| `avg_change_1w` | `numeric` | Avg 1-week % change across sector stocks |
| `avg_change_1m` | `numeric` | Avg 1-month % change across sector stocks |
| `top_stocks` | `jsonb` | Array of `{ symbol, change_1w, change_1m }` |
| `bottom_stocks` | `jsonb` | Array of worst performers |
| `commentary` | `text` | Auto-generated insight string |

**Indexes:** `scan_date`, `sector`, `rank`

---

### `momentum_scans`

Per-stock composite momentum scores.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` (PK) | Auto-generated |
| `scan_date` | `date` | Date of the scan |
| `scanned_at` | `timestamptz` | Exact timestamp |
| `symbol` | `text` | Ticker symbol |
| `score` | `integer` | Composite score 0–100 |
| `price` | `numeric` | Latest close price |
| `price_change_5d` | `numeric` | 5-day % change |
| `volume_ratio` | `numeric` | Today vol / 20-day avg vol |
| `rsi_14` | `numeric` | RSI(14) value |
| `above_sma_20` | `boolean` | Close > 20-day SMA |
| `price_score` | `integer` | 0–30 |
| `volume_score` | `integer` | 0–30 |
| `rsi_score` | `integer` | 0–20 |
| `trend_score` | `integer` | 0–20 |
| `price_tier` | `text` | `penny`, `small`, `mid`, `large` |

**Indexes:** `scan_date`, `symbol`, `score`

---

### `stock_picks`

Curated stock-of-the-day/week selections.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` (PK) | Auto-generated |
| `pick_date` | `date` | Date of the pick |
| `created_at` | `timestamptz` | When the pick was generated |
| `symbol` | `text` | Ticker symbol |
| `pick_type` | `text` | `daily` or `weekly` |
| `rank` | `integer` | 1 = top pick |
| `momentum_score` | `integer` | From momentum scanner |
| `patterns_detected` | `jsonb` | Array of pattern names |
| `price` | `numeric` | Current price |
| `volume_ratio` | `numeric` | Volume ratio |
| `percent_change` | `numeric` | % change |
| `rationale` | `text` | Auto-generated explanation |
| `signals` | `jsonb` | All contributing signals |

**Indexes:** `pick_date`, `symbol`, `pick_type`

---

### `market_insights`

Rules-based market interpretations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` (PK) | Auto-generated |
| `insight_date` | `date` | Date |
| `created_at` | `timestamptz` | When generated |
| `insight_type` | `text` | `volume_spike`, `breakout`, `sector_rotation`, `pattern_match`, `momentum_leader` |
| `symbol` | `text` | Ticker (nullable for sector insights) |
| `title` | `text` | Short headline |
| `body` | `text` | Full insight text |
| `data` | `jsonb` | Supporting numbers |
| `priority` | `integer` | 1 = most important |

**Indexes:** `insight_date`, `insight_type`, `priority`

---

## Migration

The migration file is at `db/migrations/001_create_tables.sql`. Apply it to your Supabase project:

```bash
# Via Supabase CLI
supabase db push

# Or paste into Supabase Dashboard > SQL Editor
```

## Row Level Security

All tables have RLS enabled:
- **Read:** Anyone with the anon key can read (public data for the website)
- **Write:** Only the service role key can insert/update (server-side jobs)
