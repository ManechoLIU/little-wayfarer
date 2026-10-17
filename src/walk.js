const WORLD_WIDTH = 2200;
const WORLD_HEIGHT = 520;
const SPEED = 190;
const HOLD_MS = 1000;
const MAX_TRAIL = 180;
const LONG_PRESS_MS = 350;
const DRAG_THRESHOLD = 10;

const STORIES = [
  { id: 'explore', title: '小镇路口', x: 310, y: 365, tone: 'orange', responses: [['step-forward', '向前一步'], ['look-around', '先观察']] },
  { id: 'setback', title: '蓝色雨棚', x: 625, y: 395, tone: 'blue', responses: [['rest', '先休息'], ['try-again', '再试一次']] },
  { id: 'lonely', title: '月下路灯', x: 930, y: 350, tone: 'pink', responses: [['reach-out', '发出邀请'], ['sit-with-it', '陪自己坐坐']] },
  { id: 'mistake', title: '修补工坊', x: 1235, y: 405, tone: 'lime', responses: [['repair', '试着修补'], ['learn', '记下来']] },
  { id: 'help', title: '同行花圃', x: 1535, y: 350, tone: 'orange', responses: [['lend-a-hand', '伸出手'], ['ask-together', '一起想办法']] },
  { id: 'rest', title: '安静长椅', x: 1815, y: 395, tone: 'blue', responses: [['sleep', '睡一觉'], ['small-ritual', '做件小事']] },
];

const CAMP = { x: 2070, y: 382 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function classifyWalkGesture(elapsed, distanceMoved, cancelled = false) {
  if (cancelled) return 'cancel';
  if (distanceMoved > DRAG_THRESHOLD) return 'drag';
  return elapsed >= LONG_PRESS_MS ? 'hold' : 'tap';
}

function validPoint(point, fallback) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y)
    ? { x: clamp(point.x, 70, WORLD_WIDTH - 70), y: clamp(point.y, 318, 445) }
    : fallback;
}

function landscapeHTML() {
  return `<svg class="lw-landscape" viewBox="0 0 2200 520" aria-hidden="true" focusable="false">
    <path class="lw-hill lw-hill-back" d="M0 263C170 191 294 226 441 276S741 203 914 257s299-34 475 5 338-43 495-2 208-21 316-29v289H0Z"/>
    <path class="lw-hill lw-hill-front" d="M0 327c185-56 278 18 443-10s279-52 441 9 303-39 463-7 295-40 468 6 283-11 385-34v229H0Z"/>
    <g class="lw-cloud" transform="translate(110 78)"><ellipse rx="51" ry="25"/><ellipse cx="43" cy="4" rx="42" ry="22"/><ellipse cx="-34" cy="9" rx="34" ry="18"/></g>
    <g class="lw-cloud lw-cloud-small" transform="translate(1050 95)"><ellipse rx="48" ry="22"/><ellipse cx="39" cy="4" rx="33" ry="18"/></g>
    <g class="lw-cloud lw-cloud-pink" transform="translate(1680 66)"><ellipse rx="51" ry="25"/><ellipse cx="43" cy="4" rx="42" ry="22"/></g>
    <path class="lw-path" d="M0 407c171-61 279 62 455 5s298 38 470-4 316 58 478 0 304 38 455-1 238-22 342-10"/>
    <g class="lw-tree" transform="translate(455 278)"><path d="M-7 100 0 34l12 66Z"/><circle cy="22" r="37"/><circle cx="-25" cy="43" r="27"/><circle cx="27" cy="48" r="29"/></g>
    <g class="lw-tree lw-tree-blue" transform="translate(1370 264)"><path d="M-6 108 0 38l13 70Z"/><circle cy="27" r="42"/><circle cx="-30" cy="53" r="29"/><circle cx="31" cy="52" r="31"/></g>
    <g class="lw-lamp" transform="translate(1065 267)"><path d="M0 113V16"/><path d="M0 21q23-17 39 1"/><circle cx="39" cy="26" r="13"/></g>
    <g class="lw-lamp" transform="translate(1722 276)"><path d="M0 108V16"/><path d="M0 21q23-17 39 1"/><circle cx="39" cy="26" r="13"/></g>
    <g class="lw-flowers" transform="translate(760 413)"><circle cx="0" cy="0" r="8"/><circle cx="23" cy="11" r="6"/><circle cx="47" cy="-6" r="7"/><path d="M0 8v23m23-14v20M47 1v28"/></g>
    <g class="lw-flowers lw-flowers-pink" transform="translate(1450 418)"><circle cx="0" cy="0" r="8"/><circle cx="23" cy="11" r="6"/><circle cx="47" cy="-6" r="7"/><path d="M0 8v23m23-14v20M47 1v28"/></g>
  </svg>`;
}

