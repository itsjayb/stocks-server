/**
 * Post tweets to X (Twitter) via API v2 using OAuth 1.0a.
 * Supports: plain text, polls, media attachments, and threads.
 */

import crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import type { PostTweetResult, PostTweetOptions, PollOptions } from '../types.js';

const POST_URL = 'https://api.twitter.com/2/tweets';
const MEDIA_UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json';
const MAX_TWEET_LENGTH = 280;

function getOAuth() {
  const key = process.env.X_API_KEY;
  const secret = process.env.X_API_SECRET;
  if (!key || !secret) {
    throw new Error('Missing X_API_KEY or X_API_SECRET');
  }
  return new OAuth({
    consumer: { key, secret },
    signature_method: 'HMAC-SHA1',
    hash_function(baseString: string, key: string) {
      return crypto.createHmac('sha1', key).update(baseString).digest('base64');
    },
  });
}

function getTokens() {
  const key = process.env.X_ACCESS_TOKEN;
  const secret = process.env.X_ACCESS_TOKEN_SECRET;
  if (!key || !secret) {
    throw new Error('Missing X_ACCESS_TOKEN or X_ACCESS_TOKEN_SECRET');
  }
  return { key, secret };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Upload media (image buffer) to X via v1.1 media/upload endpoint.
 * Returns the media_id_string to attach to a tweet.
 */
export async function uploadMedia(imageBuffer: Buffer, mimeType = 'image/png'): Promise<string | null> {
  try {
    const tokens = getTokens();
    const oauth = getOAuth();

    const base64Data = imageBuffer.toString('base64');

    const requestData = {
      method: 'POST' as const,
      url: MEDIA_UPLOAD_URL,
      data: {
        media_data: base64Data,
      },
    };

    const authHeader = oauth.toHeader(oauth.authorize(requestData, tokens));

    const body = new URLSearchParams();
    body.set('media_data', base64Data);
    if (mimeType) body.set('media_type', mimeType);

    const res = await fetch(MEDIA_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: authHeader.Authorization,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[x-post] Media upload failed:', res.status, errText.slice(0, 300));
      return null;
    }

    const data = (await res.json()) as { media_id_string?: string };
    if (!data.media_id_string) {
      console.error('[x-post] Media upload response missing media_id_string');
      return null;
    }

    console.log('[x-post] Media uploaded:', data.media_id_string);
    return data.media_id_string;
  } catch (err) {
    console.error('[x-post] Media upload error:', (err as Error).message);
    return null;
  }
}

/**
 * Post a tweet with optional media, poll, or reply-to (for threads).
 */
export async function postTweet(
  textOrOptions: string | PostTweetOptions
): Promise<PostTweetResult> {
  const opts: PostTweetOptions = typeof textOrOptions === 'string'
    ? { text: textOrOptions }
    : textOrOptions;

  const trimmed = typeof opts.text === 'string' ? opts.text.trim().slice(0, MAX_TWEET_LENGTH) : '';
  if (!trimmed) {
    return { success: false, error: 'Tweet text is empty' };
  }

  let tokens: { key: string; secret: string };
  try {
    tokens = getTokens();
  } catch {
    return { success: false, error: 'Missing X_ACCESS_TOKEN or X_ACCESS_TOKEN_SECRET' };
  }

  const oauth = getOAuth();
  const requestData = { method: 'POST' as const, url: POST_URL };
  const authHeader = oauth.toHeader(oauth.authorize(requestData, tokens));

  function buildBody(bodyText: string) {
    const payload: Record<string, unknown> = { text: bodyText };

    if (opts.media_ids?.length) {
      payload.media = { media_ids: opts.media_ids };
    }
    if (opts.poll) {
      payload.poll = {
        options: opts.poll.options.map((o) => o.slice(0, 25)),
        duration_minutes: opts.poll.duration_minutes,
      };
    }
    if (opts.reply_to) {
      payload.reply = { in_reply_to_tweet_id: opts.reply_to };
    }

    return JSON.stringify(payload);
  }

  async function doPost(bodyText: string) {
    const res = await fetch(POST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader.Authorization,
      },
      body: buildBody(bodyText),
    });

    const data = (await res.json().catch(() => ({}))) as {
      data?: { id?: string };
      detail?: string;
      title?: string;
      error?: string;
    };
    return { res, data } as const;
  }

  const maxAttempts = 3;
  let attempt = 0;
  let lastErr: { status: number; msg: string } | null = null;

  while (attempt < maxAttempts) {
    const resp = await doPost(trimmed);
    if (resp.res.ok) return { success: true, id: resp.data.data?.id };

    const errMsg = resp.data.detail || resp.data.title || resp.data.error || JSON.stringify(resp.data);

    if (resp.res.status === 403 && /duplicate/i.test(errMsg)) {
      const altText = `${trimmed} 🔁`;
      const retry = await doPost(altText.slice(0, MAX_TWEET_LENGTH));
      if (retry.res.ok) return { success: true, id: retry.data.data?.id };
      const retryErr = retry.data.detail || retry.data.title || retry.data.error || JSON.stringify(retry.data);
      return { success: false, error: `X API ${retry.res.status}: ${retryErr}` };
    }

    lastErr = { status: resp.res.status, msg: errMsg };

    if ((resp.res.status === 429 || resp.res.status >= 500) && attempt < maxAttempts - 1) {
      const retryAfter = Number(resp.res.headers.get('retry-after')) || Math.pow(2, attempt) * 1000;
      await sleep(retryAfter);
      attempt += 1;
      continue;
    }

    break;
  }

  return { success: false, error: `X API ${lastErr?.status || 0}: ${lastErr?.msg || 'unknown error'}` };
}

