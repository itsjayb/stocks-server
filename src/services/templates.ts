/**
 * Fallback tweet templates when the LLM fails or returns empty.
 * All under 280 characters. Use {headline} for optional top news headline.
 * Supports tweet types: news (no CTA), pattern (no tickers), strategy (can include tickers/ETFs).
 */

import type { NewsItem } from '../types.js';
import type { TweetType } from './aggregate-news.js';

const PROMO_URL = process.env.PROMO_WEBSITE_URL || 'https://learnstockmarket.online';
const domain = PROMO_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** News-only: headline + short take, no website. Job may append tickers. */
const NEWS_WITH_HEADLINE = [
  '{headline}',
  'Market update: {headline}',
  '{headline} Worth keeping an eye on.',
];

const NEWS_STATIC = [
  'Market in focus today.',
  'Big moves on the tape. Stay sharp.',
  'Volatility picking up. Watch the key levels.',
];

/** Pattern promo: no tickers. Focus on pattern + success rate + URL. */
const PATTERN_WITH_ITEM = [
  '{name}: {description} Roughly 70% success rate when confirmed. Learn it: {url}',
  'Master {name} – one of the most reliable chart patterns. Learn step by step: {url}',
];

const PATTERN_STATIC = [
  `Head & Shoulders is known to have roughly a 70% success rate when confirmed. Learn it step by step: ${domain}/patterns`,
  `New to trading? Learn support, resistance, and trend patterns step by step. ${domain}/patterns`,
  `Double Top and Double Bottom – reversal patterns pros use. Learn them: ${domain}/patterns`,
  `Support, resistance, trend patterns – learn them with structured lessons. ${domain}/patterns`,
];

/** Strategy promo: can include tickers (ETFs). Focus on strategy + URL. */
const STRATEGY_WITH_ITEM = [
  '{name}: {description} One of the most popular strategies. Learn it: {url}',
  'Master {name} – used by pros for entries and exits. Learn step by step: {url}',
];

const STRATEGY_STATIC = [
  `Plan your entries and exits like a pro. Trading strategies explained: ${domain}/strategies`,
  `Moving Average Crossover – simple and effective. Learn it: ${domain}/strategies`,
  `Entries, exits, and risk – walk through real trading strategies. ${domain}/strategies`,
];

const MAX_HEADLINE_IN_TWEET = 120;
const MAX_DESCRIPTION_IN_FALLBACK = 80;

export interface PatternOrStrategyForFallback {
  name: string;
  description: string;
  url: string;
}

export function getFallbackTweet(
  items: NewsItem[] = [],
  type: TweetType = 'pattern',
  patternOrStrategy?: PatternOrStrategyForFallback
): string {
  const headline = items.length > 0 && items[0].headline
    ? items[0].headline.slice(0, MAX_HEADLINE_IN_TWEET).trim()
    : '';

  let pool: string[];
  if (type === 'news') {
    pool = headline.length > 0 ? NEWS_WITH_HEADLINE : NEWS_STATIC;
  } else if (type === 'pattern') {
    pool = patternOrStrategy?.url ? PATTERN_WITH_ITEM : PATTERN_STATIC;
  } else if (type === 'strategy') {
    pool = patternOrStrategy?.url ? STRATEGY_WITH_ITEM : STRATEGY_STATIC;
  } else {
    pool = headline.length > 0 ? NEWS_WITH_HEADLINE : NEWS_STATIC;
  }

  const template = pool[Math.floor(Math.random() * pool.length)];
  let text = template
    .replace(/\{headline\}/g, headline)
    .replace(/\{name\}/g, patternOrStrategy?.name ?? '')
    .replace(/\{description\}/g, patternOrStrategy?.description?.slice(0, MAX_DESCRIPTION_IN_FALLBACK) ?? '')
    .replace(/\{url\}/g, patternOrStrategy?.url ?? '')
    .trim();
  if (text.length > 280) text = text.slice(0, 277) + '…';
  return text;
}
