/**
 * Load pattern/strategy reference and pick one for a website tweet.
 * Uses config/patterns-and-strategies.json; URLs use /tw/ for Twitter referral.
 */

import { readFile } from 'fs/promises';

import { getPromoBaseUrl } from './tweet-promo-url.js';

export interface PatternOrStrategyItem {
  name: string;
  description: string;
  url: string;
  kind: 'pattern' | 'strategy';
}

interface Row {
  id: number;
  name: string;
  slug: string;
  description: string;
}

interface Config {
  patterns: Row[];
  strategies: Row[];
}

let cached: Config | null = null;

async function loadConfig(): Promise<Config> {
  if (cached) return cached;
  const path = new URL('../../config/patterns-and-strategies.json', import.meta.url);
  const raw = await readFile(path, 'utf8');
  cached = JSON.parse(raw) as Config;
  return cached;
}

/**
 * Pick one pattern or one strategy for this run (time-based rotation).
 * Returns null if config is missing or invalid.
 */
export async function pickPatternOrStrategy(): Promise<PatternOrStrategyItem | null> {
  try {
    const config = await loadConfig();
    const patterns = config.patterns ?? [];
    const strategies = config.strategies ?? [];
    const total = patterns.length + strategies.length;
    if (total === 0) return null;

    const d = new Date();
    const index = (d.getDate() * 24 + d.getHours()) % total;
    const base = getPromoBaseUrl();
    if (index < patterns.length) {
      const row = patterns[index];
      return {
        name: row.name,
        description: row.description,
        url: `${base}/tw/pattern/${row.slug}`,
        kind: 'pattern',
      };
    }
    const row = strategies[index - patterns.length];
    return {
      name: row.name,
      description: row.description,
      url: `${base}/tw/strategy/${row.slug}`,
      kind: 'strategy',
    };
  } catch (err) {
    console.warn('[pattern-strategy-pick] Could not load config:', (err as Error).message);
    return null;
  }
}

/**
 * Pick one pattern only (for pattern promo tweets). No tickers in these tweets.
 */
export async function pickPattern(): Promise<PatternOrStrategyItem | null> {
  try {
    const config = await loadConfig();
    const patterns = config.patterns ?? [];
    if (patterns.length === 0) return null;

    const d = new Date();
    const index = (d.getDate() * 24 + d.getHours()) % patterns.length;
    const base = getPromoBaseUrl();
    const row = patterns[index];
    return {
      name: row.name,
      description: row.description,
      url: `${base}/tw/pattern/${row.slug}`,
      kind: 'pattern',
    };
  } catch (err) {
    console.warn('[pattern-strategy-pick] Could not load config:', (err as Error).message);
    return null;
  }
}

/**
 * Pick one strategy only (for strategy promo tweets). Strategy tweets CAN include tickers/ETFs.
 */
export async function pickStrategy(): Promise<PatternOrStrategyItem | null> {
  try {
    const config = await loadConfig();
    const strategies = config.strategies ?? [];
    if (strategies.length === 0) return null;

    const d = new Date();
    const index = (d.getDate() * 24 + d.getHours()) % strategies.length;
    const base = getPromoBaseUrl();
    const row = strategies[index];
    return {
      name: row.name,
      description: row.description,
      url: `${base}/tw/strategy/${row.slug}`,
      kind: 'strategy',
    };
  } catch (err) {
    console.warn('[pattern-strategy-pick] Could not load config:', (err as Error).message);
    return null;
  }
}
