/**
 * Stock Picks job: cross-references all service results to select top daily picks.
 * Depends on smart-movers, pattern-alerts, and momentum-scanner having run first.
 * Run: tsx src/jobs/stock-picks-job.ts
 */

import 'dotenv/config';
import { generateStockPicks } from '../services/stock-picks.js';
import { storeStockPicks } from '../db/supabase.js';

async function main() {
  console.log('[stock-picks-job] Starting...');
  const result = await generateStockPicks();

  if (result.picks.length === 0) {
    console.log('[stock-picks-job] No picks today — not enough signals across services.');
  } else {
    console.log(`[stock-picks-job] Selected ${result.picks.length} picks:`);
    for (const p of result.picks) {
      console.log(`  #${p.rank} ${p.symbol} — score ${p.momentum_score}, patterns: [${p.patterns_detected.join(', ')}]`);
      console.log(`    ${p.rationale}`);
    }
  }

  await storeStockPicks(result.picks);
  console.log('[stock-picks-job] Done.');
}

main().catch((err) => {
  console.error('[stock-picks-job] Error:', err);
  process.exit(1);
});
