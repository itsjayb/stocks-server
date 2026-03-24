/**
 * Launcher for the TypeScript tweet job (rotation, typed fallbacks, /tw/ URLs).
 * Prefer: npm run tweet  or  npx tsx src/jobs/tweet-job.ts
 */

import 'dotenv/config';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const script = join(__dirname, 'tweet-job.ts');

const child = spawn('npx', ['tsx', script], { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 1));
