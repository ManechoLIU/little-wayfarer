import { EVENTS, validateTraveler } from './journey.js';

const MAX_TIMESTAMP = 8640000000000000;
const MAX_MEMORIES = 6;
const MAX_TRAIL = 80;
const MAX_NOTE_LENGTH = 180;
const MAX_TEXT_LENGTH = 1000;
const MAX_BODY_LENGTH = 4000;
const ENTRY_KEYS = ['id', 'travelerId', 'name', 'timestamp', 'date', 'note', 'fromChapter', 'toChapter', 'memories', 'marks', 'trail', 'visited'];
const MEMORY_KEYS = ['chapter', 'title', 'text', 'eventId', 'responseId'];
const POINT_KEYS = ['x', 'y'];
const EVENT_BY_ID = new Map(EVENTS.map((event) => [event.id, event]));

function validGiftCounts(value) {
  return Array.isArray(value) && value.length === 4
    && value.every((count) => typeof count === 'string' && /^\d+$/.test(count));
}

function validDiaryTraveler(value) {
  if (!isPlainObject(value)) return false;
  const copy = { ...value };
  if (Object.hasOwn(copy, 'giftCounts')) {
    if (!validGiftCounts(copy.giftCounts)) return false;
    delete copy.giftCounts;
  }
  return validateTraveler(copy);
}

