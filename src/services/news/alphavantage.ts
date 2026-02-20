/**
 * Fetch market news from Alpha Vantage NEWS_SENTIMENT (or top-level news).
 * Returns items in shared shape: { headline, summary, url, source, date }[]
 */

import type { NewsItem } from '../../types.js';

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE_URL = 'https://www.alphavantage.co/query';

export interface FetchAlphaVantageNewsOptions {
  tickers?: string;
  limit?: number;
}

export async function fetchAlphaVantageNews(options: FetchAlphaVantageNewsOptions = {}): Promise<NewsItem[]> {
  const tickers = options.tickers || 'AAPL,TSLA';
  const limit = options.limit ?? 10;

  if (!API_KEY) {
    console.warn('Alpha Vantage: missing ALPHA_VANTAGE_API_KEY');
    return [];
  }

  const url = new URL(BASE_URL);
  url.searchParams.set('function', 'NEWS_SENTIMENT');
  url.searchParams.set('tickers', tickers);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('apikey', API_KEY);

  try {
    const res = await fetch(url.toString());

    if (!res.ok) {
      console.warn('Alpha Vantage news API error:', res.status, await res.text());
      return [];
    }

    const data = (await res.json()) as { feed?: Array<{ title?: string; headline?: string; summary?: string; url?: string; time_published?: string; created_at?: string }> };
    const items = data.feed || [];

    return items.map((item): NewsItem => ({
      headline: item.title || item.headline || '',
      summary: item.summary || '',
      url: item.url || '',
      source: 'Alpha Vantage',
      date: item.time_published || item.created_at || '',
    }));
  } catch (err) {
    console.warn('Alpha Vantage news fetch failed:', (err as Error).message);
    return [];
  }
}
