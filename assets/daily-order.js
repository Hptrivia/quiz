/* ── Daily Which Came First? ──────────────────────────────────────── */
// Five things, put them in order oldest → newest. Same shuffled start for
// everyone (seeded by date). Each check colours every slot 🟩 right place /
// ⬛ wrong place, and right-place items lock. 3 tries; when they run out,
// in-app players can watch a rewarded ad for one more (premium: free),
// marked 🎬 on the result — the ad never improves the result, it only stops
// a loss. One 💡 hint per game (rewarded ad; premium free; app only): shows
// the year of the unlocked item that's furthest from its right place.
// Puzzle of the day = puzzles[days since start % puzzles.length]
// in data/daily_order.json. Has the missed-days calendar (daily-archive.js)
// and the streak save (sr* in admob.js), same as Trivia / Wordle / Mashup.

const WF_MAX_TRIES = 3;

function wfTodayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

function wfYesterdayKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

/* ── PRNG (same algo as daily.js / daily-wordle.js) ── */
function wfRng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function wfHash(str) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function wfPuzzleForDate(data, dateKey) {
  const days = Math.round((Date.parse(`${dateKey}T00:00:00Z`) - Date.parse(`${data.start}T00:00:00Z`)) / 86400000);
  const n = data.puzzles.length;
  return data.puzzles[((days % n) + n) % n];
}

// Starting order: indexes into the oldest→newest list, shuffled by date,
// re-shuffled until no item already sits in its right place.
function wfStartOrder(count, dateKey) {
  const rng = wfRng(wfHash(`${dateKey}_order`));
  let order;
  do {
    order = [...Array(count).keys()];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  } while (order.some((v, i) => v === i));
  return order;
}

/* ── Missed-days archive (calendar lives in daily-archive.js) ── */
const WF_ARCHIVE = {
  prefix: 'wf',
  name: 'Which Came First?',
  page: 'daily-order.html',
  resultId: 'wfArchiveResult',
  gaMode: 'order',
  playedOnDay(dateKey) {
    const st = JSON.parse(localStorage.getItem(`wfState_${dateKey}`) || 'null');
    if (!st || !st.completed) return null;
    return st.solved ? `${st.rows.length}/${WF_MAX_TRIES}` : `X/${WF_MAX_TRIES}`;
  },
  seedPlayed(dateKey, i) {
    const rows = Array.from({ length: (i % 3) + 1 }, (_, n) => n === (i % 3) ? '🟩🟩🟩🟩🟩' : '🟩⬛⬛🟩⬛');
    localStorage.setItem(`wfState_${dateKey}`, JSON.stringify({ completed: true, solved: true, rows }));
  },
};

function wfAnswerHtml(items) {
  return items.map((it, i) => `
    <div class="wf-item wf-item-locked">
      <span class="wf-pos">${i + 1}</span>
      <span class="wf-name">${it.emoji || ''} ${it.name}</span>
      <span class="wf-year">${it.year}</span>
    </div>`).join('');
}

function wfSaveArchiveResult(dateKey, rows, solved, items) {
  localStorage.removeItem(`wfArchiveProgress_${dateKey}`);
  const tries = rows.length;
  const label = !solved ? `X/${WF_MAX_TRIES}` : tries > WF_MAX_TRIES ? `🎬/${WF_MAX_TRIES}` : `${tries}/${WF_MAX_TRIES}`;
  return daSaveLate(WF_ARCHIVE, dateKey, {
    label,
    scoreHtml: `
      <p style="text-align:center;margin:6px 0 8px;font-size:1.05rem;font-weight:600;">${!solved ? 'Not solved' : tries > WF_MAX_TRIES ? 'Solved on the 🎬 extra try' : `Solved in ${label}`}</p>
      <pre style="text-align:center;font-size:1.3rem;line-height:1.4;margin:0 0 12px;">${rows.join('\n')}</pre>`,
    detailsLabel: 'Show the Answer',
    detailsHtml: `<div class="wf-list">${wfAnswerHtml(items)}</div>`,
  });
}

/* ── State / streak ── */
function wfGetState() {
  return JSON.parse(localStorage.getItem(`wfState_${wfTodayKey()}`) || 'null');
}

function wfSaveState(data) {
  localStorage.setItem(`wfState_${wfTodayKey()}`, JSON.stringify(data));
}

function wfGetStreak() {
  return JSON.parse(localStorage.getItem('wfStreak') || '{"current":0,"best":0,"lastCompleted":""}');
}

