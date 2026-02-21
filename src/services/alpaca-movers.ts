/**
 * Fetch top market movers (gainers and losers) from Alpaca Screener API.
 * Uses previous close → latest price; resets at market open for stocks.
 */

const ALPACA_DATA_BASE =
  (process.env.VITE_ALPACA_HISTORY_BASE_URL || '').replace(/\/v2\/stocks\/?$/, '') ||
  'https://data.alpaca.markets';
const API_KEY = process.env.VITE_ALPACA_API_KEY;
const API_SECRET = process.env.VITE_ALPACA_SECRET_KEY;

export interface Mover {
  symbol: string;
  percent_change: number;
  change: number;
  price: number;
}

export interface AlpacaMoversResult {
  gainers: Mover[];
  losers: Mover[];
  market_type: string;
  last_updated: string;
}

export interface FetchAlpacaMoversOptions {
  /** Number of top gainers and top losers to return (1–50). Default 10. */
  top?: number;
  /** 'stocks' | 'crypto'. Default 'stocks'. */
  market_type?: 'stocks' | 'crypto';
}

export async function fetchAlpacaMovers(
  options: FetchAlpacaMoversOptions = {}
): Promise<AlpacaMoversResult | null> {
  const { top = 10, market_type = 'stocks' } = options;

  if (!API_KEY || !API_SECRET) {
    console.warn('Alpaca movers: missing VITE_ALPACA_API_KEY or VITE_ALPACA_SECRET_KEY');
    return null;
  }

  const url = new URL(`${ALPACA_DATA_BASE}/v1beta1/screener/${market_type}/movers`);
  url.searchParams.set('top', String(Math.min(50, Math.max(1, top))));

  const res = await fetch(url.toString(), {
    headers: {
      'APCA-API-KEY-ID': API_KEY,
      'APCA-API-SECRET-KEY': API_SECRET,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn('Alpaca movers API error:', res.status, text);
    return null;
  }

  return (await res.json()) as AlpacaMoversResult;
}
