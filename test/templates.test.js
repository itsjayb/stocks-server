import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFallbackTweet } from '../src/services/templates.js';

test('getFallbackTweet uses headline templates and truncates headline', () => {
  const longHeadline = 'H'.repeat(200);
  const items = [{ headline: longHeadline }];

  const origRand = Math.random;
  try {
    Math.random = () => 0; // pick first template deterministically
    const tweet = getFallbackTweet(items);
    // should start with truncated headline (max 120 chars)
    assert.strictEqual(tweet.slice(0, 120), longHeadline.slice(0, 120));
    // should contain domain
    assert.match(tweet, /learnstockmarket.online/);
    assert.ok(tweet.length <= 280);
  } finally {
    Math.random = origRand;
  }
});

test('getFallbackTweet without items returns a static template', () => {
  const origRand = Math.random;
  try {
    Math.random = () => 0; // deterministic
    const tweet = getFallbackTweet([]);
    // should contain domain or patterns path
    assert.match(tweet, /learnstockmarket.online/);
    assert.ok(tweet.length <= 280);
  } finally {
    Math.random = origRand;
  }
});
