/**
 * Sector Momentum job: computes sector rotation rankings and stores to Supabase.
 * Run: tsx src/jobs/sector-momentum-job.ts
 */

import 'dotenv/config';
import { getSectorMomentum } from '../services/sector-momentum.js';
import { storeSectorMomentum } from '../db/supabase.js';

async function main() {
  console.log('[sector-momentum-job] Starting...');
  const result = await getSectorMomentum();

  console.log(`[sector-momentum-job] Ranked ${result.sectors.length} sectors.`);
  for (const s of result.sectors) {
    const arrow = s.avg_change_1w >= 0 ? '↑' : '↓';
    console.log(`  ${s.rank}. ${s.sector} ${arrow} ${s.avg_change_1w}% (1w), ${s.avg_change_1m}% (1m)`);
  }

  await storeSectorMomentum(result.sectors);
  console.log('[sector-momentum-job] Done.');
}

main().catch((err) => {
  console.error('[sector-momentum-job] Error:', err);
  process.exit(1);
});
