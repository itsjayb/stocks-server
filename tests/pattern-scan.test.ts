/**
 * Tests for the pattern-scan pipeline: run Python pattern_scan.py with fixture OHLC
 * and assert output shape. Requires Python 3 and python/requirements.txt installed.
 */

import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { test } from 'node:test';
import assert from 'node:assert';
import type { PatternScanResult } from '../src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PYTHON_SCRIPT = join(ROOT, 'python', 'pattern_scan.py');
const FIXTURE_PATH = join(__dirname, 'fixtures', 'ohlc-sample.json');

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
    py.on('error', reject);
    py.on('close', (code: number | null) => {
      if (code !== 0) reject(new Error(`exit ${code}: ${stderr || stdout}`));
      else {
        try {
          resolve(JSON.parse(stdout) as PatternScanResult);
        } catch {
          reject(new Error(`Invalid JSON: ${stdout.slice(0, 200)}`));
        }
      }
    });
    py.stdin.write(stdinData);
    py.stdin.end();
  });
}

test('Python pattern_scan.py accepts OHLC JSON on stdin and returns valid result shape', async () => {
  const fixture = await readFile(FIXTURE_PATH, 'utf8');
  const result = await runPythonWithStdin(fixture);

  assert.ok(result, 'result is truthy');
  assert.ok(Array.isArray(result.results), 'result.results is an array');
  assert.ok(Array.isArray(result.errors), 'result.errors is an array');

  const aapl = result.results.find((r) => r.symbol === 'AAPL');
  assert.ok(aapl, 'AAPL is in results');
  assert.ok(Array.isArray(aapl.patterns), 'AAPL has patterns array');

  for (const r of result.results) {
    assert.ok(typeof r.symbol === 'string', `result has symbol string: ${r.symbol}`);
    assert.ok(Array.isArray(r.patterns), `result has patterns array for ${r.symbol}`);
    for (const p of r.patterns) {
      assert.ok(typeof p.type === 'string', 'pattern has type');
      assert.ok(typeof p.date === 'string', 'pattern has date');
    }
  }
});

test('Python pattern_scan.py with empty object returns empty results', async () => {
  const result = await runPythonWithStdin('{}');
  assert.ok(Array.isArray(result.results));
  assert.ok(Array.isArray(result.errors));
  assert.strictEqual(result.results.length, 0);
});
