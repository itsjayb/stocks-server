/**
 * Aggregate news from multiple sources, deduplicate, trim, and build the LLM prompt.
 * Includes canonical site description for learnstockmarket.online so tweets advertise correctly.
 * Supports three tweet types: news (no CTA), pattern (pattern promo), strategy (strategy promo).
 *
 * Engagement boost: prompts include emotional framing, CTAs, and optional poll generation.
 */

import type { NewsItem, TweetTypeWeights } from '../types.js';

const PROMO_URL = process.env.PROMO_WEBSITE_URL || 'https://learnstockmarket.online';
const DOMAIN = PROMO_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
const MAX_ITEMS = 10;

export type TweetType = 'news' | 'pattern' | 'strategy';

const SITE_DESCRIPTION = `The site is ${DOMAIN}. It teaches chart patterns (support/resistance, trend patterns) at /patterns, and trading strategies (entries, exits, risk) at /strategies. Content is organized as lessons so users can follow a path and track progress.`;

const DEFAULT_WEIGHTS: TweetTypeWeights = { news: 50, pattern: 30, strategy: 20 };

const ENGAGEMENT_CTAS = [
  'Bullish or bearish? Drop your take below 📈📉',
  'Agree or disagree? Let us know 👇',
  'What\'s your play here? Reply below 💬',
  'Would you trade this? Yes or no 👇',
  'Tag a trader who needs to see this 🔥',
  'Smash the like if you saw this coming 🎯',
];

const EMOTIONAL_WORDS = {
  excitement: ['explosive', 'surging', 'breakout', 'rocket', 'massive', 'parabolic'],
  fear: ['crash', 'plunge', 'collapse', 'freefall', 'meltdown', 'bloodbath'],
  curiosity: ['hidden gem', 'under the radar', 'sleeper', 'overlooked', 'secret weapon'],
  urgency: ['right now', 'breaking', 'just in', 'developing', 'watch closely'],
};

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

function getEmotionalFraming(): string {
  return `Use emotionally resonant language when appropriate. Leverage psychology: greed ("don't miss this"), fear ("watch out for"), overconfidence ("everyone's bullish but…"), or curiosity ("most traders overlook this"). Use strong words like "${EMOTIONAL_WORDS.excitement.slice(0, 3).join('", "')}" for gains, "${EMOTIONAL_WORDS.fear.slice(0, 3).join('", "')}" for drops, or "${EMOTIONAL_WORDS.curiosity.slice(0, 2).join('", "')}" for discovery.`;
}

function getCtaInstruction(): string {
  return `End with a short engagement hook that invites replies, e.g. "Bullish or bearish?" or "Would you trade this?" or "What's your play?" — keep it brief and natural, not forced.`;
}

/**
 * Build prompt for the given tweet type with engagement-boosting instructions.
 * - news: headline-focused with emotional framing + CTA; LLM identifies affected stocks (limit 3).
 * - pattern: pattern hook with success rate + CTA; NO tickers.
 * - strategy: strategy hook + CTA; CAN include tickers (ETFs, sector ETFs).
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

  const emotionalFraming = getEmotionalFraming();
  const ctaInstruction = getCtaInstruction();

  const rules =
    `Write like a real person. Do not use quotation marks. Short, punchy sentences. Under 280 characters total. Output only the tweet text. No explanation, no quotes around the tweet. ${emotionalFraming} ${ctaInstruction}`;

  if (type === 'news') {
    const system = `You write short, engaging tweets for a stock market learning brand. ${SITE_DESCRIPTION} Goal: educate, build trust, and drive engagement (replies, likes, retweets).`;
    const task = `Using the market news below, write exactly ONE tweet. This tweet is NEWS ONLY: lead with the most important or interesting headline. Do NOT add a website link or call-to-action to the site.

Identify which stocks could be affected by this news. Include 1–3 cash tags (e.g. $XOM $USO $OIL) for the most relevant tickers. Limit to 3 tickers max.
When the news suggests a sector or theme (e.g. Iran, conflict, energy, oil), you may add a short tactical note like "watch oil stocks for potential short-term swing trades" or similar. Keep it concise.
If no specific stocks are clearly affected, keep it to the headline and a short take without tickers.
Frame the commentary to highlight greed, fear, or overconfidence in markets when relevant.
${rules}`;
    return `${system}\n\n${task}\n\nMarket news:\n${newsString}`;
  }

  if (type === 'pattern') {
    const system = `You write short, engaging tweets for a stock market learning site. ${SITE_DESCRIPTION} Goal: educate, promote pattern learning, and drive engagement.`;
    let task: string;
    if (patternOrStrategy && patternOrStrategy.kind === 'pattern') {
      task = `Write exactly ONE tweet that promotes this specific pattern: "${patternOrStrategy.name}". One-line description: ${patternOrStrategy.description}. Use a short hook with a concrete stat when available (e.g. "known to have roughly 70% success rate when confirmed"). Do NOT include any stock tickers or cash tags – we do not want to imply specific stocks match this pattern. End with this exact URL: ${patternOrStrategy.url}. Do NOT paste news headlines. ${rules}`;
    } else {
      task = `Write exactly ONE tweet that promotes learning a chart pattern (e.g. Head & Shoulders, Double Top, Cup and Handle). Add a concrete hook (e.g. "Head & Shoulders has roughly a 70% success rate when confirmed"). Do NOT include any stock tickers. End with: ${PROMO_URL}/tw/patterns or ${DOMAIN}/tw/patterns. ${rules}`;
    }
    return `${system}\n\n${task}\n\nOptional context from recent market news (do not quote verbatim):\n${newsString}`;
  }

  // type === 'strategy'
  const system = `You write short, engaging tweets for a stock market learning site. ${SITE_DESCRIPTION} Goal: educate, promote strategy learning, and drive engagement.`;
  let task: string;
  if (patternOrStrategy && patternOrStrategy.kind === 'strategy') {
    task = `Write exactly ONE tweet that promotes this specific strategy: "${patternOrStrategy.name}". One-line description: ${patternOrStrategy.description}. Use a short hook (e.g. "one of the most popular trading strategies" or why it matters). You MAY include 1–3 relevant tickers or ETFs (e.g. $SPY $QQQ $XLF) that fit the strategy – strategies can apply to ETFs and sectors. ${symbolHint} End with this exact URL: ${patternOrStrategy.url}. Do NOT paste news headlines. ${rules}`;
  } else {
    task = `Write exactly ONE tweet that promotes learning a trading strategy (e.g. Moving Average Crossover, Support and Resistance, Breakout Trading). Add a hook like "one of the most popular strategies". You MAY include 1–3 relevant ETFs or tickers. ${symbolHint} End with: ${PROMO_URL}/tw/strategies or ${DOMAIN}/tw/strategies. ${rules}`;
  }
  return `${system}\n\n${task}\n\nOptional context from recent market news (do not quote verbatim):\n${newsString}`;
}

/**
 * Build a poll-specific prompt: asks the LLM to produce a tweet + 2–4 poll options.
 * Output format: JSON with { text, options: string[] }.
 */
