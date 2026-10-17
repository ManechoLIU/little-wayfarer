import { createTraveler, applyExperience } from './journey.js';
import { makeTextDiaryEntry } from './diary.js';
import { autoEquipGear } from './gear.js';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const DEMO_MARK = '【虚构演示】';

function dateParts(timestamp) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(timestamp));
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function shanghaiDayStart(timestamp) {
  const parts = dateParts(timestamp);
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) - 8 * HOUR;
}

function stamp(now, daysAgo, hour, minute, order) {
  const day = shanghaiDayStart(now) - daysAgo * DAY;
  const planned = day + hour * HOUR + minute * 60_000;
  if (daysAgo !== 0 || planned <= now) return planned;
  return Math.max(day, now - (2 - order) * 1000);
}

function text(body) {
  return `${DEMO_MARK}${body}`;
}

export function makeDemoJourney(now = Date.now()) {
  if (!Number.isSafeInteger(now) || now < 0) throw new TypeError('演示时间无效');
  let traveler = createTraveler({ name: '示例·小歪', seed: 0x5a17c0de, palette: 2, trait: 1 }, now);
  let equipped = [];
  const entries = [];
  const entryOutfits = {};
  const plans = [
    [6, 10, 0, 'explore', 'step-forward', '第一次探索：我试着走上一条还不熟悉的小路。'],
    [6, 14, 1, 'setback', 'rest', '方案受挫了，今天先休息，不把失败当成终点。'],
    [4, 11, 2, 'lonely', 'reach-out', '有点孤单，于是向朋友发出了一句邀请。'],
    [3, 13, 3, 'mistake', 'learn', '我犯了个错，把它记下来，明天带着经验再来。'],
    [2, 15, 4, 'help', 'ask-together', '和朋友一起想办法，路忽然宽了一点。'],
    [1, 12, 5, null, null, '今天只是看见云慢慢移动，也值得写下来。'],
    [0, 10, 6, 'rest', 'small-ritual', '给自己倒一杯水，照顾好身体再出发。'],
    [0, 11, 7, 'explore', 'step-forward', '重新出发：同一条路，也可以用新的心情走。'],
  ];

  for (const [index, [daysAgo, hour, minute, eventId, responseId, body]] of plans.entries()) {
    const timestamp = stamp(now, daysAgo, hour, minute, index >= plans.length - 2 ? index - (plans.length - 2) : 0);
    const before = traveler;
    const after = eventId ? applyExperience(before, eventId, responseId, timestamp) : before;
    const choices = eventId ? [{ eventId, responseId }] : [];
    const entry = makeTextDiaryEntry(before, after, text(body), choices, timestamp);
    entry.id = `${entry.id}-demo-${index}`;
    equipped = autoEquipGear(before, after, equipped);
    entries.push(entry);
    entryOutfits[entry.id] = [...equipped];
    traveler = after;
  }

  return {
    travelers: [traveler],
    active: traveler.id,
    links: {},
    entries,
    wardrobe: { [traveler.id]: [...equipped] },
    entryOutfits,
  };
}
