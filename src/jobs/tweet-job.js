/**
 * Tweet job: fetch news from 3 APIs, aggregate, ask Ollama for tweet text, post to X.
 * Uses fallback templates if the LLM fails or returns empty.
 * Run once: node src/jobs/tweet-job.js
 * Set DRY_RUN=true to skip posting to X.
 * Set POST_START_DATE=YYYY-MM-DD to only post on or after that date.
 */

import 'dotenv/config';
import { fetchAlpacaNews } from '../services/news/alpaca.js';
import { fetchFinnhubNews } from '../services/news/finnhub.js';
import { fetchAlphaVantageNews } from '../services/news/alphavantage.js';
import { aggregateNews, buildNewsString, buildPromptForType, getNextTweetType } from '../services/aggregate-news.js';
import { generateTweet } from '../services/ollama.js';
import { postTweet } from '../services/x-post.js';
import { getFallbackTweet } from '../services/templates.js';
import { pickPattern, pickStrategy } from '../services/pattern-strategy-pick.js';
import { enforcePromoTrackingPath } from '../services/url-tracking.js';
import { readFile, writeFile } from 'fs/promises';

const DRY_RUN = process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';
const SKIP_POST = process.env.SKIP_POST === 'true' || process.env.SKIP_POST === '1';
const LAST_TWEET_PATH = new URL('../../config/last_tweet.txt', import.meta.url);
const LAST_TWEET_TYPE_PATH = new URL('../../config/last_tweet_type.txt', import.meta.url);

function isBeforeStartDate() {
  const start = process.env.POST_START_DATE;
  if (!start) return false;
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return false;
  startDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today < startDate;
}

async function pickTweetTypeForRun() {
  let previousType = null;
  try {
    const raw = await readFile(LAST_TWEET_TYPE_PATH, 'utf8');
    previousType = raw.trim() || null;
  } catch {
    // ignore missing/invalid state file
  }

  const nextType = getNextTweetType(previousType);
  try {
    await writeFile(LAST_TWEET_TYPE_PATH, nextType, 'utf8');
  } catch (err) {
    console.warn('[tweet-job] Could not persist last tweet type:', err.message);
  }

  console.log('[tweet-job] Tweet type selected:', { previousType, nextType });
  return nextType;
}

async function run() {
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
    const tweetType = await pickTweetTypeForRun();

    let patternOrStrategy = null;
    if (tweetType === 'pattern') {
      patternOrStrategy = await pickPattern();
    } else if (tweetType === 'strategy') {
      patternOrStrategy = await pickStrategy();
    }

    let tweetText = '';

    if (items.length > 0) {
      const newsString = buildNewsString(items);
      const prompt = buildPromptForType(newsString, tweetType, {
        ...(patternOrStrategy && { patternOrStrategy }),
      });

      try {
        console.log('[tweet-job] Calling Ollama', {
          baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
          envModel: process.env.OLLAMA_MODEL || null,
          tweetType,
          ...(patternOrStrategy && { patternOrStrategy: patternOrStrategy.name }),
          promptLength: prompt.length,
          promptPreview: prompt.slice(0, 1000),
        });

        tweetText = (await generateTweet(prompt))?.trim() || '';

        if (tweetText) {
          console.log('[tweet-job] Ollama returned text', { length: tweetText.length, preview: tweetText.slice(0, 200) });
        }
      } catch (err) {
        console.error('[tweet-job] LLM failed, using fallback template:', err.message);
        console.error('[tweet-job] LLM error details:', err);
        console.log('[tweet-job] Prompt preview (truncated):', prompt.slice(0, 2000));
      }

      if (!tweetText) {
        tweetText = getFallbackTweet(items, tweetType, patternOrStrategy ?? undefined);
        console.log('[tweet-job] Using fallback template (LLM empty or failed).');
      }
    } else {
      tweetText = getFallbackTweet([], tweetType, patternOrStrategy ?? undefined);
      console.log('[tweet-job] No news items; using fallback template.');
    }

    const trackedTweetText = enforcePromoTrackingPath(tweetText);
    if (trackedTweetText !== tweetText) {
      console.log('[tweet-job] Normalized promo URL(s) to /tw tracking path.');
      tweetText = trackedTweetText;
    }

    if (!tweetText) {
      console.warn('[tweet-job] No tweet text; skipping.');
      return;
    }

    // Prevent posting the exact same tweet back-to-back by storing last posted tweet.
    try {
      const prev = await readFile(LAST_TWEET_PATH, 'utf8').catch(() => '');
      if (prev && prev.trim() === tweetText.trim()) {
        console.log('[tweet-job] Tweet is identical to last posted tweet; skipping to avoid duplicate.');
        return;
      }
    } catch {
      // ignore read errors
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
      try {
        await writeFile(LAST_TWEET_PATH, tweetText.trim(), 'utf8');
      } catch {
        // ignore write errors in dry run
      }
      return;
    }

    const result = await postTweet(tweetText);
    if (result.success) {
      console.log('[tweet-job] Posted to X. Tweet ID:', result.id);
      try {
        await writeFile(LAST_TWEET_PATH, tweetText.trim(), 'utf8');
      } catch (err) {
        console.warn('[tweet-job] Could not write last_tweet file:', err.message);
      }
    } else {
      console.error('[tweet-job] X post failed:', result.error);
    }
  } catch (err) {
    console.error('[tweet-job] Error:', err.message);
    throw err;
  }
}

run();
