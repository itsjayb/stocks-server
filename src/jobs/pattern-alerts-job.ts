/**
 * Pattern Alerts job: runs JS-based pattern detection (MA crossovers, breakouts,
 * bullish engulfing) and stores alerts to Supabase. Complements the existing
 * Python-based pattern-scan-job which handles head & shoulders.
 * Run: tsx src/jobs/pattern-alerts-job.ts
 */

import 'dotenv/config';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { detectPatterns } from '../services/pattern-alerts.js';
import { storePatternAlerts } from '../db/supabase.js';
import { STOCKS } from '../stocks.js';
import type { PatternScanConfig } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const CONFIG_PATH = join(ROOT, 'config', 'stocks-to-scan.json');
const BATCH_SIZE = 50;
const DELAY_MS = 3000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadSymbols(): Promise<string[]> {
  const raw = await readFile(CONFIG_PATH, 'utf8');
  const config: PatternScanConfig = JSON.parse(raw);
  const stocksSet = new Set(STOCKS);

  if (config.useMasterList) {
    const all = [...STOCKS];
    return config.limit ? all.slice(0, config.limit) : all;
  }

  if (Array.isArray(config.symbols) && config.symbols.length > 0) {
    return config.symbols.filter((s) => stocksSet.has(s));
  }

  return STOCKS.slice(0, 100);
}

async function main() {
  console.log('[pattern-alerts-job] Starting JS-based pattern detection...');
  const symbols = await loadSymbols();
  console.log(`[pattern-alerts-job] Scanning ${symbols.length} symbols in batches of ${BATCH_SIZE}.`);

  const allAlerts: Awaited<ReturnType<typeof detectPatterns>>['alerts'] = [];

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    console.log(`[pattern-alerts-job] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(symbols.length / BATCH_SIZE)} (${batch.length} symbols)...`);

    const result = await detectPatterns({ symbols: batch, timeframe: '1D', days: 365 });
    allAlerts.push(...result.alerts);

    if (i + BATCH_SIZE < symbols.length) await delay(DELAY_MS);
  }

  console.log(`[pattern-alerts-job] Found ${allAlerts.length} pattern alerts.`);
  if (allAlerts.length > 0) {
    const typeCounts: Record<string, number> = {};
    for (const a of allAlerts) {
      typeCounts[a.pattern_type] = (typeCounts[a.pattern_type] || 0) + 1;
    }
    console.log('[pattern-alerts-job] By type:', typeCounts);
  }

  await storePatternAlerts(allAlerts);
  console.log('[pattern-alerts-job] Done.');
}

main().catch((err) => {
  console.error('[pattern-alerts-job] Error:', err);
  process.exit(1);
});
