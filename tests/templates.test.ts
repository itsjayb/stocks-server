import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFallbackTweet, getFallbackPoll } from '../src/services/templates.js';
import type { NewsItem } from '../src/types.js';

test('getFallbackTweet uses headline templates and truncates headline', () => {
  const longHeadline = 'H'.repeat(200);
  const items: NewsItem[] = [{ headline: longHeadline, summary: '', url: '', source: '', date: '' }];

  const origRand = Math.random;
  try {
    Math.random = () => 0;
    const tweet = getFallbackTweet(items, 'news');
    assert.ok(tweet.includes(longHeadline.slice(0, 120)));
    assert.doesNotMatch(tweet, /learnstockmarket\.online/);
    assert.ok(tweet.length <= 280);
  } finally {
    Math.random = origRand;
  }
});

test('getFallbackTweet without items returns a static template with CTA', () => {
  const origRand = Math.random;
  try {
    Math.random = () => 0;
    const tweet = getFallbackTweet([], 'pattern');
    assert.match(tweet, /learnstockmarket.online/);
    assert.ok(tweet.length <= 280);
    // Should contain some engagement element
    assert.ok(/\?|👇|💬|🔥|🎯/.test(tweet), 'fallback should contain engagement element');
  } finally {
    Math.random = origRand;
  }
});

test('getFallbackTweet with type news has no website URL but has CTA', () => {
  const origRand = Math.random;
  try {
    Math.random = () => 0;
    const tweet = getFallbackTweet([], 'news');
    assert.doesNotMatch(tweet, /learnstockmarket\.online/);
    assert.ok(tweet.length <= 280);
    assert.ok(/\?|👇|💬|📊|📈/.test(tweet), 'news fallback should contain engagement element');
  } finally {
    Math.random = origRand;
  }
});

test('getFallbackTweet news with headline includes emotional hook', () => {
  const items: NewsItem[] = [{ headline: 'Fed raises rates', summary: '', url: '', source: '', date: '' }];
  const origRand = Math.random;
  try {
    Math.random = () => 0;
    const tweet = getFallbackTweet(items, 'news');
    assert.ok(tweet.includes('Fed raises rates'));
    assert.ok(/\?|👇|💬|🔥|📈/.test(tweet), 'should have engagement element');
  } finally {
    Math.random = origRand;
  }
});

test('getFallbackTweet strategy includes engagement CTA', () => {
  const tweet = getFallbackTweet([], 'strategy');
  assert.ok(tweet.length <= 280);
  assert.ok(/\?|👇|💬|🔥|🎯|📈/.test(tweet), 'strategy fallback should contain engagement element');
});

// --- getFallbackPoll ---

test('getFallbackPoll returns valid poll structure', () => {
  const poll = getFallbackPoll();
  assert.ok(typeof poll.text === 'string' && poll.text.length > 0);
  assert.ok(Array.isArray(poll.options));
  assert.ok(poll.options.length >= 2 && poll.options.length <= 4);
  for (const opt of poll.options) {
    assert.ok(typeof opt === 'string' && opt.length > 0 && opt.length <= 25);
  }
});
