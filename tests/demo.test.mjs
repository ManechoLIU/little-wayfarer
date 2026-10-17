import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDemoJourney } from '../src/demo.js';
import { validateTraveler } from '../src/journey.js';
import { validateDiaryEntry } from '../src/diary.js';
import { gearCatalog } from '../src/gear.js';

const NOW = Date.UTC(2025, 0, 8, 8, 0, 0);

function shanghaiParts(timestamp) {
  return Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', hour: '2-digit', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(timestamp)).map(({ type, value }) => [type, value]));
}

test('demo journey is explicitly fictional, valid, recent, and has one traveler', () => {
  const demo = makeDemoJourney(NOW);
  assert.deepEqual(Object.keys(demo).sort(), ['active', 'entries', 'entryOutfits', 'links', 'travelers', 'wardrobe'].sort());
  assert.equal(demo.links && Object.keys(demo.links).length, 0);
  assert.equal(demo.travelers.length, 1);
  assert.equal(demo.active, demo.travelers[0].id);
  assert.equal(validateTraveler(demo.travelers[0]), true);
  assert.equal(demo.entries.length, 8);
  for (const entry of demo.entries) {
    assert.equal(validateDiaryEntry(entry), true);
    assert.match(entry.body, /^【虚构演示】/);
    assert.ok(entry.timestamp <= NOW);
  }
});

test('demo has eight records across multiple Shanghai dates with same-day repeats and a gap', () => {
  const demo = makeDemoJourney(NOW);
  const dates = demo.entries.map(({ date }) => date);
  const counts = new Map(dates.map((date) => [date, dates.filter((item) => item === date).length]));
  assert.ok(new Set(dates).size >= 5);
  assert.ok([...counts.values()].some((count) => count >= 2));
  assert.ok([...Array(7)].some((_, offset) => {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date(NOW - offset * 86400000));
    return !dates.includes(date);
  }));
  assert.ok(demo.entries.some((entry) => entry.visited.length === 0));
  assert.ok(demo.entries.some((entry) => entry.memories.length === 1));
});

test('demo covers a small emotional arc and outfits are valid independent snapshots', () => {
  const demo = makeDemoJourney(NOW);
  const moods = demo.entries.map(({ mood }) => mood);
  assert.ok(new Set(moods).size >= 4);
  assert.ok(demo.entries.some(({ memories }) => memories.some(({ eventId }) => eventId === 'explore')));
  assert.ok(demo.entries.some(({ memories }) => memories.some(({ eventId }) => eventId === 'setback')));
  assert.ok(demo.entries.some(({ memories }) => memories.some(({ eventId }) => eventId === 'lonely')));
  assert.ok(demo.entries.some(({ memories }) => memories.some(({ eventId }) => eventId === 'mistake')));
  assert.ok(demo.entries.some(({ memories }) => memories.some(({ eventId }) => eventId === 'help')));
  const validGear = new Set(gearCatalog.map(({ id }) => id));
  const travelerGear = demo.wardrobe[demo.active];
  assert.ok(travelerGear.every((id) => validGear.has(id)));
  for (const entry of demo.entries) assert.ok(demo.entryOutfits[entry.id].every((id) => validGear.has(id)));
  const firstId = demo.entries[0].id;
  const before = [...demo.entryOutfits[firstId]];
  demo.entryOutfits[firstId].push('changed-later');
  assert.deepEqual(demo.entries[0].id, firstId);
  assert.deepEqual(before, demo.entryOutfits[firstId].slice(0, -1));
  assert.notStrictEqual(demo.entryOutfits[firstId], demo.wardrobe[demo.active]);
});

test('demo uses real Shanghai hours and keeps early or midnight plans ordered and non-future', () => {
  const normal = makeDemoJourney(NOW);
  assert.equal(Number(shanghaiParts(normal.entries[0].timestamp).hour), 10);
  assert.equal(Number(shanghaiParts(normal.entries[1].timestamp).hour), 14);

  for (const earlyNow of [Date.UTC(2025, 0, 8, 0, 0, 0), Date.UTC(2025, 0, 7, 16, 0, 0)]) {
    const demo = makeDemoJourney(earlyNow);
    const today = demo.entries.slice(-2);
    assert.ok(today.every((entry) => entry.timestamp <= earlyNow));
    assert.ok(today.every((entry) => entry.timestamp >= earlyNow - 2_000));
    assert.ok(today[0].timestamp <= today[1].timestamp);
    assert.notEqual(today[0].id, today[1].id);
    assert.equal(new Set(demo.entries.map(({ id }) => id)).size, demo.entries.length);
  }
});
