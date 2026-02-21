/**
 * Shared types for the stocks-server project.
 */

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
