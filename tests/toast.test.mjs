import test from 'node:test';
import assert from 'node:assert/strict';
import * as notices from '../src/toast.js';

test('toast expiry removes only its message without rebuilding an active composer', () => {
  let renders = 0, removed = 0, expire;
  const notice = notices.createToast?.({ querySelector: () => ({ remove: () => removed++ }) }, () => renders++, { setTimeout: fn => { expire = fn; return 1; }, clearTimeout() {} });
  assert.ok(notice);
  notice.show('开始自己的旅程');
  assert.equal(renders, 1);
  expire();
  assert.equal(renders, 1);
  assert.equal(removed, 1);
  assert.equal(notice.text, '');
});