function wfUpdateStreak(solved) {
  const dateKey = wfTodayKey();
  const streak  = wfGetStreak();
  if (streak.lastCompleted === dateKey) return streak;
  if (solved) {
    streak.current = streak.lastCompleted === wfYesterdayKey() ? streak.current + 1 : 1;
    streak.best    = Math.max(streak.best, streak.current);
  } else {
    streak.current = 0;
  }
  streak.lastCompleted = dateKey;
  localStorage.setItem('wfStreak', JSON.stringify(streak));
  return streak;
}

/* ── Homepage / Daily Challenges card ── */
function wfInitDailyHomepageCard() {
  const card = document.querySelector('.daily-order-card');
  if (!card) return;
  const state  = wfGetState();
  const streak = wfGetStreak();
  const subEl  = card.querySelector('.daily-card-sub');
  if (!subEl) return;
  const saveText = srCardText('wfStreak');
  if (state && state.completed) {
    subEl.textContent = 'Done for today — come back tomorrow';
  } else if (saveText) {
    subEl.textContent = saveText;
  } else if (streak.current > 0 && (streak.lastCompleted === wfTodayKey() || streak.lastCompleted === wfYesterdayKey())) {
    subEl.textContent = `🔥 ${streak.current} day streak`;
  }
}

/* ── Page ── */
async function renderDailyOrderPage() {
  const loadingEl = document.getElementById('wfLoading');
  const gameEl    = document.getElementById('wfGame');

  let data;
  try { data = await fetchJSON('data/daily_order.json'); }
  catch {
    if (loadingEl) loadingEl.textContent = "Failed to load today's puzzle. Please try again.";
    return;
  }
  WF_ARCHIVE.launch = data.start;   // calendar only counts days since launch
  srSetupTestIfRequested('wfStreak', [`wfState_${wfTodayKey()}`, 'cbWebDailyUsed_order']);

  // ?replay=1: wipe today's game on this device so it can be played again (testing).
  if (new URLSearchParams(window.location.search).get('replay') === '1') {
    localStorage.removeItem(`wfState_${wfTodayKey()}`);
    localStorage.removeItem('cbWebDailyUsed_order');
    history.replaceState(null, '', 'daily-order.html');
  }
  daSeedTest(WF_ARCHIVE);

  // ?date=YYYY-MM-DD → a missed day from the calendar, not today's puzzle.
  // Its in-progress order lives under its own key, never wfState_.
  const archiveDate = daResolveDateParam(WF_ARCHIVE);
  if (archiveDate === false) return;
  const playDate  = archiveDate || wfTodayKey();
  const loadState = () => archiveDate
    ? JSON.parse(localStorage.getItem(`wfArchiveProgress_${archiveDate}`) || 'null')
    : wfGetState();
  const saveState = data => archiveDate
    ? localStorage.setItem(`wfArchiveProgress_${archiveDate}`, JSON.stringify(data))
    : wfSaveState(data);

  const items = wfPuzzleForDate(data, playDate).items; // already oldest → newest

  const existing = loadState();
  if (!archiveDate && existing && existing.completed) {
    if (loadingEl) loadingEl.style.display = 'none';
    wfShowResult(existing, items);
    return;
  }

  if (!archiveDate) srMaybeOfferRepair('wfStreak');

  // Web (non-native, non-premium): one free game ever, same as the other dailies.
  if (!archiveDate && typeof isLimitedWeb === 'function' && isLimitedWeb() && localStorage.getItem('cbWebDailyUsed_order') === 'true') {
    if (loadingEl) loadingEl.style.display = 'none';
    if (gameEl) {
      gameEl.style.display = 'block';
      gameEl.innerHTML = typeof webWallHTML === 'function'
        ? webWallHTML("You've played your free Which Came First? 🎉", null, 'daily games', 1) : '';
    }
    return;
  }

  if (loadingEl) loadingEl.style.display = 'none';
  if (gameEl)    gameEl.style.display    = 'block';

  const dateLabel = document.getElementById('wfDateLabel');
  if (dateLabel) {
    dateLabel.textContent = daFormatDay(playDate, { weekday: 'long', month: 'long', day: 'numeric' }) +
                            (archiveDate ? ' · Missed day' : '');
  }

  // order[i] = index (into items) of the item currently in slot i.
  let order     = existing ? existing.order : wfStartOrder(items.length, playDate);
  let rows      = existing ? existing.rows : [];   // one 🟩/⬛ string per check
  let extraTry  = existing ? !!existing.extraTry : false;
  let hint      = existing && typeof existing.hint === 'number' ? existing.hint : null; // index into items
  let gameOver  = false;

  const listEl     = document.getElementById('wfList');
  const checkBtn   = document.getElementById('wfCheckBtn');
  const leftEl     = document.getElementById('wfTriesLeft');
  const feedbackEl = document.getElementById('wfFeedback');

  const maxTries = () => WF_MAX_TRIES + (extraTry ? 1 : 0);
  // Items lock only when a Check finds them in the right place — never live
  // while moving (that would reveal the answer before checking).
  let lockedItems = new Set(existing && existing.locks ? existing.locks
    : existing && existing.rows && existing.rows.length ? order.filter((idx, i) => idx === i) : []);
  const locked   = i => lockedItems.has(order[i]);
  const save     = () => saveState({ completed: false, order, rows, extraTry, hint, locks: [...lockedItems] });

  if (!rows.length) daAddHeaderButton(WF_ARCHIVE, gameEl.querySelector('h2'), gameEl.querySelector('.wa-title-mid'));

  // How to Play: opens by itself the first time, then from the ? button.
  const howTo = document.getElementById('wfHowTo');
  const closeHowTo = () => { howTo.style.display = 'none'; try { localStorage.setItem('wfHowToSeen', '1'); } catch {} };
  document.getElementById('wfHowToBtn').addEventListener('click', () => { howTo.style.display = 'flex'; });
  howTo.querySelector('.dw-info-close').addEventListener('click', closeHowTo);
  howTo.addEventListener('click', e => { if (e.target === howTo) closeHowTo(); });
  if (!localStorage.getItem('wfHowToSeen')) howTo.style.display = 'flex';

  // 💡 Hint: the year of the unlocked item furthest from its right place.
  const isPremium = typeof isPremiumUser === 'function' && isPremiumUser();
  const canShowAd = (isInApp() && ADMOB_ADS_ENABLED);
  const hintBtn = document.getElementById('wfHintBtn');
  if (!isPremium && !canShowAd && !srIsTest()) hintBtn.style.display = 'none';
  function renderHintBtn() {
    if (hint === null) return;
    hintBtn.disabled = true;
    hintBtn.textContent = '💡 Used';
  }
  hintBtn.addEventListener('click', () => {
    if (hint !== null || gameOver) return;
    const reveal = () => {
      const open = order.map((idx, i) => ({ idx, off: Math.abs(idx - i), lock: locked(i) })).filter(x => !x.lock);
      open.sort((a, b) => b.off - a.off);
      hint = open[0].idx;
      save(); render(); renderHintBtn();
    };
    if (isPremium) return reveal();
    _offerRewardedLifeline('Hint', () => {
      if (typeof gtag === 'function' && !srIsTest()) gtag('event', 'order_hint_ad');
      reveal();
    }, 'Stuck? Watch a short ad to <strong>reveal the year</strong> of one event?');
  });
  renderHintBtn();

  function render() {
    listEl.innerHTML = order.map((idx, i) => {
      const it = items[idx];
      const lock = locked(i);
      return `<div class="wf-item${lock ? ' wf-item-locked' : ''}">
        <span class="wf-pos">${i + 1}</span>
        <span class="wf-name">${it.emoji || ''} ${it.name}${hint === idx ? ` <span class="wf-year-badge">💡 ${it.year}</span>` : ''}</span>
        ${lock ? '<span class="wf-lock">✅</span>' : `
        <span class="wf-moves">
          <button type="button" class="wf-move" data-i="${i}" data-dir="-1" aria-label="Move up"${i === 0 ? ' disabled' : ''}>▲</button>
          <button type="button" class="wf-move" data-i="${i}" data-dir="1" aria-label="Move down"${i === order.length - 1 ? ' disabled' : ''}>▼</button>
        </span>`}
      </div>`;
    }).join('');
    leftEl.textContent = `Tries left: ${maxTries() - rows.length}`;
  }

  // Moving skips over locked slots so right-place items stay put.
  function move(i, dir) {
    let j = i + dir;
    while (j >= 0 && j < order.length && locked(j)) j += dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    daRemoveHeaderButton();
    feedbackEl.textContent = '';
    save();
    render();
  }

  function finish(solved) {
    gameOver = true;
    if (archiveDate) {
      gameEl.style.display = 'none';
      daShowLateResult(WF_ARCHIVE, archiveDate, wfSaveArchiveResult(archiveDate, rows, solved, items));
      return;
    }
    const streak = wfUpdateStreak(solved);
    const result = { completed: true, solved, rows, extraTry, hint, streak: streak.current, bestStreak: streak.best };
    wfSaveState(result);
    if (typeof gtag === 'function' && !srIsTest()) gtag('event', 'daily_finished', { mode: 'order', solved, score: rows.length });
    if (typeof tgNotifyDailyFinished === 'function') tgNotifyDailyFinished();
    if (typeof isLimitedWeb === 'function' && isLimitedWeb()) localStorage.setItem('cbWebDailyUsed_order', 'true');
    gameEl.style.display = 'none';
    wfShowResult(result, items);
  }

  function outOfTries() {
    if (extraTry || (!isPremium && !canShowAd)) return finish(false);
    const grant = () => { extraTry = true; save(); render(); feedbackEl.textContent = '🎬 One more try — make it count!'; feedbackEl.className = 'feedback'; };
    if (isPremium) return grant();
    _offerRewardedLifeline('Extra Try', () => {
      if (typeof gtag === 'function') gtag('event', 'order_extra_try_ad');
      grant();
    }, 'Out of tries! Watch a short ad for <strong>one more try</strong>?', () => finish(false));
  }

  listEl.addEventListener('click', e => {
    const btn = e.target.closest('.wf-move');
    if (btn && !gameOver) move(parseInt(btn.dataset.i, 10), parseInt(btn.dataset.dir, 10));
  });

  checkBtn.addEventListener('click', () => {
    if (gameOver) return;
    daRemoveHeaderButton();
    const row = order.map((idx, i) => idx === i ? '🟩' : '⬛').join('');
    rows.push(row);
    order.forEach((idx, i) => { if (idx === i) lockedItems.add(idx); });
    const solved = order.every((idx, i) => idx === i);
    if (typeof SoundFX !== 'undefined') SoundFX.play(solved ? 'correct' : 'wrong');
    if (solved) return finish(true);
    const right = order.filter((idx, i) => idx === i).length;
    feedbackEl.textContent = `${right} of ${order.length} in the right place`;
    feedbackEl.className = 'feedback wrong';
    save();
    render();
    if (rows.length >= maxTries()) outOfTries();
  });

  render();
  // Restored a game that was sitting on its last try when the app closed.
  if (rows.length >= maxTries()) outOfTries();
}

