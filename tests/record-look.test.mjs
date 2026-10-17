import test from 'node:test';
import assert from 'node:assert/strict';
import { recordLook } from '../src/record-look.js';
import { recordOutfitHTML } from '../src/gear.js';

test('record look changes across records while remaining deterministic', () => {
  const one = recordLook([{ id: 'entry-1', body: '文字A' }]);
  const two = recordLook([{ id: 'entry-1' }, { id: 'entry-2' }]);
  const three = recordLook([{ id: 'entry-1' }, { id: 'entry-2' }, { id: 'entry-3' }]);
  assert.deepEqual([one.outfit, two.outfit, three.outfit], ['scarf', 'cape', 'sprout']);
  assert.notEqual(one.style, two.style);
  assert.equal(recordLook([{ id: 'entry-1', body: '换正文' }]).style, one.style);
  assert.deepEqual(recordLook([{ id: 'entry-1' }]), one);
});

test('empty history has no outfit and outfit SVG is explicitly record-scoped', () => {
  assert.deepEqual(recordLook([]), { style: '', outfit: null });
  assert.match(recordOutfitHTML('cape'), /data-record-outfit="cape"/);
  assert.match(recordOutfitHTML('sprout'), /lw-gear-pack/);
  assert.equal(recordOutfitHTML(null), '');
});

test('history truncation restores earlier look without later records', () => {
  const all = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(recordLook(all.slice(0, 2)), recordLook([{ id: 'a' }, { id: 'b' }]));
  assert.notDeepEqual(recordLook(all.slice(0, 2)), recordLook(all));
});
