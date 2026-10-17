const GEAR = Object.freeze({
  cape: { id: 'cape', label: '小小勇气披风', description: '迈出那一步后，肩边多了一角会飘的颜色。' },
  compass: { id: 'compass', label: '好奇指南针', description: '不急着选答案时，它会帮忙记住看过的方向。' },
  windmill: { id: 'windmill', label: '再试试风车', description: '风停过，也会重新转起来。' },
  lantern: { id: 'lantern', label: '陪伴小夜灯', description: '一个人坐坐或向外连接时，身边仍留着一点光。' },
  patch: { id: 'patch', label: '认真修补贴', description: '裂缝没有被藏起来，而是被好好照料过。' },
  sprout: { id: 'sprout', label: '同行嫩芽包', description: '给出去或一起找到的办法，长成了背包边的新芽。' },
  scarf: { id: 'scarf', label: '照顾自己围巾', description: '停下来照顾身体，也是一段真实的路。' },
  flower: { id: 'flower', label: '同行小花', description: '有人从远处送来一朵不会催促的小花。' },
  heartpin: { id: 'heartpin', label: '加油心意扣', description: '一句加油被别在身边，需要时可以再看见。' },
  star: { id: 'star', label: '明日小星星', description: '同行者留下的光，陪它走到下一天。' },
});

const MARK_TO_GEAR = Object.freeze({
  '勇气': 'cape',
  '好奇': 'compass',
  '韧性': 'windmill',
  '坚持': 'windmill',
  '连接': 'lantern',
  '独处': 'lantern',
  '修补': 'patch',
  '诚实': 'patch',
  '善意': 'sprout',
  '同行': 'sprout',
  '照顾自己': 'scarf',
  '一朵小花': 'flower',
  '一句加油': 'heartpin',
  '一颗星星': 'star',
});

const SVG = Object.freeze({
  cape: `<svg viewBox="0 0 290 290" aria-hidden="true"><path class="lw-gear-cape-shadow" d="M69 112c-21 17-30 51-22 101 7 38 31 45 55 17-13-37-15-73 1-111Z"/><path class="lw-gear-cape-clasp" d="M82 115c8-9 18-9 27 0"/><circle class="lw-gear-cape-button" cx="84" cy="115" r="7"/></svg>`,
  compass: `<svg viewBox="0 0 290 290" aria-hidden="true"><path class="lw-gear-rope" d="M218 143c12 19 9 38-1 52"/><circle class="lw-gear-compass-shell" cx="216" cy="202" r="25"/><circle class="lw-gear-compass-face" cx="216" cy="202" r="17"/><path class="lw-gear-compass-needle" d="m216 187 6 15-6 15-6-15Z"/><circle class="lw-gear-metal" cx="216" cy="202" r="3"/></svg>`,
  windmill: `<svg viewBox="0 0 290 290" aria-hidden="true"><path class="lw-gear-stick" d="m225 82-12 91"/><path class="lw-gear-windmill-a" d="M225 82c-31-2-40-17-37-35 20 0 32 8 37 35Z"/><path class="lw-gear-windmill-b" d="M225 82c2-31 17-40 35-37 0 20-8 32-35 37Z"/><path class="lw-gear-windmill-c" d="M225 82c31 2 40 17 37 35-20 0-32-8-37-35Z"/><path class="lw-gear-windmill-d" d="M225 82c-2 31-17 40-35 37 0-20 8-32 35-37Z"/><circle class="lw-gear-metal" cx="225" cy="82" r="8"/></svg>`,
  lantern: `<svg viewBox="0 0 290 290" aria-hidden="true"><path class="lw-gear-lantern-handle" d="M42 157c0-29 43-29 43 0"/><rect class="lw-gear-lantern-body" x="37" y="153" width="53" height="61" rx="18"/><rect class="lw-gear-lantern-glow" x="47" y="165" width="33" height="35" rx="13"/><path class="lw-gear-lantern-cap" d="M45 151h37M43 215h41"/></svg>`,
  patch: `<svg viewBox="0 0 290 290" aria-hidden="true"><path class="lw-gear-patch" d="m107 210 41-9 11 38-42 10Z"/><path class="lw-gear-stitch" d="m116 214 30-7m-25 34 29-7m-38-9 43-10"/></svg>`,
  sprout: `<svg viewBox="0 0 290 290" aria-hidden="true"><path class="lw-gear-pack" d="M226 139c31-3 42 20 34 63-4 22-18 31-42 24-5-33-2-62 8-87Z"/><path class="lw-gear-pack-seam" d="M226 161c11 8 23 8 35 2"/><path class="lw-gear-sprout-stem" d="M241 143c-1-22 4-33 15-43"/><path class="lw-gear-sprout-leaf" d="M253 105c1-17 12-26 29-24-2 17-12 25-29 24Zm-8 12c-15-3-24-13-23-29 16 2 24 12 23 29Z"/></svg>`,
  scarf: `<svg viewBox="0 0 290 290" aria-hidden="true"><path class="lw-gear-scarf-wrap" d="M83 183c34 19 86 19 124-2l8 25c-45 22-99 22-140 0Z"/><path class="lw-gear-scarf-tail" d="m184 199 24 2 14 55-30-8Z"/><path class="lw-gear-scarf-line" d="m197 241 21 5m-23-15 20 4"/></svg>`,
  flower: `<svg viewBox="0 0 290 290" aria-hidden="true"><path class="lw-gear-flower-stem" d="M60 76c9 32 12 54 8 78"/><path class="lw-gear-flower-leaf" d="M68 123c15-14 28-13 39 1-14 12-27 12-39-1Z"/><g class="lw-gear-flower-head"><circle cx="57" cy="66" r="13"/><circle cx="76" cy="65" r="13"/><circle cx="66" cy="49" r="13"/><circle cx="65" cy="80" r="13"/><circle class="lw-gear-flower-core" cx="66" cy="65" r="10"/></g></svg>`,
  heartpin: `<svg viewBox="0 0 290 290" aria-hidden="true"><path class="lw-gear-heartpin" d="M222 211c-24-20-34-31-33-46 1-17 23-24 34-8 12-16 34-8 34 9 0 15-12 27-35 45Z"/><circle class="lw-gear-pin-shine" cx="211" cy="168" r="5"/></svg>`,
  star: `<svg viewBox="0 0 290 290" aria-hidden="true"><path class="lw-gear-star" d="m239 38 10 21 23 3-17 16 4 23-20-11-21 11 4-23-17-16 24-3Z"/><circle class="lw-gear-star-dot" cx="199" cy="47" r="5"/><circle class="lw-gear-star-dot" cx="270" cy="113" r="7"/></svg>`,
});