function wfShowResult(state, items) {
  const resultEl = document.getElementById('wfResult');
  if (!resultEl) return;
  resultEl.style.display = 'block';

  const tries = state.rows.length;
  const onExtra = state.solved && tries > WF_MAX_TRIES;
  const scoreText = !state.solved ? `X/${WF_MAX_TRIES}` : onExtra ? `🎬/${WF_MAX_TRIES}` : `${tries}/${WF_MAX_TRIES}`;
  document.getElementById('wfResultStatus').textContent = !state.solved ? 'Not solved 😔'
    : onExtra ? 'Solved on the 🎬 extra try 😅'
    : `Solved in ${tries}/${WF_MAX_TRIES}${state.hint !== null && state.hint !== undefined ? ' · 💡 hint' : ''} ${tries === 1 ? '🎯' : tries === 2 ? '🎉' : '😅'}`;
  document.getElementById('wfResultGrid').textContent = state.rows.join('\n');
  document.getElementById('wfAnswer').innerHTML = wfAnswerHtml(items);

  daInitButton(WF_ARCHIVE, document.getElementById('wfArchiveBtn'));

  const streak = wfGetStreak();
  document.getElementById('wfStreakBox').innerHTML = `
    <div class="streak-current">🔥 ${streak.current} day streak</div>
    <div class="streak-best">Best: ${streak.best} days</div>`;
  if (typeof dailyResultAppBannerHTML === 'function') {
    document.getElementById('wfStreakBox').insertAdjacentHTML('afterend', dailyResultAppBannerHTML('Which Came First?'));
  }

  const countdownEl = document.getElementById('wfCountdown');
  if (countdownEl) {
    const tick = () => {
      const now = new Date();
      const ms  = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now;
      const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
      countdownEl.textContent = `Next puzzle in ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    };
    tick();
    setInterval(tick, 1000);
  }

  const shareBtn = document.getElementById('wfShareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const text = `Trivia Gauntlet — Which Came First?\n${wfTodayKey()}\n${scoreText}${state.hint !== null && state.hint !== undefined ? ' 💡' : ''}\n${state.rows.join('\n')}\n\ntriviagauntlet.app/daily-order.html`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          shareBtn.textContent = 'Copied!';
          setTimeout(() => { shareBtn.textContent = 'Share Results'; }, 2000);
        });
      }
    });
  }
}

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page === 'daily-order') renderDailyOrderPage();
  if (document.body.dataset.page === 'home' || document.body.dataset.page === 'daily-challenges') wfInitDailyHomepageCard();
});
