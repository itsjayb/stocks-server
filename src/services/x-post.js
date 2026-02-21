/**
 * Post a tweet to X (Twitter) via API v2 using OAuth 1.0a.
 */

import crypto from 'crypto';
import OAuth from 'oauth-1.0a';

const POST_URL = 'https://api.twitter.com/2/tweets';
const MAX_TWEET_LENGTH = 280;

function getOAuth() {
  const consumer = {
    key: process.env.X_API_KEY,
    secret: process.env.X_API_SECRET,
  };
  if (!consumer.key || !consumer.secret) {
    throw new Error('Missing X_API_KEY or X_API_SECRET');
  }
  return new OAuth({
    consumer,
    signature_method: 'HMAC-SHA1',
    hash_function(baseString, key) {
      return crypto.createHmac('sha1', key).update(baseString).digest('base64');
    },
  });
}

/**
 * @param {string} text - Tweet text (will be truncated to 280 chars)
 * @returns {{ success: boolean, id?: string, error?: string }}
 */
export async function postTweet(text) {
  const trimmed = typeof text === 'string' ? text.trim().slice(0, MAX_TWEET_LENGTH) : '';
  if (!trimmed) {
    return { success: false, error: 'Tweet text is empty' };
  }

  const accessToken = {
    key: process.env.X_ACCESS_TOKEN,
    secret: process.env.X_ACCESS_TOKEN_SECRET,
  };
  if (!accessToken.key || !accessToken.secret) {
    return { success: false, error: 'Missing X_ACCESS_TOKEN or X_ACCESS_TOKEN_SECRET' };
  }

  const oauth = getOAuth();
  const requestData = {
    method: 'POST',
    url: POST_URL,
  };
  const authHeader = oauth.toHeader(oauth.authorize(requestData, accessToken));

  const res = await fetch(POST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader.Authorization,
    },
    body: JSON.stringify({ text: trimmed }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errMsg = data.detail || data.title || data.error || JSON.stringify(data);
    return { success: false, error: `X API ${res.status}: ${errMsg}` };
  }

  const id = data.data?.id;
  return { success: true, id };
}