const MOOD_SVG = Object.freeze({
  1: `<span class="lw-gear-mood lw-gear-mood-setback" aria-hidden="true"><svg viewBox="0 0 290 290"><path class="lw-gear-rain-cloud" d="M199 52c7-25 43-25 53-4 25-4 37 27 17 40h-74c-21-12-14-34 4-36Z"/><path class="lw-gear-raindrops" d="m207 101-6 14m29-14-6 14m29-14-6 14"/><circle class="lw-gear-mud" cx="81" cy="236" r="9"/><circle class="lw-gear-mud" cx="205" cy="245" r="6"/></svg></span>`,
  2: `<span class="lw-gear-mood lw-gear-mood-sad" aria-hidden="true"><svg viewBox="0 0 290 290"><path class="lw-gear-tear" d="M71 132c15 22 16 31 7 38-9 7-22 0-20-11 1-7 6-16 13-27Zm145 2c14 20 15 29 7 36-9 6-21 0-20-11 1-7 6-15 13-25Z"/><circle class="lw-gear-sad-bubble" cx="56" cy="105" r="7"/><circle class="lw-gear-sad-bubble" cx="235" cy="112" r="5"/></svg></span>`,
  3: `<span class="lw-gear-mood lw-gear-mood-rest" aria-hidden="true"><svg viewBox="0 0 290 290"><path class="lw-gear-sleep-bubble" d="M222 75h31l-30 34h31"/><path class="lw-gear-sleep-bubble lw-gear-sleep-small" d="M195 54h20l-19 22h20"/><circle class="lw-gear-dream" cx="258" cy="49" r="9"/></svg></span>`,
});

export function earnedGear(traveler) {
  const marks = Array.isArray(traveler?.marks) ? traveler.marks : [];
  const seen = new Set();
  const earned = [];
  for (const mark of marks) {
    const id = MARK_TO_GEAR[mark];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    earned.push({ ...GEAR[id], source: mark });
  }
  return earned;
}

export function gearHTML(traveler, equippedIds, mood = traveler?.mood) {
  const earned = earnedGear(traveler);
  const byId = new Map(earned.map((item) => [item.id, item]));
  const requested = equippedIds === undefined ? earned.slice(-3).map((item) => item.id) : (Array.isArray(equippedIds) ? equippedIds : []);
  const selected = [];
  const seen = new Set();
  for (const id of requested) {
    if (selected.length === 3) break;
    if (typeof id !== 'string' || seen.has(id) || !byId.has(id)) continue;
    seen.add(id);
    selected.push(byId.get(id));
  }
  const safeMood = Number.isInteger(mood) && mood >= 0 && mood <= 5 ? mood : 0;
  const items = selected.map((item) => `<span class="lw-gear-item lw-gear-${item.id}" data-gear="${item.id}" data-source="${item.source}" aria-label="${item.label}，来自${item.source}">${SVG[item.id]}<span class="lw-gear-tag">来自「${item.source}」</span></span>`).join('');
  return `<span class="lw-gear-layer" aria-label="旅途中获得的随身物件">${items}${MOOD_SVG[safeMood] || ''}</span>`;
}

