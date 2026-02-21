/**
 * Pattern scan job: load symbols from config (or full master list), run multiple timeframes
 * (daily 1Y & 2Y, monthly 3Y & 5Y), fetch bars from Alpaca in batches, run Python pattern_scan.py
 * on each batch with a 3s delay, merge results, and save to output/pattern-results-YYYY-MM-DD.json.
 * Run: tsx src/jobs/pattern-scan-job.ts
 * Requires: Python 3 with python/requirements.txt installed, Alpaca keys in .env.
 */

import 'dotenv/config';
import { spawn } from 'child_process';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fetchAlpacaBars } from '../services/alpaca-bars.js';
import type { AlpacaTimeframe } from '../services/alpaca-bars.js';
import { STOCKS } from '../stocks.js';
import type { BarsMap, PatternScanConfig, PatternScanResult, PatternScanResultItem } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const CONFIG_PATH = join(ROOT, 'config', 'stocks-to-scan.json');
const PYTHON_SCRIPT = join(ROOT, 'python', 'pattern_scan.py');
const FIXTURE_PATH = join(ROOT, 'tests', 'fixtures', 'ohlc-sample.json');
const OUTPUT_DIR = join(ROOT, 'output');

const DEFAULT_DAYS = 365;
const BATCH_SIZE = 100;
const DELAY_MS = 3000;
const STOCKS_SET = new Set(STOCKS);