function storyHTML(story, storyMode) {
  return `<section class="lw-stop lw-stop-${story.tone}" data-stop="${story.id}" style="--x:${story.x}px;--y:${story.y}px" aria-label="${story.title}">
    <div class="lw-stop-landmark" aria-hidden="true"><i></i><b></b><span>${story.title}</span></div>
    ${storyMode ? `<div class="lw-signs" aria-label="${story.title}的两个回应">
      ${story.responses.map(([id, label], index) => `<button class="lw-sign" type="button" data-event="${story.id}" data-response="${id}" data-side="${index ? 'right' : 'left'}"><span>${label}</span><small>停在这里 1 秒</small></button>`).join('')}
    </div>
    <div class="lw-done" aria-hidden="true">走过了</div>` : ''}
  </section>`;
}

function initialState(traveler, progress) {
  const visited = Array.isArray(progress?.visited)
    ? [...new Set(progress.visited.filter((id) => STORIES.some((story) => story.id === id)))]
    : [];
  const trail = Array.isArray(progress?.trail)
    ? progress.trail.map((point) => validPoint(point, null)).filter(Boolean).slice(-MAX_TRAIL)
    : [];
  return {
    position: validPoint(progress?.position, { x: 110, y: 395 }),
    visited,
    trail,
    startChapter: Number.isInteger(progress?.startChapter) && progress.startChapter >= 0 ? progress.startChapter : (Number(traveler?.chapter) || 0),
    campOpened: progress?.campOpened === true,
  };
}

export function selectReplayMoment(entries, positionX) {
  const ordered = (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && entry.id != null && Number.isFinite(entry.x))
    .slice()
    .sort((left, right) => left.x - right.x);
  if (!ordered.length) return null;
  let selected = ordered[0];
  for (const entry of ordered) {
    if (Number(positionX) < entry.x - 70) break;
    selected = entry;
  }
  return selected;
}

