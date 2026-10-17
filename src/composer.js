import { EVENTS } from './journey.js';
import { validateRecordAnalysis } from './record-analysis.js';

const CATEGORY = Object.freeze({
  explore: '探索', setback: '受挫', lonely: '孤单', mistake: '犯错', help: '帮助', rest: '休息',
});

const TERMS = Object.freeze({
  explore: ['第一次', '试试看', '尝试了', '新开始', '没去过', '开始学', '鼓起勇气'],
  setback: ['受挫', '失败了', '没做好', '被拒绝', '没有成功', '卡住了', '不顺利'],
  lonely: ['孤单', '孤独', '没人理解', '想有人陪', '只有我一个', '联系不上'],
  mistake: ['犯错', '做错', '说错', '弄坏', '伤害了', '忘记了', '对不起'],
  help: ['帮助了', '帮助朋友', '帮助别人', '帮朋友', '帮同事', '帮了', '搭把手', '陪着他', '陪着她', '一起想办法', '伸出手'],
  rest: ['休息', '睡一觉', '太累', '疲惫', '停下来', '照顾自己', '缓一缓'],
});

const NEGATION = /(?:并不|并没有|没有|没|不|不是|无需|不用)$/;

function firstConservativeMatch(text, terms) {
  let winner = null;
  for (const term of terms) {
    let from = 0;
    while (from < text.length) {
      const index = text.indexOf(term, from);
      if (index < 0) break;
      const prefix = text.slice(Math.max(0, index - 5), index);
      if (!NEGATION.test(prefix)) {
        if (!winner || index < winner.index) winner = { term, index };
        break;
      }
      from = index + term.length;
    }
  }
  return winner;
}

export function analyzeLocalJournal(value) {
  const text = typeof value === 'string' ? value : '';
  if (!text.trim()) return [];
  const candidates = [];
  for (const event of EVENTS) {
    const match = firstConservativeMatch(text, TERMS[event.id] || []);
    if (!match) continue;
    const start = Math.max(0, match.index - 18);
    const end = Math.min(text.length, match.index + match.term.length + 22);
    candidates.push({
      eventId: event.id,
      category: CATEGORY[event.id],
      matchedText: match.term,
      before: `${start > 0 ? '…' : ''}${text.slice(start, match.index)}`,
      after: `${text.slice(match.index + match.term.length, end)}${end < text.length ? '…' : ''}`,
      index: match.index,
      kind: 'candidate',
    });
  }
  return candidates.sort((a, b) => a.index - b.index);
}

function dateLabel() {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date());
}

function excerptParts(text, evidence) {
  const index = text.indexOf(evidence);
  if (index < 0) return null;
  const start = Math.max(0, index - 18);
  const end = Math.min(text.length, index + evidence.length + 22);
  return {
    matchedText: evidence,
    before: `${start > 0 ? '…' : ''}${text.slice(start, index)}`,
    after: `${text.slice(index + evidence.length, end)}${end < text.length ? '…' : ''}`,
    index,
  };
}

export function normalizeComposerDraft(value, { textOnly = false } = {}) {
  const draft = value && typeof value === 'object' ? value : {};
  const text = typeof draft.text === 'string' ? draft.text.slice(0, 4000) : '';
  if (textOnly) return { text, analyzedText: '', analysisSource: 'local', summary: '', candidates: [] };
  const analyzedText = typeof draft.analyzedText === 'string' && draft.analyzedText === text ? draft.analyzedText : '';
  const analysisSource = draft.analysisSource === 'model' ? 'model' : 'local';
  const summary = typeof draft.summary === 'string' ? draft.summary.slice(0, 800) : '';
  const candidates = [];
  if (analyzedText && Array.isArray(draft.candidates)) {
    for (const raw of draft.candidates.slice(0, EVENTS.length)) {
      const event = EVENTS.find((item) => item.id === raw?.eventId);
      const response = event?.responses.find((item) => item.id === raw?.responseId);
      if (!event || !response) continue;
      const manual = raw.manual === true;
      const evidence = typeof raw.evidence === 'string' ? raw.evidence.slice(0, 240) : (typeof raw.matchedText === 'string' ? raw.matchedText.slice(0, 240) : '');
      const parts = manual ? { matchedText: '', before: '', after: '', index: Number.MAX_SAFE_INTEGER } : excerptParts(analyzedText, evidence);
      if (!parts) continue;
      candidates.push({
        eventId: event.id, responseId: response.id, checked: raw.checked === true, manual,
        evidence: manual ? '' : evidence, reason: typeof raw.reason === 'string' ? raw.reason.slice(0, 500) : '',
        category: CATEGORY[event.id], kind: 'candidate', ...parts,
      });
    }
  }
  return { text, analyzedText, analysisSource, summary, candidates };
}