/** Daily 1y & 2y; monthly 3y & 5y. */
const SCAN_CONFIGS: Array<{ timeframe: AlpacaTimeframe; days: number; label: string }> = [
  { timeframe: '1Day', days: 365, label: '1D-1Y' },
  { timeframe: '1Day', days: 730, label: '1D-2Y' },
  { timeframe: '1Month', days: 365 * 3, label: '1M-3Y' },
  { timeframe: '1Month', days: 365 * 5, label: '1M-5Y' },
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadSymbols(): Promise<string[]> {
  const raw = await readFile(CONFIG_PATH, 'utf8');
  const config: PatternScanConfig = JSON.parse(raw);

  let symbols: string[];
  if (config.useMasterList === true) {
    symbols = [...STOCKS];
    const limit = config.limit;
    if (typeof limit === 'number' && limit > 0) {
      symbols = symbols.slice(0, limit);
    }
  } else if (Array.isArray(config.symbols) && config.symbols.length > 0) {
    symbols = config.symbols.filter((s) => STOCKS_SET.has(s));
    if (symbols.length === 0) {
      throw new Error(
        'config/stocks-to-scan.json "symbols" had no symbols that exist in src/stocks.ts (STOCKS). Add valid tickers or set "useMasterList": true.'
      );
    }
  } else {
    throw new Error(
      'config/stocks-to-scan.json must have a non-empty "symbols" array or "useMasterList": true. Optionally set "limit" when using useMasterList.'
    );
  }

  return symbols;
}

function runPythonWithStdin(stdinData: string): Promise<PatternScanResult> {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', [PYTHON_SCRIPT, '-'], {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    py.stdout.on('data', (chunk: Buffer | string) => { stdout += chunk; });
    py.stderr.on('data', (chunk: Buffer | string) => { stderr += chunk; });
    py.on('error', (err: Error) => reject(err));
    py.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`Python exited ${code}: ${stderr || stdout}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as PatternScanResult);
      } catch {
        reject(new Error(`Invalid JSON from Python: ${stdout.slice(0, 200)}`));
      }
    });
    py.stdin.write(stdinData);
    py.stdin.end();
  });
}

export interface RunPatternScanOptions {
  useFixture?: boolean;
  symbols?: string[];
  days?: number;
  timeframe?: AlpacaTimeframe;
  /** Label for this run (e.g. "1D-1Y") when merging multi-timeframe results. */
  lookback?: string;
}

export async function runPatternScan(options: RunPatternScanOptions = {}): Promise<PatternScanResult> {
  const useFixture = options.useFixture ?? (process.env.PATTERN_SCAN_USE_FIXTURE === 'true' || process.env.PATTERN_SCAN_USE_FIXTURE === '1');

  let bars: BarsMap;
  if (useFixture) {
    const raw = await readFile(FIXTURE_PATH, 'utf8');
    bars = JSON.parse(raw) as BarsMap;
  } else {
    const symbols = options.symbols || await loadSymbols();
    const days = options.days ?? DEFAULT_DAYS;
    const timeframe = options.timeframe ?? '1Day';
    bars = await fetchAlpacaBars(symbols, { days, timeframe });
  }

  const symbolsWithBars = Object.keys(bars).filter((s) => bars[s].length >= 20);
  if (symbolsWithBars.length === 0) {
    return { results: [], errors: ['No symbol had enough bars (need at least 20).'] };
  }

  const stdinData = JSON.stringify(bars);
  return runPythonWithStdin(stdinData);
}

/** Run pattern scan in batches with delay between batches; merge results and return. */
export async function runPatternScanBatched(options: RunPatternScanOptions = {}): Promise<PatternScanResult> {
  const useFixture = options.useFixture ?? (process.env.PATTERN_SCAN_USE_FIXTURE === 'true' || process.env.PATTERN_SCAN_USE_FIXTURE === '1');
  if (useFixture) {
    return runPatternScan(options);
  }

  const symbols = options.symbols || await loadSymbols();
  const days = options.days ?? DEFAULT_DAYS;
  const timeframe = options.timeframe ?? '1Day';
  const lookback = options.lookback;
  const batches: string[][] = [];
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    batches.push(symbols.slice(i, i + BATCH_SIZE));
  }

  const allResults: PatternScanResultItem[] = [];
  const allErrors: string[] = [];
  const totalBatches = batches.length;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`[pattern-scan] Batch ${i + 1}/${totalBatches} (${batch.length} symbols)…`);
    const bars = await fetchAlpacaBars(batch, { days, timeframe });
    const symbolsWithBars = Object.keys(bars).filter((s) => bars[s].length >= 20);
    if (symbolsWithBars.length === 0) {
      allErrors.push(`Batch ${i + 1}: no symbol had enough bars.`);
      if (i < batches.length - 1) await delay(DELAY_MS);
      continue;
    }
    const stdinData = JSON.stringify(bars);
    try {
      const result = await runPythonWithStdin(stdinData);
      if (result.results?.length) {
        const tagged = result.results.map((r) => (lookback ? { ...r, lookback } : r));
        allResults.push(...tagged);
      }
      if (result.errors?.length) allErrors.push(...result.errors);
    } catch (err) {
      allErrors.push(`Batch ${i + 1}: ${(err as Error).message}`);
    }
    if (i < batches.length - 1) await delay(DELAY_MS);
  }

  return { results: allResults, errors: allErrors };
}

/** Save merged result to output/pattern-results-YYYY-MM-DD.json and a latest.json for the dashboard. */
async function saveResults(result: PatternScanResult): Promise<string> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `pattern-results-${date}.json`;
  const filepath = join(OUTPUT_DIR, filename);

  const withPatterns = (result.results || []).filter((r) => r.patterns?.length > 0);
  const payload = {
    scanDate: date,
    scannedAt: new Date().toISOString(),
    timeframes: SCAN_CONFIGS.map((c) => c.label),
    totalScanned: result.results?.length ?? 0,
    withPatternsCount: withPatterns.length,
    results: result.results ?? [],
    withPatterns,
    errors: result.errors ?? [],
  };

  await writeFile(filepath, JSON.stringify(payload, null, 2), 'utf8');
  const latestPath = join(OUTPUT_DIR, 'latest.json');
  await writeFile(latestPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log('[pattern-scan] Saved to', filepath, 'and', latestPath);
  return filepath;
}

async function main(): Promise<void> {
  const useFixture = process.env.PATTERN_SCAN_USE_FIXTURE === 'true' || process.env.PATTERN_SCAN_USE_FIXTURE === '1';
  if (useFixture) {
    console.log('[pattern-scan] Using fixture OHLC (PATTERN_SCAN_USE_FIXTURE=true) – no Alpaca call.');
    const result = await runPatternScan();
    await saveResults(result);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('[pattern-scan] Running multi-timeframe scan: 1D-1Y, 1D-2Y, 1M-3Y, 1M-5Y (3s between batches).');
  const allResults: PatternScanResultItem[] = [];
  const allErrors: string[] = [];

  try {
    for (const config of SCAN_CONFIGS) {
      console.log(`\n[pattern-scan] --- ${config.label} (${config.timeframe}, ${config.days} days) ---`);
      const result = await runPatternScanBatched({
        days: config.days,
        timeframe: config.timeframe,
        lookback: config.label,
      });
      if (result.results?.length) allResults.push(...result.results);
      if (result.errors?.length) allErrors.push(...result.errors);
    }

    const result: PatternScanResult = { results: allResults, errors: allErrors };
    await saveResults(result);
    const withPatterns = allResults.filter((r) => r.patterns?.length > 0);
    if (withPatterns.length > 0) {
      console.log('\n[pattern-scan] Symbols with patterns:', [...new Set(withPatterns.map((r) => r.symbol))].join(', '));
    }
    if (allErrors.length > 0) {
      console.warn('[pattern-scan] Errors:', allErrors);
    }
  } catch (err) {
    console.error('[pattern-scan] Error:', (err as Error).message);
    process.exit(1);
  }
}

main();
