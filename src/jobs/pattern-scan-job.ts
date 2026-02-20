/**
 * Pattern scan job: load symbols from config, fetch daily bars from Alpaca,
 * run Python pattern_scan.py on the OHLC data, print or return results.
 * Run: tsx src/jobs/pattern-scan-job.ts
 * Requires: Python 3 with python/requirements.txt installed, Alpaca keys in .env.
 */

import 'dotenv/config';
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fetchAlpacaBars } from '../services/alpaca-bars.js';
import { STOCKS } from '../stocks.js';
import type { BarsMap, PatternScanConfig, PatternScanResult } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const CONFIG_PATH = join(ROOT, 'config', 'stocks-to-scan.json');
const PYTHON_SCRIPT = join(ROOT, 'python', 'pattern_scan.py');
const FIXTURE_PATH = join(ROOT, 'tests', 'fixtures', 'ohlc-sample.json');

const DEFAULT_DAYS = 365;
const STOCKS_SET = new Set(STOCKS);

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
    bars = await fetchAlpacaBars(symbols, { days });
  }

  const symbolsWithBars = Object.keys(bars).filter((s) => bars[s].length >= 20);
  if (symbolsWithBars.length === 0) {
    return { results: [], errors: ['No symbol had enough bars (need at least 20).'] };
  }

  const stdinData = JSON.stringify(bars);
  return runPythonWithStdin(stdinData);
}

async function main(): Promise<void> {
  const useFixture = process.env.PATTERN_SCAN_USE_FIXTURE === 'true' || process.env.PATTERN_SCAN_USE_FIXTURE === '1';
  if (useFixture) {
    console.log('[pattern-scan] Using fixture OHLC (PATTERN_SCAN_USE_FIXTURE=true) – no Alpaca call.');
  } else {
    console.log('[pattern-scan] Loading symbols and fetching bars…');
  }
  try {
    const result = await runPatternScan();
    console.log(JSON.stringify(result, null, 2));
    const withPatterns = (result.results || []).filter((r) => r.patterns?.length > 0);
    if (withPatterns.length > 0) {
      console.log('\n[pattern-scan] Symbols with patterns:', withPatterns.map((r) => r.symbol).join(', '));
    }
    if ((result.errors || []).length > 0) {
      console.warn('[pattern-scan] Errors:', result.errors);
    }
  } catch (err) {
    console.error('[pattern-scan] Error:', (err as Error).message);
    process.exit(1);
  }
}

main();