/** Mount the walking world. Domain state and persistence remain owned by the caller. */
export function mountWalk({ root, traveler, art, onExperience, onFinish, onProgress, initialProgress, moments = [], onMoment, onWrite, onCamp, storyMode = false, replayMode = false, onRecallMoment, onExitReplay } = {}) {
  if (!(root instanceof Element)) throw new TypeError('mountWalk 需要有效的 root');
  if (!traveler || typeof art !== 'function') {
    throw new TypeError('mountWalk 缺少 traveler 或 art');
  }

  let currentTraveler = traveler;
  const state = initialState(traveler, initialProgress);
  const visited = new Set(state.visited);
  const keys = new Set();
  let position = { ...state.position };
  let target = null;
  let camera = 0;
  let direction = 1;
  let moving = false;
  let raf = 0;
  let previousTime = performance.now();
  let hold = null;
  let busy = false;
  let finished = false;
  let destroyed = false;
  let lastMood = null;
  let lastTrail = state.trail.at(-1) || { ...position };
  let lastTrailTime = 0;
  let lastProgressTime = 0;
  let nearbyId = '';
  let campOpened = state.campOpened;
  let currentMomentId = null;
  let recordAppearanceActive = false;
  let pendingMomentId = null;
  let gesture = null;
  let gestureDirection = null;
  let gestureTimer = 0;
  let suppressClickUntil = 0;
  let cameraPanOffset = 0;

  root.classList.add('lw-walk-root');
  root.innerHTML = `<section class="lw-shell" aria-labelledby="lw-title">
    <header class="lw-head">
      <div><span class="lw-kicker">${replayMode ? 'LOOK BACK ON THE ROAD' : 'A PLACE TO KEEP WALKING'}</span><h2 id="lw-title">${replayMode ? `陪 ${escapeHTML(traveler.name)}，回看这段路` : `陪 ${escapeHTML(traveler.name)}，继续走走`}</h2></div>
      <div class="lw-progress" role="status" aria-live="polite"><b data-progress-count>${moments.length}</b><span> 段已记录</span><i data-progress-dots></i></div>
    </header>
    <div class="lw-viewport" tabindex="0" role="application" aria-label="${replayMode ? '回看这段路。方向键或 WASD 前后移动，也可以点击地面查看已经留下的记录。' : '可行走的黏土小世界。方向键或 WASD 移动，也可以点击地面。想到什么，随时记一笔。'}">
      <div class="lw-world">
        ${landscapeHTML()}
        <div class="lw-rain" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
        ${storyMode?STORIES.map(story=>storyHTML(story,true)).join(''):''}${moments.filter(m=>m&&Number.isFinite(m.x)&&Number.isFinite(m.y)).map(m=>`<button type="button" class="lw-moment" data-moment="${escapeHTML(m.id)}" style="left:${clamp(m.x,80,2120)}px;top:${clamp(m.y-125,180,320)}px"><b>✎</b><span>${escapeHTML(m.label||'今天，留一笔')}</span></button>`).join('')}
        <section class="lw-camp" style="--x:${CAMP.x}px;--y:${CAMP.y}px" aria-label="今天的营火">
          <div class="lw-fire" aria-hidden="true"><i></i><b></b><span></span></div><strong>今天的营火</strong><small data-camp-label></small>
        </section>
        <div class="lw-footprints" aria-hidden="true"></div>
        <div class="lw-player" aria-label="${escapeHTML(traveler.name)}"><div class="lw-character"></div><span class="lw-player-shadow"></span></div>
      </div>
      <div class="lw-hint" data-hint role="status" aria-live="polite">${replayMode ? '回看这段路：前后走动，看看当时的样子' : '点地面，或用方向键 / WASD 出发'}</div>
      <div class="lw-toast" data-toast role="alert" hidden></div>
    </div>
    <footer class="lw-controls">
      <div class="lw-directions" aria-label="移动按钮">
        <button type="button" data-move="left" aria-label="向左走">←</button><button type="button" data-move="up" aria-label="向上走">↑</button><button type="button" data-move="down" aria-label="向下走">↓</button><button type="button" data-move="right" aria-label="向右走">→</button>
      </div>
      <div class="lw-nearby" data-nearby aria-live="polite"><span>${replayMode ? '沿着记录点，回看当时的变化' : '想到了什么，随时记一笔'}</span><button type="button" data-write>${replayMode ? '查看这一笔' : '路上记一笔'}</button></div>
      <button class="lw-finish" type="button" data-finish>${replayMode ? '回到现在 →' : '去营火坐坐 →'}</button>
    </footer>
  </section>`;

  const viewport = root.querySelector('.lw-viewport');
  const world = root.querySelector('.lw-world');
  const player = root.querySelector('.lw-player');
  const character = root.querySelector('.lw-character');
  const footprints = root.querySelector('.lw-footprints');
  const hint = root.querySelector('[data-hint]');
  const toast = root.querySelector('[data-toast]');
  const nearby = root.querySelector('[data-nearby]');
  const finishButton = root.querySelector('[data-finish]');
  const progressCount = root.querySelector('[data-progress-count]');
  const progressDots = root.querySelector('[data-progress-dots]');
  const campLabel = root.querySelector('[data-camp-label]');

  function getProgress() {
    return { visited: [...visited], trail: state.trail.map((point) => ({ ...point })), startChapter: state.startChapter, position: { ...position }, campOpened };
  }

  function emitProgress(force = false) {
    const now = performance.now();
    if (!force && now - lastProgressTime < 300) return;
    lastProgressTime = now;
    if (typeof onProgress === 'function') onProgress(getProgress());
  }

  function renderCharacter(mood) {
    if (lastMood === mood) return;
    character.innerHTML = art(currentTraveler, mood);
    lastMood = mood;
  }

  function syncRecordCharacter() {
    const moment = replayMode ? selectReplayMoment(moments, position.x) : moments
      .filter((entry) => entry && !entry.pending && entry.id != null && Number.isFinite(entry.x) && Number.isFinite(entry.y) && distance(position, entry) <= 70)
      .reduce((nearest, entry) => !nearest || distance(position, entry) < distance(position, nearest) ? entry : nearest, null);
    const nextId = moment ? String(moment.id) : null;
    if (nextId === currentMomentId) return recordAppearanceActive;
    currentMomentId = nextId;
    recordAppearanceActive = false;
    root.querySelectorAll('[data-moment]').forEach((node) => node.classList.toggle('is-recalled', nextId !== null && node.dataset.moment === nextId));
    hint.textContent = moment ? `那时的样子 · ${String(moment.label || '这一笔')}` : replayMode ? '回看这段路：前后走动，看看当时的样子' : '回到现在，继续走走。';
    if (!moment || typeof onRecallMoment !== 'function') return false;
    try {
      const snapshot = onRecallMoment(moment.id);
      if (typeof snapshot === 'string' && snapshot.length) {
        character.innerHTML = snapshot;
        // Invalidate the live appearance cache so leaving a node restores it.
        lastMood = null;
        recordAppearanceActive = true;
      }
    } catch (error) {
      showToast(error?.message || '这一笔暂时看不了。');
    }
    return recordAppearanceActive;
  }

  function updateProgressUI() {
    if (replayMode) {
      progressCount.textContent = String(moments.filter((moment) => moment && !moment.pending).length);
      progressDots.innerHTML = '';
      finishButton.disabled = busy;
      finishButton.textContent = '回到现在 →';
      campLabel.textContent = '回到现在';
      root.querySelector('.lw-camp').classList.add('is-ready');
      return;
    }
    if (!storyMode) {
      progressCount.textContent = String(moments.filter(m=>!m.pending).length);
      progressDots.innerHTML = '';
      finishButton.disabled = busy;
      finishButton.textContent = '去营火坐坐 →';
      campLabel.textContent = '随时过来坐坐';
      root.querySelector('.lw-camp').classList.add('is-ready');
      return;
    }
    progressCount.textContent = String(visited.size);
    progressDots.innerHTML = STORIES.slice(0, 3).map((_, index) => `<span class="${index < Math.min(visited.size, 3) ? 'is-on' : ''}"></span>`).join('');
    const ready = visited.size >= 3;
    finishButton.disabled = !ready || busy || finished;
    finishButton.textContent = finished ? '今天这一段走完了' : ready ? '去营火歇一歇 →' : `再走 ${3 - visited.size} 段经历`;
    campLabel.textContent = ready ? '火已经亮了，走近这里' : `还差 ${3 - visited.size} 段经历点亮`;
    root.querySelector('.lw-camp').classList.toggle('is-ready', ready);
    STORIES.forEach((story) => root.querySelector(`[data-stop="${story.id}"]`)?.classList.toggle('is-done', visited.has(story.id)));
  }

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function addFootprint(point, restored = false) {
    const dot = document.createElement('i');
    dot.style.left = `${point.x}px`;
    dot.style.top = `${point.y + 34}px`;
    if (restored) dot.classList.add('is-old');
    footprints.append(dot);
    while (footprints.childElementCount > 34) footprints.firstElementChild.remove();
  }

  state.trail.slice(-30).forEach((point) => addFootprint(point, true));

  function recordTrail(now) {
    if (distance(position, lastTrail) < 30 || now - lastTrailTime < 150) return;
    const point = { x: Math.round(position.x), y: Math.round(position.y) };
    state.trail.push(point);
    if (state.trail.length > MAX_TRAIL) state.trail.splice(0, state.trail.length - MAX_TRAIL);
    lastTrail = point;
    lastTrailTime = now;
    addFootprint(point);
    emitProgress();
  }

  function nearestStory() {
    let nearest = null;
    for (const story of STORIES) {
      if (storyMode && visited.has(story.id)) continue;
      const gap = distance(position, story);
      if (!nearest || gap < nearest.gap) nearest = { story, gap };
    }
    return nearest;
  }

  function updateNearby() {
    if (replayMode) {
      const moment = selectReplayMoment(moments, position.x);
      const nextId = moment ? String(moment.id) : '';
      if (nextId === nearbyId) return;
      nearbyId = nextId;
      nearby.innerHTML = `<span>${moment ? escapeHTML(moment.label || '这一笔') : '沿着记录点，回看当时的变化'}</span><button type="button" data-write${moment ? '' : ' disabled'}>查看这一笔</button>`;
      return;
    }
    if (!storyMode) {
      if (nearbyId === '__free-walk') return;
      nearbyId = '__free-walk';
      nearby.innerHTML = '<span>想到了什么，随时记一笔</span><button type="button" data-write>路上记一笔</button>';
      return;
    }
    const match = nearestStory();
    const nextId = match && match.gap < 155 ? match.story.id : '';
    if (nextId === nearbyId) return;
    nearbyId = nextId;
    root.querySelectorAll('.lw-stop.is-near').forEach((node) => node.classList.remove('is-near'));
    if (!match || !nextId) {
      nearby.innerHTML = '<span>走近彩色地点，会看到两个回应</span>';
      return;
    }
    root.querySelector(`[data-stop="${nextId}"]`)?.classList.add('is-near');
    nearby.innerHTML = `<span>${match.story.title}：</span>${match.story.responses.map(([id, label]) => `<button type="button" data-respond="${nextId}:${id}">${label}</button>`).join('')}`;
  }

  function selectedResponse() {
    for (const story of STORIES) {
      if (visited.has(story.id)) continue;
      for (let index = 0; index < story.responses.length; index += 1) {
        const signPoint = { x: story.x + (index ? 58 : -58), y: story.y + 8 };
        if (distance(position, signPoint) < 50) return { story, responseId: story.responses[index][0] };
      }
    }
    return null;
  }

  function experience(story, responseId) {
    if (replayMode || busy || visited.has(story.id)) return;
    busy = true;
    target = null;
    updateProgressUI();
    hint.textContent = '正在把这段经历放进背包…';
    try {
      const nextTraveler = onExperience(story.id, responseId);
      if (!nextTraveler || typeof nextTraveler !== 'object') throw new TypeError('经历没有返回最新旅伴');
      currentTraveler = nextTraveler;
      visited.add(story.id);
      lastMood = null;
      renderCharacter(currentTraveler.mood);
      showToast(`「${story.title}」已经走进旅程。`);
      hint.textContent = visited.size >= 3 ? '营火亮了。继续探索，或去营火完成散步。' : '这段路留下了。继续走走看。';
      emitProgress(true);
    } catch (error) {
      showToast(error?.message || '这段经历没有保存，请再试一次。');
      hint.textContent = '没有消耗这个地点，可以重新选择。';
    } finally {
      busy = false;
      hold = null;
      nearbyId = '__reset';
      updateNearby();
      updateProgressUI();
    }
  }

  function completeWalk() {
    if (finished || busy || visited.size < 3) return;
    finished = true;
    target = null;
    hint.textContent = '今天这一段走完了，明天还陪你。';
    updateProgressUI();
    emitProgress(true);
    try{onFinish({ visited: [...visited], trail: state.trail.map((point) => ({ ...point })), startChapter: state.startChapter });}catch(error){finished=false;showToast(error?.message||'手账未保存，请重试。');hint.textContent='经历仍在，手账还未保存。可以再次走近营火重试。';updateProgressUI();}
  }

  async function openCamp() {
    if (busy || campOpened || typeof onCamp !== 'function') return;
    busy = true;
    campOpened = true;
    target = null;
    hold = null;
    hint.textContent = '在营火边坐一会儿。';
    updateProgressUI();
    emitProgress(true);
    try {
      await onCamp();
    } catch (error) {
      campOpened = false;
      showToast(error?.message || '营火边暂时坐不下来，可以再试一次。');
      hint.textContent = '营火还在这里，可以再试一次。';
      emitProgress(true);
    } finally {
      busy = false;
      updateProgressUI();
    }
  }

  function updateHold(now) {
    if (moving || busy) {
      if (hold) hint.textContent = nearbyId ? '选一块路标，走过去并停留 1 秒。' : '慢慢走，下一处故事就在前面。';
      hold = null;
      return;
    }
    const campDistance = distance(position, CAMP);
    if (replayMode) {
      hold = null;
      return;
    }
    if (!storyMode && campOpened && campDistance > 100) {
      campOpened = false;
      emitProgress(true);
    }
    if (!storyMode && !campOpened && campDistance < 68) {
      if (!hold || hold.kind !== 'camp') hold = { kind: 'camp', since: now };
      hint.textContent = `在营火边停一停… ${Math.min(100, Math.round((now - hold.since) / HOLD_MS * 100))}%`;
      if (now - hold.since >= HOLD_MS) openCamp();
      return;
    }
    if (storyMode && visited.size >= 3 && campDistance < 68) {
      if (!hold || hold.kind !== 'camp') hold = { kind: 'camp', since: now };
      hint.textContent = `在营火边停一停… ${Math.min(100, Math.round((now - hold.since) / HOLD_MS * 100))}%`;
      if (now - hold.since >= HOLD_MS) completeWalk();
      return;
    }
    if (!storyMode) {
      if (hold) hint.textContent = '想到了什么，随时可以记一笔。';
      hold = null;
      return;
    }
    const choice = selectedResponse();
    if (!choice) {
      if (hold) hint.textContent = nearbyId ? '选一块路标，走过去并停留 1 秒。' : '点地面，或用方向键 / WASD 继续走。';
      hold = null;
      return;
    }
    const key = `${choice.story.id}:${choice.responseId}`;
    if (!hold || hold.kind !== key) hold = { kind: key, since: now };
    hint.textContent = `在「${choice.story.responses.find(([id]) => id === choice.responseId)?.[1]}」旁停一停… ${Math.min(100, Math.round((now - hold.since) / HOLD_MS * 100))}%`;
    if (now - hold.since >= HOLD_MS) experience(choice.story, choice.responseId);
  }

  function updateMood() {
    root.classList.remove('is-raining-on-player');
    if (syncRecordCharacter()) return;
    // Frame 5 is a stepping pose; never overwrite a saved difficult emotion.
    const pose = !replayMode && moving && [0, 4, 5].includes(currentTraveler.mood) ? 5 : currentTraveler.mood;
    renderCharacter(pose);
  }

  function moveFrame(dt, now) {
    let dx = 0;
    let dy = 0;
    if (gestureDirection) { dx += gestureDirection.x; dy += gestureDirection.y; }
    if (keys.has('ArrowLeft') || keys.has('a')) dx -= 1;
    if (keys.has('ArrowRight') || keys.has('d')) dx += 1;
    if (keys.has('ArrowUp') || keys.has('w')) dy -= 1;
    if (keys.has('ArrowDown') || keys.has('s')) dy += 1;
    if (dx || dy) target = null;
    if (!dx && !dy && target) {
      const tx = target.x - position.x;
      const ty = target.y - position.y;
      const gap = Math.hypot(tx, ty);
      if (pendingMomentId !== null && gap <= 12) {
        const momentId = pendingMomentId;
        pendingMomentId = null;
        target = null;
        moving = false;
        hint.textContent = '已经走到这一笔。';
        try { onMoment?.(momentId); } catch (error) { showToast(error?.message || '这一笔暂时看不了。'); }
        return;
      }
      if (gap < 5) target = null;
      else { dx = tx / gap; dy = ty / gap; }
    }
    const magnitude = Math.hypot(dx, dy);
    moving = magnitude > 0 && !busy && (!storyMode || !finished);
    if (moving) {
      dx /= magnitude;
      dy /= magnitude;
      position.x = clamp(position.x + dx * SPEED * dt, 70, WORLD_WIDTH - 58);
      position.y = clamp(position.y + dy * SPEED * .56 * dt, 318, 445);
      if (Math.abs(dx) > .05) direction = dx > 0 ? 1 : -1;
      recordTrail(now);
      if (pendingMomentId !== null && target && distance(position, target) <= 12) {
        const momentId = pendingMomentId;
        pendingMomentId = null;
        target = null;
        moving = false;
        hint.textContent = '已经走到这一笔。';
        try { onMoment?.(momentId); } catch (error) { showToast(error?.message || '这一笔暂时看不了。'); }
      }
    }
  }

  function paint(now) {
    const viewportWidth = viewport.clientWidth;
    const followCamera = position.x - viewportWidth * .43;
    camera += (clamp(followCamera + cameraPanOffset, 0, Math.max(0, WORLD_WIDTH - viewportWidth)) - camera) * .13;
    world.style.transform = `translate3d(${-camera}px,0,0)`;
    player.style.transform = `translate3d(${position.x - 58}px,${position.y - 116}px,0)`;
    character.style.setProperty('--facing', direction);
    player.classList.toggle('is-moving', moving);
    if (!storyMode && campOpened && distance(position, CAMP) > 100) {
      campOpened = false;
      emitProgress(true);
    }
    updateNearby();
    updateMood();
    updateHold(now);
  }

  function loop(now) {
    if (destroyed) return;
    const dt = Math.min(.04, (now - previousTime) / 1000 || 0);
    previousTime = now;
    moveFrame(dt, now);
    if (destroyed) return;
    paint(now);
    if (!destroyed) raf = requestAnimationFrame(loop);
  }

  function keyboardBlocked(event) {
    const active = document.activeElement;
    return event.metaKey || event.ctrlKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(active?.tagName || '') || active?.isContentEditable || Boolean(document.querySelector('.modal-backdrop,[role="dialog"]'));
  }

  function onKeyDown(event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'a', 's', 'd'].includes(key) || keyboardBlocked(event)) return;
    event.preventDefault();
    pendingMomentId = null;
    cameraPanOffset = 0;
    keys.add(key);
  }
  function onKeyUp(event) { keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key); }
  function stopGesture() {
    window.clearTimeout(gestureTimer);
    gestureTimer = 0;
    gestureDirection = null;
    gesture = null;
  }
  function stopKeys() { keys.clear(); stopGesture(); }

  function onViewportClick(event) {
    if (event.target.closest('button') || busy || finished) return;
    if (performance.now() < suppressClickUntil) { event.preventDefault(); return; }
    pendingMomentId = null;
    cameraPanOffset = 0;
    const rect = viewport.getBoundingClientRect();
    const worldRect=world.getBoundingClientRect();target = validPoint({ x: event.clientX - worldRect.left, y: event.clientY - worldRect.top }, position);
    viewport.focus({ preventScroll: true });
  }

  function moveButton(event) {
    const button = event.target.closest('[data-move]');
    if (!button) return;
    event.preventDefault();
    const map = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' };
    const key = map[button.dataset.move];
    pendingMomentId = null;
    cameraPanOffset = 0;
    keys.add(key);
    button.setPointerCapture?.(event.pointerId);
    const release = () => { keys.delete(key); button.removeEventListener('pointerup', release); button.removeEventListener('pointercancel', release); };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
  }

  function updateHoldDirection(clientX, clientY) {
    const worldRect = world.getBoundingClientRect();
    const dx = clientX - worldRect.left - position.x;
    const dy = clientY - worldRect.top - position.y;
    const magnitude = Math.hypot(dx, dy);
    gestureDirection = magnitude > 4 ? { x: dx / magnitude, y: dy / magnitude } : { x: direction, y: 0 };
  }

  function onGestureStart(event) {
    if (!event.isPrimary || event.button > 0 || event.target.closest('button') || busy || finished) return;
    stopGesture();
    gesture = { id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, startedAt: performance.now(), startPan: cameraPanOffset, dragging: false, holding: false };
    viewport.setPointerCapture?.(event.pointerId);
    gestureTimer = window.setTimeout(() => {
      if (!gesture || gesture.id !== event.pointerId || gesture.dragging) return;
      gesture.holding = true;
      pendingMomentId = null;
      target = null;
      cameraPanOffset = 0;
      updateHoldDirection(gesture.lastX, gesture.lastY);
      hint.textContent = '按住继续走，松手停下。';
    }, LONG_PRESS_MS);
  }

  function onGestureMove(event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.holding && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      window.clearTimeout(gestureTimer);
      gesture.dragging = true;
      pendingMomentId = null;
      target = null;
      cameraPanOffset = gesture.startPan - dx;
      hint.textContent = '正在查看这段路，松手后可以继续走。';
      event.preventDefault();
    } else if (gesture.dragging) {
      cameraPanOffset = gesture.startPan - dx;
      event.preventDefault();
    } else if (gesture.holding) {
      updateHoldDirection(event.clientX, event.clientY);
      event.preventDefault();
    }
  }

  function onGestureEnd(event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const kind = classifyWalkGesture(performance.now() - gesture.startedAt, Math.hypot(gesture.lastX - gesture.startX, gesture.lastY - gesture.startY), event.type === 'pointercancel');
    const consumed = gesture.dragging || gesture.holding || kind === 'drag' || kind === 'hold';
    stopGesture();
    if (consumed) {
      suppressClickUntil = performance.now() + 500;
      hint.textContent = replayMode ? '回看这段路：前后走动，看看当时的样子' : '点地面，或长按一个方向继续走。';
    }
  }

  function onVisibilityChange() { if (document.hidden) stopKeys(); }

  function onRootClick(event) {
    const momentNode=event.target.closest('[data-moment]');if(momentNode){const moment=moments.find((item)=>item&&String(item.id)===momentNode.dataset.moment&&Number.isFinite(item.x)&&Number.isFinite(item.y));if(moment){keys.clear();hold=null;cameraPanOffset=0;pendingMomentId=String(moment.id);target=validPoint({x:moment.x,y:moment.y},position);hint.textContent=`正在走向这一笔 · ${String(moment.label||'记录')}`;}return;}
    if(event.target.closest('[data-write]')){target=null;pendingMomentId=null;keys.clear();try{if(replayMode){if(currentMomentId!=null)onMoment?.(currentMomentId);}else onWrite?.({x:Math.round(position.x),y:Math.round(position.y)});}catch(error){showToast(error?.message||(replayMode?'这一笔暂时看不了。':'暂时不能记下这一笔。'));}return;}
    const sign = event.target.closest('.lw-sign');
    if (sign) {
      pendingMomentId = null;
      const story = STORIES.find((item) => item.id === sign.dataset.event);
      const index = story?.responses.findIndex(([id]) => id === sign.dataset.response) ?? -1;
      if (story && index >= 0 && !visited.has(story.id)) target = { x: story.x + (index ? 58 : -58), y: story.y + 8 };
      return;
    }
    const alternative = event.target.closest('[data-respond]');
    if (alternative) {
      pendingMomentId = null;
      const [eventId, responseId] = alternative.dataset.respond.split(':');
      const story = STORIES.find((item) => item.id === eventId);
      if (story) experience(story, responseId);
      return;
    }
    if (event.target.closest('[data-finish]')) {
      pendingMomentId = null;
      if (replayMode) {
        target = null;
        keys.clear();
        try { onExitReplay?.(); } catch (error) { showToast(error?.message || '暂时回不到现在，请再试一次。'); }
        return;
      }
      if (!storyMode && distance(position, CAMP) < 68) openCamp();
      else target = { ...CAMP };
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', stopKeys);
  viewport.addEventListener('click', onViewportClick);
  viewport.addEventListener('pointerdown', onGestureStart);
  viewport.addEventListener('pointermove', onGestureMove);
  viewport.addEventListener('pointerup', onGestureEnd);
  viewport.addEventListener('pointercancel', onGestureEnd);
  root.addEventListener('click', onRootClick);
  document.addEventListener('visibilitychange', onVisibilityChange);
  root.querySelector('.lw-directions').addEventListener('pointerdown', moveButton);
  updateProgressUI();
  paint(performance.now());
  raf = requestAnimationFrame(loop);

  return {
    getProgress,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopGesture();
      cancelAnimationFrame(raf);
      window.clearTimeout(showToast.timer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', stopKeys);
      viewport.removeEventListener('click', onViewportClick);
      viewport.removeEventListener('pointerdown', onGestureStart);
      viewport.removeEventListener('pointermove', onGestureMove);
      viewport.removeEventListener('pointerup', onGestureEnd);
      viewport.removeEventListener('pointercancel', onGestureEnd);
      root.removeEventListener('click', onRootClick);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      root.querySelector('.lw-directions')?.removeEventListener('pointerdown', moveButton);
      root.classList.remove('lw-walk-root', 'is-raining-on-player');
    },
  };
}

export const walkGeometry = Object.freeze({ WORLD_WIDTH, WORLD_HEIGHT, distance, clamp });
