/**
 * Fetch market news from Alpaca News API (v1beta1).
 * Returns items in shared shape: { headline, summary, url, source, date }[]
 */

import type { NewsItem } from '../../types.js';

const ALPACA_DATA_BASE =
  (process.env.VITE_ALPACA_HISTORY_BASE_URL || '').replace(/\/v2\/stocks\/?$/, '') ||
  'https://data.alpaca.markets';
const API_KEY = process.env.VITE_ALPACA_API_KEY;
const API_SECRET = process.env.VITE_ALPACA_SECRET_KEY;

const DEFAULT_SYMBOLS = 'AAPL,TSLA,SPY';
const DEFAULT_LIMIT = 10;

export interface FetchAlpacaNewsOptions {
  symbols?: string;
  limit?: number;
}

export async function fetchAlpacaNews(options: FetchAlpacaNewsOptions = {}): Promise<NewsItem[]> {
  const symbols = options.symbols || DEFAULT_SYMBOLS;
  const limit = options.limit ?? DEFAULT_LIMIT;

  if (!API_KEY || !API_SECRET) {
    console.warn('Alpaca: missing VITE_ALPACA_API_KEY or VITE_ALPACA_SECRET_KEY');
    return [];
  }

  const url = new URL(`${ALPACA_DATA_BASE}/v1beta1/news`);
  url.searchParams.set('symbols', symbols);
  url.searchParams.set('limit', String(limit));

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'APCA-API-KEY-ID': API_KEY,
        'APCA-API-SECRET-KEY': API_SECRET,
      },
    });

    if (!res.ok) {
      console.warn('Alpaca news API error:', res.status, await res.text());
      return [];
    }

    const data = (await res.json()) as { news?: Array<{ headline?: string; summary?: string; url?: string; created_at?: string; updated_at?: string }> };
    const items = data.news || [];

    return items.map((item): NewsItem => ({
      headline: item.headline || '',
      summary: item.summary || '',
      url: item.url || '',
      source: 'Alpaca',
      date: item.created_at || item.updated_at || '',
    }));
  } catch (err) {
    console.warn('Alpaca news fetch failed:', (err as Error).message);
    return [];
  }
}
