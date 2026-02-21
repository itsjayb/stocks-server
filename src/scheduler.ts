/**
 * Scheduler: pattern scan at 2:00; tweet job only when RUN_TWEET_JOB=true (e.g. on Raspberry Pi).
 * On this Mac branch we run only the pattern scanner; set RUN_TWEET_JOB=true on the Pi to post tweets.
 * Start with: tsx src/scheduler.ts  or  pm2 start ecosystem.config.cjs
 */

import 'dotenv/config';
import cron from 'node-cron';
import { spawn } from 'child_process';
import { join } from 'path';
import { startMoversSync } from './jobs/movers-sync-job.js';

const tweetJobPath = join(process.cwd(), 'src', 'jobs', 'tweet-job.ts');
const patternScanJobPath = join(process.cwd(), 'src', 'jobs', 'pattern-scan-job.ts');

const RUN_TWEET_JOB = process.env.RUN_TWEET_JOB === 'true' || process.env.RUN_TWEET_JOB === '1';
const TWEET_SCHEDULE = '0 8,10,12,14,16,18 * * *'; // 6 times per day
const PATTERN_SCAN_SCHEDULE = '0 15 * * *'; // 3:00 PM Central every day

function runTweetJob(): void {
  console.log('[scheduler] Running tweet job at', new Date().toISOString());
  const child = spawn('npx', ['tsx', tweetJobPath], {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('close', (code: number | null) => {
    if (code !== 0) console.error('[scheduler] Tweet job exited with code', code);
  });
}

function runPatternScanJob(): void {
  console.log('[scheduler] Running pattern scan job at', new Date().toISOString());
  const child = spawn('npx', ['tsx', patternScanJobPath], {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('close', (code: number | null) => {
    if (code !== 0) console.error('[scheduler] Pattern scan job exited with code', code);
  });
}

if (RUN_TWEET_JOB) {
  console.log('[scheduler] Tweet job enabled (RUN_TWEET_JOB=true) – will run at 8:00, 10:00, 12:00, 14:00, 16:00, 18:00.');
  cron.schedule(TWEET_SCHEDULE, runTweetJob);
} else {
  console.log('[scheduler] Tweet job disabled (RUN_TWEET_JOB not set). Set RUN_TWEET_JOB=true to enable.');
}

console.log('[scheduler] Pattern scan will run daily at 3:00 PM Central.');
cron.schedule(PATTERN_SCAN_SCHEDULE, runPatternScanJob, { timezone: 'America/Chicago' });

// Movers sync: polls Alpaca every 90s during market hours and writes to Supabase.
const RUN_MOVERS_SYNC = process.env.RUN_MOVERS_SYNC !== 'false'; // enabled by default
if (RUN_MOVERS_SYNC) {
  startMoversSync();
} else {
  console.log('[scheduler] Movers sync disabled (RUN_MOVERS_SYNC=false).');
}
