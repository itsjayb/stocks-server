/**
 * Smart Movers: enriches raw Alpaca top movers with volume analysis,
 * 52-week high proximity, and price tier classification.
 *
 * Turns a boring "top gainers" list into actionable setups by answering:
 *   - Is volume unusual? (> 2× 20-day avg)
 *   - Is it near a 52-week high? (within 5%)
 *   - What price tier? (penny / small / mid / large)
 */

import { fetchAlpacaMovers, type Mover } from './alpaca-movers.js';
import { fetchAlpacaBars } from './alpaca-bars.js';
import { getPriceTier, type SmartMover, type SmartMoversResult } from '../types.js';

const VOLUME_UNUSUAL_THRESHOLD = 2.0;
const NEAR_52W_HIGH_PCT = 0.05;

function computeAvgVolume(bars: Array<{ v: number }>): number {
  if (!bars.length) return 0;
  const recent = bars.slice(-20);
  return Math.round(recent.reduce((sum, b) => sum + b.v, 0) / recent.length);
}

function compute52WeekHigh(bars: Array<{ h: number }>): number {
  if (!bars.length) return 0;
  return Math.max(...bars.map((b) => b.h));
}

export interface SmartMoversOptions {
  top?: number;
}

export async function getSmartMovers(options: SmartMoversOptions = {}): Promise<SmartMoversResult> {
  const { top = 10 } = options;

  const raw = await fetchAlpacaMovers({ top, market_type: 'stocks' });
  if (!raw) {
    return { scan_date: today(), scanned_at: new Date().toISOString(), movers: [] };
  }

  const allSymbols = [
    ...raw.gainers.map((m) => m.symbol),
    ...raw.losers.map((m) => m.symbol),
  ];

  const barsMap = await fetchAlpacaBars(allSymbols, { days: 365 });

  const enrich = (m: Mover, direction: 'gainer' | 'loser'): SmartMover => {
    const bars = barsMap[m.symbol] || [];
    const avgVol = computeAvgVolume(bars);
    const high52w = compute52WeekHigh(bars);
    const lastBar = bars.length ? bars[bars.length - 1] : null;
    const currentVol = lastBar?.v ?? 0;
    const volRatio = avgVol > 0 ? Number((currentVol / avgVol).toFixed(2)) : 0;
    const pctFrom52w = high52w > 0 ? Number(((high52w - m.price) / high52w).toFixed(4)) : 1;

    return {
      symbol: m.symbol,
      direction,
      percent_change: m.percent_change,
      price: m.price,
      change: m.change,
      volume: currentVol,
      avg_volume_20d: avgVol,
      volume_ratio: volRatio,
      high_52w: high52w,
      pct_from_52w_high: pctFrom52w,
      unusual_volume: volRatio >= VOLUME_UNUSUAL_THRESHOLD,
      near_52w_high: pctFrom52w <= NEAR_52W_HIGH_PCT,
      price_tier: getPriceTier(m.price),
    };
  };

  const movers = [
    ...raw.gainers.map((m) => enrich(m, 'gainer')),
    ...raw.losers.map((m) => enrich(m, 'loser')),
  ];

  return {
    scan_date: today(),
    scanned_at: new Date().toISOString(),
    movers,
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
