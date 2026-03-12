/**
 * Fallback tweet templates when the LLM fails or returns empty.
 * All under 280 characters. Use {headline} for optional top news headline.
 * Supports tweet types: news (no CTA), pattern (no tickers), strategy (can include tickers/ETFs).
 *
 * Engagement boost: templates include emotional hooks and CTAs to drive replies.
 */

import type { NewsItem } from '../types.js';
import type { TweetType } from './aggregate-news.js';

const PROMO_URL = process.env.PROMO_WEBSITE_URL || 'https://learnstockmarket.online';
const domain = PROMO_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** News-only: headline + emotional framing + CTA. Job may append tickers. */
const NEWS_WITH_HEADLINE = [
  '{headline} 🔥 Bullish or bearish? Drop your take 👇',
  'Breaking: {headline} What\'s your play here? 📈📉',
  '{headline} This could be massive. Agree or disagree? 💬',
  '{headline} Smart money is watching this closely. Your move? 👇',
  'Just in: {headline} Would you trade this? 🎯',
];

const NEWS_STATIC = [
  'Market in focus today. Big moves brewing 🔥 What are you watching? 👇',
  'Volatility is picking up. Smart traders are watching key levels. What\'s your play? 📊',
  'The tape is telling a story today. Bullish or bearish? Drop your take 📈📉',
  'Something is brewing under the surface. What\'s on your watchlist? 👇',
  'Markets don\'t sleep and neither should your watchlist. What are you eyeing? 🎯',
];

/** Pattern promo: no tickers. Focus on pattern + success rate + URL + CTA. */
const PATTERN_WITH_ITEM = [
  '{name}: {description} Roughly 70% success rate when confirmed 🎯 Learn it: {url} What pattern do you use most? 👇',
  'Most traders overlook {name} — that\'s a mistake. Master it step by step: {url} Ever traded this pattern? 💬',
  '{name} is one of the most reliable setups in the market. Learn how: {url} Bullish or bearish pattern? 📈📉',
];

const PATTERN_STATIC = [
  `Head & Shoulders: roughly 70% success rate when confirmed. Hidden gem of chart patterns 🎯 Learn it: ${domain}/tw/patterns What\'s your go-to pattern? 👇`,
  `Double Top and Double Bottom — the reversal patterns pros swear by. Learn them: ${domain}/tw/patterns Which do you prefer? 💬`,
  `Support, resistance, trend patterns — the foundation of every winning trade. Learn step by step: ${domain}/tw/patterns Ready to level up? 🔥`,
  `Most traders skip chart patterns. The ones who don\'t? They have an edge. Start here: ${domain}/tw/patterns Agree? 👇`,
];

/** Strategy promo: can include tickers (ETFs). Focus on strategy + URL + CTA. */
const STRATEGY_WITH_ITEM = [
  '{name}: {description} One of the most popular strategies for a reason 🔥 Learn it: {url} Do you use this? 👇',
  'Master {name} — pros use this for entries and exits every day. Learn step by step: {url} What\'s your edge? 💬',
  '{name} could change how you trade. Seriously. Learn it: {url} Ever tried this strategy? 🎯',
];

const STRATEGY_STATIC = [
  `Plan your entries and exits like a pro. Trading strategies explained: ${domain}/tw/strategies What strategy do you swear by? 👇`,
  `Moving Average Crossover — simple, effective, and explosive when timed right 🔥 Learn it: ${domain}/tw/strategies Do you use MAs? 💬`,
  `The best traders don\'t guess — they follow a strategy. Which one works for you? Start here: ${domain}/tw/strategies 📈`,
  `Entries, exits, risk — real strategies for real traders. ${domain}/tw/strategies What\'s your go-to? 🎯`,
];

/** Fallback poll questions when LLM can't generate one. */
export const FALLBACK_POLLS: Array<{ text: string; options: string[] }> = [
  { text: 'Where do you think $SPY closes this week? 📊', options: ['Higher 📈', 'Lower 📉', 'Flat ➡️'] },
  { text: 'What\'s your favorite trading timeframe? ⏰', options: ['Day trading', 'Swing trading', 'Long-term', 'Scalping'] },
  { text: 'Most reliable chart pattern? 📈', options: ['Head & Shoulders', 'Double Bottom', 'Cup & Handle', 'Bull Flag'] },
  { text: 'How are you feeling about the market today? 🎯', options: ['Very bullish 🚀', 'Cautiously bullish', 'Bearish 🐻', 'Cash gang 💵'] },
  { text: 'Best sector to watch right now? 👀', options: ['Tech 💻', 'Energy ⛽', 'Finance 🏦', 'Healthcare 🏥'] },
  { text: 'What matters most in your trading? 🤔', options: ['Entries', 'Exits', 'Risk mgmt', 'All equal'] },
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

export function getFallbackPoll(): { text: string; options: string[] } {
  return FALLBACK_POLLS[Math.floor(Math.random() * FALLBACK_POLLS.length)];
}
