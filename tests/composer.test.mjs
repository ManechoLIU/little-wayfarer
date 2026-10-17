import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLocalJournal, normalizeComposerDraft } from '../src/composer.js';

test('empty and unrelated writing stays unclassified', () => {
  assert.deepEqual(analyzeLocalJournal(''), []);
  assert.deepEqual(analyzeLocalJournal('今天阳光很好，我吃了面。'), []);
});

test('user markup remains plain source text without generated HTML', () => {
  const result = analyzeLocalJournal('<img src=x onerror=alert(1)>今天犯错了');
  assert.equal(result.length, 1);
  assert.equal(result[0].eventId, 'mistake');
  assert.equal(result[0].matchedText, '犯错');
  assert.equal('html' in result[0], false);
  assert.match(result[0].before, /nerror=alert\(1\)>/);
});

test('negated keywords are skipped conservatively', () => {
  assert.deepEqual(analyzeLocalJournal('今天我并不孤单，也没有失败了。'), []);
});

test('mixed writing produces editable candidates rather than a verdict', () => {
  const result = analyzeLocalJournal('第一次去做这件事，后来有点受挫，晚上想停下来休息。');
  assert.deepEqual(result.map((item) => item.eventId), ['explore', 'setback', 'rest']);
  assert.ok(result.every((item) => item.kind === 'candidate'));
  assert.ok(result.every((item) => !('responseId' in item)));
});

test('draft normalization restores only valid allowlisted candidates', () => {
  const source = {
    text: '我第一次走这条路。', analyzedText: '我第一次走这条路。', analysisSource: 'model', summary: '一个候选摘要',
    candidates: [
      { eventId: 'explore', responseId: 'look-around', evidence: '第一次', reason: '<b>仅是文本</b>', checked: true },
      { eventId: 'unknown', responseId: 'bad', evidence: '走', checked: true },
      { eventId: 'rest', responseId: 'sleep', evidence: '原文没有的证据', checked: true },
    ],
  };
  const restored = normalizeComposerDraft(source);
  assert.equal(restored.candidates.length, 1);
  assert.deepEqual(restored.candidates[0].eventId, 'explore');
  assert.equal(restored.candidates[0].responseId, 'look-around');
  assert.equal(restored.candidates[0].checked, true);
  assert.equal(restored.candidates[0].reason, '<b>仅是文本</b>');
  restored.candidates[0].reason = 'changed';
  assert.equal(source.candidates[0].reason, '<b>仅是文本</b>');
});

test('stale analyzed text cannot restore old choices', () => {
  const restored = normalizeComposerDraft({ text: '已经改过', analyzedText: '旧正文', candidates: [{ eventId: 'rest', responseId: 'sleep', evidence: '旧正文', checked: true }] });
  assert.equal(restored.analyzedText, '');
  assert.deepEqual(restored.candidates, []);
});

test('text-only draft restores writing without carrying old analysis or selected feelings', () => {
  const source = {
    text: '第一次去散步，想留住这阵风。',
    analyzedText: '第一次去散步，想留住这阵风。',
    analysisSource: 'model', summary: '旧的分析',
    candidates: [{ eventId: 'explore', responseId: 'step-forward', evidence: '第一次', checked: true }],
  };
  assert.deepEqual(normalizeComposerDraft(source, { textOnly: true }), {
    text: source.text, analyzedText: '', analysisSource: 'local', summary: '', candidates: [],
  });
  assert.equal(source.candidates[0].checked, true);
});

test('text-only drafts keep whitespace and limit writing to the supported length', () => {
  const restored = normalizeComposerDraft({ text: `  ${'字'.repeat(4001)}` }, { textOnly: true });
  assert.equal(restored.text, `  ${'字'.repeat(3998)}`);
  assert.equal(restored.text.length, 4000);
  assert.deepEqual(normalizeComposerDraft(null, { textOnly: true }).candidates, []);
});


test('explicit help to a friend is suggested, while its negation is not', () => {
  assert.ok(analyzeLocalJournal('今天帮助朋友搬完了家，晚上终于能坐下来喝一杯热茶。').some(item => item.eventId === 'help'));
  assert.ok(!analyzeLocalJournal('今天没有帮助朋友搬家。').some(item => item.eventId === 'help'));
});
