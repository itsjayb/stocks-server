/**
 * Post a tweet to X (Twitter) via API v2 using OAuth 1.0a.
 */

import crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import type { PostTweetResult } from '../types.js';

const POST_URL = 'https://api.twitter.com/2/tweets';
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

export async function postTweet(text: string): Promise<PostTweetResult> {
  const trimmed = typeof text === 'string' ? text.trim().slice(0, MAX_TWEET_LENGTH) : '';
  if (!trimmed) {
    return { success: false, error: 'Tweet text is empty' };
  }

  const accessKey = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_TOKEN_SECRET;
  if (!accessKey || !accessSecret) {
    return { success: false, error: 'Missing X_ACCESS_TOKEN or X_ACCESS_TOKEN_SECRET' };
  }

  const oauth = getOAuth();
  const requestData = {
    method: 'POST',
    url: POST_URL,
  };
  const authHeader = oauth.toHeader(oauth.authorize(requestData, { key: accessKey, secret: accessSecret }));

  async function doPost(bodyText: string) {
    const res = await fetch(POST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader.Authorization,
      },
      body: JSON.stringify({ text: bodyText }),
    });

    const data = (await res.json().catch(() => ({}))) as { data?: { id?: string }; detail?: string; title?: string; error?: string };
    return { res, data } as const;
  }

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  const maxAttempts = 3;
  let attempt = 0;
  let lastErr: { status: number; msg: string } | null = null;

  while (attempt < maxAttempts) {
    const resp = await doPost(trimmed);
    if (resp.res.ok) return { success: true, id: resp.data.data?.id };

    const errMsg = resp.data.detail || resp.data.title || resp.data.error || JSON.stringify(resp.data);

    // If duplicate content, try a single gentle retry with a suffix
    if (resp.res.status === 403 && /duplicate/i.test(errMsg)) {
      const altText = `${trimmed} 🔁`;
      const retry = await doPost(altText.slice(0, MAX_TWEET_LENGTH));
      if (retry.res.ok) return { success: true, id: retry.data.data?.id };
      const retryErr = retry.data.detail || retry.data.title || retry.data.error || JSON.stringify(retry.data);
      return { success: false, error: `X API ${retry.res.status}: ${retryErr}` };
    }

    lastErr = { status: resp.res.status, msg: errMsg };

    // For rate limits and server errors, retry with exponential backoff
    if ((resp.res.status === 429 || resp.res.status >= 500) && attempt < maxAttempts - 1) {
      const retryAfter = Number(resp.res.headers.get('retry-after')) || Math.pow(2, attempt) * 1000;
      await sleep(retryAfter);
      attempt += 1;
      continue;
    }

    // Non-retryable error or out of attempts
    break;
  }

  return { success: false, error: `X API ${lastErr?.status || 0}: ${lastErr?.msg || 'unknown error'}` };
}
