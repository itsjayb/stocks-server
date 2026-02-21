/**
 * Market Insights job: reads all service results and generates interpretive insights.
 * Should run after all other service jobs have completed.
 * Run: tsx src/jobs/market-insights-job.ts
 */

import 'dotenv/config';
import { generateMarketInsights } from '../services/market-insights.js';
import { storeMarketInsights } from '../db/supabase.js';

async function main() {
  console.log('[market-insights-job] Starting...');
  const result = await generateMarketInsights();

  console.log(`[market-insights-job] Generated ${result.insights.length} insights:`);
  for (const i of result.insights) {
    const sym = i.symbol ? ` [${i.symbol}]` : '';
    console.log(`  ${i.priority}. (${i.insight_type})${sym} ${i.title}`);
  }

  await storeMarketInsights(result.insights);
  console.log('[market-insights-job] Done.');
}

main().catch((err) => {
  console.error('[market-insights-job] Error:', err);
  process.exit(1);
});
