/**
 * Run the tweet job 6 times per day at fixed times (8:00, 10:00, 12:00, 14:00, 16:00, 18:00).
 * Start with: node src/scheduler.js
 */

import 'dotenv/config';
import cron from 'node-cron';
import { spawn } from 'child_process';
import { join } from 'path';

const tweetJobPath = join(process.cwd(), 'src', 'jobs', 'tweet-job.js');

const SCHEDULE = '0 8,10,12,14,16,18 * * *'; // 6 times per day at 8, 10, 12, 14, 16, 18

function runTweetJob() {
  console.log('[scheduler] Running tweet job at', new Date().toISOString());
  const child = spawn(process.execPath, [tweetJobPath], {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('close', (code) => {
    if (code !== 0) console.error('[scheduler] Tweet job exited with code', code);
  });
}

console.log('[scheduler] Tweet job will run at 8:00, 10:00, 12:00, 14:00, 16:00, 18:00 (server time).');
cron.schedule(SCHEDULE, runTweetJob);
