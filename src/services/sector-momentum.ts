/**
 * Sector Momentum: tracks performance of 11 GICS sectors using representative stocks.
 * Computes 1-week and 1-month average % change, ranks sectors, highlights drivers.
 */

import { fetchAlpacaBars } from './alpaca-bars.js';
import type { OhlcBar, SectorMomentumRow, SectorMomentumResult, SectorStock } from '../types.js';

const SECTOR_MAP: Record<string, string[]> = {
  Technology:               ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'ADBE', 'CRM', 'INTC', 'AMD', 'CSCO', 'ORCL'],
  Healthcare:               ['UNH', 'JNJ', 'LLY', 'PFE', 'ABBV', 'MRK', 'TMO', 'ABT', 'DHR', 'AMGN'],
  Financials:               ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'BLK', 'SCHW', 'AXP', 'C', 'USB'],
  'Consumer Discretionary': ['AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'LOW', 'SBUX', 'TJX', 'BKNG', 'CMG'],
  'Consumer Staples':       ['PG', 'KO', 'PEP', 'COST', 'WMT', 'PM', 'MO', 'CL', 'MDLZ', 'KHC'],
  Energy:                   ['XOM', 'CVX', 'COP', 'EOG', 'SLB', 'MPC', 'PSX', 'VLO', 'OXY', 'HES'],
  Industrials:              ['CAT', 'DE', 'UNP', 'HON', 'UPS', 'BA', 'RTX', 'GE', 'LMT', 'MMM'],
  Materials:                ['LIN', 'APD', 'SHW', 'ECL', 'FCX', 'NEM', 'NUE', 'DOW', 'DD', 'VMC'],
  'Real Estate':            ['AMT', 'PLD', 'CCI', 'EQIX', 'PSA', 'SPG', 'DLR', 'O', 'WELL', 'AVB'],
  Utilities:                ['NEE', 'DUK', 'SO', 'D', 'AEP', 'EXC', 'SRE', 'XEL', 'ED', 'WEC'],
  'Communication Services': ['GOOG', 'META', 'NFLX', 'DIS', 'CMCSA', 'VZ', 'T', 'TMUS', 'CHTR', 'EA'],
};

function pctChange(bars: OhlcBar[], daysBack: number): number {
  if (bars.length < 2) return 0;
  const endIdx = bars.length - 1;
  const startIdx = Math.max(0, endIdx - daysBack);
  const startPrice = bars[startIdx].c;
  if (startPrice === 0) return 0;
  return Number((((bars[endIdx].c - startPrice) / startPrice) * 100).toFixed(2));
}

export async function getSectorMomentum(): Promise<SectorMomentumResult> {
  const allSymbols = [...new Set(Object.values(SECTOR_MAP).flat())];
  const barsMap = await fetchAlpacaBars(allSymbols, { days: 35 });

  const sectors: SectorMomentumRow[] = [];

  for (const [sector, symbols] of Object.entries(SECTOR_MAP)) {
    const stocks: SectorStock[] = [];

    for (const sym of symbols) {
      const bars = barsMap[sym];
      if (!bars || bars.length < 5) continue;
      stocks.push({
        symbol: sym,
        change_1w: pctChange(bars, 5),
        change_1m: pctChange(bars, 21),
      });
    }

    if (stocks.length === 0) continue;

    const avg1w = Number((stocks.reduce((s, st) => s + st.change_1w, 0) / stocks.length).toFixed(2));
    const avg1m = Number((stocks.reduce((s, st) => s + st.change_1m, 0) / stocks.length).toFixed(2));

    const sorted1w = [...stocks].sort((a, b) => b.change_1w - a.change_1w);

    sectors.push({
      sector,
      rank: 0,
      avg_change_1w: avg1w,
      avg_change_1m: avg1m,
      top_stocks: sorted1w.slice(0, 3),
      bottom_stocks: sorted1w.slice(-3).reverse(),
      commentary: '',
    });
  }

  sectors.sort((a, b) => b.avg_change_1w - a.avg_change_1w);
  sectors.forEach((s, i) => {
    s.rank = i + 1;
    s.commentary = generateCommentary(s, sectors.length);
  });

  return {
    scan_date: today(),
    scanned_at: new Date().toISOString(),
    sectors,
  };
}

function generateCommentary(s: SectorMomentumRow, total: number): string {
  const topDrivers = s.top_stocks.map((st) => st.symbol).join(', ');

  if (s.rank <= 3) {
    const direction = s.avg_change_1w >= 0 ? 'up' : 'down';
    return `${s.sector} is a top performer this week (${direction} ${Math.abs(s.avg_change_1w)}%). Leading names: ${topDrivers}.`;
  }
  if (s.rank >= total - 2) {
    return `${s.sector} is underperforming this week (${s.avg_change_1w}%). Weakest: ${s.bottom_stocks.map((st) => st.symbol).join(', ')}.`;
  }
  return `${s.sector} is mid-pack this week (${s.avg_change_1w}%).`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
