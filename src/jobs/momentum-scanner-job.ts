/**
 * Momentum Scanner job: scores a stock universe on composite momentum and stores to Supabase.
 * Run: tsx src/jobs/momentum-scanner-job.ts
 */

import 'dotenv/config';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runMomentumScan } from '../services/momentum-scanner.js';
import { storeMomentumScans } from '../db/supabase.js';
import { STOCKS } from '../stocks.js';
import type { PatternScanConfig, MomentumScanRow } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const CONFIG_PATH = join(ROOT, 'config', 'stocks-to-scan.json');
const BATCH_SIZE = 100;
const DELAY_MS = 3000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadSymbols(): Promise<string[]> {
  const raw = await readFile(CONFIG_PATH, 'utf8');
  const config: PatternScanConfig = JSON.parse(raw);

  if (config.useMasterList) {
    const all = [...STOCKS];
    return config.limit ? all.slice(0, config.limit) : all;
  }

  if (Array.isArray(config.symbols) && config.symbols.length > 0) {
    const stocksSet = new Set(STOCKS);
    return config.symbols.filter((s) => stocksSet.has(s));
  }

  return STOCKS.slice(0, 200);
}

async function main() {
  console.log('[momentum-scanner-job] Starting...');
  const symbols = await loadSymbols();
  console.log(`[momentum-scanner-job] Scanning ${symbols.length} symbols in batches of ${BATCH_SIZE}.`);

  const allScans: MomentumScanRow[] = [];

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    console.log(`[momentum-scanner-job] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(symbols.length / BATCH_SIZE)} (${batch.length} symbols)...`);

    const result = await runMomentumScan({ symbols: batch });
    allScans.push(...result.scans);

    if (i + BATCH_SIZE < symbols.length) await delay(DELAY_MS);
  }

  allScans.sort((a, b) => b.score - a.score);
  console.log(`[momentum-scanner-job] Scored ${allScans.length} stocks.`);

  const top5 = allScans.slice(0, 5);
  if (top5.length) {
    console.log('[momentum-scanner-job] Top 5:');
    for (const s of top5) {
      console.log(`  ${s.symbol}: ${s.score}/100 ($${s.price}, ${s.price_change_5d}% 5d, ${s.volume_ratio}× vol, RSI ${s.rsi_14})`);
    }
  }

  await storeMomentumScans(allScans);
  console.log('[momentum-scanner-job] Done.');
}

main().catch((err) => {
  console.error('[momentum-scanner-job] Error:', err);
  process.exit(1);
});
