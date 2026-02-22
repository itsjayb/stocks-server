/**
 * Scheduler: runs all service jobs on cron schedules.
 * All times Central Time (America/Chicago), weekdays only (Mon–Fri).
 *
 * ┌──────────┬──────────────────────────────────────────────────────┐
 * │  Time CT │  Job                                                │
 * ├──────────┼──────────────────────────────────────────────────────┤
 * │ 9:00 AM  │  Smart Movers + Momentum Scanner (repeat every 30m) │
 * │ 9:30 AM  │  ↑                                                  │
 * │ ...      │  ↑ every :00 and :30                                │
 * │ 2:30 PM  │  ↑ last intraday run                                │
 * ├──────────┼──────────────────────────────────────────────────────┤
 * │ 3:00 PM  │  Pattern Scan (Python head & shoulders)             │
 * │ 3:15 PM  │  Pattern Alerts (JS: MA cross, breakout, engulfing) │
 * │ 4:00 PM  │  Sector Momentum                                    │
 * │ 5:00 PM  │  Stock Picks (reads movers+patterns+momentum)       │
 * │ 5:30 PM  │  Market Insights (reads all services)               │
 * ├──────────┼──────────────────────────────────────────────────────┤
 * │ 8,10,12  │  Tweet job (opt-in, RUN_TWEET_JOB=true)             │
 * │ 14,16,18 │                                                      │
 * └──────────┴──────────────────────────────────────────────────────┘
 *
 * Start with: tsx src/scheduler.ts  or  pm2 start ecosystem.config.cjs
 */

import 'dotenv/config';
import cron from 'node-cron';
import { spawn } from 'child_process';
import { join } from 'path';

const JOBS_DIR = join(process.cwd(), 'src', 'jobs');
const TZ = 'America/Chicago';

const RUN_TWEET_JOB = process.env.RUN_TWEET_JOB === 'true' || process.env.RUN_TWEET_JOB === '1';

function runJob(name: string, filename: string): void {
  console.log(`[scheduler] Running ${name} at`, new Date().toISOString());
  const child = spawn('npx', ['tsx', join(JOBS_DIR, filename)], {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('close', (code: number | null) => {
    if (code !== 0) console.error(`[scheduler] ${name} exited with code`, code);
  });
}

// ── Intraday: every 30 min from 9:00 AM to 2:30 PM CT (Mon–Fri) ──
// Stops before 3:00 PM so it doesn't overlap with the pattern scan jobs.
// Cron: minutes 0,30 / hours 9–14 = 9:00, 9:30, 10:00 ... 14:00, 14:30 (12 runs)
const MARKET_HOURS_SCHEDULE = '0,30 9-14 * * 1-5';

cron.schedule(MARKET_HOURS_SCHEDULE, () => runJob('smart-movers', 'smart-movers-job.ts'), { timezone: TZ });
console.log('[scheduler] Smart Movers: every 30 min, 9:00 AM – 2:30 PM CT (Mon–Fri).');

cron.schedule(MARKET_HOURS_SCHEDULE, () => runJob('momentum-scanner', 'momentum-scanner-job.ts'), { timezone: TZ });
console.log('[scheduler] Momentum Scanner: every 30 min, 9:00 AM – 2:30 PM CT (Mon–Fri).');

// ── After-hours: run in dependency order ──
// 3:00 PM — Pattern Scan (Python)        — needs full day's candle
// 3:15 PM — Pattern Alerts (JS)          — offset to avoid API contention
// 4:00 PM — Sector Momentum              — 1 hr after close for finalized bars
// 5:00 PM — Stock Picks                  — reads movers + patterns + momentum from DB
// 5:30 PM — Market Insights              — reads all service outputs from DB

cron.schedule('0 15 * * 1-5', () => runJob('pattern-scan', 'pattern-scan-job.ts'), { timezone: TZ });
console.log('[scheduler] Pattern Scan (Python): 3:00 PM CT.');

cron.schedule('15 15 * * 1-5', () => runJob('pattern-alerts', 'pattern-alerts-job.ts'), { timezone: TZ });
console.log('[scheduler] Pattern Alerts (JS): 3:15 PM CT.');

cron.schedule('0 16 * * 1-5', () => runJob('sector-momentum', 'sector-momentum-job.ts'), { timezone: TZ });
console.log('[scheduler] Sector Momentum: 4:00 PM CT.');

cron.schedule('0 17 * * 1-5', () => runJob('stock-picks', 'stock-picks-job.ts'), { timezone: TZ });
console.log('[scheduler] Stock Picks: 5:00 PM CT.');

cron.schedule('30 17 * * 1-5', () => runJob('market-insights', 'market-insights-job.ts'), { timezone: TZ });
console.log('[scheduler] Market Insights: 5:30 PM CT.');

// ── Tweet job (opt-in) ──
if (RUN_TWEET_JOB) {
  const TWEET_SCHEDULE = '0 8,10,12,14,16,18 * * 1-5';
  cron.schedule(TWEET_SCHEDULE, () => runJob('tweet', 'tweet-job.ts'), { timezone: TZ });
  console.log('[scheduler] Tweet job: 8 AM, 10, 12, 2, 4, 6 PM CT (Mon–Fri).');
} else {
  console.log('[scheduler] Tweet job disabled. Set RUN_TWEET_JOB=true to enable.');
}

console.log('[scheduler] All jobs registered. Waiting for cron triggers...');
