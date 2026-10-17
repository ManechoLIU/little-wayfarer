import test from 'node:test';
import assert from 'node:assert/strict';
import { mountComposer } from '../src/composer.js';

class Node {
  listeners = new Map(); value = ''; textContent = ''; innerHTML = ''; disabled = false; hidden = false;
  classList = { add() {}, remove() {} };
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  removeEventListener(type) { this.listeners.delete(type); }
  focus() {}
}
class Root extends Node {
  nodes = new Map();
  querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, new Node()); return this.nodes.get(selector); }
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function setup(options = {}) {
  globalThis.Element = Node;
  const root = new Root(), saved = [];
  const mounted = mountComposer({ root, traveler: { id: 'a', name: '小芽' }, art: () => '', onSave: value => saved.push(value), ...options });
  const click = selector => root.listeners.get('click')({ target: { closest: query => query === selector ? {} : null } });
  return { root, saved, mounted, click, text: root.querySelector('[data-compose-text]'), error: root.querySelector('[data-compose-error]') };
}

test('saving analyzes exactly once before passing the mood to persistence', async () => {
  let calls = 0;
  const view = setup({ analyzeJournal: async text => { calls++; assert.equal(text, '今天有点难过'); return { mood: 2, evidence: '难过' }; }, provider: 'DeepSeek' });
  view.text.value = '今天有点难过'; view.click('[data-compose-save]'); view.click('[data-compose-save]');
  await flush();
  assert.equal(calls, 1);
  assert.deepEqual(view.saved, [{ text: '今天有点难过', choices: [], analysis: { mood: 2, evidence: '难过' } }]);
  view.mounted.destroy();
});

test('plain saving never sends the diary to the model', async () => {
  let calls = 0;
  const view = setup({ analyzeJournal: async () => { calls++; } });
  view.text.value = '只留在本机'; view.click('[data-compose-plain]'); await flush();
  assert.equal(calls, 0);
  assert.deepEqual(view.saved, [{ text: '只留在本机', choices: [] }]);
  view.mounted.destroy();
});

test('failed or invalid analysis keeps the writing and never silently persists an old expression', async () => {
  for (const analyzeJournal of [async () => { throw Error('暂时不可用'); }, async () => ({ mood: 2, evidence: '不存在' })]) {
    const view = setup({ analyzeJournal });
    view.text.value = '今天有点难过'; view.click('[data-compose-save]'); await flush();
    assert.equal(view.saved.length, 0);
    assert.equal(view.text.value, '今天有点难过');
    assert.equal(view.error.hidden, false);
    assert.equal(view.root.querySelector('[data-compose-save]').disabled, false);
    view.mounted.destroy();
  }
});

test('closing the composer discards an in-flight result instead of changing another character', async () => {
  let finish;
  const view = setup({ analyzeJournal: () => new Promise(resolve => { finish = resolve; }) });
  view.text.value = '难过'; view.click('[data-compose-save]'); view.mounted.destroy();
  finish({ mood: 2, evidence: '难过' }); await flush();
  assert.equal(view.saved.length, 0);
});

test('availability updates the disclosure without resetting the current draft', async () => {
  const view = setup(); view.text.value = '写到一半';
  view.mounted.setAnalysisService?.({ analyzeJournal: async () => ({ mood: null, evidence: '' }), provider: 'DeepSeek' });
  assert.equal(view.text.value, '写到一半');
  assert.match(view.root.querySelector('[data-compose-private]').textContent, /DeepSeek/);
  view.click('[data-compose-save]'); await flush();
  assert.equal(view.saved[0]?.analysis?.mood, null);
  view.mounted.destroy();
});
