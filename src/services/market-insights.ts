/**
 * Market Insights: generates rules-based "AI-style" interpretations by reading
 * results from all other services and producing human-readable insight strings.
 *
 * Instead of "TSLA up 5%" you get:
 *   "TSLA up 5% on 3× volume, breaking weekly resistance — momentum score 85."
 */

import {
  fetchSmartMovers,
  fetchPatternAlerts,
  fetchSectorMomentum,
  fetchMomentumScans,
} from '../db/supabase.js';
import type { MarketInsight, MarketInsightsResult, InsightType } from '../types.js';

const MAX_INSIGHTS = 15;

export async function generateMarketInsights(date?: string): Promise<MarketInsightsResult> {
  const d = date || new Date().toISOString().slice(0, 10);

  const [movers, patterns, sectors, scans] = await Promise.all([
    fetchSmartMovers(d),
    fetchPatternAlerts(d),
    fetchSectorMomentum(d),
    fetchMomentumScans(d),
  ]);

  const insights: MarketInsight[] = [];
  let priority = 1;

  // -----------------------------------------------------------------------
  // Volume spikes from smart movers
  // -----------------------------------------------------------------------
  type MoverRow = {
    symbol: string;
    direction: string;
    percent_change: number;
    volume_ratio: number;
    price: number;
    unusual_volume: boolean;
    near_52w_high: boolean;
  };

  const unusualMovers = (movers as MoverRow[]).filter((m) => m.unusual_volume);
  for (const m of unusualMovers.slice(0, 3)) {
    insights.push({
      insight_type: 'volume_spike',
      symbol: m.symbol,
      title: `${m.symbol} surging on ${m.volume_ratio}× volume`,
      body: `${m.symbol} is ${m.direction === 'gainer' ? 'up' : 'down'} ${Math.abs(m.percent_change).toFixed(1)}% at $${m.price} with ${m.volume_ratio}× average volume.${m.near_52w_high ? ' Trading near 52-week highs.' : ''}`,
      data: { percent_change: m.percent_change, volume_ratio: m.volume_ratio, price: m.price },
      priority: priority++,
    });
  }

  // -----------------------------------------------------------------------
  // Breakout patterns
  // -----------------------------------------------------------------------
  type PatternRow = { symbol: string; pattern_type: string; details: Record<string, unknown> };

  const breakouts = (patterns as PatternRow[]).filter((p) => p.pattern_type === 'breakout');
  for (const b of breakouts.slice(0, 3)) {
    const level = (b.details as { breakout_level?: number }).breakout_level ?? 0;
    insights.push({
      insight_type: 'breakout',
      symbol: b.symbol,
      title: `${b.symbol} broke above $${level.toFixed(2)} resistance`,
      body: `${b.symbol} closed above its 20-day high of $${level.toFixed(2)} with elevated volume — a potential breakout setup.`,
      data: b.details,
      priority: priority++,
    });
  }

  // -----------------------------------------------------------------------
  // Pattern matches (golden cross, bullish engulfing, etc.)
  // -----------------------------------------------------------------------
  const interestingPatterns = (patterns as PatternRow[]).filter(
    (p) => p.pattern_type !== 'breakout',
  );
  for (const p of interestingPatterns.slice(0, 3)) {
    const friendly = friendlyPatternName(p.pattern_type);
    insights.push({
      insight_type: 'pattern_match',
      symbol: p.symbol,
      title: `${p.symbol}: ${friendly} detected`,
      body: `${p.symbol} is showing a ${friendly} on the chart. ${patternExplainer(p.pattern_type)}`,
      data: p.details,
      priority: priority++,
    });
  }

  // -----------------------------------------------------------------------
  // Sector rotation
  // -----------------------------------------------------------------------
  type SectorRow = {
    sector: string;
    rank: number;
    avg_change_1w: number;
    commentary: string;
    top_stocks: Array<{ symbol: string }>;
  };

  const topSectors = (sectors as SectorRow[]).filter((s) => s.rank <= 3);
  const bottomSectors = (sectors as SectorRow[]).filter((s) => s.rank >= (sectors as SectorRow[]).length - 2);

  for (const s of topSectors.slice(0, 2)) {
    insights.push({
      insight_type: 'sector_rotation',
      symbol: null,
      title: `${s.sector} leading the market this week`,
      body: s.commentary || `${s.sector} averaged ${s.avg_change_1w}% this week. Top names: ${s.top_stocks.map((st) => st.symbol).join(', ')}.`,
      data: { sector: s.sector, avg_change_1w: s.avg_change_1w, rank: s.rank },
      priority: priority++,
    });
  }

  for (const s of bottomSectors.slice(0, 1)) {
    insights.push({
      insight_type: 'sector_rotation',
      symbol: null,
      title: `${s.sector} underperforming this week`,
      body: s.commentary || `${s.sector} averaged ${s.avg_change_1w}% this week.`,
      data: { sector: s.sector, avg_change_1w: s.avg_change_1w, rank: s.rank },
      priority: priority++,
    });
  }

  // -----------------------------------------------------------------------
  // Momentum leaders
  // -----------------------------------------------------------------------
  type ScanRow = { symbol: string; score: number; price: number; price_change_5d: number; volume_ratio: number };

  const topMomentum = (scans as ScanRow[]).slice(0, 3);
  for (const s of topMomentum) {
    insights.push({
      insight_type: 'momentum_leader',
      symbol: s.symbol,
      title: `${s.symbol} momentum score: ${s.score}/100`,
      body: `${s.symbol} at $${s.price} — ${s.price_change_5d >= 0 ? '+' : ''}${s.price_change_5d}% over 5 days, ${s.volume_ratio}× avg volume. One of the strongest momentum profiles today.`,
      data: { score: s.score, price_change_5d: s.price_change_5d, volume_ratio: s.volume_ratio },
      priority: priority++,
    });
  }

  return {
    insight_date: d,
    created_at: new Date().toISOString(),
    insights: insights.slice(0, MAX_INSIGHTS),
  };
}

function friendlyPatternName(type: string): string {
  const map: Record<string, string> = {
    golden_cross: 'Golden Cross (50/200 SMA)',
    death_cross: 'Death Cross (50/200 SMA)',
    bullish_engulfing: 'Bullish Engulfing',
    head_shoulder: 'Head & Shoulders',
    inverse_head_shoulder: 'Inverse Head & Shoulders',
    breakout: 'Breakout',
  };
  return map[type] || type.replace(/_/g, ' ');
}

function patternExplainer(type: string): string {
  const map: Record<string, string> = {
    golden_cross: 'A golden cross occurs when the 50-day SMA crosses above the 200-day SMA — historically a bullish signal.',
    death_cross: 'A death cross occurs when the 50-day SMA crosses below the 200-day SMA — often interpreted as bearish.',
    bullish_engulfing: 'A bullish engulfing pattern shows buying pressure overtaking the prior day\'s selling — a potential reversal signal.',
    head_shoulder: 'Head & shoulders is a reversal pattern suggesting a potential trend change.',
    inverse_head_shoulder: 'An inverse head & shoulders suggests a potential bullish reversal from a downtrend.',
  };
  return map[type] || 'Learn more about this pattern at learnstockmarket.online/patterns.';
}
