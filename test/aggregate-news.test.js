import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateNews, buildNewsString, buildPrompt } from '../src/services/aggregate-news.js';

test('aggregateNews merges, deduplicates, sorts and limits items', () => {
  const a = [
    { headline: 'A1', summary: 's1', url: 'https://x/1', source: 'S', date: '2026-02-19T12:00:00Z' },
    { headline: 'A2', summary: 's2', url: 'https://x/2', source: 'S', date: '2026-02-18T12:00:00Z' },
  ];
  const b = [
    { headline: 'A1', summary: 's1', url: 'https://x/1', source: 'S', date: '2026-02-19T12:00:00Z' }, // dup
    { headline: 'B1', summary: 's3', url: 'https://x/3', source: 'S', date: '2026-02-20T09:00:00Z' },
  ];

  const combined = aggregateNews([a, b]);
  // Expect unique urls, sorted by date desc
  assert.strictEqual(combined.length, 3);
  assert.strictEqual(combined[0].headline, 'B1');
  assert.strictEqual(combined[1].headline, 'A1');
  assert.strictEqual(combined[2].headline, 'A2');
});

test('buildNewsString formats items into lines', () => {
  const items = [
    { headline: 'H', summary: 'Summary text', url: 'https://u', source: 'Src' },
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
  // PROMO URL default should be present
  assert.match(prompt, /learnstockmarket.online/);
});
