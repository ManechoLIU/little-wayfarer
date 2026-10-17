import { earnedGear } from './gear.js';

function validGiftCounts(value) {
  return Array.isArray(value) && value.length === 4
    && value.every((item) => typeof item === 'string' && /^\d+$/.test(item));
}

// Recalled appearance comes only from the chosen record and its predecessors.
export function historicalLook(traveler, entry, entries, outfits = {}) {
  if (!entry || entry.travelerId !== traveler.id) throw new TypeError('这段记录不属于当前旅伴');
  const own = entries.filter(item => item.travelerId === traveler.id);
  const index = own.findIndex(item => item.id === entry.id);
  const hasOutfitSnapshot = Array.isArray(outfits[entry.id]);
  const hasMoodSnapshot = Number.isInteger(entry.mood);
  const hasGiftSnapshot = validGiftCounts(entry.giftCounts);
  const snapshot = { ...traveler, mood: hasMoodSnapshot ? entry.mood : 0, marks: [...entry.marks] };
  if (hasGiftSnapshot) snapshot.giftCounts = [...entry.giftCounts];
  else delete snapshot.giftCounts;
  return {
    traveler: snapshot,
    gearIds: hasOutfitSnapshot ? [...outfits[entry.id]] : earnedGear(snapshot).slice(-3).map(item => item.id),
    traceEntries: index >= 0 ? own.slice(0, index + 1) : own.filter(item => item.timestamp <= entry.timestamp),
    hasOutfitSnapshot,
    hasMoodSnapshot,
    hasGiftSnapshot,
  };
}
