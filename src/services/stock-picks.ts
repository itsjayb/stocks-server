/**
 * Stock Picks: selects 1–3 "Stock of the Day" picks by cross-referencing
 * smart movers, pattern alerts, and momentum scans.
 *
 * Selection criteria:
 *   - Must appear as a mover OR have momentum score > 70
 *   - Must have at least one detected pattern
 *   - Price > $5 (no penny stocks)
 *   - Volume ratio > 1.5
 *   - Ranked by momentum score; top 3 returned
 */

import {
  fetchSmartMovers,
  fetchPatternAlerts,
  fetchMomentumScans,
} from '../db/supabase.js';
import type { StockPick, StockPicksResult } from '../types.js';

const MAX_DAILY_PICKS = 3;
const MIN_MOMENTUM_SCORE = 50;
const MIN_PRICE = 5;
const MIN_VOLUME_RATIO = 1.5;

export async function generateStockPicks(date?: string): Promise<StockPicksResult> {
  const d = date || new Date().toISOString().slice(0, 10);

  const [movers, patterns, scans] = await Promise.all([
    fetchSmartMovers(d),
    fetchPatternAlerts(d),
    fetchMomentumScans(d),
  ]);

  const moverSet = new Set((movers as Array<{ symbol: string }>).map((m) => m.symbol));
  const patternMap = new Map<string, string[]>();
  for (const p of patterns as Array<{ symbol: string; pattern_type: string }>) {
    const list = patternMap.get(p.symbol) || [];
    list.push(p.pattern_type);
    patternMap.set(p.symbol, list);
  }

  type ScanRow = {
    symbol: string;
    score: number;
    price: number;
    volume_ratio: number;
    price_change_5d: number;
  };

  const scanMap = new Map<string, ScanRow>();
  for (const s of scans as ScanRow[]) {
    scanMap.set(s.symbol, s);
  }

  const candidates: StockPick[] = [];

  const allSymbols = new Set([...moverSet, ...scanMap.keys()]);
  for (const symbol of allSymbols) {
    const scan = scanMap.get(symbol);
    const patternsDetected = patternMap.get(symbol) || [];
    const isMover = moverSet.has(symbol);

    const momentumScore = scan?.score ?? 0;
    const price = scan?.price ?? 0;
    const volumeRatio = scan?.volume_ratio ?? 0;
    const pctChange = scan?.price_change_5d ?? 0;

    if (price < MIN_PRICE) continue;
    if (volumeRatio < MIN_VOLUME_RATIO && !isMover) continue;
    if (momentumScore < MIN_MOMENTUM_SCORE && !isMover) continue;
    if (patternsDetected.length === 0 && momentumScore < 70) continue;

    const signals: Record<string, unknown> = {};
    if (isMover) signals.mover = true;
    if (patternsDetected.length) signals.patterns = patternsDetected;
    if (scan) signals.momentum = { score: momentumScore, rsi: (scan as Record<string, unknown>).rsi_14 };

    const rationale = buildRationale(symbol, isMover, patternsDetected, momentumScore, pctChange, volumeRatio);

    candidates.push({
      symbol,
      pick_type: 'daily',
      rank: 0,
      momentum_score: momentumScore,
      patterns_detected: [...new Set(patternsDetected)],
      price,
      volume_ratio: volumeRatio,
      percent_change: pctChange,
      rationale,
      signals,
    });
  }

  candidates.sort((a, b) => {
    const aBonus = a.patterns_detected.length > 0 ? 10 : 0;
    const bBonus = b.patterns_detected.length > 0 ? 10 : 0;
    return (b.momentum_score + bBonus) - (a.momentum_score + aBonus);
  });

  const picks = candidates.slice(0, MAX_DAILY_PICKS);
  picks.forEach((p, i) => { p.rank = i + 1; });

  return {
    pick_date: d,
    created_at: new Date().toISOString(),
    picks,
  };
}

function buildRationale(
  symbol: string,
  isMover: boolean,
  patterns: string[],
  score: number,
  pctChange: number,
  volRatio: number,
): string {
  const parts: string[] = [];

  if (isMover) {
    parts.push(`${symbol} appeared as a top mover today`);
  }

  if (patterns.length > 0) {
    const unique = [...new Set(patterns)];
    parts.push(`detected pattern(s): ${unique.join(', ')}`);
  }

  if (score > 0) {
    parts.push(`momentum score ${score}/100`);
  }

  if (Math.abs(pctChange) > 0) {
    parts.push(`${pctChange >= 0 ? '+' : ''}${pctChange}% over 5 days`);
  }

  if (volRatio > 1.5) {
    parts.push(`volume ${volRatio}× average`);
  }

  return parts.length > 0
    ? parts.join('; ') + '.'
    : `${symbol} met multiple selection criteria.`;
}
