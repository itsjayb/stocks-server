import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureTwReferralInTweet,
  hasTwReferralLink,
  getPromoBaseUrl,
} from '../src/services/tweet-promo-url.js';

test('hasTwReferralLink detects /tw/ under promo base', () => {
  const base = 'https://learnstockmarket.online';
  assert.equal(hasTwReferralLink('Read more https://learnstockmarket.online/tw/patterns', base), true);
  assert.equal(hasTwReferralLink('https://learnstockmarket.online/tw/pattern/head-shoulders', base), true);
  assert.equal(hasTwReferralLink('Visit https://learnstockmarket.online/', base), false);
  assert.equal(hasTwReferralLink('Visit https://learnstockmarket.online/tw', base), false);
});

test('ensureTwReferralInTweet leaves news tweets unchanged', () => {
  const t = ensureTwReferralInTweet('Fed holds rates.', 'news', null, getPromoBaseUrl());
  assert.strictEqual(t, 'Fed holds rates.');
});

test('ensureTwReferralInTweet appends /tw/ list URL when promo has no tracking link', () => {
  const base = getPromoBaseUrl();
  const p = ensureTwReferralInTweet('Chart patterns matter.', 'pattern', null, base);
  assert.match(p, new RegExp(`${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/tw/patterns`));
});

test('ensureTwReferralInTweet appends strategy list when type is strategy and no link', () => {
  const base = getPromoBaseUrl();
  const s = ensureTwReferralInTweet('Plan your exits.', 'strategy', null, base);
  assert.match(s, new RegExp(`${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/tw/strategies`));
});

test('ensureTwReferralInTweet uses specific lesson URL when provided', () => {
  const base = getPromoBaseUrl();
  const url = `${base}/tw/pattern/double-top`;
  const out = ensureTwReferralInTweet('Double tops matter.', 'pattern', { kind: 'pattern', url }, base);
  assert.match(out, /\/tw\/pattern\/double-top/);
});

test('ensureTwReferralInTweet does not duplicate when /tw/ already present', () => {
  const base = getPromoBaseUrl();
  const url = `${base}/tw/strategies`;
  const one = ensureTwReferralInTweet(`Learn more ${url}`, 'strategy', null, base);
  assert.strictEqual(one, `Learn more ${url}`);
});
