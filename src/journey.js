const MOODS = ['好奇出发', '受挫', '难过', '休息', '被善意接住', '再出发'];
const MAX_NAME_LENGTH = 40;
const MAX_MEMORIES = 100;
const TRAVELER_KEYS = ['version', 'id', 'name', 'seed', 'palette', 'trait', 'mood', 'chapter', 'memories', 'marks'];
const MEMORY_KEYS = ['id', 'chapter', 'eventId', 'responseId', 'title', 'text', 'mood', 'mark', 'timestamp'];

const event = (id, title, description, icon, responses) => ({ id, title, description, icon, responses });
const response = (id, label, description, mood, mark, text) => ({ id, label, description, mood, mark, text });

export const EVENTS = Object.freeze([
  event('explore', '试试新路', '世界在地图边缘，等你迈出一步。', '🧭', [
    response('step-forward', '向前一步', '先试试看，再决定要不要继续。', 5, '勇气', '你迈出了一小步，脚下就有了新的路。'),
    response('look-around', '先观察', '把陌生的地方看清楚，也是出发。', 0, '好奇', '你没有急着回答，只把新鲜的风景收进眼睛。'),
  ]),
  event('setback', '遇到挫折', '努力没有立刻带来想要的结果。', '🌧️', [
    response('rest', '先休息', '把力气留给明天，失败不必马上被解释。', 3, '韧性', '你把肩膀放下来，知道休息也是继续的一部分。'),
    response('try-again', '再试一次', '换个方法，带着刚刚学到的东西回来。', 5, '坚持', '你擦掉一点灰尘，又带着新的方法出发。'),
  ]),
  event('lonely', '感到孤单', '同行的人暂时走远了，四周安静下来。', '🌙', [
    response('reach-out', '发出邀请', '让一个可信的人知道你想有人同行。', 4, '连接', '你发出了一句问候，远处也亮起了一盏灯。'),
    response('sit-with-it', '陪自己坐坐', '先承认这份难过，给它一个安静的位置。', 2, '独处', '你陪着自己的心情坐了一会儿，夜色没有催你。'),
  ]),
  event('mistake', '犯了个错', '一处小小的偏差，让事情变得不一样。', '🪴', [
    response('repair', '试着修补', '承认影响，做一件能让事情变好的事。', 4, '修补', '你诚实地说起那处裂缝，也开始把它一点点补好。'),
    response('learn', '记下来', '先理解发生了什么，下次带着经验走。', 1, '诚实', '你把教训写进旅程里，错误没有变成你的名字。'),
  ]),
  event('help', '帮助别人', '有人在路边需要一点时间、力气或耐心。', '🤝', [
    response('lend-a-hand', '伸出手', '用你能给的方式，让对方少走一点弯路。', 4, '善意', '你分出一点力气，另一双眼睛重新有了光。'),
    response('ask-together', '一起想办法', '先听清需要，再和对方并肩寻找办法。', 5, '同行', '你们把问题摊在一起，路就不再只由一个人走。'),
  ]),
  event('rest', '好好休息', '旅程不只由脚步组成，也需要停下来照顾自己。', '🛏️', [
    response('sleep', '睡一觉', '把今天交给夜晚，醒来再看下一步。', 3, null, '你安心睡了一觉，身体记得怎样重新积攒力气。'),
    response('small-ritual', '做件小事', '喝水、晒太阳，或整理一个让你舒服的角落。', 4, '照顾自己', '你为自己留了一点温柔，心里重新有了空间。'),
  ]),
]);

const EVENT_BY_ID = new Map(EVENTS.map((item) => [item.id, item]));

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

function validNow(now) {
  return Number.isSafeInteger(now) && now >= 0;
}

function validName(name) {
  return typeof name === 'string' && name.trim().length > 0 && name.length <= MAX_NAME_LENGTH;
}

function validUint(value, max) {
  return Number.isInteger(value) && value >= 0 && value <= max;
}

function validGiftCounts(value) {
  return Array.isArray(value) && value.length === 4
    && value.every((count) => typeof count === 'string' && /^\d+$/.test(count));
}

