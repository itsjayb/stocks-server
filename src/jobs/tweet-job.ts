/**
 * Tweet job: fetch news from 3 APIs, aggregate, ask Ollama for tweet text, post to X.
 * Uses fallback templates if the LLM fails or returns empty.
 * Run once: tsx src/jobs/tweet-job.ts
 * Set DRY_RUN=true to skip posting to X.
 * Set POST_START_DATE=YYYY-MM-DD to only post on or after that date.
 */

import 'dotenv/config';
import { fetchAlpacaNews } from '../services/news/alpaca.js';
import { fetchFinnhubNews } from '../services/news/finnhub.js';
import { fetchAlphaVantageNews } from '../services/news/alphavantage.js';
import { aggregateNews, buildNewsString, buildPrompt } from '../services/aggregate-news.js';
import { generateTweet } from '../services/ollama.js';
import { postTweet } from '../services/x-post.js';
import { getFallbackTweet } from '../services/templates.js';
import { getTrendingSymbols } from '../services/trending.js';
import { readFile } from 'fs/promises';

const DRY_RUN = process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';
const SKIP_POST = process.env.SKIP_POST === 'true' || process.env.SKIP_POST === '1';

function isBeforeStartDate(): boolean {
  const start = process.env.POST_START_DATE;
  if (!start) return false;
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return false;
  startDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today < startDate;
}

async function run(): Promise<void> {
  console.log('[tweet-job] Starting…');
  if (DRY_RUN) console.log('[tweet-job] DRY_RUN=true – will not post to X');

  if (isBeforeStartDate()) {
    console.log('[tweet-job] Before POST_START_DATE; skipping.');
    return;
  }

  try {
    const [alpaca, finnhub, alphavantage] = await Promise.all([
      fetchAlpacaNews(),
      fetchFinnhubNews(),
      fetchAlphaVantageNews(),
    ]);

    const items = aggregateNews([alpaca, finnhub, alphavantage]);

    let tweetText = '';

    if (items.length > 0) {
      const newsString = buildNewsString(items);
      const prompt = buildPrompt(newsString);

      try {
        tweetText = (await generateTweet(prompt))?.trim() || '';
      } catch (err) {
        console.warn('[tweet-job] LLM failed, using fallback template:', (err as Error).message);
      }

      if (!tweetText) {
        tweetText = getFallbackTweet(items);
        console.log('[tweet-job] Using fallback template (LLM empty or failed).');
      }
    } else {
      tweetText = getFallbackTweet([]);
      console.log('[tweet-job] No news items; using fallback template.');
    }

    // Load candidate symbols from config if available and append trending cash-tags
    async function loadCandidateSymbols(): Promise<string[]> {
      try {
        const raw = await readFile(new URL('../../config/stocks-to-scan.json', import.meta.url));
        const parsed = JSON.parse(raw.toString());
        if (Array.isArray(parsed?.symbols)) return parsed.symbols;
      } catch (err) {
        // ignore and fallback
      }
      return ['SPY', 'AAPL', 'QQQ'];
    }

    try {
      const candidates = await loadCandidateSymbols();
      let top = await getTrendingSymbols(candidates, 3);
      if (!top || top.length === 0) {
        top = (candidates && candidates.length) ? candidates.slice(0, 3) : ['SPY', 'AAPL', 'QQQ'];
      }
      if (top && top.length) {
        const offset = new Date().getDate() % top.length;
        const rotated = top.slice(offset).concat(top.slice(0, offset));
        const cashTags = rotated.map((s) => `$${s}`).join(' ');
        tweetText = `${tweetText} ${cashTags}`;
      }
    } catch (err) {
      console.warn('[tweet-job] Could not fetch trending symbols:', (err as Error).message);
    }

    if (!tweetText) {
      console.warn('[tweet-job] No tweet text; skipping.');
      return;
    }

    console.log('[tweet-job] Tweet:', tweetText.slice(0, 80) + (tweetText.length > 80 ? '…' : ''));

    if (DRY_RUN || SKIP_POST) {
      if (SKIP_POST) {
        console.log('[tweet-job] SKIP_POST=true — posting is commented out.');
      } else {
        console.log('[tweet-job] Dry run – not posting to X.');
      }
      console.log('[tweet-job] Would post the following tweet:');
      console.log(tweetText);
      return;
    }

    const result = await postTweet(tweetText);
    if (result.success) {
      console.log('[tweet-job] Posted to X. Tweet ID:', result.id);
    } else {
      console.error('[tweet-job] X post failed:', result.error);
    }
  } catch (err) {
    console.error('[tweet-job] Error:', (err as Error).message);
    throw err;
  }
}

run();
