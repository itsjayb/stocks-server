/**
 * Scheduler: runs all service jobs on cron schedules.
 *
 * Schedule (Central Time):
 *   Market hours (every 30 min, 9:30–16:00): Smart Movers, Momentum Scanner
 *   15:00: Pattern Scan (Python), Pattern Alerts (JS)
 *   16:00: Sector Momentum
 *   17:00: Stock Picks (depends on movers + patterns + momentum)
 *   17:30: Market Insights (reads all service outputs)
 *   8,10,12,14,16,18: Tweet job (when RUN_TWEET_JOB=true)
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

// Market hours: every 30 min from 9:30 to 16:00 CT (Mon-Fri)
const MARKET_HOURS_SCHEDULE = '0,30 9-15 * * 1-5';

cron.schedule(MARKET_HOURS_SCHEDULE, () => runJob('smart-movers', 'smart-movers-job.ts'), { timezone: TZ });
console.log('[scheduler] Smart Movers: every 30 min during market hours (CT).');

cron.schedule(MARKET_HOURS_SCHEDULE, () => runJob('momentum-scanner', 'momentum-scanner-job.ts'), { timezone: TZ });
console.log('[scheduler] Momentum Scanner: every 30 min during market hours (CT).');

// Daily after-hours jobs
cron.schedule('0 15 * * 1-5', () => runJob('pattern-scan', 'pattern-scan-job.ts'), { timezone: TZ });
console.log('[scheduler] Pattern Scan (Python): daily at 3:00 PM CT.');

cron.schedule('15 15 * * 1-5', () => runJob('pattern-alerts', 'pattern-alerts-job.ts'), { timezone: TZ });
console.log('[scheduler] Pattern Alerts (JS): daily at 3:15 PM CT.');

cron.schedule('0 16 * * 1-5', () => runJob('sector-momentum', 'sector-momentum-job.ts'), { timezone: TZ });
console.log('[scheduler] Sector Momentum: daily at 4:00 PM CT.');

cron.schedule('0 17 * * 1-5', () => runJob('stock-picks', 'stock-picks-job.ts'), { timezone: TZ });
console.log('[scheduler] Stock Picks: daily at 5:00 PM CT.');

cron.schedule('30 17 * * 1-5', () => runJob('market-insights', 'market-insights-job.ts'), { timezone: TZ });
console.log('[scheduler] Market Insights: daily at 5:30 PM CT.');

// Tweet job (opt-in)
if (RUN_TWEET_JOB) {
  const TWEET_SCHEDULE = '0 8,10,12,14,16,18 * * *';
  cron.schedule(TWEET_SCHEDULE, () => runJob('tweet', 'tweet-job.ts'));
  console.log('[scheduler] Tweet job enabled — 8:00, 10:00, 12:00, 14:00, 16:00, 18:00.');
} else {
  console.log('[scheduler] Tweet job disabled. Set RUN_TWEET_JOB=true to enable.');
}
