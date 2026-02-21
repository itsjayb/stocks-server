/**
 * Pattern Alerts: enhanced pattern detection combining:
 *   1. Python head & shoulders detection (existing)
 *   2. Moving average crossovers (50/200 SMA golden/death cross)
 *   3. Breakout detection (close above N-day high on volume spike)
 *
 * Results are stored per-symbol, per-pattern, per-timeframe.
 */

import { fetchAlpacaBars } from './alpaca-bars.js';
import type { OhlcBar, PatternAlert, PatternAlertsResult } from '../types.js';

// ---------------------------------------------------------------------------
// SMA helper
// ---------------------------------------------------------------------------

function sma(bars: OhlcBar[], period: number): number[] {
  const result: number[] = new Array(bars.length).fill(NaN);
  for (let i = period - 1; i < bars.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += bars[j].c;
    result[i] = sum / period;
  }
  return result;
}

// ---------------------------------------------------------------------------
// RSI helper (used by momentum scanner too, exported)
// ---------------------------------------------------------------------------

export function computeRSI(bars: OhlcBar[], period = 14): number[] {
  const rsi: number[] = new Array(bars.length).fill(NaN);
  if (bars.length < period + 1) return rsi;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = bars[i].c - bars[i - 1].c;
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < bars.length; i++) {
    const diff = bars[i].c - bars[i - 1].c;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return rsi;
}

// ---------------------------------------------------------------------------
// Golden / Death cross detection (50/200 SMA)
// ---------------------------------------------------------------------------

function detectMACrossovers(symbol: string, bars: OhlcBar[], timeframe: string): PatternAlert[] {
  if (bars.length < 201) return [];

  const sma50 = sma(bars, 50);
  const sma200 = sma(bars, 200);
  const alerts: PatternAlert[] = [];

  const lookbackDays = 5;
  const start = Math.max(200, bars.length - lookbackDays);

  for (let i = start; i < bars.length; i++) {
    if (isNaN(sma50[i]) || isNaN(sma200[i]) || isNaN(sma50[i - 1]) || isNaN(sma200[i - 1])) continue;

    const prevAbove = sma50[i - 1] > sma200[i - 1];
    const currAbove = sma50[i] > sma200[i];

    if (!prevAbove && currAbove) {
      alerts.push({
        symbol,
        pattern_type: 'golden_cross',
        timeframe,
        pattern_date: bars[i].t.slice(0, 10),
        details: { sma50: Number(sma50[i].toFixed(2)), sma200: Number(sma200[i].toFixed(2)) },
      });
    } else if (prevAbove && !currAbove) {
      alerts.push({
        symbol,
        pattern_type: 'death_cross',
        timeframe,
        pattern_date: bars[i].t.slice(0, 10),
        details: { sma50: Number(sma50[i].toFixed(2)), sma200: Number(sma200[i].toFixed(2)) },
      });
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Breakout detection (close above 20-day high + volume > 1.5× avg)
// ---------------------------------------------------------------------------

function detectBreakouts(symbol: string, bars: OhlcBar[], timeframe: string): PatternAlert[] {
  if (bars.length < 21) return [];

  const alerts: PatternAlert[] = [];
  const lookbackDays = 3;
  const start = Math.max(20, bars.length - lookbackDays);

  for (let i = start; i < bars.length; i++) {
    let high20 = 0;
    let volSum = 0;
    for (let j = i - 20; j < i; j++) {
      if (bars[j].h > high20) high20 = bars[j].h;
      volSum += bars[j].v;
    }
    const avgVol = volSum / 20;
    const volRatio = avgVol > 0 ? bars[i].v / avgVol : 0;

    if (bars[i].c > high20 && volRatio >= 1.5) {
      alerts.push({
        symbol,
        pattern_type: 'breakout',
        timeframe,
        pattern_date: bars[i].t.slice(0, 10),
        details: {
          breakout_level: Number(high20.toFixed(2)),
          close: bars[i].c,
          volume_ratio: Number(volRatio.toFixed(2)),
        },
      });
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Bullish engulfing detection
// ---------------------------------------------------------------------------

function detectBullishEngulfing(symbol: string, bars: OhlcBar[], timeframe: string): PatternAlert[] {
  if (bars.length < 3) return [];
  const alerts: PatternAlert[] = [];
  const lookbackDays = 5;
  const start = Math.max(1, bars.length - lookbackDays);

  for (let i = start; i < bars.length; i++) {
    const prev = bars[i - 1];
    const curr = bars[i];
    const prevBearish = prev.c < prev.o;
    const currBullish = curr.c > curr.o;
    const engulfs = curr.o <= prev.c && curr.c >= prev.o;

    if (prevBearish && currBullish && engulfs) {
      alerts.push({
        symbol,
        pattern_type: 'bullish_engulfing',
        timeframe,
        pattern_date: curr.t.slice(0, 10),
        details: { prev_open: prev.o, prev_close: prev.c, curr_open: curr.o, curr_close: curr.c },
      });
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------

export interface PatternAlertOptions {
  symbols: string[];
  timeframe?: string;
  days?: number;
}

export async function detectPatterns(options: PatternAlertOptions): Promise<PatternAlertsResult> {
  const { symbols, timeframe = '1D', days = 365 } = options;
  if (!symbols.length) {
    return { scan_date: today(), scanned_at: new Date().toISOString(), alerts: [] };
  }

  const barsMap = await fetchAlpacaBars(symbols, { days });
  const allAlerts: PatternAlert[] = [];

  for (const [symbol, bars] of Object.entries(barsMap)) {
    if (!bars || bars.length < 20) continue;

    allAlerts.push(...detectMACrossovers(symbol, bars, timeframe));
    allAlerts.push(...detectBreakouts(symbol, bars, timeframe));
    allAlerts.push(...detectBullishEngulfing(symbol, bars, timeframe));
  }

  return {
    scan_date: today(),
    scanned_at: new Date().toISOString(),
    alerts: allAlerts,
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
