import test from 'node:test';
import assert from 'node:assert/strict';
import { createTraveler, validateTraveler } from '../src/journey.js';
import { makeTextDiaryEntry, validateDiaryEntry } from '../src/diary.js';
import { historicalLook } from '../src/history.js';
import * as analysis from '../src/record-analysis.js';

test('semantic sadness changes the saved face without inventing actions or chain chapters', () => {
  const before = createTraveler({ name: '小芽', seed: 1, palette: 0, trait: 3 }, 1000);
  const result = analysis.applyRecordAnalysis?.(before, '今天有点难过', { mood: 2, evidence: '难过' });
  assert.equal(result?.mood, 2);
  assert.equal(before.mood, 0);
  assert.equal(result.chapter, 0);
  assert.deepEqual(result.memories, []);
  assert.deepEqual(result.marks, []);
  assert.equal(validateTraveler(result), true);
  const entry = makeTextDiaryEntry(before, result, '今天有点难过', [], 2000);
  assert.equal(validateDiaryEntry(entry), true);
  const restored = JSON.parse(JSON.stringify({ traveler: result, entries: [entry] }));
  assert.equal(historicalLook({ ...restored.traveler, mood: 4 }, restored.entries[0], restored.entries).traveler.mood, 2);
});

test('ambiguous text preserves the current expression and later happy records stay independent', () => {
  const before = { ...createTraveler({ name: '小芽', seed: 1, palette: 0, trait: 3 }, 1000), mood: 2, giftCounts: ['2', '0', '0', '0'] };
  const unchanged = analysis.applyRecordAnalysis?.(before, '今天坐了三站地铁', { mood: null, evidence: '' });
  assert.equal(unchanged?.mood, 2);
  const happy = analysis.applyRecordAnalysis?.(before, '终于完成了，好开心', { mood: 4, evidence: '好开心' });
  assert.equal(happy?.mood, 4);
  assert.equal(before.mood, 2);
  assert.deepEqual(happy.giftCounts, ['2', '0', '0', '0']);
});

test('model output cannot inject fields, unsupported moods, or evidence absent from the diary', () => {
  for (const output of [{ mood: 2, evidence: '别人的原文' }, { mood: 9, evidence: '难过' }, { mood: '2', evidence: '难过' }, { mood: 2, evidence: '' }, { mood: null, evidence: '难过' }, { mood: 2, evidence: '难过', html: '<script>' }]) {
    assert.equal(analysis.validateRecordAnalysis?.(output, '今天有点难过'), null);
  }
});
