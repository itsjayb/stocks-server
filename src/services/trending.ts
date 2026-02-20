import { fetchAlpacaBars } from './alpaca-bars.js';

/**
 * Return the top N symbols by latest daily volume from a candidate list.
 */
export async function getTrendingSymbols(candidates: string[], top = 3): Promise<string[]> {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];

  try {
    const barsMap = await fetchAlpacaBars(candidates, { days: 2, limit: candidates.length * 2 });

    const withVol: Array<{ sym: string; vol: number }> = Object.entries(barsMap).map(([sym, bars]) => {
      const last = Array.isArray(bars) && bars.length ? bars[bars.length - 1] : null;
      return { sym, vol: last?.v ?? 0 };
    });

    withVol.sort((a, b) => b.vol - a.vol);

    return withVol.slice(0, top).map((x) => x.sym);
  } catch (err) {
    console.warn('Trending symbols fetch failed:', (err as Error).message);
    return [];
  }
}
