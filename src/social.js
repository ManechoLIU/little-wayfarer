import { earnedGear, gearHTML } from './gear.js';

const MARKS = Object.freeze(['勇气', '好奇', '韧性', '坚持', '连接', '独处', '修补', '诚实', '善意', '同行', '照顾自己']);
const REACTIONS = Object.freeze([
  { id: 0, label: '送一朵花', note: '留下一点温柔' },
  { id: 1, label: '给一句鼓励', note: '告诉它有人看见' },
  { id: 2, label: '送一颗星星', note: '留一点光给明天' },
  { id: 3, label: '放一枚彩纸弹', note: '让大屏回应这一下' },
]);
const POLL_MS = 5000;
const REACTION_SECONDS = 12;
const GIFT_MARKS = Object.freeze(['一朵小花', '一句加油', '一颗星星']);

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const shortAddress = (value) => {
  const text = String(value || '');
  return text.length > 12 ? `${text.slice(0, 6)}…${text.slice(-4)}` : text || '未知地址';
};
const asNumber = (value) => {
  const number = Number(value ?? 0);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
};
const receiptSucceeded = (receipt) => receipt && (receipt.status === 1 || receipt.status === 1n);

function readField(record, name, index) {
  return record?.[name] ?? record?.[index];
}

function normalizeTraveler(raw, fallback) {
  const markBits = asNumber(readField(raw, 'marks', 7));
  const marks = MARKS.filter((_, bit) => (markBits & (1 << bit)) !== 0);
  GIFT_MARKS.forEach((mark, bit) => { if ((markBits & (1 << (12 + bit))) !== 0) marks.push(mark); });
  return {
    ...fallback,
    origin: String(readField(raw, 'origin', 0) || fallback.origin || ''),
    name: String(readField(raw, 'name', 1) || fallback.name || ''),
    seed: asNumber(readField(raw, 'seed', 2)),
    chapter: asNumber(readField(raw, 'chapter', 3)),
    palette: asNumber(readField(raw, 'palette', 4)),
    trait: asNumber(readField(raw, 'trait', 5)),
    mood: asNumber(readField(raw, 'mood', 6)),
    marks,
    wornSouvenirId: String(readField(raw, 'wornSouvenirId', 8) || '0'),
    souvenirCount: asNumber(readField(raw, 'souvenirCount', 9)),
    lastInteractionAt: asNumber(readField(raw, 'lastInteractionAt', 10)),
    lastInteraction: asNumber(readField(raw, 'lastInteraction', 11)),
  };
}

function normalizeSouvenir(raw, id) {
  return {
    id: String(id),
    source: String(readField(raw, 'source', 0) || '0'),
    target: String(readField(raw, 'target', 1) || '0'),
    chapter: asNumber(readField(raw, 'chapter', 2)),
    markBit: asNumber(readField(raw, 'markBit', 3)),
    sender: String(readField(raw, 'sender', 4) || ''),
    timestamp: asNumber(readField(raw, 'timestamp', 5)),
  };
}

function errorMessage(error, action) {
  if (error?.code === 4001 || error?.code === 'ACTION_REJECTED') return '你取消了钱包确认，没有产生链上记录。';
  const name = error?.revert?.name || error?.errorName || error?.data?.errorName;
  if (name === 'AlreadyEncouraged') return action === 'souvenir'
    ? '这个钱包已经给这只旅伴送过一件纪念物了。每个钱包只能送一次。'
    : '这个钱包已经和这只旅伴互动过了。四种回应共用一次机会。';
  if (name === 'NotOrigin') return '只有这只旅伴的主人钱包可以穿戴或摘下物件。';
  if (name === 'InvalidInput') return action === 'reaction'
    ? '旅伴主人不能给自己互动；如果你不是主人，请检查旅伴链接。'
    : action === 'souvenir' ? '只能从自己拥有的链上旅伴送出真实获得过的物件。' : '这件物品不属于当前旅伴，无法穿戴。';
  return error?.shortMessage || error?.reason || error?.message || '操作没有完成，请稍后重试。';
}

function sourceGear(mark) {
  return earnedGear({ marks: [mark] })[0] || { id: '', label: mark, description: '' };
}

