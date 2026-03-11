/**
 * Aggregate news from multiple sources, deduplicate, trim, and build the LLM prompt.
 * Includes canonical site description for learnstockmarket.online so tweets advertise correctly.
 * Supports three tweet types: news (no CTA), website (pattern/strategy promo), stocks (cash-tag focus).
 */

import type { NewsItem } from '../types.js';

const PROMO_URL = process.env.PROMO_WEBSITE_URL || 'https://learnstockmarket.online';
const DOMAIN = PROMO_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
const MAX_ITEMS = 10;

export type TweetType = 'news' | 'pattern' | 'strategy';

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
  /** When type is 'pattern' or 'strategy', use this specific item and its URL (/tw/ referral). */
  patternOrStrategy?: { name: string; description: string; url: string; kind: 'pattern' | 'strategy' };
}

/**
 * Build prompt for the given tweet type. Varying the type produces different content:
 * - news: headline-focused, no website CTA; LLM identifies affected stocks (limit 3), optional tactical context.
 * - pattern: one pattern hook with success rate, CTA; NO tickers (avoid implying tickers match the pattern).
 * - strategy: one strategy hook, CAN include tickers (ETFs, sector ETFs).
 */
export function buildPromptForType(
  newsString: string,
  type: TweetType,
  options: BuildPromptOptions = {}
): string {
  const { candidateSymbols = [], patternOrStrategy } = options;
  const symbolHint =
    candidateSymbols.length > 0
      ? `Suggested tickers: ${candidateSymbols.slice(0, 12).map((s) => `$${s}`).join(', ')}. You may also use sector ETFs (e.g. $XLE $USO $OIL for energy, $XLF for financials).`
      : 'Use sector ETFs or relevant tickers like $SPY $QQQ $XLE $USO where relevant.';

  const rules =
    'Write like a real person. Do not use quotation marks. Short, punchy sentences. Under 280 characters total. Output only the tweet text. No explanation, no quotes around the tweet.';

  if (type === 'news') {
    const system = `You write short, engaging tweets for a stock market learning brand. ${SITE_DESCRIPTION} Goal: educate and build trust.`;
    const task = `Using the market news below, write exactly ONE tweet. This tweet is NEWS ONLY: lead with the most important or interesting headline. Do NOT add a website link or call-to-action.

Identify which stocks could be affected by this news. Include 1–3 cash tags (e.g. $XOM $USO $OIL) for the most relevant tickers. Limit to 3 tickers max.
When the news suggests a sector or theme (e.g. Iran, conflict, energy, oil), you may add a short tactical note like "watch oil stocks for potential short-term swing trades" or similar. Keep it concise.
If no specific stocks are clearly affected, keep it to the headline and a short take without tickers.
${rules}`;
    return `${system}\n\n${task}\n\nMarket news:\n${newsString}`;
  }

  if (type === 'pattern') {
    const system = `You write short, engaging tweets for a stock market learning site. ${SITE_DESCRIPTION} Goal: educate and promote pattern learning.`;
    let task: string;
    if (patternOrStrategy && patternOrStrategy.kind === 'pattern') {
      task = `Write exactly ONE tweet that promotes this specific pattern: "${patternOrStrategy.name}". One-line description: ${patternOrStrategy.description}. Use a short hook with a concrete stat when available (e.g. "known to have roughly 70% success rate when confirmed"). Do NOT include any stock tickers or cash tags – we do not want to imply specific stocks match this pattern. End with this exact URL: ${patternOrStrategy.url}. Do NOT paste news headlines. ${rules}`;
    } else {
      task = `Write exactly ONE tweet that promotes learning a chart pattern (e.g. Head & Shoulders, Double Top, Cup and Handle). Add a concrete hook (e.g. "Head & Shoulders has roughly a 70% success rate when confirmed"). Do NOT include any stock tickers. End with: ${PROMO_URL}/tw/patterns or ${DOMAIN}/tw/patterns. ${rules}`;
    }
    return `${system}\n\n${task}\n\nOptional context from recent market news (do not quote verbatim):\n${newsString}`;
  }

  // type === 'strategy'
  const system = `You write short, engaging tweets for a stock market learning site. ${SITE_DESCRIPTION} Goal: educate and promote strategy learning.`;
  let task: string;
  if (patternOrStrategy && patternOrStrategy.kind === 'strategy') {
    task = `Write exactly ONE tweet that promotes this specific strategy: "${patternOrStrategy.name}". One-line description: ${patternOrStrategy.description}. Use a short hook (e.g. "one of the most popular trading strategies" or why it matters). You MAY include 1–3 relevant tickers or ETFs (e.g. $SPY $QQQ $XLF) that fit the strategy – strategies can apply to ETFs and sectors. ${symbolHint} End with this exact URL: ${patternOrStrategy.url}. Do NOT paste news headlines. ${rules}`;
  } else {
    task = `Write exactly ONE tweet that promotes learning a trading strategy (e.g. Moving Average Crossover, Support and Resistance, Breakout Trading). Add a hook like "one of the most popular strategies". You MAY include 1–3 relevant ETFs or tickers. ${symbolHint} End with: ${PROMO_URL}/tw/strategies or ${DOMAIN}/tw/strategies. ${rules}`;
  }
  return `${system}\n\n${task}\n\nOptional context from recent market news (do not quote verbatim):\n${newsString}`;
}

/**
 * Default prompt builder (backward compatible). Uses 'news' type.
 */
export function buildPrompt(newsString: string): string {
  return buildPromptForType(newsString, 'news');
}

const TWEET_TYPES: TweetType[] = ['news', 'pattern', 'strategy'];

/**
 * Pick a tweet type for this run so we rotate content: news, pattern promo, strategy promo.
 * Uses time-based rotation (hour + day) so we switch it up across runs.
 */
export function pickTweetType(): TweetType {
  const d = new Date();
  const index = (d.getDate() * 24 + d.getHours()) % TWEET_TYPES.length;
  return TWEET_TYPES[index];
}
