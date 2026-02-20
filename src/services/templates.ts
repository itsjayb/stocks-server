/**
 * Fallback tweet templates when the LLM fails or returns empty.
 * All under 280 characters. Use {headline} for optional top news headline.
 */

import type { NewsItem } from '../types.js';

const PROMO_URL = process.env.PROMO_WEBSITE_URL || 'https://learnstockmarket.online';
const domain = PROMO_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** Templates that can include {headline} – headline will be truncated if needed */
const WITH_HEADLINE = [
  `{headline} Learn chart patterns and trading strategies: ${domain}`,
  `Market update: {headline} Stay sharp – learn patterns and strategies at ${domain}`,
  `{headline} Level up your trading with lessons on patterns and risk: ${domain}`,
];

/** Static templates (no placeholder) */
const STATIC = [
  `New to trading? Learn support, resistance, and trend patterns step by step. ${domain}/patterns`,
  `Plan your entries and exits like a pro. Trading strategies explained: ${domain}/strategies`,
  `Chart patterns and trading strategies in one place. Track your progress. ${domain}`,
  `Support, resistance, trend patterns – learn them with structured lessons. ${domain}/patterns`,
  `Entries, exits, and risk – walk through real trading strategies. ${domain}/strategies`,
  `Stock market education that sticks: patterns, strategies, and a path to follow. ${domain}`,
];

const MAX_HEADLINE_IN_TWEET = 120;

export function getFallbackTweet(items: NewsItem[] = []): string {
  const headline = items.length > 0 && items[0].headline
    ? items[0].headline.slice(0, MAX_HEADLINE_IN_TWEET).trim()
    : '';

  const pool = headline.length > 0 ? WITH_HEADLINE : STATIC;
  const template = pool[Math.floor(Math.random() * pool.length)];

  let text = template.replace(/\{headline\}/g, headline).trim();
  if (text.length > 280) text = text.slice(0, 277) + '…';
  return text;
}
