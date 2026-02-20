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
}

export interface PatternScanResult {
  results: PatternScanResultItem[];
  errors: string[];
}
