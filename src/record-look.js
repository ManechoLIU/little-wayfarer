function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) {
    result ^= char.codePointAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function recordLook(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return { style: '', outfit: null };
  const last = entries[entries.length - 1];
  const index = entries.length;
  const id = last && typeof last === 'object' ? last.id : '';
  const outfits = ['scarf', 'cape', 'sprout'];
  return recordLookFromVisual({
    hue: (hash(id) % 71) - 35,
    scale: 97 + (hash(`${id}:scale`) % 7),
    tilt: (hash(`${id}:tilt`) % 7) - 3,
    outfit: outfits[(index - 1) % outfits.length],
  });
}

export function isRecordVisual(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = ['hue', 'scale', 'tilt', 'outfit'];
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
    && Number.isInteger(value.hue) && value.hue >= -35 && value.hue <= 35
    && Number.isInteger(value.scale) && value.scale >= 97 && value.scale <= 103
    && Number.isInteger(value.tilt) && value.tilt >= -3 && value.tilt <= 3
    && ['scarf', 'cape', 'sprout'].includes(value.outfit);
}

export function recordLookFromVisual(value) {
  if (!isRecordVisual(value)) throw new TypeError('角色装扮无效');
  const visual = { hue: value.hue, scale: value.scale, tilt: value.tilt, outfit: value.outfit };
  return {
    style: `--lw-record-hue:${visual.hue}deg;--lw-record-scale:${(visual.scale / 100).toFixed(2)};--lw-record-tilt:${visual.tilt.toFixed(1)}deg;`,
    outfit: visual.outfit,
    visual,
  };
}
