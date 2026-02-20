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

  const res = await fetch(POST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader.Authorization,
    },
    body: JSON.stringify({ text: trimmed }),
  });

  const data = (await res.json().catch(() => ({}))) as { data?: { id?: string }; detail?: string; title?: string; error?: string };

  if (!res.ok) {
    const errMsg = data.detail || data.title || data.error || JSON.stringify(data);
    return { success: false, error: `X API ${res.status}: ${errMsg}` };
  }

  const id = data.data?.id;
  return { success: true, id };
}
