-- 002_service_tiers.sql
-- Defines which service belongs to which pricing tier (free, $4.99, $9.99).
-- Frontend reads this table to show "what you get" per plan and to gate data access.
-- Apply in Supabase SQL Editor (or supabase db push if using CLI).

-- ============================================================
-- service_tiers
-- ============================================================
CREATE TABLE IF NOT EXISTS service_tiers (
  service_key  text PRIMARY KEY,
  tier         text NOT NULL CHECK (tier IN ('free', '4_99', '9_99')),
  name         text NOT NULL,
  description  text NOT NULL,
  table_name   text,
  sort_order   integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_service_tiers_tier ON service_tiers (tier);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE service_tiers ENABLE ROW LEVEL SECURITY;

-- Public read so frontend (anon) can show pricing and gate by tier
CREATE POLICY "Public read service_tiers" ON service_tiers FOR SELECT USING (true);

-- ============================================================
-- Seed: one row per service
-- ============================================================
INSERT INTO service_tiers (service_key, tier, name, description, table_name, sort_order) VALUES
  ('smart_movers',     'free',  'Smart Movers',      'Top gainers and losers with volume context, 52-week high proximity, and price tier. Updated every 30 min during market hours.',                    'smart_movers',     1),
  ('momentum_scans',   'free',  'Momentum Scanner',  'Composite 0–100 momentum score per stock (price, volume, RSI, trend). Refreshed every 30 min during market hours.',                             'momentum_scans',   2),
  ('sector_momentum',  'free',  'Sector Momentum',    'Ranking of 11 GICS sectors with 1-week and 1-month performance and top/bottom stocks. Daily after market close.',                              'sector_momentum', 3),
  ('pattern_scan',     '4_99',  'Pattern Scan',       'Head & shoulders and other chart patterns across multiple timeframes (1D 1Y/2Y, 1M 3Y/5Y). Daily after close.',                                NULL,              4),
  ('pattern_alerts',   '4_99',  'Pattern Alerts',     'Moving average crossovers (50/200), breakouts, and bullish engulfing alerts per symbol. Daily after close.',                                 'pattern_alerts',   5),
  ('stock_picks',      '4_99',  'Stock Picks',        'Daily and weekly picks that combine movers, patterns, and momentum into ranked ideas with rationale.',                                         'stock_picks',      6),
  ('market_insights',  '9_99',  'Market Insights',    'Human-style summaries of the day: volume spikes, breakouts, sector rotation, pattern matches, and momentum leaders.',                         'market_insights',  7),
  ('tweet',            '9_99',  'Daily Tweet',        'Curated market summary tweet (news + insights) posted to X. Optional; runs only when RUN_TWEET_JOB is enabled.',                              NULL,              8)
ON CONFLICT (service_key) DO UPDATE SET
  tier        = EXCLUDED.tier,
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  table_name  = EXCLUDED.table_name,
  sort_order  = EXCLUDED.sort_order;
