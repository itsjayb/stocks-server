/**
 * Movers Sync Job
 *
 * Fetches top 5 gainers and top 5 losers from Alpaca every 90 seconds,
 * but only during US market hours (9:30 AM – 4:00 PM ET, Mon–Fri).
 * Each cycle replaces the previous 10 rows in the Supabase `top_movers` table.
 *
 * Run standalone:  tsx src/jobs/movers-sync-job.ts
 * Or integrated via the scheduler.
 */

import 'dotenv/config';
import { fetchAlpacaMovers, Mover } from '../services/alpaca-movers.js';
import { getSupabase } from '../services/supabase.js';

const SYNC_INTERVAL_MS = 90_000; // 90 seconds
const TOP_COUNT = 5;
const TABLE = 'top_movers';

function isMarketOpen(): boolean {
  const now = new Date();

  const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(etString);

  const day = et.getDay(); // 0=Sun … 6=Sat
  if (day === 0 || day === 6) return false;

  const minutes = et.getHours() * 60 + et.getMinutes();
  const open = 9 * 60 + 30;  // 09:30 ET
  const close = 16 * 60;     // 16:00 ET

  return minutes >= open && minutes < close;
}

interface TopMoverRow {
  side: 'gainer' | 'loser';
  rank: number;
  symbol: string;
  price: number;
  change: number;
  percent_change: number;
  updated_at: string;
}

function buildRows(gainers: Mover[], losers: Mover[], ts: string): TopMoverRow[] {
  const rows: TopMoverRow[] = [];

  gainers.slice(0, TOP_COUNT).forEach((m, i) => {
    rows.push({
      side: 'gainer',
      rank: i + 1,
      symbol: m.symbol,
      price: m.price,
      change: m.change,
      percent_change: m.percent_change,
      updated_at: ts,
    });
  });

  losers.slice(0, TOP_COUNT).forEach((m, i) => {
    rows.push({
      side: 'loser',
      rank: i + 1,
      symbol: m.symbol,
      price: m.price,
      change: m.change,
      percent_change: m.percent_change,
      updated_at: ts,
    });
  });

  return rows;
}

async function syncOnce(): Promise<void> {
  if (!isMarketOpen()) {
    console.log('[movers-sync] Market closed – skipping.');
    return;
  }

  const result = await fetchAlpacaMovers({ top: TOP_COUNT, market_type: 'stocks' });
  if (!result) {
    console.warn('[movers-sync] Alpaca returned null – skipping this cycle.');
    return;
  }

  const rows = buildRows(result.gainers, result.losers, result.last_updated);

  const supabase = getSupabase();

  const { error } = await supabase
    .from(TABLE)
    .upsert(rows, { onConflict: 'side,rank' });

  if (error) {
    console.error('[movers-sync] Supabase upsert error:', error.message);
    return;
  }

  const symbols = rows.map((r) => `${r.side === 'gainer' ? '+' : '-'}${r.symbol}`).join(', ');
  console.log(`[movers-sync] Saved ${rows.length} rows at ${result.last_updated}  [${symbols}]`);
}

let _timer: ReturnType<typeof setInterval> | null = null;

export function startMoversSync(): void {
  console.log(`[movers-sync] Starting – polling every ${SYNC_INTERVAL_MS / 1000}s during market hours (9:30–16:00 ET).`);

  syncOnce().catch((err) => console.error('[movers-sync] initial tick error:', err));

  _timer = setInterval(() => {
    syncOnce().catch((err) => console.error('[movers-sync] tick error:', err));
  }, SYNC_INTERVAL_MS);
}

export function stopMoversSync(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    console.log('[movers-sync] Stopped.');
  }
}

// When run directly as a standalone script
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('movers-sync-job.ts') ||
   process.argv[1].endsWith('movers-sync-job.js'));

if (isDirectRun) {
  startMoversSync();
  process.on('SIGINT', () => {
    stopMoversSync();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    stopMoversSync();
    process.exit(0);
  });
}