function stableId(input) {
  let hash = 2166136261;
  for (const char of `${input.name}\u0000${input.seed}\u0000${input.palette}\u0000${input.trait}`) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `traveler-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function assertCreateInput(input, now) {
  if (!isPlainObject(input) || !validName(input.name) || !validUint(input.seed, 0xffffffff)
    || !validUint(input.palette, 3) || !validUint(input.trait, 3) || !validNow(now)) {
    throw new TypeError('非法旅伴输入');
  }
}

export function createTraveler(input, now = Date.now()) {
  assertCreateInput(input, now);
  return {
    version: 1,
    id: stableId(input),
    name: input.name.trim(),
    seed: input.seed,
    palette: input.palette,
    trait: input.trait,
    mood: 0,
    chapter: 0,
    memories: [],
    marks: [],
  };
}

function validMemory(memory, travelerChapter) {
  if (!isPlainObject(memory) || !hasExactKeys(memory, MEMORY_KEYS)) return false;
  if (typeof memory.id !== 'string' || memory.id.length === 0 || !Number.isInteger(memory.chapter)
    || memory.chapter < 1 || memory.chapter > travelerChapter || typeof memory.eventId !== 'string'
    || typeof memory.responseId !== 'string' || typeof memory.title !== 'string' || memory.title.length === 0
    || typeof memory.text !== 'string' || memory.text.length === 0 || !validUint(memory.mood, 5)
    || !(memory.mark === null || (typeof memory.mark === 'string' && memory.mark.length > 0))
    || !validNow(memory.timestamp)) return false;
  const eventItem = EVENT_BY_ID.get(memory.eventId);
  return Boolean(eventItem && eventItem.responses.some((item) => item.id === memory.responseId));
}

export function validateTraveler(value) {
  if (!isPlainObject(value)) return false;
  const hasGifts = Object.hasOwn(value, 'giftCounts');
  if (!hasExactKeys(value, hasGifts ? [...TRAVELER_KEYS, 'giftCounts'] : TRAVELER_KEYS)
    || (hasGifts && !validGiftCounts(value.giftCounts))) return false;
  if (value.version !== 1 || typeof value.id !== 'string' || value.id.length === 0
    || !validName(value.name) || !validUint(value.seed, 0xffffffff) || !validUint(value.palette, 3)
    || !validUint(value.trait, 3) || !validUint(value.mood, 5) || !Number.isInteger(value.chapter)
    || value.chapter < 0 || !Array.isArray(value.memories) || value.memories.length > MAX_MEMORIES
    || !Array.isArray(value.marks) || value.marks.some((mark) => typeof mark !== 'string' || mark.length === 0)
    || new Set(value.marks).size !== value.marks.length) return false;
  const expectedFirstChapter = value.chapter === 0 ? 1 : Math.max(1, value.chapter - value.memories.length + 1);
  if (value.chapter === 0 && value.memories.length !== 0) return false;
  if (value.chapter > 0 && value.memories.length === 0) return false;
  return value.memories.every((memory, index) => validMemory(memory, value.chapter)
    && memory.chapter === expectedFirstChapter + index);
}

function assertTraveler(value) {
  if (!validateTraveler(value)) throw new TypeError('旅伴存档无效');
}

function findResponse(eventId, responseId) {
  const eventItem = EVENT_BY_ID.get(eventId);
  if (!eventItem) throw new RangeError('未知经历');
  const selected = eventItem.responses.find((item) => item.id === responseId);
  if (!selected) throw new RangeError('未知回应');
  return { eventItem, selected };
}

export function applyExperience(traveler, eventId, responseId, now = Date.now()) {
  assertTraveler(traveler);
  if (!validNow(now)) throw new TypeError('时间无效');
  const { eventItem, selected } = findResponse(eventId, responseId);
  const chapter = traveler.chapter + 1;
  const memory = {
    id: `${traveler.id}-memory-${chapter}`,
    chapter,
    eventId,
    responseId,
    title: eventItem.title,
    text: selected.text,
    mood: selected.mood,
    mark: selected.mark,
    timestamp: now,
  };
  const memories = [...traveler.memories, memory].slice(-MAX_MEMORIES);
  const marks = selected.mark && !traveler.marks.includes(selected.mark)
    ? [...traveler.marks, selected.mark]
    : [...traveler.marks];
  const next = { ...traveler, mood: selected.mood, chapter, memories, marks };
  if (Object.hasOwn(traveler, 'giftCounts')) next.giftCounts = [...traveler.giftCounts];
  return next;
}

export function getAppearance(traveler) {
  assertTraveler(traveler);
  return traveler.mood;
}

export function summarize(traveler) {
  assertTraveler(traveler);
  return `${traveler.name}走到第${traveler.chapter}章，${MOODS[traveler.mood]}。`;
}
