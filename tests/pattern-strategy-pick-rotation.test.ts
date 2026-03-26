import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickPattern, pickStrategy } from '../src/services/pattern-strategy-pick.js';

const RealDate = Date;

function withMockedNow<T>(iso: string, run: () => Promise<T>): Promise<T> {
  const fixed = new RealDate(iso);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.Date = class extends RealDate {
    constructor(...args: any[]) {
      if (args.length === 0) return new RealDate(fixed);
      return new RealDate(...args);
    }
    static now(): number {
      return fixed.getTime();
    }
  } as DateConstructor;

  return run().finally(() => {
    global.Date = RealDate;
  });
}

test('pickPattern changes across days at same hour', async () => {
  const first = await withMockedNow('2026-03-26T08:00:00.000Z', () => pickPattern());
  const nextDay = await withMockedNow('2026-03-27T08:00:00.000Z', () => pickPattern());

  assert.ok(first?.name);
  assert.ok(nextDay?.name);
  assert.notEqual(first?.name, nextDay?.name);
});

test('pickStrategy changes across days at same hour', async () => {
  const first = await withMockedNow('2026-03-26T08:00:00.000Z', () => pickStrategy());
  const nextDay = await withMockedNow('2026-03-27T08:00:00.000Z', () => pickStrategy());

  assert.ok(first?.name);
  assert.ok(nextDay?.name);
  assert.notEqual(first?.name, nextDay?.name);
});
