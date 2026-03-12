/**
 * Tweet job: fetch news from 3 APIs, aggregate, ask Ollama for tweet text, post to X.
 * Uses fallback templates if the LLM fails or returns empty.
 *
 * Engagement-boosted pipeline:
 * - Weighted type selection (50% news, 30% pattern, 20% strategy)
 * - Emotional framing + CTAs baked into prompts
 * - 25% chance of poll tweets for news/strategy types
 * - Auto-generated stock chart images attached as media
 * - Strategic hashtag appending
 * - Post-tweet analytics logging
 *
 * Run once: tsx src/jobs/tweet-job.ts
 * Set DRY_RUN=true to skip posting to X.
 * Set POST_START_DATE=YYYY-MM-DD to only post on or after that date.
 */

import 'dotenv/config';
import { fetchAlpacaNews } from '../services/news/alpaca.js';
import { fetchFinnhubNews } from '../services/news/finnhub.js';
import { fetchAlphaVantageNews } from '../services/news/alphavantage.js';
import {
  aggregateNews,
  buildNewsString,
  buildPromptForType,
  buildPollPrompt,
  pickTweetType,
  shouldUsePoll,
  pickHashtags,
  pickCta,
} from '../services/aggregate-news.js';
import { generateTweet } from '../services/ollama.js';
import { postTweet, postTweetWithPoll, postTweetWithMedia } from '../services/x-post.js';
import { getFallbackTweet, getFallbackPoll } from '../services/templates.js';
import { getTrendingSymbols } from '../services/trending.js';
import { getSmartMovers } from '../services/smart-movers.js';
import { pickPattern, pickStrategy } from '../services/pattern-strategy-pick.js';
import { generateChartImage, extractChartSymbol } from '../services/chart-gen.js';
import { logTweetPosted } from '../services/tweet-analytics.js';
import { readFile, writeFile } from 'fs/promises';
import { STOCKS } from '../stocks.js';
import type { PatternScanConfig } from '../types.js';

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

/**
 * Try to parse a poll response from the LLM. Expected: { text, options: string[] }.
 */
function parsePollResponse(raw: string): { text: string; options: string[] } | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as { text?: string; options?: string[] };
    if (typeof parsed.text !== 'string' || !Array.isArray(parsed.options)) return null;
    const options = parsed.options
      .filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
      .map((o) => o.slice(0, 25));
    if (options.length < 2 || options.length > 4) return null;
    return { text: parsed.text.slice(0, 280), options };
  } catch {
    return null;
  }
}

/**
 * Append hashtags to tweet text only if they fit within the 280-char limit.
 */
function appendHashtags(text: string, hashtags: string[]): string {
  const suffix = ' ' + hashtags.join(' ');
  if (text.length + suffix.length <= 280) {
    return text + suffix;
  }
  if (hashtags.length > 1 && text.length + (' ' + hashtags[0]).length <= 280) {
    return text + ' ' + hashtags[0];
  }
  return text;
}

/**
 * Check if the tweet text already contains a CTA-like question or engagement hook.
 */