/**
 * Post a tweet with a poll attached.
 */
export async function postTweetWithPoll(
  text: string,
  pollOptions: string[],
  durationMinutes = 1440
): Promise<PostTweetResult> {
  return postTweet({
    text,
    poll: { options: pollOptions, duration_minutes: durationMinutes },
  });
}

/**
 * Post a tweet with media (image) attached.
 */
export async function postTweetWithMedia(
  text: string,
  imageBuffer: Buffer,
  mimeType = 'image/png'
): Promise<PostTweetResult> {
  const mediaId = await uploadMedia(imageBuffer, mimeType);
  if (!mediaId) {
    console.warn('[x-post] Media upload failed, posting without image.');
    return postTweet(text);
  }
  return postTweet({ text, media_ids: [mediaId] });
}

/**
 * Post a thread (array of tweet texts). Each tweet replies to the previous one.
 * Returns the result of the first tweet (thread head).
 */
export async function postThread(tweets: string[]): Promise<PostTweetResult> {
  if (!tweets.length) return { success: false, error: 'Empty thread' };

  const firstResult = await postTweet(tweets[0]);
  if (!firstResult.success || !firstResult.id) return firstResult;

  let parentId = firstResult.id;
  for (let i = 1; i < tweets.length; i++) {
    await sleep(1000);
    const replyResult = await postTweet({ text: tweets[i], reply_to: parentId });
    if (replyResult.success && replyResult.id) {
      parentId = replyResult.id;
    } else {
      console.warn(`[x-post] Thread tweet ${i + 1} failed:`, replyResult.error);
    }
  }

  return firstResult;
}

/**
 * Fetch engagement metrics for a tweet via X API v2.
 */
export async function fetchTweetMetrics(tweetId: string): Promise<{
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
} | null> {
  try {
    const tokens = getTokens();
    const oauth = getOAuth();
    const url = `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`;
    const requestData = { method: 'GET' as const, url };
    const authHeader = oauth.toHeader(oauth.authorize(requestData, tokens));

    const res = await fetch(url, {
      headers: { Authorization: authHeader.Authorization },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      data?: {
        public_metrics?: {
          impression_count?: number;
          like_count?: number;
          retweet_count?: number;
          reply_count?: number;
          quote_count?: number;
        };
      };
    };

    const m = data.data?.public_metrics;
    if (!m) return null;

    return {
      impressions: m.impression_count ?? 0,
      likes: m.like_count ?? 0,
      retweets: m.retweet_count ?? 0,
      replies: m.reply_count ?? 0,
      quotes: m.quote_count ?? 0,
    };
  } catch (err) {
    console.warn('[x-post] Failed to fetch tweet metrics:', (err as Error).message);
    return null;
  }
}
