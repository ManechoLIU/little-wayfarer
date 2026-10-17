import test from 'node:test';
import assert from 'node:assert/strict';

const journey = await import('../src/journey.js');
const { EVENTS, createTraveler, applyExperience, getAppearance, validateTraveler, summarize } = journey;

const baseInput = { name: '小旅伴', seed: 0x12345678, palette: 2, trait: 1 };

test('EVENTS exposes the six contract experiences with two responses each', () => {
  assert.deepEqual(EVENTS.map(({ id }) => id), ['explore', 'setback', 'lonely', 'mistake', 'help', 'rest']);
  for (const event of EVENTS) {
    assert.equal(typeof event.title, 'string');
    assert.equal(typeof event.description, 'string');
    assert.equal(typeof event.icon, 'string');
    assert.equal(event.responses.length, 2);
    for (const response of event.responses) {
      assert.equal(typeof response.id, 'string');
      assert.equal(typeof response.label, 'string');
      assert.equal(typeof response.description, 'string');
      assert.ok(Number.isInteger(response.mood) && response.mood >= 0 && response.mood <= 5);
      assert.equal(typeof response.text, 'string');
      assert.ok(response.mark === null || typeof response.mark === 'string');
    }
  }
});

test('createTraveler creates a valid deterministic initial traveler', () => {
  const first = createTraveler(baseInput, 1700000000000);
  const second = createTraveler(baseInput, 1700000000000);
  assert.deepEqual(first, second);
  assert.equal(first.version, 1);
  assert.equal(typeof first.id, 'string');
  assert.equal(first.name, baseInput.name);
  assert.equal(first.seed, baseInput.seed);
  assert.equal(first.palette, baseInput.palette);
  assert.equal(first.trait, baseInput.trait);
  assert.equal(first.mood, 0);
  assert.equal(first.chapter, 0);
  assert.deepEqual(first.memories, []);
  assert.deepEqual(first.marks, []);
  assert.equal(validateTraveler(first), true);
});

test('applyExperience returns a new object and preserves the input', () => {
  const traveler = createTraveler(baseInput, 1000);
  const before = structuredClone(traveler);
  const next = applyExperience(traveler, 'explore', EVENTS[0].responses[0].id, 2000);
  assert.deepEqual(traveler, before);
  assert.notStrictEqual(next, traveler);
  assert.notStrictEqual(next.memories, traveler.memories);
  assert.notStrictEqual(next.marks, traveler.marks);
  assert.equal(next.chapter, 1);
  assert.equal(next.memories[0].chapter, 1);
  assert.equal(next.memories[0].eventId, 'explore');
  assert.equal(next.memories[0].timestamp, 2000);
  assert.equal(validateTraveler(next), true);
});

test('different responses create different moods and narratives', () => {
  const traveler = createTraveler(baseInput, 1000);
  const event = EVENTS.find(({ id }) => id === 'setback');
  const rested = applyExperience(traveler, event.id, event.responses[0].id, 2000);
  const retried = applyExperience(traveler, event.id, event.responses[1].id, 2000);
  assert.notEqual(rested.mood, retried.mood);
  assert.notEqual(rested.memories[0].text, retried.memories[0].text);
});

test('resting keeps prior growth and marks are deduplicated', () => {
  let traveler = createTraveler(baseInput, 1000);
  const explore = EVENTS.find(({ id }) => id === 'explore');
  const rest = EVENTS.find(({ id }) => id === 'rest');
  traveler = applyExperience(traveler, explore.id, explore.responses[0].id, 2000);
  traveler = applyExperience(traveler, rest.id, rest.responses[0].id, 3000);
  traveler = applyExperience(traveler, rest.id, rest.responses[0].id, 4000);
  assert.equal(traveler.mood, 3);
  assert.equal(traveler.marks.filter((mark) => mark === '勇气').length, 1);
  assert.equal(traveler.chapter, 3);
  assert.deepEqual(traveler.memories.map(({ chapter }) => chapter), [1, 2, 3]);
});

test('memories keep the latest 100 entries with continuous chapter numbers', () => {
  let traveler = createTraveler(baseInput, 1000);
  const event = EVENTS[0];
  for (let index = 0; index < 105; index += 1) {
    traveler = applyExperience(traveler, event.id, event.responses[index % 2].id, 2000 + index);
  }
  assert.equal(traveler.chapter, 105);
  assert.equal(traveler.memories.length, 100);
  assert.deepEqual(traveler.memories.map(({ chapter }) => chapter), Array.from({ length: 100 }, (_, i) => i + 6));
  assert.equal(validateTraveler(traveler), true);
});

test('appearance follows the mood state and summarize is concise Chinese', () => {
  const traveler = createTraveler(baseInput, 1000);
  const next = applyExperience(traveler, 'lonely', EVENTS.find(({ id }) => id === 'lonely').responses[0].id, 2000);
  assert.equal(getAppearance(traveler), 0);
  assert.equal(getAppearance(next), next.mood);
  assert.match(summarize(next), /小旅伴/);
  assert.match(summarize(next), /第1章/);
});

test('invalid traveler input and corrupted saves are rejected', () => {
  for (const input of [
    { ...baseInput, name: '' },
    { ...baseInput, name: 'x'.repeat(41) },
    { ...baseInput, seed: -1 },
    { ...baseInput, seed: 2 ** 32 },
    { ...baseInput, seed: 1.5 },
    { ...baseInput, palette: 4 },
    { ...baseInput, trait: -1 },
    null,
  ]) assert.throws(() => createTraveler(input, 1000));

  const traveler = createTraveler(baseInput, 1000);
  assert.throws(() => applyExperience(traveler, 'unknown', 'x', 2000));
  assert.throws(() => applyExperience(traveler, 'explore', 'unknown', 2000));
  assert.equal(validateTraveler({ ...traveler, mood: 9 }), false);
  assert.equal(validateTraveler({ ...traveler, memories: [{ bad: true }] }), false);
  assert.equal(validateTraveler({ ...traveler, marks: [''] }), false);
  assert.throws(() => getAppearance({ ...traveler, mood: 9 }));
});

test('giftCounts is an optional validated save field and survives experiences immutably', () => {
  const traveler = { ...createTraveler(baseInput, 1000), giftCounts: ['3', '0', '2', '1'] };
  assert.equal(validateTraveler(traveler), true);
  const next = applyExperience(traveler, 'rest', 'sleep', 2000);
  assert.deepEqual(next.giftCounts, traveler.giftCounts);
  assert.notStrictEqual(next.giftCounts, traveler.giftCounts);
  assert.equal(validateTraveler({ ...traveler, giftCounts: ['3', 'oops', '2', '1'] }), false);
  assert.equal(validateTraveler({ ...traveler, giftCounts: ['3', '0', '2'] }), false);
});
