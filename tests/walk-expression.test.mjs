import test from 'node:test';
import assert from 'node:assert/strict';
import { mountWalk } from '../src/walk.js';

// Exercise the real walk controller; substitute only DOM, keyboard and RAF.
class ElementStub {
  style = { setProperty() {} };
  dataset = {};
  innerHTML = '';
  textContent = '';
  clientWidth = 390;
  childElementCount = 0;
  classList = { add() {}, remove() {}, toggle() {} };
  addEventListener() {}
  removeEventListener() {}
  append() {}
}
class Root extends ElementStub {
  nodes = new Map();
  querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, new ElementStub()); return this.nodes.get(selector); }
  querySelectorAll() { return []; }
}
function setup({ x = 110, mood = 0, moments = [], replayMode = false, recall = id => `record:${id}` } = {}) {
  const handlers = new Map();
  let frame;
  let time = performance.now();
  globalThis.Element = ElementStub;
  globalThis.window = { addEventListener: (type, fn) => handlers.set(type, fn), removeEventListener() {}, setTimeout: () => 1, clearTimeout() {} };
  globalThis.document = { querySelector: () => null, createElement: () => new ElementStub(), addEventListener() {}, removeEventListener() {} };
  globalThis.requestAnimationFrame = fn => { frame = fn; return 1; };
  globalThis.cancelAnimationFrame = () => {};
  const traveler = { name: '小芽', mood, chapter: 0 };
  const root = new Root();
  const mounted = mountWalk({ root, traveler, moments, replayMode, initialProgress: { position: { x, y: 390 } }, art: (_, expression) => `current:${expression}`, onRecallMoment: recall });
  const tick = () => { time += 40; frame(time); };
  const key = (type, key) => handlers.get(type)({ key, preventDefault() {} });
  return { root, mounted, traveler, tick, key, appearance: () => root.querySelector('.lw-character').innerHTML };
}

test('ordinary walking restores the actual record appearance near a node', () => {
  const view = setup({ x: 200, mood: 4, moments: [{ id: 'sad-day', x: 200, y: 390 }] });
  assert.equal(view.appearance(), 'record:sad-day');
  assert.equal(view.traveler.mood, 4);
  view.mounted.destroy();
});

test('stepping and stopping change the action pose without changing the saved mood', () => {
  const view = setup();
  assert.equal(view.appearance(), 'current:0');
  view.key('keydown', 'ArrowRight'); view.tick();
  assert.equal(view.appearance(), 'current:5');
  view.key('keyup', 'ArrowRight'); view.tick();
  assert.equal(view.appearance(), 'current:0');
  assert.equal(view.traveler.mood, 0);
  view.mounted.destroy();
});

test('leaving a record restores the current appearance even when its mood is unchanged', () => {
  const view = setup({ x: 200, mood: 4, moments: [{ id: 'old', x: 200, y: 390 }] });
  assert.equal(view.appearance(), 'record:old');
  view.key('keydown', 'ArrowRight');
  for (let i = 0; i < 16; i++) view.tick();
  view.key('keyup', 'ArrowRight'); view.tick();
  assert.equal(view.appearance(), 'current:4');
  assert.equal(view.traveler.mood, 4);
  view.mounted.destroy();
});

test('a sad saved expression is retained while walking away from records', () => {
  const view = setup({ mood: 2 });
  view.key('keydown', 'ArrowRight'); view.tick();
  assert.equal(view.appearance(), 'current:2');
  view.mounted.destroy();
});

test('replay still starts with the earliest historical appearance', () => {
  const view = setup({ replayMode: true, moments: [{ id: 'first', x: 200, y: 390 }] });
  assert.equal(view.appearance(), 'record:first');
  view.mounted.destroy();
});

test('node appearance takes priority over the walking pose and restores on revisit', () => {
  const view = setup({ x: 200, moments: [{ id: 'old', x: 200, y: 390 }] });
  view.key('keydown', 'ArrowRight'); view.tick();
  assert.equal(view.appearance(), 'record:old');
  for (let i = 0; i < 15; i++) view.tick();
  assert.equal(view.appearance(), 'current:5');
  view.key('keyup', 'ArrowRight'); view.key('keydown', 'ArrowLeft');
  for (let i = 0; i < 16; i++) view.tick();
  assert.equal(view.appearance(), 'record:old');
  assert.equal(view.traveler.mood, 0);
  view.mounted.destroy();
});

test('pending and vertically distant records do not change the character', () => {
  const view = setup({ x: 200, moments: [{ id: 'pending', pending: true, x: 200, y: 390 }, { id: 'distant', x: 200, y: 318 }] });
  assert.equal(view.appearance(), 'current:0');
  view.mounted.destroy();
});

test('an unavailable historical appearance leaves the current character visible', () => {
  for (const recall of [() => '', () => { throw new Error('unavailable'); }]) {
    const view = setup({ x: 200, mood: 2, moments: [{ id: 'old', x: 200, y: 390 }], recall });
    assert.equal(view.appearance(), 'current:2');
    view.mounted.destroy();
  }
});