export function mountSocial({ root, invite, owned = [], readContract, writeContract, art, onHome, onError } = {}) {
  if (!(root instanceof Element)) throw new TypeError('mountSocial 需要有效的 root');
  if (!invite || typeof readContract !== 'function' || typeof writeContract !== 'function' || typeof art !== 'function') {
    throw new TypeError('mountSocial 缺少旅伴或合约依赖');
  }

  let current = { ...invite, id: String(invite.id), address: String(invite.address) };
  let inbox = [];
  let sources = [];
  let worn = null;
  let destroyed = false;
  let actionBusy = false;
  let refreshing = false;
  let consecutiveFailures = 0;
  let pollTimer = 0;
  let reactionTimer = 0;
  let inboxLoaded = false;
  let sourcesLoaded = false;

  root.classList.add('lw-social-root');
  root.innerHTML = `<section class="lw-social-shell" aria-labelledby="lw-social-title">
    <header class="lw-social-head">
      <button type="button" class="lw-social-home" data-social-home>我也捏一只，自己出发</button>
      <a class="lw-social-jump" href="#lw-social-interact">和这只互动 ↓</a>
    </header>
    <div class="lw-social-hero">
      <div class="lw-social-copy"><span class="lw-social-kicker">有朋友来过的路</span><h1 id="lw-social-title"></h1><p data-social-meta></p><p class="lw-social-owner" data-social-owner></p></div>
      <div class="lw-social-stage"><div class="lw-social-character" data-social-character></div><div class="lw-social-worn" data-social-worn></div><div class="lw-social-confetti" aria-hidden="true">${Array.from({ length: 18 }, (_, index) => `<i style="--i:${index}"></i>`).join('')}</div><div class="lw-social-smoke" aria-hidden="true"><i></i><i></i><i></i></div></div>
      <div class="lw-social-live" data-social-live role="status" aria-live="polite">正在看看它最近的样子…</div>
    </div>
    <section class="lw-social-panel" id="lw-social-interact">
      <div class="lw-social-section-head"><div><span class="lw-social-kicker">留一份小小心意</span><h2>从这里，回应它一下</h2></div><button type="button" class="lw-social-refresh" data-social-refresh>看看新变化</button></div>
      <p class="lw-social-note">选一份心意送给它，每位朋友可以送一次。需要钱包确认，花少量测试 MON 付手续费，不需要充值。</p>
      <div class="lw-social-reactions">${REACTIONS.map((item) => `<button type="button" data-social-action="reaction" data-social-gift="${item.id}"><b>${item.label}</b><span>${item.note}</span></button>`).join('')}</div>
    </section>
    <details class="lw-social-panel lw-social-extra"><summary>送一件有故事的物件</summary>
      <p class="lw-social-note">从自己的旅伴身上，送出一件有故事的纪念。你仍会保留原来的那一件。</p>
      <div class="lw-social-sources" data-social-sources><p class="lw-social-empty">正在打开自己的纪念物…</p></div>
    </details>
    <details class="lw-social-panel lw-social-extra"><summary>看看收到的纪念物</summary><button type="button" class="lw-social-unwear" data-social-action="unwear" hidden>摘下当前物件</button>
      <p class="lw-social-note">送来的心意会留在这里。由旅伴的主人决定，带上哪一件。</p>
      <div class="lw-social-inbox" data-social-inbox><p class="lw-social-empty">正在打开收件箱…</p></div>
    </details>
    <footer class="lw-social-footer"><span>邀请朋友来看它</span><code data-social-url></code><button type="button" data-social-copy>复制链接</button><p>这里只分享旅伴和心意，不展示私人记录。</p></footer>
    <div class="lw-social-error" data-social-error role="alert" hidden></div>
  </section>`;

  const characterEl = root.querySelector('[data-social-character]');
  const wornEl = root.querySelector('[data-social-worn]');
  const liveEl = root.querySelector('[data-social-live]');
  const sourcesEl = root.querySelector('[data-social-sources]');
  const inboxEl = root.querySelector('[data-social-inbox]');
  const errorEl = root.querySelector('[data-social-error]');
  const unwearButton = root.querySelector('[data-social-action="unwear"]');
  root.querySelector('[data-social-url]').textContent = location.href;

  function reportError(message, quiet = false) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    if (!quiet && typeof onError === 'function') onError(message);
  }

  function clearError() {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  function setBusy(next, label = '') {
    actionBusy = next;
    root.querySelectorAll('[data-social-action]').forEach((button) => {
      const alreadyWorn = button.dataset.socialAction === 'wear' && button.dataset.socialGiftId === current.wornSouvenirId;
      button.disabled = next || alreadyWorn;
    });
    if (next) liveEl.textContent = label;
  }

  function renderIdentity() {
    root.querySelector('#lw-social-title').textContent = `${current.name}，有人来看你了。`;
    root.querySelector('[data-social-meta]').textContent = `每一份心意，都有人记得。`;
    root.querySelector('[data-social-owner]').textContent = `主人 ${shortAddress(current.origin)}`;
    characterEl.innerHTML = art(current, current.mood);
  }

  function reactionIsFresh() {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return current.lastInteraction === 3 && current.lastInteractionAt > 0 && nowSeconds - current.lastInteractionAt >= 0 && nowSeconds - current.lastInteractionAt <= REACTION_SECONDS;
  }

  function updateReaction() {
    window.clearTimeout(reactionTimer);
    const fresh = reactionIsFresh();
    root.classList.toggle('lw-social-reacting', fresh);
    if (!fresh) return;
    liveEl.textContent = '刚刚有人从另一块屏幕放了一枚彩纸弹。';
    const remaining = Math.max(0, (current.lastInteractionAt + REACTION_SECONDS) * 1000 - Date.now());
    reactionTimer = window.setTimeout(() => root.classList.remove('lw-social-reacting'), remaining + 40);
  }

  function renderWorn() {
    if (!worn || current.wornSouvenirId === '0') {
      wornEl.innerHTML = '';
      unwearButton.hidden = true;
      return;
    }
    const mark = MARKS[worn.markBit];
    wornEl.innerHTML = `<div class="lw-social-worn-art">${gearHTML({ marks: [mark], mood: 0 }, undefined, 0)}</div><span>戴着：${esc(sourceGear(mark).label)} · 来自旅伴 #${esc(worn.source)} 第 ${worn.chapter} 章</span>`;
    unwearButton.hidden = false;
  }

  function renderSources() {
    if (!sources.length) {
      sourcesEl.innerHTML = '<p class="lw-social-empty">当前设备还没有自己的旅伴。先捏一只、走出印记，再回来互赠物件。</p>';
      return;
    }
    sourcesEl.innerHTML = sources.map((source) => `<article class="lw-social-source"><header><b>${esc(source.name)}</b><span>${source.id ? `链上旅伴 #${esc(source.id)}` : '仅保存在当前设备'}</span></header>${source.unavailable ? `<p class="lw-social-source-note">${esc(source.unavailable)}</p>` : `<div>${source.items.map((item) => `<button type="button" data-social-action="souvenir" data-social-source="${esc(source.id)}" data-social-bit="${item.bit}"><b>${esc(item.gear.label)}</b><span>来自「${esc(item.mark)}」· 第 ${item.chapter} 章</span></button>`).join('')}</div>`}</article>`).join('');
  }

  function renderInbox() {
    if (!inbox.length) {
      inboxEl.innerHTML = '<p class="lw-social-empty">还没有收到来源物件。送来的会是副本，原旅伴不会失去它。</p>';
      return;
    }
    inboxEl.innerHTML = inbox.map((item) => {
      const mark = MARKS[item.markBit] || '未知印记';
      const gear = sourceGear(mark);
      const date = item.timestamp ? new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(item.timestamp * 1000) : '链上时间未知';
      const active = current.wornSouvenirId === item.id;
      return `<article class="lw-social-gift ${active ? 'lw-social-is-worn' : ''}"><div><span>${esc(gear.label)}</span><b>来自旅伴 #${esc(item.source)} · 第 ${item.chapter} 章</b><small>${esc(shortAddress(item.sender))} · ${esc(date)}</small></div><button type="button" data-social-action="wear" data-social-gift-id="${esc(item.id)}" ${active ? 'disabled' : ''}>${active ? '正戴着' : '戴上'}</button></article>`;
    }).join('');
  }

  async function readInbox(contract, count) {
    const start = Math.max(0, count - 6);
    const indexes = Array.from({ length: count - start }, (_, offset) => start + offset).reverse();
    return Promise.all(indexes.map(async (index) => {
      const id = await contract.receivedSouvenirs(current.id, index);
      return normalizeSouvenir(await contract.souvenirs(id), id);
    }));
  }

  async function readSources(contract) {
    return Promise.all(owned.map(async (traveler) => {
      if (!traveler?.link?.id) return { id: '', name: String(traveler?.name || '未命名旅伴'), items: [], unavailable: '这只旅伴还没有链上来源记录，暂时不能赠送物件。' };
      if (String(traveler.link.address || '').toLowerCase() !== current.address.toLowerCase()) {
        return { id: String(traveler.link.id), name: String(traveler.name || '未命名旅伴'), items: [], unavailable: '这只旅伴记录在另一个合约，不能向当前旅伴赠送。' };
      }
      const sourceId = String(traveler.link.id);
      const latest = await contract.getTraveler(sourceId);
      const chapters = await Promise.all(MARKS.map((_, bit) => contract.firstMarkChapter(sourceId, bit)));
      const items = chapters.map((chapter, bit) => ({ bit, chapter: asNumber(chapter), mark: MARKS[bit], gear: sourceGear(MARKS[bit]) })).filter((item) => item.chapter > 0);
      return { id: sourceId, name: String(readField(latest, 'name', 1) || traveler.name || `旅伴 #${sourceId}`), items, unavailable: items.length ? '' : '链上还没有可核验的成长印记，暂时没有物件可赠送。' };
    }));
  }

  async function refresh({ manual = false } = {}) {
    if (destroyed || refreshing) return;
    if (actionBusy && !manual) {
      window.clearTimeout(pollTimer);
      pollTimer = window.setTimeout(() => refresh(), POLL_MS);
      return;
    }
    refreshing = true;
    if (manual) {
      window.clearTimeout(pollTimer);
      liveEl.textContent = '正在看看有没有新心意…';
    }
    try {
      const contract = readContract(current.address);
      const previousCount = current.souvenirCount;
      const previousWorn = current.wornSouvenirId;
      const raw = await contract.getTraveler(current.id);
      current = normalizeTraveler(raw, current);
      const inboxChanged = !inboxLoaded || current.souvenirCount !== previousCount || current.wornSouvenirId !== previousWorn;
      if (manual || inboxChanged) {
        inbox = await readInbox(contract, current.souvenirCount);
        inboxLoaded = true;
      }
      if (manual || !sourcesLoaded) {
        sources = await readSources(contract);
        sourcesLoaded = true;
      }
      worn = current.wornSouvenirId !== '0'
        ? inbox.find((item) => item.id === current.wornSouvenirId) || normalizeSouvenir(await contract.souvenirs(current.wornSouvenirId), current.wornSouvenirId)
        : null;
      consecutiveFailures = 0;
      clearError();
      renderIdentity();
      renderSources();
      renderInbox();
      renderWorn();
      updateReaction();
      if (!reactionIsFresh()) liveEl.textContent = '旅伴的样子已更新 · 每一份心意，都有人记得。';
    } catch (error) {
      consecutiveFailures += 1;
      const stopped = consecutiveFailures >= 2;
      liveEl.textContent = stopped ? '连续两次读取失败，自动刷新已暂停。' : '本次链上读取失败，稍后再试一次。';
      reportError(stopped ? '自动读取已暂停。请检查网络后点击“看看新变化”。' : '暂时无法读取最新链上状态。', true);
    } finally {
      refreshing = false;
      if (!destroyed && consecutiveFailures < 2) pollTimer = window.setTimeout(() => refresh(), POLL_MS);
    }
  }

  async function transact(action, working, success, callback) {
    if (actionBusy) return;
    clearError();
    setBusy(true, working);
    try {
      const contract = await writeContract(current.address);
      const tx = await callback(contract);
      liveEl.textContent = '交易已发送，等待链上确认…';
      const receipt = await tx.wait();
      if (!receiptSucceeded(receipt)) throw new Error('交易回执未成功。');
      await refresh({ manual: true });
      liveEl.textContent = success;
    } catch (error) {
      const message = errorMessage(error, action);
      reportError(message);
      liveEl.textContent = '操作没有写入链上。';
    } finally {
      setBusy(false);
    }
  }

  function onClick(event) {
    const home = event.target.closest('[data-social-home]');
    if (home) { onHome?.(); return; }
    if (event.target.closest('[data-social-refresh]')) { if (!actionBusy) { consecutiveFailures = 0; refresh({ manual: true }); } return; }
    if (event.target.closest('[data-social-copy]')) {
      navigator.clipboard?.writeText(location.href).then(() => { liveEl.textContent = '同行链接已复制。'; }).catch(() => reportError('浏览器没有允许复制，请从地址栏复制链接。'));
      return;
    }
    const action = event.target.closest('[data-social-action]');
    if (!action || action.disabled) return;
    if (action.dataset.socialAction === 'reaction') {
      const gift = Number(action.dataset.socialGift);
      transact('reaction', '正在连接钱包…', '回应已由链上确认。', (contract) => contract.encourage(current.id, gift));
    }
    if (action.dataset.socialAction === 'souvenir') {
      const sourceId = action.dataset.socialSource;
      const bit = Number(action.dataset.socialBit);
      transact('souvenir', '正在连接来源旅伴的钱包…', '来源物件副本已送达。', (contract) => contract.sendSouvenir(sourceId, current.id, bit));
    }
    if (action.dataset.socialAction === 'wear') {
      const giftId = action.dataset.socialGiftId;
      transact('wear', '正在连接主人钱包…', '物件已穿戴。', (contract) => contract.wearSouvenir(current.id, giftId));
    }
    if (action.dataset.socialAction === 'unwear') {
      transact('wear', '正在连接主人钱包…', '当前物件已摘下。', (contract) => contract.wearSouvenir(current.id, 0));
    }
  }

  root.addEventListener('click', onClick);
  renderIdentity();
  renderSources();
  renderInbox();
  renderWorn();
  refresh();

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      window.clearTimeout(pollTimer);
      window.clearTimeout(reactionTimer);
      root.removeEventListener('click', onClick);
      root.classList.remove('lw-social-root', 'lw-social-reacting');
    },
  };
}
