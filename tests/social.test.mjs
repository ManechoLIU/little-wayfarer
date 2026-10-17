import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSocial } from '../src/social.js';
import { gearHTML } from '../src/gear.js';

// Only the DOM and wallet/RPC boundary are substituted; the social controller,
// counter reader and character renderer run unchanged.
class ElementStub {
  constructor(selector = '') { this.selector = selector; this.dataset = {}; this.textContent = ''; this.hidden = false; this.value = ''; }
  classList = { add() {}, remove() {}, toggle() {} };
  closest(selector) { return selector === this.selector ? this : null; }
  focus() { this.focused = true; }
  select() { this.selected = true; }
  setSelectionRange() { this.selected = true; }
}
class Root extends ElementStub {
  nodes = new Map();
  querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, new ElementStub(selector)); return this.nodes.get(selector); }
  querySelectorAll() { return []; }
  addEventListener(type, handler) { if (type === 'click') this.click = handler; }
  removeEventListener() {}
}
const drain = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };

function setup({ clipboard, failReadAfterGift = false, receiptStatus = 1, deferredInitialRead, failSourceRead = false, failInboxRead = false, deferredSourceRead, sourceInitiallyOpen = true, initialWornId = '0' } = {}) {
  globalThis.Element = ElementStub;
  globalThis.window = { setTimeout() { return 1; }, clearTimeout() {} };
  globalThis.location = { href: 'https://example.com/?c=0x1234567890123456789012345678901234567890&id=1' };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard } });
  const root = new Root();
  root.querySelector('[data-social-source-panel]').open = sourceInitiallyOpen && Boolean(failSourceRead || deferredSourceRead);
  root.querySelector('[data-social-inbox-panel]').open = failInboxRead;
  let flowers = 0;
  let gifted = false;
  let reads = 0;
  let wornId = initialWornId;
  const contract = {
    async getTraveler() {
      const first = reads++ === 0;
      if (first && deferredInitialRead) await deferredInitialRead;
      if (gifted && failReadAfterGift) throw Error('RPC unavailable');
      return { origin: '0xowner', name: '小芽', seed: 1, chapter: 0, palette: 0, trait: 3, mood: flowers ? 4 : 0, marks: flowers ? 4096 : 0, wornSouvenirId: wornId, souvenirCount: failInboxRead ? 1 : 0, lastInteractionAt: 0, lastInteraction: 0 };
    },
    async getGiftCounts() { return [BigInt(flowers), 0n, 0n, 0n]; },
    async encourage() { return { wait: async () => { if (receiptStatus === 1) flowers++; gifted = true; return { status: receiptStatus }; } }; },
    async firstMarkChapter() { if (deferredSourceRead) await deferredSourceRead; if (failSourceRead) throw Error('source RPC unavailable'); return 0; },
    async receivedSouvenirs() { if (failInboxRead) throw Error('inbox RPC unavailable'); return 1; },
    async souvenirs() { return { source: 2, target: 1, chapter: 1, markBit: 0, sender: '0xfriend', timestamp: 1 }; },
    async wearSouvenir(_, id) { return { wait: async () => { wornId = String(id); return { status: 1 }; } }; },
  };
  const owned = failSourceRead || deferredSourceRead ? [{ name: '自己的旅伴', link: { id: '2', address: '0xcontract' } }] : [];
  const mounted = mountSocial({ root, invite: { id: '1', address: '0xcontract', name: '小芽', marks: [] }, owned, readContract: () => contract, writeContract: async () => contract, art: t => gearHTML(t) });
  const gift = async () => {
    const button = new ElementStub('[data-social-action]');
    button.dataset = { socialAction: 'reaction', socialGift: '0' };
    root.click({ target: button });
    await drain();
  };
  const unwear = async () => {
    const button = new ElementStub('[data-social-action]'); button.dataset = { socialAction: 'unwear' };
    root.click({ target: button }); await drain();
  };
  return { root, mounted, gift, unwear };
}

