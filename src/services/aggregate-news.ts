/**
 * Aggregate news from multiple sources, deduplicate, trim, and build the LLM prompt.
 * Includes canonical site description for learnstockmarket.online so tweets advertise correctly.
 * Supports three tweet types: news (no CTA), website (pattern/strategy promo), stocks (cash-tag focus).
 */

import type { NewsItem } from '../types.js';

const PROMO_URL = process.env.PROMO_WEBSITE_URL || 'https://learnstockmarket.online';
const DOMAIN = PROMO_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
const MAX_ITEMS = 10;

export type TweetType = 'news' | 'website' | 'stocks';

const SITE_DESCRIPTION = `The site is ${DOMAIN}. It teaches chart patterns (support/resistance, trend patterns) at /patterns, and trading strategies (entries, exits, risk) at /strategies. Content is organized as lessons so users can follow a path and track progress.`;

export function aggregateNews(arrays: (NewsItem[] | unknown)[]): NewsItem[] {
  const seen = new Set<string>();
  const combined: NewsItem[] = [];

  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (!item?.headline) continue;
      const key = (item.url || item.headline).slice(0, 120);
      if (seen.has(key)) continue;
      seen.add(key);
      combined.push(item as NewsItem);
    }
  }

  combined.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  return combined.slice(0, MAX_ITEMS);
}

export function buildNewsString(items: NewsItem[]): string {
  return items
    .map(
      (item) =>
        `- [${item.source}] ${item.headline}${item.summary ? ` ${item.summary.slice(0, 100)}` : ''}${item.url ? ` Link: ${item.url}` : ''}`
    )
    .join('\n');
}

/** Options for building a type-specific prompt. */
export interface BuildPromptOptions {
  candidateSymbols?: string[];
  /** When type is 'website', use this specific pattern/strategy and its URL (/tw/ referral). */
  patternOrStrategy?: { name: string; description: string; url: string; kind: 'pattern' | 'strategy' };
}

/**
 * Build prompt for the given tweet type. Varying the type produces different content:
 * - news: headline-focused, no website CTA; may suggest sectors/tickers (e.g. oil for Iran).
 * - website: one pattern/strategy hook with a concrete stat or detail, then CTA; no long news.
 * - stocks: reason to watch 2–4 tickers with cash tags; no website.
 */
export function buildPromptForType(
  newsString: string,
  type: TweetType,
  options: BuildPromptOptions = {}
): string {
  const { candidateSymbols = [], patternOrStrategy } = options;
  const symbolHint =
    candidateSymbols.length > 0
      ? `Suggested tickers (use 2–4): ${candidateSymbols.slice(0, 8).map((s) => `$${s}`).join(', ')}. You may also use sector-relevant tickers (e.g. $XOM $USO $OIL for oil/geopolitics, $SPY $QQQ for markets).`
      : 'Use 2–4 cash tags like $SPY $AAPL $QQQ $XOM $USO where relevant.';

  const rules =
    'Write like a real person. Do not use quotation marks. Short, punchy sentences. Under 280 characters total. Output only the tweet text. No explanation, no quotes around the tweet.';

  if (type === 'news') {
    const system = `You write short, engaging tweets for a stock market learning brand. ${SITE_DESCRIPTION} Goal: educate and build trust.`;
    const task = `Using the market news below, write exactly ONE tweet. This tweet is NEWS ONLY: lead with the most important or interesting headline. Do not add a website link or call-to-action. If the news suggests a sector or theme (e.g. Iran, conflict, energy), you may suggest watching related tickers and include 1–3 cash tags (e.g. $XOM $USO $OIL). Otherwise keep it to the headline and a short take. ${rules}`;
    return `${system}\n\n${task}\n\nMarket news:\n${newsString}`;
  }

  if (type === 'website') {
    const system = `You write short, engaging tweets for a stock market learning site. ${SITE_DESCRIPTION} Goal: educate, build trust, and occasionally promote the site.`;
    let task: string;
    if (patternOrStrategy) {
      task = `Write exactly ONE tweet that promotes this specific ${patternOrStrategy.kind}: "${patternOrStrategy.name}". One-line description: ${patternOrStrategy.description}. Use a short hook (e.g. why it matters or a stat like "known to have roughly 70% success rate when confirmed" where relevant). End with this exact URL: ${patternOrStrategy.url}. Do NOT paste a long news headline. ${rules}`;
    } else {
      task = `Write exactly ONE tweet that promotes our educational site. Do NOT paste a long news headline. Focus on ONE specific pattern or strategy (e.g. Head & Shoulders, double top/bottom, support and resistance, moving average crossovers). Add a concrete hook when possible (e.g. "Head & Shoulders is known to have roughly a 70% success rate when confirmed" or "learn to spot the pattern pros use"). End with our URL: ${PROMO_URL} or ${DOMAIN}. ${rules}`;
    }
    return `${system}\n\n${task}\n\nOptional context from recent market news (do not quote verbatim):\n${newsString}`;
  }

  // type === 'stocks'
  const system = `You write short, engaging tweets for a stock market learning brand. ${SITE_DESCRIPTION} Goal: educate, build trust, and drive engagement.`;
  const task = `Using the market news below, write exactly ONE tweet that gives a reason to watch certain stocks. Include 2–4 cash tags ($TICKER). ${symbolHint} Do not add a website link. Be punchy: why these stocks now? Tie to news, momentum, or a theme. ${rules}`;
  return `${system}\n\n${task}\n\nMarket news:\n${newsString}`;
}

/**
 * Default prompt builder (backward compatible). Uses 'news' type.
 */
export function buildPrompt(newsString: string): string {
  return buildPromptForType(newsString, 'news');
}

const TWEET_TYPES: TweetType[] = ['news', 'website', 'stocks'];

/**
 * Pick a tweet type for this run so we rotate content: not every tweet promotes the website.
 * Uses time-based rotation (hour + day) so we switch it up across runs.
 */
export function pickTweetType(): TweetType {
  const d = new Date();
  const index = (d.getDate() * 24 + d.getHours()) % TWEET_TYPES.length;
  return TWEET_TYPES[index];
}
