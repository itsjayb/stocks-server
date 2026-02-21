/**
 * Shared types for the stocks-server project.
 */

// ---------------------------------------------------------------------------
// Core / existing
// ---------------------------------------------------------------------------

export interface NewsItem {
  headline: string;
  summary: string;
  url: string;
  source: string;
  date: string;
}

export interface OhlcBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type BarsMap = Record<string, OhlcBar[]>;

export interface PostTweetResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface PatternScanConfig {
  useMasterList?: boolean;
  limit?: number;
  symbols?: string[];
}

export interface PatternScanResultItem {
  symbol: string;
  patterns: Array<{ type: string; date: string }>;
  /** e.g. "1D-1Y", "1D-2Y", "1M-3Y", "1M-5Y" – which timeframe/lookback produced this result. */
  lookback?: string;
}

export interface PatternScanResult {
  results: PatternScanResultItem[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Price tiers
// ---------------------------------------------------------------------------

export type PriceTier = 'penny' | 'small' | 'mid' | 'large';

export function getPriceTier(price: number): PriceTier {
  if (price < 5) return 'penny';
  if (price <= 20) return 'small';
  if (price <= 100) return 'mid';
  return 'large';
}

// ---------------------------------------------------------------------------
// Smart Movers
// ---------------------------------------------------------------------------

export interface SmartMover {
  symbol: string;
  direction: 'gainer' | 'loser';
  percent_change: number;
  price: number;
  change: number;
  volume: number;
  avg_volume_20d: number;
  volume_ratio: number;
  high_52w: number;
  pct_from_52w_high: number;
  unusual_volume: boolean;
  near_52w_high: boolean;
  price_tier: PriceTier;
}

export interface SmartMoversResult {
  scan_date: string;
  scanned_at: string;
  movers: SmartMover[];
}

// ---------------------------------------------------------------------------
// Pattern Alerts
// ---------------------------------------------------------------------------

export interface PatternAlert {
  symbol: string;
  pattern_type: string;
  timeframe: string;
  pattern_date: string;
  details: Record<string, unknown>;
}

export interface PatternAlertsResult {
  scan_date: string;
  scanned_at: string;
  alerts: PatternAlert[];
}

// ---------------------------------------------------------------------------
// Sector Momentum
// ---------------------------------------------------------------------------

export interface SectorStock {
  symbol: string;
  change_1w: number;
  change_1m: number;
}

export interface SectorMomentumRow {
  sector: string;
  rank: number;
  avg_change_1w: number;
  avg_change_1m: number;
  top_stocks: SectorStock[];
  bottom_stocks: SectorStock[];
  commentary: string;
}

export interface SectorMomentumResult {
  scan_date: string;
  scanned_at: string;
  sectors: SectorMomentumRow[];
}

// ---------------------------------------------------------------------------
// Momentum Scanner
// ---------------------------------------------------------------------------

export interface MomentumScanRow {
  symbol: string;
  score: number;
  price: number;
  price_change_5d: number;
  volume_ratio: number;
  rsi_14: number;
  above_sma_20: boolean;
  price_score: number;
  volume_score: number;
  rsi_score: number;
  trend_score: number;
  price_tier: PriceTier;
}

export interface MomentumScanResult {
  scan_date: string;
  scanned_at: string;
  scans: MomentumScanRow[];
}

// ---------------------------------------------------------------------------
// Stock Picks
// ---------------------------------------------------------------------------

export interface StockPick {
  symbol: string;
  pick_type: 'daily' | 'weekly';
  rank: number;
  momentum_score: number;
  patterns_detected: string[];
  price: number;
  volume_ratio: number;
  percent_change: number;
  rationale: string;
  signals: Record<string, unknown>;
}

export interface StockPicksResult {
  pick_date: string;
  created_at: string;
  picks: StockPick[];
}

// ---------------------------------------------------------------------------
// Market Insights
// ---------------------------------------------------------------------------

export type InsightType =
  | 'volume_spike'
  | 'breakout'
  | 'sector_rotation'
  | 'pattern_match'
  | 'momentum_leader';

export interface MarketInsight {
  insight_type: InsightType;
  symbol: string | null;
  title: string;
  body: string;
  data: Record<string, unknown>;
  priority: number;
}

export interface MarketInsightsResult {
  insight_date: string;
  created_at: string;
  insights: MarketInsight[];
}
