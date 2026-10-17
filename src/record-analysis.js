// A visual reading of one diary entry, never a diagnosis or a chain experience.
export function validateRecordAnalysis(value, text) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof text !== 'string') return null;
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== 'evidence' || keys[1] !== 'mood' || typeof value.evidence !== 'string' || value.evidence.length > 240) return null;
  if (value.mood === null) return value.evidence === '' ? { mood: null, evidence: '' } : null;
  if (!Number.isInteger(value.mood) || value.mood < 0 || value.mood > 5 || !value.evidence.trim() || !text.includes(value.evidence)) return null;
  return { mood: value.mood, evidence: value.evidence };
}

export function applyRecordAnalysis(traveler, text, value) {
  const analysis = validateRecordAnalysis(value, text);
  if (!analysis) throw new TypeError('这次表情理解没有完成，文字还在，请重试或仅保存文字。');
  return { ...traveler, mood: analysis.mood ?? traveler.mood, ...(traveler.giftCounts ? { giftCounts: [...traveler.giftCounts] } : {}) };
}