export function buildPollPrompt(
  newsString: string,
  type: TweetType,
  options: BuildPromptOptions = {}
): string {
  const { candidateSymbols = [] } = options;
  const tickerHint = candidateSymbols.length > 0
    ? `Relevant tickers: ${candidateSymbols.slice(0, 5).map((s) => `$${s}`).join(', ')}.`
    : '';

  if (type === 'news') {
    return `You create engaging Twitter polls about stock market news. Using the news below, write a poll tweet.
Output ONLY valid JSON: { "text": "the tweet question (under 200 chars)", "options": ["option1", "option2", "option3"] }
The question should be about a specific news item — ask the audience to predict what happens next or share their opinion.
Include 1–2 cash tags if relevant. 2–4 poll options, each under 25 characters. ${tickerHint}
Make it fun, opinionated, and engaging. No explanation outside the JSON.

Market news:
${newsString}`;
  }

  if (type === 'pattern') {
    return `You create engaging Twitter polls about chart patterns for traders.
Output ONLY valid JSON: { "text": "the tweet question (under 200 chars)", "options": ["option1", "option2", "option3"] }
Ask about favorite patterns, most reliable patterns, or pattern success rates.
2–4 poll options, each under 25 characters. Do NOT include stock tickers.
Make it educational and engaging. No explanation outside the JSON.

Optional context:
${newsString}`;
  }

  return `You create engaging Twitter polls about trading strategies.
Output ONLY valid JSON: { "text": "the tweet question (under 200 chars)", "options": ["option1", "option2", "option3"] }
Ask about favorite strategies, best approach for current conditions, or strategy preferences.
2–4 poll options, each under 25 characters. You may include 1–2 ETF tickers. ${tickerHint}
Make it educational and engaging. No explanation outside the JSON.

Optional context:
${newsString}`;
}

/**
 * Default prompt builder (backward compatible). Uses 'news' type.
 */
export function buildPrompt(newsString: string): string {
  return buildPromptForType(newsString, 'news');
}

/**
 * Pick a random CTA string for appending to tweets when the LLM doesn't include one.
 */
export function pickCta(): string {
  return ENGAGEMENT_CTAS[Math.floor(Math.random() * ENGAGEMENT_CTAS.length)];
}

/**
 * Pick a tweet type using weighted probabilities (default: 50% news, 30% pattern, 20% strategy).
 * Weights are configurable via env vars TWEET_WEIGHT_NEWS, TWEET_WEIGHT_PATTERN, TWEET_WEIGHT_STRATEGY.
 */
export function pickTweetType(): TweetType {
  const weights: TweetTypeWeights = {
    news: Number(process.env.TWEET_WEIGHT_NEWS) || DEFAULT_WEIGHTS.news,
    pattern: Number(process.env.TWEET_WEIGHT_PATTERN) || DEFAULT_WEIGHTS.pattern,
    strategy: Number(process.env.TWEET_WEIGHT_STRATEGY) || DEFAULT_WEIGHTS.strategy,
  };
  const total = weights.news + weights.pattern + weights.strategy;
  const roll = Math.random() * total;

  if (roll < weights.news) return 'news';
  if (roll < weights.news + weights.pattern) return 'pattern';
  return 'strategy';
}

/**
 * Decide whether this run should be a poll tweet (roughly 25% chance for news/strategy).
 */
export function shouldUsePoll(type: TweetType): boolean {
  if (type === 'pattern') return false;
  const chance = Number(process.env.POLL_CHANCE) || 0.25;
  return Math.random() < chance;
}

/**
 * Pick 1–2 relevant hashtags for the tweet type, only if they fit within the char limit.
 */
export function pickHashtags(type: TweetType): string[] {
  const pools: Record<TweetType, string[]> = {
    news: ['#StockMarket', '#Trading', '#WallStreet', '#MarketNews', '#Stocks', '#Finance'],
    pattern: ['#ChartPatterns', '#TechnicalAnalysis', '#TradingTips', '#LearnToTrade', '#StockTrading'],
    strategy: ['#TradingStrategy', '#StockTrading', '#TradingTips', '#SwingTrading', '#DayTrading'],
  };
  const pool = pools[type] || pools.news;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2);
}
