import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateNews,
  buildNewsString,
  buildPrompt,
  buildPromptForType,
  buildPollPrompt,
  pickTweetType,
  shouldUsePoll,
  pickHashtags,
  pickCta,
} from '../src/services/aggregate-news.js';
import type { NewsItem } from '../src/types.js';

test('aggregateNews merges, deduplicates, sorts and limits items', () => {
  const a: NewsItem[] = [
    { headline: 'A1', summary: 's1', url: 'https://x/1', source: 'S', date: '2026-02-19T12:00:00Z' },
    { headline: 'A2', summary: 's2', url: 'https://x/2', source: 'S', date: '2026-02-18T12:00:00Z' },
  ];
  const b: NewsItem[] = [
    { headline: 'A1', summary: 's1', url: 'https://x/1', source: 'S', date: '2026-02-19T12:00:00Z' }, // dup
    { headline: 'B1', summary: 's3', url: 'https://x/3', source: 'S', date: '2026-02-20T09:00:00Z' },
  ];

  const combined = aggregateNews([a, b]);
  assert.strictEqual(combined.length, 3);
  assert.strictEqual(combined[0].headline, 'B1');
  assert.strictEqual(combined[1].headline, 'A1');
  assert.strictEqual(combined[2].headline, 'A2');
});

test('buildNewsString formats items into lines', () => {
  const items: NewsItem[] = [
    { headline: 'H', summary: 'Summary text', url: 'https://u', source: 'Src', date: '' },
  ];
  const str = buildNewsString(items);
  assert.match(str, /\[Src\] H/);
  assert.match(str, /Summary text/);
  assert.match(str, /Link: https:\/\/u/);
});

test('buildPrompt includes site description and news', () => {
  const news = '- [Src] H';
  const prompt = buildPrompt(news);
  assert.match(prompt, /Market news:/);
  assert.match(prompt, /H/);
  assert.match(prompt, /learnstockmarket.online/);
});

// --- buildPromptForType ---

test('buildPromptForType news includes emotional framing and CTA', () => {
  const prompt = buildPromptForType('- [Src] headline', 'news');
  assert.match(prompt, /NEWS ONLY/);
  assert.match(prompt, /Do NOT add a website link/);
  assert.match(prompt, /emotional/i);
  assert.match(prompt, /engagement hook/i);
  assert.match(prompt, /greed, fear, or overconfidence/);
});

test('buildPromptForType pattern includes pattern promotion and CTA', () => {
  const prompt = buildPromptForType('- [Src] headline', 'pattern');
  assert.match(prompt, /pattern/i);
  assert.match(prompt, /Do NOT include any stock tickers/);
  assert.match(prompt, /engagement hook/i);
});

test('buildPromptForType strategy includes strategy promotion and CTA', () => {
  const prompt = buildPromptForType('- [Src] headline', 'strategy');
  assert.match(prompt, /strategy/i);
  assert.match(prompt, /You MAY include/);
  assert.match(prompt, /engagement hook/i);
});

test('buildPromptForType pattern with patternOrStrategy uses specific item', () => {
  const prompt = buildPromptForType('- news', 'pattern', {
    patternOrStrategy: { name: 'Head & Shoulders', description: 'A reversal pattern', url: 'https://example.com/tw/pattern/head-shoulders', kind: 'pattern' },
  });
  assert.match(prompt, /Head & Shoulders/);
  assert.match(prompt, /https:\/\/example\.com\/tw\/pattern\/head-shoulders/);
});

test('buildPromptForType strategy with candidateSymbols includes tickers', () => {
  const prompt = buildPromptForType('- news', 'strategy', {
    candidateSymbols: ['AAPL', 'TSLA', 'SPY'],
  });
  assert.match(prompt, /\$AAPL/);
  assert.match(prompt, /\$TSLA/);
  assert.match(prompt, /\$SPY/);
});

// --- buildPollPrompt ---

test('buildPollPrompt news generates JSON instruction', () => {
  const prompt = buildPollPrompt('- [Src] headline', 'news', { candidateSymbols: ['AAPL'] });
  assert.match(prompt, /valid JSON/i);
  assert.match(prompt, /"text"/);
  assert.match(prompt, /"options"/);
  assert.match(prompt, /\$AAPL/);
});

test('buildPollPrompt pattern does not include tickers', () => {
  const prompt = buildPollPrompt('- [Src] headline', 'pattern');
  assert.match(prompt, /Do NOT include stock tickers/);
});

test('buildPollPrompt strategy allows ETFs', () => {
  const prompt = buildPollPrompt('- [Src] headline', 'strategy');
  assert.match(prompt, /ETF/i);
});

// --- pickTweetType ---

test('pickTweetType returns a valid tweet type', () => {
  const types = new Set<string>();
  for (let i = 0; i < 100; i++) {
    types.add(pickTweetType());
  }
  for (const t of types) {
    assert.ok(['news', 'pattern', 'strategy'].includes(t), `unexpected type: ${t}`);
  }
});

// --- shouldUsePoll ---

test('shouldUsePoll never returns true for pattern type', () => {
  for (let i = 0; i < 50; i++) {
    assert.strictEqual(shouldUsePoll('pattern'), false);
  }
});

test('shouldUsePoll can return true for news type', () => {
  let sawTrue = false;
  for (let i = 0; i < 200; i++) {
    if (shouldUsePoll('news')) { sawTrue = true; break; }
  }
  assert.ok(sawTrue, 'shouldUsePoll should occasionally return true for news');
});

// --- pickHashtags ---

test('pickHashtags returns 1-2 hashtags for each type', () => {
  for (const type of ['news', 'pattern', 'strategy'] as const) {
    const tags = pickHashtags(type);
    assert.ok(tags.length >= 1 && tags.length <= 2, `expected 1-2 tags, got ${tags.length}`);
    for (const tag of tags) {
      assert.ok(tag.startsWith('#'), `tag should start with #: ${tag}`);
    }
  }
});

// --- pickCta ---

test('pickCta returns a non-empty string', () => {
  const cta = pickCta();
  assert.ok(cta.length > 0);
});
