/**
 * Fetch OHLC bar data from Alpaca Market Data API v2 for chart pattern scanning.
 * Returns { [symbol]: [ { t, o, h, l, c, v }, ... ] } (chronological).
 */

import type { BarsMap, OhlcBar } from '../types.js';

const ALPACA_DATA_BASE =
  (process.env.VITE_ALPACA_HISTORY_BASE_URL || '').replace(/\/v2\/stocks\/?$/, '') ||
  'https://data.alpaca.markets';
const API_KEY = process.env.VITE_ALPACA_API_KEY;
const API_SECRET = process.env.VITE_ALPACA_SECRET_KEY;

const DEFAULT_DAYS = 365;
const MAX_LIMIT = 10000;

export type AlpacaTimeframe = '1Day' | '1Month';

export interface FetchAlpacaBarsOptions {
  start?: string | Date;
  end?: string | Date;
  days?: number;
  limit?: number;
  adjustment?: string;
  /** Bar size: 1Day (default) or 1Month for longer lookbacks. */
  timeframe?: AlpacaTimeframe;
}

export async function fetchAlpacaBars(symbols: string[], options: FetchAlpacaBarsOptions = {}): Promise<BarsMap> {
  if (!symbols?.length) return {};

  if (!API_KEY || !API_SECRET) {
    console.warn('Alpaca: missing VITE_ALPACA_API_KEY or VITE_ALPACA_SECRET_KEY');
    return {};
  }

  // Default end to yesterday so we never request same-day ("recent SIP") data;
  // free Alpaca subscriptions don't allow querying recent SIP data (403).
  const end = options.end
    ? new Date(options.end)
    : (() => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday;
      })();
  const days = options.days ?? DEFAULT_DAYS;
  const start = options.start
    ? new Date(options.start)
    : new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const limit = options.limit ?? Math.min(MAX_LIMIT, symbols.length * 500);

  const timeframe = options.timeframe ?? '1Day';
  const url = new URL(`${ALPACA_DATA_BASE}/v2/stocks/bars`);
  url.searchParams.set('symbols', symbols.join(','));
  url.searchParams.set('timeframe', timeframe);
  url.searchParams.set('start', start.toISOString().slice(0, 10));
  url.searchParams.set('end', end.toISOString().slice(0, 10));
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('adjustment', options.adjustment || 'split');

  const out: BarsMap = {};
  let nextPageToken: string | null = null;

  do {
    if (nextPageToken) url.searchParams.set('page_token', nextPageToken);

    const res = await fetch(url.toString(), {
      headers: {
        'APCA-API-KEY-ID': API_KEY,
        'APCA-API-SECRET-KEY': API_SECRET,
      },
    });

    if (!res.ok) {
      console.warn('Alpaca bars API error:', res.status, await res.text());
      break;
    }

    const data = (await res.json()) as {
      bars?: Record<string, Array<{ t?: string; o?: number; h?: number; l?: number; c?: number; v?: number }>>;
      next_page_token?: string | null;
    };
    const bars = data.bars || {};
    nextPageToken = data.next_page_token ?? null;

    for (const [sym, list] of Object.entries(bars)) {
      if (!Array.isArray(list)) continue;
      if (!out[sym]) out[sym] = [];
      for (const b of list) {
        out[sym].push({
          t: b.t ?? '',
          o: b.o ?? 0,
          h: b.h ?? 0,
          l: b.l ?? 0,
          c: b.c ?? 0,
          v: b.v ?? 0,
        } as OhlcBar);
      }
    }
  } while (nextPageToken);

  for (const sym of Object.keys(out)) {
    out[sym].sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());
  }

  return out;
}
