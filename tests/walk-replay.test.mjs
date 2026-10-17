import test from 'node:test';
import assert from 'node:assert/strict';
import { selectReplayMoment } from '../src/walk.js';

const moments = [
  { id: 'late', x: 900 },
  { id: 'first', x: 200 },
  { id: 'middle', x: 520 },
];

test('replay starts with the first snapshot before its threshold', () => {
  assert.equal(selectReplayMoment(moments, 80)?.id, 'first');
});

test('replay changes at the record threshold in either walking direction', () => {
  assert.equal(selectReplayMoment(moments, 449)?.id, 'first');
  assert.equal(selectReplayMoment(moments, 450)?.id, 'middle');
  assert.equal(selectReplayMoment(moments, 830)?.id, 'late');
  assert.equal(selectReplayMoment(moments, 600)?.id, 'middle');
  assert.equal(selectReplayMoment(moments, 300)?.id, 'first');
});

test('invalid records do not become replay snapshots', () => {
  assert.equal(selectReplayMoment([{ id: 'no-x' }, { x: 300 }, null], 500), null);
});
