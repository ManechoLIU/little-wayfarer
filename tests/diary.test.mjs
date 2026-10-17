import test from 'node:test';
import assert from 'node:assert/strict';

const { EVENTS, createTraveler, applyExperience } = await import('../src/journey.js');
const { makeDiaryEntry, makeTextDiaryEntry, validateDiaryEntry } = await import('../src/diary.js');

const START = Date.UTC(2025, 0, 1, 15, 59, 59, 999);

function travelerWithWalk() {
  let traveler = createTraveler({ name: '小旅伴', seed: 7, palette: 1, trait: 2 }, START);
  for (const [eventId, responseId] of [['explore', 'step-forward'], ['lonely', 'reach-out'], ['help', 'ask-together']]) {
    traveler = applyExperience(traveler, eventId, responseId, START + traveler.chapter + 1);
  }
  return traveler;
}

function progress(overrides = {}) {
  return {
    startChapter: 0,
    trail: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
    visited: ['explore', 'lonely', 'help'],
    ...overrides,
  };
}

test('makeDiaryEntry creates a detached Shanghai dated postcard from actual progress', () => {
  const traveler = travelerWithWalk();
  const entry = makeDiaryEntry(traveler, progress(), START);
  assert.deepEqual(Object.keys(entry).sort(), ['date', 'fromChapter', 'id', 'marks', 'memories', 'name', 'note', 'timestamp', 'toChapter', 'trail', 'travelerId', 'visited'].sort());
  assert.equal(entry.id, `${traveler.id}-${START}`);
  assert.equal(entry.travelerId, traveler.id);
  assert.equal(entry.name, traveler.name);
  assert.equal(entry.timestamp, START);
  assert.equal(entry.date, '2025-01-01');
  assert.equal(entry.note, '');
  assert.equal(entry.fromChapter, 0);
  assert.equal(entry.toChapter, 3);
  assert.deepEqual(entry.memories.map(({ chapter, eventId }) => [chapter, eventId]), [[1, 'explore'], [2, 'lonely'], [3, 'help']]);
  assert.deepEqual(entry.visited, ['explore', 'lonely', 'help']);
  assert.equal(validateDiaryEntry(entry), true);
});

test('diary dates cross Shanghai midnight and allow multiple entries on one day', () => {
  const traveler = travelerWithWalk();
  const late = makeDiaryEntry(traveler, progress(), START);
  const next = makeDiaryEntry(traveler, progress(), START - 1);
  assert.equal(late.date, '2025-01-01');
  assert.equal(next.date, '2025-01-01');
  const afterMidnight = makeDiaryEntry(traveler, progress(), Date.UTC(2025, 0, 1, 16, 0, 0));
  assert.equal(afterMidnight.date, '2025-01-02');
  assert.notEqual(late.id, next.id);
});

test('only memories after this walk and valid visited locations are included', () => {
  let traveler = travelerWithWalk();
  traveler = applyExperience(traveler, 'rest', 'sleep', START + 10);
  const entry = makeDiaryEntry(traveler, progress({ startChapter: 1, visited: ['lonely', 'help', 'rest', 'lonely'] }), START);
  assert.deepEqual(entry.memories.map(({ chapter }) => chapter), [2, 3, 4]);
  assert.deepEqual(entry.visited, ['lonely', 'help', 'rest']);
  assert.throws(() => makeDiaryEntry(traveler, progress({ visited: ['explore', 'unknown', 'help'] }), START));
  assert.throws(() => makeDiaryEntry(traveler, progress({ visited: ['explore', 'lonely'] }), START));
  assert.throws(() => makeDiaryEntry(traveler, progress({ visited: ['explore', 'explore', 'explore'] }), START));
});

test('diary limits memories and trail, and copies source arrays and points', () => {
  const traveler = travelerWithWalk();
  const points = Array.from({ length: 90 }, (_, index) => ({ x: index, y: -index }));
  const sourceProgress = progress({ trail: points });
  const entry = makeDiaryEntry(traveler, sourceProgress, START);
  assert.equal(entry.trail.length, 80);
  assert.equal(entry.memories.length, 3);
  assert.notStrictEqual(entry.trail, sourceProgress.trail);
  assert.notStrictEqual(entry.trail[0], sourceProgress.trail[10]);
  assert.notStrictEqual(entry.memories[0], traveler.memories[0]);
  points[10].x = 999;
  traveler.marks.push('later');
  traveler.memories[0].title = '改写';
  assert.equal(entry.trail[0].x, 10);
  assert.equal(entry.marks.includes('later'), false);
  assert.notEqual(entry.memories[0].title, '改写');
});

test('invalid, forged, oversized, or unsafe diary data is rejected', () => {
  const traveler = travelerWithWalk();
  for (const now of [-1, 1.2, Number.MAX_SAFE_INTEGER + 1, NaN]) {
    assert.throws(() => makeDiaryEntry(traveler, progress(), now));
  }
  for (const bad of [
    progress({ startChapter: 4 }),
    progress({ trail: [{ x: Infinity, y: 1 }, { x: 2, y: 3 }, { x: 4, y: 5 }] }),
    progress({ visited: ['explore', 'lonely', 'help', 'rest'], startChapter: 3 }),
    progress({ visited: ['explore', 'lonely', 'mistake'] }),
  ]) assert.throws(() => makeDiaryEntry(traveler, bad, START));

  const entry = makeDiaryEntry(traveler, progress(), START);
  assert.equal(validateDiaryEntry({ ...entry, note: 'x'.repeat(181) }), false);
  assert.equal(validateDiaryEntry({ ...entry, date: '2025-99-99' }), false);
  assert.equal(validateDiaryEntry({ ...entry, visited: ['explore', 'lonely', 'unknown'] }), false);
  assert.equal(validateDiaryEntry({ ...entry, memories: [{ ...entry.memories[0], eventId: 'rest', responseId: 'bad' }, ...entry.memories.slice(1)] }), false);
  assert.equal(validateDiaryEntry({ ...entry, trail: [{ x: '10', y: 20 }] }), false);
  assert.equal(validateDiaryEntry({ ...entry, extra: true }), false);
});