function copiedGiftCounts(traveler) {
  if (!Object.hasOwn(traveler, 'giftCounts')) return undefined;
  if (!validGiftCounts(traveler.giftCounts)) throw new TypeError('成长礼物计数无效');
  return [...traveler.giftCounts];
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validTimestamp(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_TIMESTAMP;
}

function dateFor(timestamp) {
  if (!validTimestamp(timestamp)) throw new TypeError('散步时间无效');
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function validDate(value, timestamp) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return month >= 1 && month <= 12 && day >= 1 && parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    && (!Number.isInteger(timestamp) || dateFor(timestamp) === value);
}

function validChapter(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validText(value, max = MAX_TEXT_LENGTH, allowEmpty = false) {
  return typeof value === 'string' && (allowEmpty || value.length > 0) && value.length <= max;
}

function responseExists(eventId, responseId) {
  const event = EVENT_BY_ID.get(eventId);
  return Boolean(event && typeof responseId === 'string' && event.responses.some((response) => response.id === responseId));
}

function validVisited(visited) {
  return Array.isArray(visited) && visited.length >= 3 && visited.length <= EVENTS.length
    && visited.every((id) => typeof id === 'string' && EVENT_BY_ID.has(id))
    && new Set(visited).size === visited.length;
}

function validTextVisited(visited) {
  return Array.isArray(visited) && visited.length <= EVENTS.length
    && visited.every((id) => typeof id === 'string' && EVENT_BY_ID.has(id))
    && new Set(visited).size === visited.length;
}

function validMemory(memory, fromChapter, toChapter) {
  return hasExactKeys(memory, MEMORY_KEYS)
    && Number.isSafeInteger(memory.chapter) && memory.chapter > fromChapter && memory.chapter <= toChapter
    && validText(memory.title) && validText(memory.text)
    && typeof memory.eventId === 'string' && EVENT_BY_ID.has(memory.eventId)
    && responseExists(memory.eventId, memory.responseId);
}

function validateEntryBase(value, textEntry) {
  const hasGiftSnapshot = isPlainObject(value) && Object.hasOwn(value, 'giftCounts');
  const keys = textEntry ? [...ENTRY_KEYS, 'body', 'mood'] : [...ENTRY_KEYS];
  if (hasGiftSnapshot) keys.push('giftCounts');
  if (!hasExactKeys(value, keys)) return false;
  if (!validText(value.id, 240) || !validText(value.travelerId, 200) || !validText(value.name, 40)
    || !validTimestamp(value.timestamp) || !validDate(value.date, value.timestamp)
    || !validText(value.note, MAX_NOTE_LENGTH, true) || !validChapter(value.fromChapter)
    || !validChapter(value.toChapter) || (textEntry ? value.toChapter < value.fromChapter : value.toChapter <= value.fromChapter)
    || !Array.isArray(value.memories) || value.memories.length > MAX_MEMORIES
    || !Array.isArray(value.marks) || value.marks.length > 100
    || value.marks.some((mark) => !validText(mark, 100)) || new Set(value.marks).size !== value.marks.length
    || !Array.isArray(value.trail) || value.trail.length > MAX_TRAIL
    || value.trail.some((point) => !hasExactKeys(point, POINT_KEYS) || !Number.isFinite(point.x) || !Number.isFinite(point.y))
    || (hasGiftSnapshot && !validGiftCounts(value.giftCounts))) return false;
  if (textEntry) {
    if (!validText(value.body, MAX_BODY_LENGTH) || value.body.trim().length === 0 || !validVisitedText(value.mood)) return false;
    if (!validTextVisited(value.visited)) return false;
  } else if (!validVisited(value.visited)) return false;

  let previousChapter = value.fromChapter;
  for (const memory of value.memories) {
    if (!validMemory(memory, value.fromChapter, value.toChapter) || memory.chapter <= previousChapter) return false;
    previousChapter = memory.chapter;
  }
  const memoryEvents = new Set(value.memories.map((memory) => memory.eventId));
  if (textEntry) {
    return value.memories.length === value.visited.length
      && memoryEvents.size === value.memories.length
      && value.visited.every((eventId) => memoryEvents.has(eventId));
  }
  return value.visited.every((eventId) => memoryEvents.has(eventId));
}

function validVisitedText(mood) {
  return Number.isInteger(mood) && mood >= 0 && mood <= 5;
}

export function validateDiaryEntry(value) {
  const textKeys = [...ENTRY_KEYS, 'body', 'mood'];
  const textEntry = hasExactKeys(value, textKeys)
    || hasExactKeys(value, [...textKeys, 'giftCounts']);
  return validateEntryBase(value, textEntry);
}

function assertProgress(traveler, progress, now) {
  if (!validDiaryTraveler(traveler)) throw new TypeError('旅伴存档无效');
  if (!isPlainObject(progress) || !validTimestamp(now) || !validChapter(progress.startChapter)
    || progress.startChapter > traveler.chapter || !Array.isArray(progress.visited)
    || !progress.visited.every((id) => typeof id === 'string') || !Array.isArray(progress.trail)
    || progress.trail.some((point) => !isPlainObject(point) || !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new TypeError('散步进度无效');
  }
  const visited = [...new Set(progress.visited)];
  if (!validVisited(visited)) throw new TypeError('散步需要至少三个不同地点');
  const recentMemories = traveler.memories.filter((memory) => memory.chapter > progress.startChapter);
  if (recentMemories.length === 0 || recentMemories.length > MAX_MEMORIES
    || visited.some((eventId) => !recentMemories.some((memory) => memory.eventId === eventId))) {
    throw new TypeError('散步地点没有对应的实际经历');
  }
  return { visited, recentMemories };
}

export function makeDiaryEntry(traveler, progress, now = Date.now()) {
  const { visited, recentMemories } = assertProgress(traveler, progress, now);
  const entry = {
    id: `${traveler.id}-${now}`,
    travelerId: traveler.id,
    name: traveler.name,
    timestamp: now,
    date: dateFor(now),
    note: '',
    fromChapter: progress.startChapter,
    toChapter: traveler.chapter,
    memories: recentMemories.map(({ chapter, title, text, eventId, responseId }) => ({ chapter, title, text, eventId, responseId })),
    marks: [...traveler.marks],
    trail: progress.trail.slice(-MAX_TRAIL).map(({ x, y }) => ({ x, y })),
    visited,
  };
  const giftCounts = copiedGiftCounts(traveler);
  if (giftCounts) entry.giftCounts = giftCounts;
  if (!validateDiaryEntry(entry)) throw new TypeError('散步手账无效');
  return entry;
}

function sameTraveler(before, after) {
  return before.id === after.id && before.name === after.name && before.seed === after.seed
    && before.palette === after.palette && before.trait === after.trait && before.version === after.version;
}

export function makeTextDiaryEntry(before, after, text, choices, now = Date.now()) {
  if (!validDiaryTraveler(before) || !validDiaryTraveler(after) || !sameTraveler(before, after)
    || !validTimestamp(now) || typeof text !== 'string' || text.trim().length === 0 || text.trim().length > MAX_BODY_LENGTH
    || !Array.isArray(choices) || choices.length > MAX_MEMORIES) {
    throw new TypeError('文字手账输入无效');
  }
  const normalizedChoices = choices.map((choice) => {
    if (!hasExactKeys(choice, ['eventId', 'responseId']) || !EVENT_BY_ID.has(choice.eventId)
      || !responseExists(choice.eventId, choice.responseId)) throw new TypeError('文字手账回应无效');
    return { eventId: choice.eventId, responseId: choice.responseId };
  });
  if (new Set(normalizedChoices.map(({ eventId }) => eventId)).size !== normalizedChoices.length
    || after.chapter - before.chapter !== normalizedChoices.length) {
    throw new TypeError('文字手账经历数量无效');
  }
  const recentMemories = after.memories.filter((memory) => memory.chapter > before.chapter);
  if (recentMemories.length !== normalizedChoices.length
    || normalizedChoices.some((choice, index) => {
      const memory = recentMemories[index];
      return !memory || memory.chapter !== before.chapter + index + 1
        || memory.eventId !== choice.eventId || memory.responseId !== choice.responseId;
    })) {
    throw new TypeError('文字手账经历不匹配');
  }
  const entry = {
    id: `${after.id}-${now}`,
    travelerId: after.id,
    name: after.name,
    timestamp: now,
    date: dateFor(now),
    note: '',
    fromChapter: before.chapter,
    toChapter: after.chapter,
    memories: recentMemories.map(({ chapter, title, text: memoryText, eventId, responseId }) => ({ chapter, title, text: memoryText, eventId, responseId })),
    marks: [...after.marks],
    trail: [],
    visited: normalizedChoices.map(({ eventId }) => eventId),
    body: text.trim(),
    mood: after.mood,
  };
  const giftCounts = copiedGiftCounts(after);
  if (giftCounts) entry.giftCounts = giftCounts;
  if (!validateDiaryEntry(entry)) throw new TypeError('文字手账无效');
  return entry;
}
