import test from 'node:test';
import assert from 'node:assert/strict';
import { autoEquipGear, gearHTML, journeyTraceHTML } from '../src/gear.js';

test('new marks automatically add their gear and retain current gear', () => {
  const result = autoEquipGear(
    { chapter: 1 },
    { chapter: 2, memories: [{ chapter: 2, mark: '好奇' }] },
    ['cape', 'scarf'],
  );
  assert.deepEqual(result, ['cape', 'scarf', 'compass']);
});

test('a repeated gear source promotes rather than duplicates the item', () => {
  const result = autoEquipGear(
    { chapter: 2 },
    { chapter: 3, memories: [{ chapter: 3, mark: '坚持' }] },
    ['windmill', 'cape'],
  );
  assert.deepEqual(result, ['cape', 'windmill']);
});

test('automatic equipment keeps only the three most recent valid items', () => {
  const result = autoEquipGear(
    { chapter: 1 },
    { memories: [
      { chapter: 2, mark: '勇气' },
      { chapter: 3, mark: '好奇' },
      { chapter: 4, mark: '独处' },
      { chapter: 5, mark: '照顾自己' },
    ] },
    ['patch'],
  );
  assert.deepEqual(result, ['compass', 'lantern', 'scarf']);
});

test('plain notes still create a stable footprint without exposing user content', () => {
  const unsafeId = 'x\"><img src=x onerror=alert(1)>';
  const body = 'PRIVATE <script>alert(1)</script>';
  const entries = [{ id: unsafeId, text: body }];
  const html = journeyTraceHTML(entries);
  assert.match(html, /lw-gear-trace-footprint/);
  assert.equal(html, journeyTraceHTML(entries));
  assert.ok(!html.includes(unsafeId));
  assert.ok(!html.includes(body));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<script'));
});

test('only the latest three records render and event symbols remain distinct', () => {
  const html = journeyTraceHTML([
    { id: '1', eventId: 'explore' },
    { id: '2', eventId: 'setback' },
    { id: '3', eventId: 'mistake' },
    { id: '4', eventId: 'help' },
  ]);
  assert.equal((html.match(/class="lw-gear-trace /g) || []).length, 3);
  assert.ok(!html.includes('lw-gear-trace-explore'));
  assert.match(html, /lw-gear-trace-setback/);
  assert.match(html, /lw-gear-trace-mistake/);
  assert.match(html, /lw-gear-trace-help/);
});

test('a newly received friend gift appears even after plain-note outfits were saved empty', () => {
  const before={chapter:0,marks:[],memories:[]};
  const after={...before,marks:['一朵小花']};
  assert.deepEqual(autoEquipGear(before,after,[]),['flower']);
});

test('receiving gifts respects the three-item limit and does not rewear gifts intentionally removed', () => {
  const before={chapter:4,marks:['勇气','好奇','修补'],memories:[]};
  const after={...before,marks:[...before.marks,'一句加油']};
  assert.deepEqual(autoEquipGear(before,after,['cape','compass','patch']),['compass','patch','heartpin']);
  assert.deepEqual(autoEquipGear(after,after,[]),[]);
});

test('giftCounts render three independent visible flowers without manual wardrobe selection', () => {
  const html = gearHTML({ marks: [], giftCounts: ['3', '0', '0', '0'], mood: 0 }, []);
  assert.equal((html.match(/data-gift-kind="flower"/g) || []).length, 3);
  assert.equal((html.match(/class="lw-gift-flower/g) || []).length, 3);
  assert.match(html, /data-gift-total="flower">3</);
});

test('large gift counts cap visible items at nine and retain exact totals', () => {
  const html = gearHTML({ marks: [], giftCounts: ['123', '12', '999999999999999999999', '4'], mood: 0 }, []);
  assert.equal((html.match(/data-gift-kind="flower"/g) || []).length, 9);
  assert.equal((html.match(/data-gift-kind="heartpin"/g) || []).length, 9);
  assert.equal((html.match(/data-gift-kind="star"/g) || []).length, 9);
  assert.equal((html.match(/data-gift-kind="confetti"/g) || []).length, 4);
  assert.match(html, /data-gift-total="star">999999999999999999999</);
});
