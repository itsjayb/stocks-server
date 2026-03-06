/**
 * Aggregate news from multiple sources, deduplicate, trim, and build the LLM prompt.
 * Includes canonical site description for learnstockmarket.online so tweets advertise correctly.
 */

const PROMO_URL = process.env.PROMO_WEBSITE_URL || 'https://learnstockmarket.online';
const MAX_ITEMS = 10;

const SITE_DESCRIPTION = `The site is ${PROMO_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')}. It teaches chart patterns (support/resistance, trend patterns) at /patterns, and trading strategies (entries, exits, risk) at /strategies. Content is organized as lessons so users can follow a path and track progress.`;

/**
 * @param {{ headline: string, summary: string, url: string, source: string, date: string }[][]} arrays
 * @returns {{ headline: string, summary: string, url: string, source: string, date: string }[]}
 */
export function aggregateNews(arrays) {
  const seen = new Set();
  const combined = [];

  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (!item?.headline) continue;
      const key = (item.url || item.headline).slice(0, 120);
      if (seen.has(key)) continue;
      seen.add(key);
      combined.push(item);
    }
  }

  combined.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  return combined.slice(0, MAX_ITEMS);
}

/**
 * Build the news string for the prompt.
 * @param {{ headline: string, summary: string, url: string, source: string }[]} items
 */
export function buildNewsString(items) {
  return items
    .map(
      (item) =>
        `- [${item.source}] ${item.headline}${item.summary ? ` ${item.summary.slice(0, 100)}` : ''}${item.url ? ` Link: ${item.url}` : ''}`
    )
    .join('\n');
}

/**
 * Build the full prompt for the LLM (system/context + task + news).
 */
export function buildPrompt(newsString) {
  const systemContext = `You write tweets for a stock market learning site. ${SITE_DESCRIPTION}

Your voice: Sound like a real person on X, not a bot or a press release. Be conversational, punchy, or a little opinionated. Share the news like you're telling your timeline what just happened — something you'd actually say. We want people to retweet, quote tweet, and reply. Hot takes, questions, or "wait for real?" energy are good when they fit.`;
  const task = `Using the market news below, write exactly one tweet.

Rules:
- Under 260 characters (we will append a few $TICKER symbols after your text).
- Share the news like a person: casual, engaging, human. Make people want to react and comment.
- You may naturally mention 1–2 stock tickers with $ (e.g. $AAPL, $TSLA) in your sentence when they fit the story.
- Optionally add a short CTA or link to ${PROMO_URL} only when it fits naturally — don't force it.
- Output only the tweet text. No quotes, no explanation, no "Tweet:" prefix.`;
  return `${systemContext}\n\n${task}\n\nMarket news:\n${newsString}`;
}
