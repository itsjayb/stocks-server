/**
 * Load pattern/strategy reference and pick one for a website tweet.
 * Uses config/patterns-and-strategies.json; URLs use /tw/ for Twitter referral.
 */

import { readFile } from 'fs/promises';

const PROMO_URL = process.env.PROMO_WEBSITE_URL || 'https://learnstockmarket.online';
const BASE = PROMO_URL.replace(/\/$/, '');

let cached = null;

async function loadConfig() {
  if (cached) return cached;
  const path = new URL('../../config/patterns-and-strategies.json', import.meta.url);
  const raw = await readFile(path, 'utf8');
  cached = JSON.parse(raw);
  return cached;
}

/**
 * Pick one pattern or one strategy for this run (time-based rotation).
 * Returns null if config is missing or invalid.
 */
export async function pickPatternOrStrategy() {
  try {
    const config = await loadConfig();
    const patterns = config.patterns ?? [];
    const strategies = config.strategies ?? [];
    const total = patterns.length + strategies.length;
    if (total === 0) return null;

    const d = new Date();
    const index = (d.getDate() * 24 + d.getHours()) % total;
    if (index < patterns.length) {
      const row = patterns[index];
      return {
        name: row.name,
        description: row.description,
        url: `${BASE}/tw/pattern/${row.slug}`,
        kind: 'pattern',
      };
    }
    const row = strategies[index - patterns.length];
    return {
      name: row.name,
      description: row.description,
      url: `${BASE}/tw/strategy/${row.slug}`,
      kind: 'strategy',
    };
  } catch (err) {
    console.warn('[pattern-strategy-pick] Could not load config:', err.message);
    return null;
  }
}