test('makeTextDiaryEntry saves plain text with no choices and permits same chapter', () => {
  const traveler = travelerWithWalk();
  const entry = makeTextDiaryEntry(traveler, traveler, '  今天只想记下这句话。  ', [], START);
  assert.equal(entry.body, '今天只想记下这句话。');
  assert.equal(entry.mood, traveler.mood);
  assert.equal(entry.fromChapter, traveler.chapter);
  assert.equal(entry.toChapter, traveler.chapter);
  assert.deepEqual(entry.memories, []);
  assert.deepEqual(entry.visited, []);
  assert.deepEqual(entry.trail, []);
  assert.equal(validateDiaryEntry(entry), true);
});

test('makeTextDiaryEntry accepts one labeled choice without requiring three locations', () => {
  const before = travelerWithWalk();
  const after = applyExperience(before, 'rest', 'sleep', START + 10);
  const entry = makeTextDiaryEntry(before, after, '睡了一觉，继续走。', [{ eventId: 'rest', responseId: 'sleep' }], START);
  assert.equal(entry.memories.length, 1);
  assert.deepEqual(entry.visited, ['rest']);
  assert.equal(entry.memories[0].chapter, 4);
  assert.equal(entry.mood, after.mood);
  assert.equal(entry.fromChapter, 3);
  assert.equal(entry.toChapter, 4);
});

test('makeTextDiaryEntry rejects forged choices, changed identity, and chapter mismatch', () => {
  const before = travelerWithWalk();
  const after = applyExperience(before, 'rest', 'sleep', START + 10);
  assert.throws(() => makeTextDiaryEntry(before, after, 'x', [{ eventId: 'rest', responseId: 'bad' }], START));
  assert.throws(() => makeTextDiaryEntry(before, after, 'x', [{ eventId: 'mistake', responseId: 'learn' }], START));
  assert.throws(() => makeTextDiaryEntry({ ...before, seed: before.seed + 1 }, after, 'x', [{ eventId: 'rest', responseId: 'sleep' }], START));
  assert.throws(() => makeTextDiaryEntry(before, after, 'x', [], START));
  assert.throws(() => makeTextDiaryEntry(before, after, 'x', [{ eventId: 'rest', responseId: 'sleep' }, { eventId: 'rest', responseId: 'sleep' }], START));
});

test('text diary trims and accepts 4000 characters across Shanghai midnight, then detaches state', () => {
  const before = travelerWithWalk();
  const body = `${'字'.repeat(4000)} `;
  const entry = makeTextDiaryEntry(before, before, body, [], Date.UTC(2025, 0, 1, 16, 0, 0));
  assert.equal(entry.body.length, 4000);
  assert.equal(entry.date, '2025-01-02');
  assert.equal(entry.marks.length, before.marks.length);
  before.marks.push('后来');
  assert.equal(entry.marks.includes('后来'), false);
  assert.throws(() => makeTextDiaryEntry(before, before, ' '.repeat(4001), [], START));
  assert.equal(validateDiaryEntry({ ...entry, body: '' }), false);
  assert.equal(validateDiaryEntry({ ...entry, mood: 9 }), false);
});

test('diary entries snapshot giftCounts without changing legacy entries', () => {
  const traveler = { ...travelerWithWalk(), giftCounts: ['3', '2', '1', '0'] };
  const entry = makeTextDiaryEntry(traveler, traveler, '收到三朵花。', [], START);
  assert.deepEqual(entry.giftCounts, ['3', '2', '1', '0']);
  traveler.giftCounts[0] = '9';
  assert.deepEqual(entry.giftCounts, ['3', '2', '1', '0']);
  assert.equal(validateDiaryEntry(entry), true);
  const legacy = makeTextDiaryEntry(travelerWithWalk(), travelerWithWalk(), '旧记录。', [], START);
  assert.equal(Object.hasOwn(legacy, 'giftCounts'), false);
  assert.equal(validateDiaryEntry({ ...legacy, giftCounts: ['3', '2', '1', '0'] }), true);
  assert.equal(validateDiaryEntry({ ...legacy, giftCounts: ['3', 'oops', '1', '0'] }), false);
});

test('invalid empty records are rejected without throwing away readable journal entries', () => {
  assert.equal(validateDiaryEntry(null), false);
  assert.equal(validateDiaryEntry(undefined), false);
});

test('reading a gifted walk cannot invalidate other saved entries or the next read', () => {
  const plain = travelerWithWalk();
  const legacyWalk = makeDiaryEntry(plain, progress(), START);
  const legacyText = makeTextDiaryEntry(plain, plain, '旧手账仍然能打开。', [], START);
  const giftedWalk = makeDiaryEntry({ ...plain, giftCounts: ['3','0','0','0'] }, progress(), START);
  for (const saved of [legacyWalk, legacyText, giftedWalk, giftedWalk]) {
    assert.equal(validateDiaryEntry(JSON.parse(JSON.stringify(saved))), true);
  }
});