export const gearCatalog = Object.freeze(Object.values(GEAR).map((item) => Object.freeze({ ...item })));

const TRACE_ICONS = Object.freeze({
  explore: '<path class="lw-gear-trace-symbol" d="M9 20 20 9m-7 0h7v7"/>',
  setback: '<path class="lw-gear-trace-symbol" d="M15 7c-4 6-7 10-7 14a7 7 0 0 0 14 0c0-4-3-8-7-14Z"/>',
  lonely: '<path class="lw-gear-trace-symbol" d="M21 21A10 10 0 0 1 11 8a10 10 0 1 0 10 13Z"/>',
  mistake: '<path class="lw-gear-trace-symbol" d="m9 9 12 12m0-12L9 21"/><path class="lw-gear-trace-stitch" d="M15 6v4m0 10v4M6 15h4m10 0h4"/>',
  help: '<circle class="lw-gear-trace-symbol" cx="11" cy="15" r="6"/><circle class="lw-gear-trace-symbol" cx="20" cy="15" r="6"/>',
  rest: '<path class="lw-gear-trace-symbol" d="M9 19c7 3 14-1 14-8-6 5-10 0-16 4-2 2-1 3 2 4Z"/>',
  footprint: '<ellipse class="lw-gear-trace-symbol" cx="13" cy="18" rx="5" ry="8"/><circle class="lw-gear-trace-symbol" cx="20" cy="8" r="3"/><circle class="lw-gear-trace-symbol" cx="14" cy="6" r="2.6"/><circle class="lw-gear-trace-symbol" cx="8" cy="8" r="2.2"/>',
});

function stableHash(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function autoEquipGear(before, after, currentEquipped = []) {
  const validIds = new Set(Object.keys(GEAR));
  let equipped = [];
  for (const id of Array.isArray(currentEquipped) ? currentEquipped : []) {
    if (validIds.has(id) && !equipped.includes(id)) equipped.push(id);
  }
  equipped = equipped.slice(-3);

  const previousChapter = Number(before?.chapter) || 0;
  const newMemories = (Array.isArray(after?.memories) ? after.memories : [])
    .filter((memory) => Number(memory?.chapter) > previousChapter)
    .sort((left, right) => Number(left.chapter) - Number(right.chapter));

  for (const memory of newMemories) {
    const gearId = MARK_TO_GEAR[memory?.mark];
    if (!gearId) continue;
    equipped = equipped.filter((id) => id !== gearId);
    equipped.push(gearId);
    equipped = equipped.slice(-3);
  }
  return equipped;
}

export function journeyTraceHTML(entries) {
  const recent = (Array.isArray(entries) ? entries : []).filter((entry) => entry && typeof entry === 'object').slice(-3);
  if (!recent.length) return '';
  const positions = [[54, 213], [228, 218], [91, 250], [199, 252], [64, 245], [224, 244]];
  const traces = recent.map((entry, index) => {
    const eventId = Object.hasOwn(TRACE_ICONS, entry.eventId) ? entry.eventId : 'footprint';
    const identity = entry.id ?? entry.hash ?? `${entry.eventId || 'note'}:${entry.chapter ?? index}`;
    const hash = stableHash(identity);
    const [x, y] = positions[(hash + index) % positions.length];
    const xPercent = (x / 290 * 100).toFixed(2);
    const yPercent = (y / 290 * 100).toFixed(2);
    const rotation = (hash % 31) - 15;
    const color = hash % 5;
    return `<span class="lw-gear-trace lw-gear-trace-${eventId} lw-gear-trace-color-${color}" style="--lw-trace-x:${xPercent}%;--lw-trace-y:${yPercent}%;--lw-trace-r:${rotation}deg"><svg viewBox="0 0 30 30" aria-hidden="true"><path class="lw-gear-trace-blob" d="M6 9c3-6 14-7 18-2 5 5 3 15-2 18-6 4-16 2-18-4-2-4-1-9 2-12Z"/>${TRACE_ICONS[eventId]}<circle class="lw-gear-trace-shine" cx="9" cy="9" r="2"/></svg></span>`;
  }).join('');
  return `<span class="lw-gear-traces" aria-hidden="true">${traces}</span>`;
}