export function mountComposer({ root, traveler, art, onSave, onWalk, initialDraft, onDraft, analyzeJournal, provider = 'DeepSeek' } = {}) {
  if (!(root instanceof Element)) throw new TypeError('mountComposer 需要有效的 root');
  if (!traveler || typeof art !== 'function' || typeof onSave !== 'function') throw new TypeError('mountComposer 缺少 traveler、art 或 onSave');

  let destroyed = false;
  let busy = false;
  const restored = normalizeComposerDraft(initialDraft, { textOnly: true });
  root.classList.add('lw-compose-root');
  root.innerHTML = `<main class="lw-compose-shell" aria-labelledby="lw-compose-title">
    <div class="lw-compose-heading">
      <h1 id="lw-compose-title">路上记一笔</h1>
      <p class="lw-compose-date">${dateLabel()}</p>
    </div>
    <section class="lw-compose-companion" aria-label="陪你记一笔的小旅伴">
      <div class="lw-compose-stage" data-compose-art></div>
      <p>一句话，<br>也值得留下。</p>
    </section>
    <section class="lw-compose-writing">
      <label class="lw-compose-label" for="lw-compose-journal">想记住什么？</label>
      <textarea id="lw-compose-journal" data-compose-text maxlength="4000" rows="6" placeholder="刚刚发生了什么？或是，有个念头想留下……"></textarea>
      <div class="lw-compose-count"><span>这一笔，会成为它身上的新痕迹。</span><b data-compose-count>0 / 4000</b></div>
    </section>
    <p class="lw-compose-private" data-compose-private></p>
    <div class="lw-compose-error" data-compose-error role="alert" hidden></div>
    <div class="lw-compose-savebar">
      <button type="button" data-compose-save>记下这一笔</button>
      <button type="button" class="lw-compose-back" data-compose-plain hidden>仅保存文字，不理解表情</button>
      <p data-compose-status role="status" aria-live="polite"></p>
    </div>
    ${typeof onWalk === 'function' ? '<button type="button" class="lw-compose-back" data-compose-back>先回到路上</button>' : ''}
  </main>`;

  const textarea = root.querySelector('[data-compose-text]');
  const count = root.querySelector('[data-compose-count]');
  const saveButton = root.querySelector('[data-compose-save]');
  const plainButton = root.querySelector('[data-compose-plain]');
  const privacy = root.querySelector('[data-compose-private]');
  const backButton = root.querySelector('[data-compose-back]');
  const status = root.querySelector('[data-compose-status]');
  const error = root.querySelector('[data-compose-error]');
  root.querySelector('[data-compose-art]').innerHTML = art(traveler);
  textarea.value = restored.text;

  function getDraft() {
    return normalizeComposerDraft({ text: textarea.value }, { textOnly: true });
  }

  function emitDraft() {
    if (typeof onDraft === 'function') onDraft(getDraft());
  }

  function updateCount() {
    count.textContent = `${textarea.value.length} / 4000`;
  }

  function lockControls(locked) {
    textarea.disabled = locked;
    saveButton.disabled = locked;
    plainButton.disabled = locked;
    if (backButton) backButton.disabled = locked;
    saveButton.textContent = locked ? '正在记下…' : '记下这一笔';
  }

  function setAnalysisService(service) {
    analyzeJournal = service.analyzeJournal;
    provider = service.provider || 'DeepSeek';
    plainButton.hidden = typeof analyzeJournal !== 'function';
    privacy.textContent = typeof analyzeJournal === 'function'
      ? `点「记下这一笔」，本次文字将发送给 ${provider} 理解表情；记录仍保存在这台设备，不会上链或随邀请公开。也可选择仅保存文字。`
      : '记录保存在这台设备。表情理解暂未开启，这次仅保存文字。';
  }

  async function save(understand = true) {
    if (busy || destroyed) return;
    const text = textarea.value.trim();
    if (!text) {
      error.textContent = '写下一句话，再把它留下吧。';
      error.hidden = false;
      textarea.focus();
      return;
    }
    busy = true;
    error.hidden = true;
    status.textContent = '';
    lockControls(true);
    try {
      let analysis;
      if (understand && typeof analyzeJournal === 'function') {
        saveButton.textContent = '正在读懂这一笔…';
        const result = await analyzeJournal(text);
        if (destroyed) return;
        analysis = validateRecordAnalysis(result, text);
        if (!analysis) throw Error('这次没能读懂，文字还在。可以重试，或选择仅保存文字。');
      }
      if (destroyed) return;
      await onSave({ text, choices: [], ...(analysis ? { analysis } : {}) });
      if (destroyed) return;
      textarea.value = '';
      updateCount();
      emitDraft();
      status.textContent = '记下了，身上又多了一点故事。';
    } catch (saveError) {
      if (destroyed) return;
      error.textContent = saveError?.message || '这次还没记下，请再试一次。';
      error.hidden = false;
      status.textContent = '写下的内容还在这里。';
    } finally {
      busy = false;
      if (!destroyed) lockControls(false);
    }
  }

  function onInput() {
    updateCount();
    error.hidden = true;
    status.textContent = '';
    emitDraft();
  }

  function onClick(event) {
    if (event.target.closest('[data-compose-plain]')) { save(false); return; }
    if (event.target.closest('[data-compose-save]')) { save(); return; }
    if (!busy && event.target.closest('[data-compose-back]')) onWalk?.();
  }

  root.addEventListener('click', onClick);
  textarea.addEventListener('input', onInput);
  setAnalysisService({ analyzeJournal, provider });
  updateCount();

  return {
    getDraft,
    setAnalysisService,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      root.removeEventListener('click', onClick);
      textarea.removeEventListener('input', onInput);
      root.classList.remove('lw-compose-root');
    },
  };
}
