/**
 * Momentum Scanner: computes a composite 0–100 momentum score per stock.
 *
 * Scoring:
 *   price_score  (0–30) — 5-day % change, capped at 30%
 *   volume_score (0–30) — volume ratio (today / 20-day avg), capped at 5×
 *   rsi_score    (0–20) — RSI(14) in the "sweet spot" 40–60 gets max; extreme values score lower
 *   trend_score  (0–20) — above 20-day SMA = 20, below = 0
 */

import { fetchAlpacaBars } from './alpaca-bars.js';
import { computeRSI } from './pattern-alerts.js';
import { getPriceTier, type OhlcBar, type MomentumScanRow, type MomentumScanResult } from '../types.js';

function computeSMA(bars: OhlcBar[], period: number): number {
  if (bars.length < period) return NaN;
  let sum = 0;
  for (let i = bars.length - period; i < bars.length; i++) sum += bars[i].c;
  return sum / period;
}

function computeAvgVolume(bars: OhlcBar[], period = 20): number {
  const slice = bars.slice(-period);
  if (slice.length === 0) return 0;
  return slice.reduce((s, b) => s + b.v, 0) / slice.length;
}

function scorePriceChange(pct: number): number {
  const abs = Math.abs(pct);
  return Math.min(30, Math.round(abs));
}

function scoreVolume(ratio: number): number {
  return Math.min(30, Math.round((ratio / 5) * 30));
}

function scoreRSI(rsi: number): number {
  if (isNaN(rsi)) return 10;
  if (rsi >= 40 && rsi <= 60) return 20;
  if (rsi >= 30 && rsi <= 70) return 15;
  if (rsi >= 20 && rsi <= 80) return 10;
  return 5;
}

function scoreTrend(close: number, sma20: number): number {
  if (isNaN(sma20)) return 10;
  return close >= sma20 ? 20 : 0;
}

export interface MomentumScannerOptions {
  symbols: string[];
  days?: number;
}

export async function runMomentumScan(options: MomentumScannerOptions): Promise<MomentumScanResult> {
  const { symbols, days = 30 } = options;
  if (!symbols.length) {
    return { scan_date: today(), scanned_at: new Date().toISOString(), scans: [] };
  }

  const barsMap = await fetchAlpacaBars(symbols, { days: Math.max(days, 30) });
  const scans: MomentumScanRow[] = [];

  for (const [symbol, bars] of Object.entries(barsMap)) {
    if (!bars || bars.length < 6) continue;

    const lastIdx = bars.length - 1;
    const close = bars[lastIdx].c;
    const fiveDaysAgoIdx = Math.max(0, lastIdx - 5);
    const priceChange5d = bars[fiveDaysAgoIdx].c > 0
      ? Number((((close - bars[fiveDaysAgoIdx].c) / bars[fiveDaysAgoIdx].c) * 100).toFixed(2))
      : 0;

    const avgVol = computeAvgVolume(bars);
    const currentVol = bars[lastIdx].v;
    const volRatio = avgVol > 0 ? Number((currentVol / avgVol).toFixed(2)) : 0;

    const rsiArr = computeRSI(bars);
    const rsi14 = Number((rsiArr[lastIdx] ?? 50).toFixed(2));

    const sma20 = computeSMA(bars, 20);
    const aboveSma20 = !isNaN(sma20) && close >= sma20;

    const ps = scorePriceChange(priceChange5d);
    const vs = scoreVolume(volRatio);
    const rs = scoreRSI(rsi14);
    const ts = scoreTrend(close, sma20);
    const total = Math.min(100, ps + vs + rs + ts);

    scans.push({
      symbol,
      score: total,
      price: close,
      price_change_5d: priceChange5d,
      volume_ratio: volRatio,
      rsi_14: rsi14,
      above_sma_20: aboveSma20,
      price_score: ps,
      volume_score: vs,
      rsi_score: rs,
      trend_score: ts,
      price_tier: getPriceTier(close),
    });
  }

  scans.sort((a, b) => b.score - a.score);

  return {
    scan_date: today(),
    scanned_at: new Date().toISOString(),
    scans,
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