function hasCta(text: string): boolean {
  return /\?|👇|💬|📈📉|drop your|your (take|play|move)|agree|disagree|what do you|would you/i.test(text);
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

    const tweetType = pickTweetType();
    const usePoll = shouldUsePoll(tweetType);
    console.log('[tweet-job] Type:', tweetType, usePoll ? '(poll)' : '');

    let candidates: string[] = [];
    try {
      const raw = await readFile(new URL('../../config/stocks-to-scan.json', import.meta.url), 'utf8');
      const config: PatternScanConfig = JSON.parse(raw);
      const stocksSet = new Set(STOCKS);
      if (config.useMasterList === true) {
        candidates = [...STOCKS];
        if (typeof config.limit === 'number' && config.limit > 0) {
          candidates = candidates.slice(0, config.limit);
        } else {
          candidates = candidates.slice(0, 500);
        }
      } else if (Array.isArray(config.symbols) && config.symbols.length > 0) {
        candidates = config.symbols.filter((s) => stocksSet.has(s));
      }
    } catch {
      // ignore
    }
    if (candidates.length === 0) candidates = ['SPY', 'AAPL', 'QQQ'];

    let patternOrStrategy: Awaited<ReturnType<typeof pickPattern>> | Awaited<ReturnType<typeof pickStrategy>> = null;
    if (tweetType === 'pattern') {
      patternOrStrategy = await pickPattern();
    } else if (tweetType === 'strategy') {
      patternOrStrategy = await pickStrategy();
    }

    let tweetText = '';
    let pollData: { text: string; options: string[] } | null = null;

    // ── Poll path ──
    if (usePoll && items.length > 0) {
      const newsString = buildNewsString(items);
      const pollPrompt = buildPollPrompt(newsString, tweetType, {
        candidateSymbols: candidates,
        ...(patternOrStrategy && { patternOrStrategy }),
      });

      try {
        console.log('[tweet-job] Generating poll via Ollama…');
        const rawPoll = (await generateTweet(pollPrompt))?.trim() || '';
        pollData = parsePollResponse(rawPoll);
        if (pollData) {
          tweetText = pollData.text;
          console.log('[tweet-job] Poll generated:', pollData.text, pollData.options);
        }
      } catch (err) {
        console.warn('[tweet-job] Poll generation failed, falling back to normal tweet:', (err as Error).message);
      }

      if (!pollData) {
        const fallbackPoll = getFallbackPoll();
        pollData = fallbackPoll;
        tweetText = fallbackPoll.text;
        console.log('[tweet-job] Using fallback poll.');
      }
    }

    // ── Normal tweet path ──
    if (!tweetText && items.length > 0) {
      const newsString = buildNewsString(items);
      const prompt = buildPromptForType(newsString, tweetType, {
        candidateSymbols: candidates,
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
        console.error('[tweet-job] LLM failed, using fallback template:', (err as Error).message);
        console.error('[tweet-job] LLM error details:', err);
        console.log('[tweet-job] Prompt preview (truncated):', prompt.slice(0, 2000));
      }

      if (!tweetText) {
        tweetText = getFallbackTweet(items, tweetType, patternOrStrategy ?? undefined);
        console.log('[tweet-job] Using fallback template (LLM empty or failed).');
      }
    } else if (!tweetText) {
      tweetText = getFallbackTweet([], tweetType, patternOrStrategy ?? undefined);
      console.log('[tweet-job] No news items; using fallback template.');
    }

    // ── Cash tag enrichment (unchanged logic) ──
    if (tweetType === 'news') {
      const hasTicker = /\$[A-Z]{1,5}\b/.test(tweetText);
      if (!hasTicker) {
        try {
          let top: string[] = [];
          try {
            const { movers } = await getSmartMovers({ top: 5 });
            const gainers = movers.filter((m) => m.direction === 'gainer').slice(0, 3);
            if (gainers.length > 0) top = gainers.map((m) => m.symbol);
          } catch {
            // ignore
          }
          if (top.length === 0) top = await getTrendingSymbols(candidates, 3);
          if (top.length === 0) top = candidates.length ? candidates.slice(0, 3) : ['SPY', 'AAPL', 'QQQ'];
          if (top.length) {
            const offset = new Date().getDate() % top.length;
            const rotated = top.slice(offset).concat(top.slice(0, offset));
            const cashTags = rotated.slice(0, 3).map((s) => `$${s}`).join(' ');
            tweetText = `${tweetText} ${cashTags}`;
          }
        } catch (err) {
          console.warn('[tweet-job] Could not fetch fallback symbols:', (err as Error).message);
        }
      }
    } else if (tweetType === 'strategy') {
      const hasTicker = /\$[A-Z]{1,5}\b/.test(tweetText);
      if (!hasTicker) {
        const etfs = ['SPY', 'QQQ', 'XLF'];
        const cashTags = etfs.map((s) => `$${s}`).join(' ');
        tweetText = `${tweetText} ${cashTags}`;
      }
    }

    // ── Append CTA if tweet doesn't already have one ──
    if (!pollData && !hasCta(tweetText)) {
      const cta = pickCta();
      if (tweetText.length + cta.length + 1 <= 280) {
        tweetText = `${tweetText} ${cta}`;
      }
    }

    // ── Append hashtags if they fit ──
    const hashtags = pickHashtags(tweetType);
    tweetText = appendHashtags(tweetText, hashtags);

    // ── Truncate to 280 ──
    if (tweetText.length > 280) {
      tweetText = tweetText.slice(0, 277) + '…';
    }

    if (!tweetText) {
      console.warn('[tweet-job] No tweet text; skipping.');
      return;
    }

    // ── Dedup check ──
    const LAST_TWEET_PATH = new URL('../../config/last_tweet.txt', import.meta.url);
    try {
      const prev = await readFile(LAST_TWEET_PATH, 'utf8').catch(() => '');
      if (prev && prev.trim() === tweetText.trim()) {
        console.log('[tweet-job] Tweet is identical to last posted tweet; skipping to avoid duplicate.');
        return;
      }
    } catch {
      // ignore read errors
    }

    // ── Generate chart image for visual boost ──
    let chartBuffer: Buffer | null = null;
    if (!pollData) {
      const chartSymbol = extractChartSymbol(tweetText, candidates);
      if (chartSymbol) {
        try {
          console.log('[tweet-job] Generating chart for', chartSymbol);
          chartBuffer = await generateChartImage(chartSymbol);
          if (chartBuffer) {
            console.log('[tweet-job] Chart generated:', chartBuffer.length, 'bytes');
          }
        } catch (err) {
          console.warn('[tweet-job] Chart generation failed:', (err as Error).message);
        }
      }
    }

    console.log('[tweet-job] Tweet:', tweetText.slice(0, 80) + (tweetText.length > 80 ? '…' : ''));
    if (pollData) console.log('[tweet-job] Poll options:', pollData.options);
    if (chartBuffer) console.log('[tweet-job] Attaching chart image');

    if (DRY_RUN || SKIP_POST) {
      if (SKIP_POST) {
        console.log('[tweet-job] SKIP_POST=true — posting is commented out.');
      } else {
        console.log('[tweet-job] Dry run – not posting to X.');
      }
      console.log('[tweet-job] Would post the following tweet:');
      console.log(tweetText);
      if (pollData) console.log('[tweet-job] Poll:', pollData.options);
      if (chartBuffer) console.log('[tweet-job] With chart image attached');
      try {
        await writeFile(new URL('../../config/last_tweet.txt', import.meta.url), tweetText.trim(), 'utf8');
      } catch {
        // ignore write errors in dry run
      }
      return;
    }

    // ── Post to X ──
    let result;
    if (pollData) {
      result = await postTweetWithPoll(tweetText, pollData.options);
    } else if (chartBuffer) {
      result = await postTweetWithMedia(tweetText, chartBuffer);
    } else {
      result = await postTweet(tweetText);
    }

    if (result.success) {
      console.log('[tweet-job] Posted to X. Tweet ID:', result.id);
      try {
        await writeFile(new URL('../../config/last_tweet.txt', import.meta.url), tweetText.trim(), 'utf8');
      } catch (err) {
        console.warn('[tweet-job] Could not write last_tweet file:', (err as Error).message);
      }

      // Log to analytics
      if (result.id) {
        try {
          await logTweetPosted({
            tweet_id: result.id,
            text: tweetText,
            tweet_type: tweetType,
            created_at: new Date().toISOString(),
            had_poll: !!pollData,
            had_media: !!chartBuffer,
          });
        } catch (err) {
          console.warn('[tweet-job] Analytics logging failed:', (err as Error).message);
        }
      }
    } else {
      console.error('[tweet-job] X post failed:', result.error);
    }
  } catch (err) {
    console.error('[tweet-job] Error:', (err as Error).message);
    throw err;
  }
}

run();
