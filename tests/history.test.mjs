import test from 'node:test';
import assert from 'node:assert/strict';
import { historicalLook } from '../src/history.js';

const traveler = { id: 'a', mood: 4, marks: ['勇气', '善意'] };
const first = { id: 'first', travelerId: 'a', timestamp: 10, mood: 1, marks: ['勇气'] };
const later = { id: 'later', travelerId: 'a', timestamp: 20, mood: 4, marks: ['勇气', '善意'] };

test('historical appearance preserves its own mood and explicit empty outfit', () => {
  const look = historicalLook(traveler, first, [first, later], { first: [] });
  assert.equal(look.traveler.mood, 1);
  assert.deepEqual(look.traveler.marks, ['勇气']);
  assert.deepEqual(look.gearIds, []);
  assert.equal(look.hasOutfitSnapshot, true);
  assert.equal(traveler.mood, 4);
});

test('history excludes later records and other people, even at the same timestamp', () => {
  const sameTime = { ...later, timestamp: 10 };
  const foreign = { ...first, id: 'foreign', travelerId: 'b' };
  const look = historicalLook(traveler, first, [foreign, first, sameTime]);
  assert.deepEqual(look.traceEntries.map(item => item.id), ['first']);
  assert.deepEqual(look.gearIds, ['cape']);
  assert.equal(look.hasOutfitSnapshot, false);
});

test('legacy history uses a disclosed base mood and rejects another traveler record', () => {
  const legacy = { ...first };
  delete legacy.mood;
  const look = historicalLook(traveler, legacy, [legacy]);
  assert.equal(look.traveler.mood, 0);
  assert.equal(look.hasMoodSnapshot, false);
  assert.throws(() => historicalLook(traveler, { ...first, travelerId: 'b' }, []));
});

test('history uses the entry gift snapshot and does not leak current gifts backward', () => {
  const current = { ...traveler, giftCounts: ['9', '2', '1', '0'] };
  const old = { ...first, giftCounts: ['1', '0', '0', '0'] };
  const look = historicalLook(current, old, [old], { old: [] });
  assert.deepEqual(look.traveler.giftCounts, ['1', '0', '0', '0']);
  assert.equal(look.hasGiftSnapshot, true);
  const legacyLook = historicalLook(current, first, [first], { first: [] });
  assert.equal(Object.hasOwn(legacyLook.traveler, 'giftCounts'), false);
  assert.equal(legacyLook.hasGiftSnapshot, false);
});
