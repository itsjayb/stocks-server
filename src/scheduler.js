/**
 * Legacy tweet-only scheduler. Prefer: npm run schedule  (tsx src/scheduler.ts).
 * Runs the TypeScript tweet job at 8,10,12,14,16,18 in the server timezone.
 */

import 'dotenv/config';
import cron from 'node-cron';
import { spawn } from 'child_process';
import { join } from 'path';

const JOBS_DIR = join(process.cwd(), 'src', 'jobs');

function runTweetJob() {
  console.log('[scheduler] Running tweet job at', new Date().toISOString());
  const child = spawn('npx', ['tsx', join(JOBS_DIR, 'tweet-job.ts')], {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('close', (code) => {
    if (code !== 0) console.error('[scheduler] Tweet job exited with code', code);
  });
}

const SCHEDULE = '0 8,10,12,14,16,18 * * *';

console.log('[scheduler] Tweet job will run at 8:00, 10:00, 12:00, 14:00, 16:00, 18:00 (server timezone).');
cron.schedule(SCHEDULE, runTweetJob);
