/**
 * Smart Movers job: fetches enriched movers and stores to Supabase.
 * Run: tsx src/jobs/smart-movers-job.ts
 */

import 'dotenv/config';
import { getSmartMovers } from '../services/smart-movers.js';
import { storeSmartMovers } from '../db/supabase.js';

async function main() {
  console.log('[smart-movers-job] Starting...');
  const result = await getSmartMovers({ top: 10 });

  console.log(`[smart-movers-job] Found ${result.movers.length} movers.`);
  const unusual = result.movers.filter((m) => m.unusual_volume);
  if (unusual.length) {
    console.log(`[smart-movers-job] ${unusual.length} with unusual volume:`, unusual.map((m) => m.symbol).join(', '));
  }

  const near52w = result.movers.filter((m) => m.near_52w_high);
  if (near52w.length) {
    console.log(`[smart-movers-job] ${near52w.length} near 52-week high:`, near52w.map((m) => m.symbol).join(', '));
  }

  await storeSmartMovers(result.movers);
  console.log('[smart-movers-job] Done.');
}

main().catch((err) => {
  console.error('[smart-movers-job] Error:', err);
  process.exit(1);
});
