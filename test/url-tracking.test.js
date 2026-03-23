import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enforcePromoTrackingPath } from '../src/services/url-tracking.js';

test('adds /tw for root promo URL with protocol', () => {
  const input = 'Learn more: https://learnstockmarket.online';
  const output = enforcePromoTrackingPath(input);
  assert.match(output, /https:\/\/learnstockmarket\.online\/tw\b/);
});

test('prefixes /tw for promo URL path', () => {
  const input = 'Pattern lesson: https://learnstockmarket.online/patterns';
  const output = enforcePromoTrackingPath(input);
  assert.match(output, /https:\/\/learnstockmarket\.online\/tw\/patterns\b/);
});

test('keeps already-tracked promo URL unchanged', () => {
  const input = 'Tracked link https://learnstockmarket.online/tw/strategies';
  const output = enforcePromoTrackingPath(input);
  assert.strictEqual(output, input);
});

test('handles promo URL without protocol', () => {
  const input = 'Visit learnstockmarket.online/strategies for details';
  const output = enforcePromoTrackingPath(input);
  assert.match(output, /learnstockmarket\.online\/tw\/strategies\b/);
});

test('does not rewrite non-promo domains', () => {
  const input = 'News link: https://example.com/path';
  const output = enforcePromoTrackingPath(input);
  assert.strictEqual(output, input);
});