test('three confirmed gifts render three flowers in the actual social controller', async () => {
  const { root, mounted, gift } = setup();
  await drain();
  for (let i = 1; i <= 3; i++) {
    await gift();
    assert.equal((root.querySelector('[data-social-character]').innerHTML.match(/data-gift-kind="flower"/g) || []).length, i);
  }
  mounted.destroy();
});

test('confirmed transaction with failed readback does not claim the character has updated', async () => {
  const { root, mounted, gift } = setup({ failReadAfterGift: true });
  await drain(); await gift();
  assert.match(root.querySelector('[data-social-live]').textContent, /已确认.*刷新/);
  assert.equal((root.querySelector('[data-social-character]').innerHTML.match(/data-gift-kind="flower"/g) || []).length, 0);
  mounted.destroy();
});

test('failed transaction never adds a visible gift', async () => {
  const { root, mounted, gift } = setup({ receiptStatus: 0 });
  await drain(); await gift();
  assert.match(root.querySelector('[data-social-live]').textContent, /未成功/);
  assert.equal((root.querySelector('[data-social-character]').innerHTML.match(/data-gift-kind="flower"/g) || []).length, 0);
  mounted.destroy();
});

test('friend copy link offers selectable text when clipboard is unavailable', async () => {
  const { root, mounted } = setup();
  await drain();
  root.click({ target: new ElementStub('[data-social-copy]') });
  await drain();
  assert.equal(root.querySelector('[data-social-url]').value, location.href);
  assert.equal(root.querySelector('[data-social-url]').selected, true);
  assert.match(root.querySelector('[data-social-live]').textContent, /长按.*复制/);
  mounted.destroy();
});

test('transaction waits for an existing refresh and forces a fresh read after confirmation', async () => {
  let release;
  const deferredInitialRead = new Promise(resolve => { release = resolve; });
  const { root, mounted, gift } = setup({ deferredInitialRead, failReadAfterGift: true });
  await gift();
  release(); await drain();
  assert.match(root.querySelector('[data-social-live]').textContent, /已确认.*刷新/);
  mounted.destroy();
});

for (const failure of ['failSourceRead', 'failInboxRead']) {
  test(`${failure} in a secondary panel cannot prevent confirmed flowers from appearing`, async () => {
    const { root, mounted, gift } = setup({ [failure]: true });
    await drain(); await gift();
    assert.equal((root.querySelector('[data-social-character]').innerHTML.match(/data-gift-kind="flower"/g) || []).length, 1);
    assert.match(root.querySelector('[data-social-live]').textContent, /回应已由链上确认/);
    mounted.destroy();
  });
}

test('a pending optional source request cannot delay a new confirmed gift', async () => {
  let release;
  const deferredSourceRead = new Promise(resolve => { release = resolve; });
  const { root, mounted, gift } = setup({ deferredSourceRead });
  try {
    await drain(); await gift();
    assert.equal((root.querySelector('[data-social-character]').innerHTML.match(/data-gift-kind="flower"/g) || []).length, 1);
  } finally { release(); await drain(); mounted.destroy(); }
});

test('unwear clears the old item even while an optional source request is pending', async () => {
  let release;
  const deferredSourceRead = new Promise(resolve => { release = resolve; });
  const { root, mounted, unwear } = setup({ deferredSourceRead, sourceInitiallyOpen: false, initialWornId: '1' });
  try {
    await drain();
    assert.match(root.querySelector('[data-social-worn]').innerHTML, /lw-gear-cape/);
    root.querySelector('[data-social-source-panel]').open = true;
    root.click({ target: new ElementStub('[data-social-refresh]') }); await drain();
    await unwear();
    assert.equal(root.querySelector('[data-social-worn]').innerHTML, '');
  } finally { release(); await drain(); mounted.destroy(); }
});
