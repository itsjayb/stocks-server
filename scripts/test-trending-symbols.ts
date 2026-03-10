/**
 * Test script: see what symbols the tweet job uses as "popular/trending" for the day.
 *
 * Why tweets often show the same stocks (SPY, QQQ, AAPL):
 * - Candidates come from config/stocks-to-scan.json. If there is no "symbols" array
 *   and the tweet job doesn't use "useMasterList", it falls back to ['SPY', 'AAPL', 'QQQ'].
 * - "Trending" here means top N by *volume* from that candidate list, not "in the news."
 *   So from a tiny list, SPY/QQQ always win. To get topical names (e.g. oil when Iran/oil
 *   is in the news), we need either a larger candidate set or to use Smart Movers (actual
 *   gainers/losers of the day).
 *
 * Run: npm run test:trending   or   tsx scripts/test-trending-symbols.ts
 *
 * Options:
 *   TRENDING_TOP=5     number of trending symbols to show (default 10)
 *   MOVERS_TOP=10      number of smart movers to show (default 10)
 */

import 'dotenv/config';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { STOCKS } from '../src/stocks.js';
import type { PatternScanConfig } from '../src/types.js';
import { getTrendingSymbols } from '../src/services/trending.js';
import { getSmartMovers } from '../src/services/smart-movers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONFIG_PATH = join(ROOT, 'config', 'stocks-to-scan.json');

async function loadCandidates(): Promise<string[]> {
  let candidates: string[] = [];
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8');
    const config: PatternScanConfig = JSON.parse(raw);
    const stocksSet = new Set(STOCKS);

    if (config.useMasterList === true) {
      candidates = [...STOCKS];
      const limit = config.limit;
      if (typeof limit === 'number' && limit > 0) {
        candidates = candidates.slice(0, limit);
      }
      console.log('[config] useMasterList=true, limit=%s → %d candidates', config.limit ?? 'none', candidates.length);
    } else if (Array.isArray(config.symbols) && config.symbols.length > 0) {
      candidates = config.symbols.filter((s) => stocksSet.has(s));
      console.log('[config] symbols array → %d candidates (after filtering to STOCKS)', candidates.length);
    } else {
      console.log('[config] No symbols array and no useMasterList → tweet job would fall back to SPY, AAPL, QQQ');
      candidates = ['SPY', 'AAPL', 'QQQ'];
    }
  } catch (err) {
    console.warn('[config] Could not load config:', (err as Error).message, '→ using SPY, AAPL, QQQ');
    candidates = ['SPY', 'AAPL', 'QQQ'];
  }
  return candidates;
}

const trendingTop = Math.max(1, parseInt(process.env.TRENDING_TOP || '10', 10));
const moversTop = Math.max(1, parseInt(process.env.MOVERS_TOP || '10', 10));

async function main(): Promise<void> {
  console.log('--- Trending symbols test (what the tweet job uses for cash tags) ---\n');

  const candidates = await loadCandidates();
  console.log('Candidates (first 20):', candidates.slice(0, 20).join(', '), candidates.length > 20 ? '…' : '');
  console.log('');

  // 1) Trending = top by volume from candidate list (what tweet job uses today)
  console.log('1) getTrendingSymbols(candidates, %d) — top by *volume* from candidate list:', trendingTop);
  try {
    const trending = await getTrendingSymbols(candidates, trendingTop);
    console.log('   Result:', trending.map((s) => '$' + s).join(' '));
    if (trending.length === 0) {
      console.log('   (empty — check Alpaca keys and that symbols have recent bars)');
    }
  } catch (err) {
    console.error('   Error:', (err as Error).message);
  }
  console.log('');

  // 2) Smart Movers = actual top gainers/losers of the day (could include oil, etc. when they move)
  console.log('2) getSmartMovers({ top: %d }) — actual top gainers/losers *today*:', moversTop);
  try {
    const { movers } = await getSmartMovers({ top: moversTop });
    const gainers = movers.filter((m) => m.direction === 'gainer').slice(0, 5);
    const losers = movers.filter((m) => m.direction === 'loser').slice(0, 5);
    console.log('   Top gainers:', gainers.map((m) => `$${m.symbol} (${m.percent_change}%)`).join(', '));
    console.log('   Top losers:', losers.map((m) => `$${m.symbol} (${m.percent_change}%)`).join(', '));
    if (movers.length === 0) {
      console.log('   (empty — market may be closed or Alpaca movers API failed)');
    }
  } catch (err) {
    console.error('   Error:', (err as Error).message);
  }

  console.log('\n--- Summary ---');
  console.log('Tweet job currently appends 3 symbols from (1) trending. To get topical names (e.g. oil when Iran/oil is in the news),');
  console.log('either add more symbols to config (including sector tickers like XOM, USO, OXY) or use smart movers for "stocks" tweets.');
}

main();
