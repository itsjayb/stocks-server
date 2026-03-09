/**
 * Fallback tweet templates when the LLM fails or returns empty.
 * All under 280 characters. Use {headline} for optional top news headline.
 * Supports tweet types: news (no CTA), website (pattern/strategy promo), stocks (cash-tag focus).
 */

const PROMO_URL = process.env.PROMO_WEBSITE_URL || 'https://learnstockmarket.online';
const domain = PROMO_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** News-only: headline + short take, no website */
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

/** Website promo: specific pattern/strategy hook when possible */
const WEBSITE_WITH_HEADLINE = [
  `{headline} Learn chart patterns and trading strategies: ${domain}`,
  `Market update: {headline} Stay sharp – learn patterns and strategies at ${domain}`,
  `{headline} Level up your trading with lessons on patterns and risk: ${domain}`,
];

const WEBSITE_STATIC = [
  `Head & Shoulders is known to have roughly a 70% success rate when confirmed. Learn it step by step: ${domain}/patterns`,
  `New to trading? Learn support, resistance, and trend patterns step by step. ${domain}/patterns`,
  `Plan your entries and exits like a pro. Trading strategies explained: ${domain}/strategies`,
  `Chart patterns and trading strategies in one place. Track your progress. ${domain}`,
  `Support, resistance, trend patterns – learn them with structured lessons. ${domain}/patterns`,
  `Entries, exits, and risk – walk through real trading strategies. ${domain}/strategies`,
];

/** Stocks focus: short reason to watch; job will append cash tags */
const STOCKS_WITH_HEADLINE = [
  '{headline} Names to watch.',
  'Movers on the tape: {headline}',
  '{headline} Keep these on your list.',
];

const STOCKS_STATIC = [
  'Movers and shakers today. Headlines driving the tape.',
  'Volume and momentum in focus. Key names to watch.',
  'Market action heating up. These tickers in play.',
];

const MAX_HEADLINE_IN_TWEET = 120;
const MAX_DESCRIPTION_IN_FALLBACK = 80;

/**
 * Get a random fallback tweet.
 * @param {{ headline: string }[]} [items]
 * @param {'news'|'website'|'stocks'} [type='website']
 * @param {{ name: string, description: string, url: string }} [patternOrStrategy] - When type is website, use this for a specific pattern/strategy + URL
 */
export function getFallbackTweet(items = [], type = 'website', patternOrStrategy = null) {
  const headline = items.length > 0 && items[0].headline
    ? items[0].headline.slice(0, MAX_HEADLINE_IN_TWEET).trim()
    : '';

  let pool;
  if (type === 'news') {
    pool = headline.length > 0 ? NEWS_WITH_HEADLINE : NEWS_STATIC;
  } else if (type === 'stocks') {
    pool = headline.length > 0 ? STOCKS_WITH_HEADLINE : STOCKS_STATIC;
  } else if (type === 'website' && patternOrStrategy) {
    const desc = patternOrStrategy.description.slice(0, MAX_DESCRIPTION_IN_FALLBACK);
    pool = [`${patternOrStrategy.name}: ${desc} Learn it: ${patternOrStrategy.url}`];
  } else {
    pool = headline.length > 0 ? WEBSITE_WITH_HEADLINE : WEBSITE_STATIC;
  }

  const template = pool[Math.floor(Math.random() * pool.length)];
  let text = template.replace(/\{headline\}/g, headline).trim();
  if (text.length > 280) text = text.slice(0, 277) + '…';
  return text;
}
