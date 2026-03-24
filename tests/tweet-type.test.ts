import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickTweetType,
  TWEET_TYPES,
  isValidTweetType,
} from '../src/services/aggregate-news.js';

test('pickTweetType always returns a member of TWEET_TYPES', () => {
  for (let month = 0; month < 12; month++) {
    for (let day = 1; day <= 28; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const t = pickTweetType(new Date(2026, month, day, hour, 0, 0));
        assert.ok(
          TWEET_TYPES.includes(t),
          `Expected ${t} to be in TWEET_TYPES for ${month + 1}/${day} ${hour}:00`
        );
        assert.ok(isValidTweetType(t));
      }
    }
  }
});

test('isValidTweetType rejects unknown strings', () => {
  assert.equal(isValidTweetType('news'), true);
  assert.equal(isValidTweetType('spam'), false);
});
