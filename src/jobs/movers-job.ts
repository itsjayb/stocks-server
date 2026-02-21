/**
 * Fetch and print top 3 gainers and losers from Alpaca (test script).
 * Run: npm run movers  (or tsx src/jobs/movers-job.ts)
 */

import 'dotenv/config';
import { fetchAlpacaMovers } from '../services/alpaca-movers.js';

const TOP = 3;

async function main() {
  console.log(`Fetching top ${TOP} gainers and losers (Alpaca movers)...\n`);
  const result = await fetchAlpacaMovers({ top: TOP, market_type: 'stocks' });
  if (!result) {
    console.error('Failed to fetch movers (check keys and subscription).');
    process.exit(1);
  }
  console.log('Last updated:', result.last_updated);
  console.log('\nTop gainers:');
  result.gainers.forEach((m, i) =>
    console.log(`  ${i + 1}. ${m.symbol}  ${m.percent_change >= 0 ? '+' : ''}${m.percent_change.toFixed(2)}%  $${m.price}  ($${m.change >= 0 ? '+' : ''}${m.change})`)
  );
  console.log('\nTop losers:');
  result.losers.forEach((m, i) =>
    console.log(`  ${i + 1}. ${m.symbol}  ${m.percent_change.toFixed(2)}%  $${m.price}  ($${m.change})`)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
