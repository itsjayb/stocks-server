-- 001_create_tables.sql
-- Creates all service tables for the stocks-server platform.
-- Apply via Supabase CLI (supabase db push) or paste into the SQL Editor.

-- ============================================================
-- 1. smart_movers
-- ============================================================
CREATE TABLE IF NOT EXISTS smart_movers (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_date   date NOT NULL,
  scanned_at  timestamptz NOT NULL DEFAULT now(),
  symbol      text NOT NULL,
  direction   text NOT NULL CHECK (direction IN ('gainer', 'loser')),
  percent_change numeric NOT NULL,
  price       numeric NOT NULL,
  change      numeric NOT NULL,
  volume      bigint,
  avg_volume_20d bigint,
  volume_ratio   numeric,
  high_52w       numeric,
  pct_from_52w_high numeric,
  unusual_volume boolean DEFAULT false,
  near_52w_high  boolean DEFAULT false,
  price_tier     text CHECK (price_tier IN ('penny', 'small', 'mid', 'large'))
);

CREATE INDEX IF NOT EXISTS idx_smart_movers_date ON smart_movers (scan_date);
CREATE INDEX IF NOT EXISTS idx_smart_movers_symbol ON smart_movers (symbol);
CREATE INDEX IF NOT EXISTS idx_smart_movers_direction ON smart_movers (direction);
CREATE INDEX IF NOT EXISTS idx_smart_movers_unusual ON smart_movers (unusual_volume) WHERE unusual_volume = true;
CREATE INDEX IF NOT EXISTS idx_smart_movers_tier ON smart_movers (price_tier);

-- ============================================================
-- 2. pattern_alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS pattern_alerts (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_date    date NOT NULL,
  scanned_at   timestamptz NOT NULL DEFAULT now(),
  symbol       text NOT NULL,
  pattern_type text NOT NULL,
  timeframe    text,
  pattern_date text,
  details      jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_pattern_alerts_date ON pattern_alerts (scan_date);
CREATE INDEX IF NOT EXISTS idx_pattern_alerts_symbol ON pattern_alerts (symbol);
CREATE INDEX IF NOT EXISTS idx_pattern_alerts_type ON pattern_alerts (pattern_type);

-- ============================================================
-- 3. sector_momentum
-- ============================================================
CREATE TABLE IF NOT EXISTS sector_momentum (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_date     date NOT NULL,
  scanned_at    timestamptz NOT NULL DEFAULT now(),
  sector        text NOT NULL,
  rank          integer NOT NULL,
  avg_change_1w numeric,
  avg_change_1m numeric,
  top_stocks    jsonb DEFAULT '[]'::jsonb,
  bottom_stocks jsonb DEFAULT '[]'::jsonb,
  commentary    text
);

CREATE INDEX IF NOT EXISTS idx_sector_momentum_date ON sector_momentum (scan_date);
CREATE INDEX IF NOT EXISTS idx_sector_momentum_sector ON sector_momentum (sector);
CREATE INDEX IF NOT EXISTS idx_sector_momentum_rank ON sector_momentum (rank);

-- ============================================================
-- 4. momentum_scans
-- ============================================================
CREATE TABLE IF NOT EXISTS momentum_scans (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_date       date NOT NULL,
  scanned_at      timestamptz NOT NULL DEFAULT now(),
  symbol          text NOT NULL,
  score           integer NOT NULL CHECK (score >= 0 AND score <= 100),
  price           numeric,
  price_change_5d numeric,
  volume_ratio    numeric,
  rsi_14          numeric,
  above_sma_20    boolean DEFAULT false,
  price_score     integer DEFAULT 0,
  volume_score    integer DEFAULT 0,
  rsi_score       integer DEFAULT 0,
  trend_score     integer DEFAULT 0,
  price_tier      text CHECK (price_tier IN ('penny', 'small', 'mid', 'large'))
);

CREATE INDEX IF NOT EXISTS idx_momentum_scans_date ON momentum_scans (scan_date);
CREATE INDEX IF NOT EXISTS idx_momentum_scans_symbol ON momentum_scans (symbol);
CREATE INDEX IF NOT EXISTS idx_momentum_scans_score ON momentum_scans (score DESC);

-- ============================================================
-- 5. stock_picks
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_picks (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pick_date         date NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  symbol            text NOT NULL,
  pick_type         text NOT NULL CHECK (pick_type IN ('daily', 'weekly')),
  rank              integer NOT NULL,
  momentum_score    integer,
  patterns_detected jsonb DEFAULT '[]'::jsonb,
  price             numeric,
  volume_ratio      numeric,
  percent_change    numeric,
  rationale         text,
  signals           jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_stock_picks_date ON stock_picks (pick_date);
CREATE INDEX IF NOT EXISTS idx_stock_picks_symbol ON stock_picks (symbol);
CREATE INDEX IF NOT EXISTS idx_stock_picks_type ON stock_picks (pick_type);

-- ============================================================
-- 6. market_insights
-- ============================================================
CREATE TABLE IF NOT EXISTS market_insights (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  insight_date date NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  insight_type text NOT NULL,
  symbol       text,
  title        text NOT NULL,
  body         text NOT NULL,
  data         jsonb DEFAULT '{}'::jsonb,
  priority     integer DEFAULT 5
);

CREATE INDEX IF NOT EXISTS idx_market_insights_date ON market_insights (insight_date);
CREATE INDEX IF NOT EXISTS idx_market_insights_type ON market_insights (insight_type);
CREATE INDEX IF NOT EXISTS idx_market_insights_priority ON market_insights (priority);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE smart_movers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_alerts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sector_momentum ENABLE ROW LEVEL SECURITY;
ALTER TABLE momentum_scans  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_picks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_insights ENABLE ROW LEVEL SECURITY;

-- Public read access (website uses anon key)
CREATE POLICY "Public read smart_movers"    ON smart_movers    FOR SELECT USING (true);
CREATE POLICY "Public read pattern_alerts"  ON pattern_alerts  FOR SELECT USING (true);
CREATE POLICY "Public read sector_momentum" ON sector_momentum FOR SELECT USING (true);
CREATE POLICY "Public read momentum_scans"  ON momentum_scans  FOR SELECT USING (true);
CREATE POLICY "Public read stock_picks"     ON stock_picks     FOR SELECT USING (true);
CREATE POLICY "Public read market_insights" ON market_insights FOR SELECT USING (true);

-- Service role write access (server jobs use service key)
CREATE POLICY "Service write smart_movers"    ON smart_movers    FOR INSERT WITH CHECK (true);
CREATE POLICY "Service write pattern_alerts"  ON pattern_alerts  FOR INSERT WITH CHECK (true);
CREATE POLICY "Service write sector_momentum" ON sector_momentum FOR INSERT WITH CHECK (true);
CREATE POLICY "Service write momentum_scans"  ON momentum_scans  FOR INSERT WITH CHECK (true);
CREATE POLICY "Service write stock_picks"     ON stock_picks     FOR INSERT WITH CHECK (true);
CREATE POLICY "Service write market_insights" ON market_insights FOR INSERT WITH CHECK (true);
