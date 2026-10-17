import { EVENTS } from './journey.js';

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
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date());
}

function responseFor(eventId, responseId) {
  return EVENTS.find((event) => event.id === eventId)?.responses.find((response) => response.id === responseId);
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

export function normalizeComposerDraft(value) {
  const draft = value && typeof value === 'object' ? value : {};
  const text = typeof draft.text === 'string' ? draft.text.slice(0, 4000) : '';
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

export function mountComposer({ root, traveler, art, onSave, onWalk, onWardrobe, onHistory, onSocial, initialDraft, onDraft, analyzeJournal, analysisLabel = '本地规则' } = {}) {
  if (!(root instanceof Element)) throw new TypeError('mountComposer 需要有效的 root');
  if (!traveler || typeof art !== 'function' || typeof onSave !== 'function') throw new TypeError('mountComposer 缺少 traveler、art 或 onSave');

  let destroyed = false;
  let busy = false;
  let serial = 0;
  const restored = normalizeComposerDraft(initialDraft);
  let candidates = restored.candidates.map((item) => ({ ...item, key: `restored-${serial += 1}` }));
  let analyzedText = restored.analyzedText;
  let analysisActive = Boolean(restored.analyzedText);
  let analysisSource = restored.analysisSource;
  let analysisSummary = restored.summary;
  let analyzing = false;
  let analysisRequest = 0;

  root.classList.add('lw-compose-root');
  root.innerHTML = `<main class="lw-compose-shell" aria-labelledby="lw-compose-title">
    <section class="lw-compose-companion">
      <div class="lw-compose-date">${dateLabel()}</div>
      <div class="lw-compose-stage"><div data-compose-art></div><span data-compose-preview hidden>仅预览你选中的回应</span></div>
      <div class="lw-compose-intro"><p>身体记着走过的路</p><h1 id="lw-compose-title" data-compose-title></h1><span>第 ${Number(traveler.chapter) || 0} 章 · 随时记下想法，不必等到一天结束</span></div>
    </section>
    <section class="lw-compose-writing">
      <label for="lw-compose-journal">这一段旅程，让你想到了什么？</label>
      <p>可以是念头、见闻或今天发生的事，不必写成日记。</p>
      <textarea id="lw-compose-journal" data-compose-text maxlength="4000" rows="9" placeholder="比如：路边的一句话、刚冒出来的念头，或一件想记住的小事……"></textarea>
      <div class="lw-compose-count"><span>默认只在当前设备保存；正文不会自动上传或分享。</span><b data-compose-count>0 / 4000</b></div>
      <button type="button" class="lw-compose-analyze" data-compose-analyze>看看这一笔留下些什么</button>
      <p class="lw-compose-rule-note" data-compose-analysis-note></p>
    </section>
    <section class="lw-compose-review" data-compose-review hidden>
      <header><div><h2>从文字里找到的候选</h2><p data-compose-confirm-note>这些是匹配建议，只有你能决定这一笔意味着什么。</p><p class="lw-compose-summary" data-compose-summary hidden></p></div><span>尚未选中任何经历</span></header>
      <div class="lw-compose-candidates" data-compose-candidates></div>
      <div class="lw-compose-manual">
        <div><b>没有合适的？自己补一个标签</b><span>也可以不加标签，只保存今天的文字。</span></div>
        <label>类别<select data-compose-manual-event>${EVENTS.map((event) => `<option value="${event.id}">${CATEGORY[event.id]}</option>`).join('')}</select></label>
        <label>回应<select data-compose-manual-response></select></label>
        <button type="button" data-compose-manual-add>加入候选</button>
      </div>
    </section>
    <section class="lw-compose-savebar">
      <div><b data-compose-status>想记的时候写一笔，也可以直接回到路上。</b><span>所选类别如需上链，会由下一步另行确认。</span></div>
      <button type="button" data-compose-save>记下这一笔</button>
    </section>
    <nav class="lw-compose-doors" aria-label="其他入口">
      <button type="button" data-compose-door="walk"><i>↝</i><b>回到路上</b><span>随时继续这一段旅程</span></button>
      <button type="button" data-compose-door="wardrobe"><i>◌</i><b>我的故事背包</b><span>看看身体记住了什么</span></button>
      <button type="button" data-compose-door="history"><i>▤</i><b>沿途记录</b><span>翻翻以前写过的文字</span></button>
      <button type="button" data-compose-door="social"><i>✦</i><b>朋友来访</b><span>分享旅伴与来源物件</span></button>
    </nav>
    <div class="lw-compose-error" data-compose-error role="alert" hidden></div>
  </main>`;

  const textarea = root.querySelector('[data-compose-text]');
  const count = root.querySelector('[data-compose-count]');
  const review = root.querySelector('[data-compose-review]');
  const candidatesEl = root.querySelector('[data-compose-candidates]');
  const artEl = root.querySelector('[data-compose-art]');
  const previewLabel = root.querySelector('[data-compose-preview]');
  const status = root.querySelector('[data-compose-status]');
  const error = root.querySelector('[data-compose-error]');
  const manualEvent = root.querySelector('[data-compose-manual-event]');
  const manualResponse = root.querySelector('[data-compose-manual-response]');
  const summaryEl = root.querySelector('[data-compose-summary]');
  const confirmNote = root.querySelector('[data-compose-confirm-note]');
  const analyzeButton = root.querySelector('[data-compose-analyze]');
  root.querySelector('[data-compose-title]').textContent = `${String(traveler.name ?? '')}，路上记一笔`;
  root.querySelector('[data-compose-analysis-note]').textContent = typeof analyzeJournal === 'function'
    ? `${String(analysisLabel)} 提供建议，需你确认。按下分析会将这段文字发送到该模型服务，不自动公开或上链。`
    : '本地规则匹配，非 AI 分析；只生成候选，你可以修改或全部不要。';

  function getDraft() {
    return {
      text: textarea.value,
      analyzedText,
      analysisSource,
      summary: analysisSummary,
      candidates: candidates.map(({ eventId, responseId, checked, manual, evidence = '', reason = '', matchedText = '' }) => ({
        eventId, responseId, checked, manual, evidence: evidence || matchedText, reason,
      })),
    };
  }

  function emitDraft() {
    if (typeof onDraft !== 'function') return;
    const snapshot = getDraft();
    onDraft({ ...snapshot, candidates: snapshot.candidates.map((item) => ({ ...item })) });
  }

  function renderArt() {
    const selected = candidates.filter((item) => item.checked);
    const last = selected.at(-1);
    const response = last ? responseFor(last.eventId, last.responseId) : null;
    artEl.innerHTML = art(traveler, response ? response.mood : traveler.mood);
    previewLabel.hidden = !response;
  }

  function updateManualResponses() {
    const event = EVENTS.find((item) => item.id === manualEvent.value) || EVENTS[0];
    manualResponse.replaceChildren(...event.responses.map((response) => {
      const option = document.createElement('option');
      option.value = response.id;
      option.textContent = response.label;
      return option;
    }));
  }

  function excerptNode(candidate) {
    const paragraph = document.createElement('p');
    paragraph.className = 'lw-compose-excerpt';
    paragraph.append(document.createTextNode(candidate.before));
    const mark = document.createElement('mark');
    mark.textContent = candidate.matchedText;
    paragraph.append(mark, document.createTextNode(candidate.after));
    return paragraph;
  }

  function renderCandidates() {
    candidatesEl.replaceChildren();
    if (!candidates.length) {
      const empty = document.createElement('p');
      empty.className = 'lw-compose-empty';
      empty.textContent = '没有发现足够明确的词。你可以手动补一个标签，也可以只保存文字。';
      candidatesEl.append(empty);
    }
    for (const candidate of candidates) {
      const event = EVENTS.find((item) => item.id === candidate.eventId);
      const card = document.createElement('article');
      card.className = `lw-compose-candidate${candidate.checked ? ' lw-compose-selected' : ''}`;
      card.dataset.composeKey = candidate.key;
      const top = document.createElement('div');
      top.className = 'lw-compose-candidate-top';
      const checkLabel = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = candidate.checked;
      checkbox.dataset.composeCheck = candidate.key;
      checkLabel.append(checkbox, document.createTextNode(` 采用「${CATEGORY[candidate.eventId]}」`));
      const badge = document.createElement('span');
      badge.textContent = candidate.manual ? '你手动添加' : `${analysisSource === 'model' ? '建议依据' : '匹配到'}「${candidate.matchedText}」`;
      top.append(checkLabel, badge);
      card.append(top);
      if (!candidate.manual) card.append(excerptNode(candidate));
      if (candidate.reason) {
        const reason = document.createElement('p');
        reason.className = 'lw-compose-reason';
        reason.textContent = candidate.reason;
        card.append(reason);
      }
      const responseLabel = document.createElement('label');
      responseLabel.className = 'lw-compose-response';
      responseLabel.append(document.createTextNode('这次更接近 '));
      const select = document.createElement('select');
      select.dataset.composeResponse = candidate.key;
      for (const response of event.responses) {
        const option = document.createElement('option');
        option.value = response.id;
        option.textContent = `${response.label} · ${response.description}`;
        option.selected = response.id === candidate.responseId;
        select.append(option);
      }
      responseLabel.append(select);
      card.append(responseLabel);
      candidatesEl.append(card);
    }
    const chosen = candidates.filter((item) => item.checked).length;
    review.querySelector('header>span').textContent = chosen ? `已选择 ${chosen} 段经历` : '尚未选中任何经历';
    confirmNote.textContent = analysisSource === 'model' ? '模型提供建议，需你确认；它不是情绪诊断或评分。' : '这些是匹配建议，只有你能决定这一笔意味着什么。';
    summaryEl.textContent = analysisSummary;
    summaryEl.hidden = !analysisSummary;
    renderArt();
  }

  async function analyze() {
    if (busy || analyzing) return;
    const text = textarea.value;
    if (!text.trim()) {
      error.textContent = '先写下一点内容，再看看可能留下了什么。';
      error.hidden = false;
      textarea.focus();
      return;
    }
    const request = ++analysisRequest;
    analyzing = true;
    analyzeButton.disabled = true;
    error.hidden = true;
    status.textContent = typeof analyzeJournal === 'function' ? `正在等待 ${String(analysisLabel)} 返回建议…` : '正在用本地规则寻找候选…';
    try {
      if (typeof analyzeJournal === 'function') {
        const result = await analyzeJournal(text);
        if (destroyed || request !== analysisRequest || textarea.value !== text) return;
        const rows = Array.isArray(result?.candidates) ? result.candidates : [];
        const seen = new Set();
        candidates = [];
        for (const row of rows.slice(0, EVENTS.length)) {
          const event = EVENTS.find((item) => item.id === row?.eventId);
          const response = event?.responses.find((item) => item.id === row?.responseId);
          const evidence = typeof row?.evidence === 'string' ? row.evidence.slice(0, 240) : '';
          const parts = evidence ? excerptParts(text, evidence) : null;
          if (!event || !response || !parts || seen.has(event.id)) continue;
          seen.add(event.id);
          candidates.push({ ...parts, key: `model-${serial += 1}`, eventId: event.id, responseId: response.id, category: CATEGORY[event.id], checked: false, manual: false, evidence, reason: typeof row.reason === 'string' ? row.reason.slice(0, 500) : '', kind: 'candidate' });
        }
        analysisSource = 'model';
        analysisSummary = typeof result?.summary === 'string' ? result.summary.slice(0, 800) : '';
      } else {
        if (destroyed || request !== analysisRequest || textarea.value !== text) return;
        candidates = analyzeLocalJournal(text).map((item) => {
          const event = EVENTS.find((eventItem) => eventItem.id === item.eventId);
          return { ...item, key: `candidate-${serial += 1}`, responseId: event.responses[0].id, checked: false, manual: false, evidence: item.matchedText, reason: '' };
        });
        analysisSource = 'local';
        analysisSummary = '';
      }
      analyzedText = text;
      analysisActive = true;
      review.hidden = false;
      renderCandidates();
      emitDraft();
      status.textContent = candidates.length ? '候选没有自动采用，请按自己的意思选择。' : '没有标签也没关系，文字本身就值得记下。';
      review.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    } catch (analysisError) {
      if (destroyed || request !== analysisRequest || textarea.value !== text) return;
      error.textContent = analysisError?.message || `${String(analysisLabel)} 暂时没有返回建议。`;
      error.hidden = false;
      status.textContent = '分析没有完成，没有改用其他规则。正文仍在这里。';
    } finally {
      if (!destroyed && request === analysisRequest) {
        analyzing = false;
        analyzeButton.disabled = false;
      }
    }
  }

  function addManualCandidate() {
    const event = EVENTS.find((item) => item.id === manualEvent.value);
    if (!event) return;
    const existing = candidates.find((item) => item.eventId === event.id);
    if (existing) {
      existing.responseId = manualResponse.value;
      existing.checked = true;
    } else {
      candidates.push({ key: `manual-${serial += 1}`, eventId: event.id, responseId: manualResponse.value, category: CATEGORY[event.id], matchedText: '', before: '', after: '', checked: true, manual: true, evidence: '', reason: '' });
    }
    renderCandidates();
    emitDraft();
  }

  async function save() {
    if (busy) return;
    const text = textarea.value.trim();
    if (!text) {
      error.textContent = '先写下一点路上的想法或见闻，再记下这一笔。';
      error.hidden = false;
      textarea.focus();
      return;
    }
    const choices = candidates.filter((item) => item.checked).map(({ eventId, responseId }) => ({ eventId, responseId }));
    busy = true;
    error.hidden = true;
    const lockedControls = [...root.querySelectorAll('button,select,textarea')];
    lockedControls.forEach((control) => { control.disabled = true; });
    status.textContent = '正在记下这一笔…';
    try {
      await onSave({ text, choices });
      textarea.value = '';
      candidates = [];
      analyzedText = '';
      analysisActive = false;
      analysisSummary = '';
      emitDraft();
      if (!destroyed) status.textContent = '这一笔已经记下了。';
    } catch (saveError) {
      if (!destroyed) {
        error.textContent = saveError?.message || '今天还没有保存，请再试一次。';
        error.hidden = false;
        status.textContent = '正文和选择都还在，没有丢失。';
      }
    } finally {
      busy = false;
      if (!destroyed) lockedControls.forEach((control) => { control.disabled = false; });
    }
  }

  function onInput() {
    count.textContent = `${textarea.value.length} / 4000`;
    error.hidden = true;
    if (analyzing) {
      analysisRequest += 1;
      analyzing = false;
      analyzeButton.disabled = false;
      status.textContent = '文字变了，刚才的分析结果不会再采用。';
    }
    if (analysisActive && textarea.value !== analyzedText) {
      analysisRequest += 1;
      candidates = [];
      analyzedText = '';
      analysisActive = false;
      analysisSummary = '';
      review.hidden = true;
      renderArt();
      status.textContent = '正文有了变化，需要时可以重新看看候选。';
    }
    emitDraft();
  }

  function onChange(event) {
    if (event.target === manualEvent) { updateManualResponses(); return; }
    const checkKey = event.target.dataset.composeCheck;
    const responseKey = event.target.dataset.composeResponse;
    if (checkKey) {
      const candidate = candidates.find((item) => item.key === checkKey);
      if (candidate) candidate.checked = event.target.checked;
      renderCandidates();
      emitDraft();
    }
    if (responseKey) {
      const candidate = candidates.find((item) => item.key === responseKey);
      if (candidate) candidate.responseId = event.target.value;
      renderCandidates();
      emitDraft();
    }
  }

  function onClick(event) {
    if (event.target.closest('[data-compose-analyze]')) { analyze(); return; }
    if (event.target.closest('[data-compose-manual-add]')) { addManualCandidate(); return; }
    if (event.target.closest('[data-compose-save]')) { save(); return; }
    const door = event.target.closest('[data-compose-door]')?.dataset.composeDoor;
    if (door === 'walk') onWalk?.();
    if (door === 'wardrobe') onWardrobe?.();
    if (door === 'history') onHistory?.();
    if (door === 'social') onSocial?.();
  }

  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  textarea.addEventListener('input', onInput);
  updateManualResponses();
  textarea.value = restored.text;
  count.textContent = `${textarea.value.length} / 4000`;
  if (analysisActive) {
    review.hidden = false;
    renderCandidates();
  } else renderArt();

  return {
    getDraft,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      analysisRequest += 1;
      root.removeEventListener('click', onClick);
      root.removeEventListener('change', onChange);
      textarea.removeEventListener('input', onInput);
      root.classList.remove('lw-compose-root');
    },
  };
}
