/* ── Daily Who Am I? ──────────────────────────────────────────────── */
// Guess today's famous person in 5 tries (Poeltl-style). Pick anyone from
// the list; each guess adds a row comparing them with the answer:
// gender · born in (🟨 same continent) · field (shows the sub-field, e.g.
// "Football"; 🟨 = same field, different sub-field) · birth year (🟨 within
// 5, ⬆️⬇️) · alive. Score = number of guesses.
// When the 5 run out, in-app players can watch a rewarded ad for one more
// (premium: free), marked 🎬 — the ad never improves the score. One 💡 hint
// per game, also a rewarded ad (premium: free): reveals a fact the player
// hasn't matched yet (field → birth decade → birthplace → first letter).
// Both are app-only; the website has no rewarded ads.
// Has the missed-days calendar (daily-archive.js) and the streak save
// (sr* in admob.js), same as the other dailies.
// Data: data/whoami_people.json, built by scripts/build_whoami.py from
// Pantheon (pantheon.world, CC BY-SA 4.0). Answer of the day =
// answers[days since start % answers.length].

const WA_MAX_GUESSES = 5;
const WA_COLS = [
  { key: 'g', label: 'Gender' }, { key: 'c', label: 'Born in' }, { key: 's', label: 'Field' },
  { key: 'y', label: 'Born' }, { key: 'a', label: 'Alive' },
];
const WA_SHORT_COUNTRY = {
  'United States': 'USA', 'United Kingdom': 'UK', 'United Arab Emirates': 'UAE', 'South Korea': 'S. Korea', 'North Korea': 'N. Korea',
  'Democratic Republic of the Congo': 'DR Congo', 'Republic of the Congo': 'Congo', 'Bosnia and Herzegovina': 'Bosnia',
  'Trinidad and Tobago': 'Trinidad', 'Czech Republic': 'Czechia', 'Myanmar (Burma)': 'Myanmar', 'Bahamas, The': 'Bahamas',
  'The Bahamas': 'Bahamas', 'Saint Vincent and the Grenadines': 'St Vincent', 'Antigua and Barbuda': 'Antigua',
};

function waTodayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

function waYesterdayKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

// Lowercase, no accents/punctuation — "Beyoncé" matches "beyonce".
function waNormalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function waAnswerForDate(data, dateKey) {
  const days = Math.round((Date.parse(`${dateKey}T00:00:00Z`) - Date.parse(`${data.start}T00:00:00Z`)) / 86400000);
  const n = data.answers.length;
  return data.answers[((days % n) + n) % n];
}

// One cell of a guess row: { text, state: 'hit' | 'near' | 'miss', arrow }
function waCompare(guess, answer, key) {
  if (key === 'g') return { text: guess.g === 'F' ? 'Female' : 'Male', state: guess.g === answer.g ? 'hit' : 'miss' };
  if (key === 'c') {
    const text = WA_SHORT_COUNTRY[guess.c] || guess.c;
    return { text, state: guess.c === answer.c ? 'hit' : guess.ct === answer.ct && guess.ct !== '?' ? 'near' : 'miss' };
  }
  if (key === 's') return { text: guess.s, state: guess.s === answer.s ? 'hit' : guess.f === answer.f ? 'near' : 'miss' };
  if (key === 'y') {
    const diff = answer.y - guess.y;
    return { text: guess.y < 0 ? `${-guess.y} BC` : String(guess.y), state: diff === 0 ? 'hit' : Math.abs(diff) <= 5 ? 'near' : 'miss',
             arrow: diff > 0 ? '⬆️' : diff < 0 ? '⬇️' : '' };
  }
  return { text: guess.a ? 'Alive' : 'Dead', state: guess.a === answer.a ? 'hit' : 'miss' };
}

function waRowEmoji(guess, answer) {
  if (guess.n === answer.n) return '🟩'.repeat(WA_COLS.length);
  return WA_COLS.map(c => ({ hit: '🟩', near: '🟨', miss: '⬛' })[waCompare(guess, answer, c.key).state]).join('');
}

/* ── State / streak ── */
function waGetState() {
  return JSON.parse(localStorage.getItem(`waState_${waTodayKey()}`) || 'null');
}

function waSaveState(data) {
  localStorage.setItem(`waState_${waTodayKey()}`, JSON.stringify(data));
}

function waGetStreak() {
  return JSON.parse(localStorage.getItem('waStreak') || '{"current":0,"best":0,"lastCompleted":""}');
}

function waUpdateStreak(solved) {
  const dateKey = waTodayKey();
  const streak  = waGetStreak();
  if (streak.lastCompleted === dateKey) return streak;
  if (solved) {
    streak.current = streak.lastCompleted === waYesterdayKey() ? streak.current + 1 : 1;
    streak.best    = Math.max(streak.best, streak.current);
  } else {
    streak.current = 0;
  }
  streak.lastCompleted = dateKey;
  localStorage.setItem('waStreak', JSON.stringify(streak));
  return streak;
}

/* ── Missed-days archive (calendar lives in daily-archive.js) ── */
const WA_ARCHIVE = {
  prefix: 'wa',
  name: 'Who Am I?',
  page: 'daily-whoami.html',
  resultId: 'waArchiveResult',
  gaMode: 'whoami',
  playedOnDay(dateKey) {
    const st = JSON.parse(localStorage.getItem(`waState_${dateKey}`) || 'null');
    if (!st || !st.completed || !st.guesses) return null;
    return st.solved ? `${st.guesses.length}/${WA_MAX_GUESSES}` : `X/${WA_MAX_GUESSES}`;
  },
  seedPlayed(dateKey, i) {
    const guesses = Array.from({ length: (i % 6) + 1 }, () => '');
    localStorage.setItem(`waState_${dateKey}`, JSON.stringify({ completed: true, solved: true, guesses }));
  },
};

function waSaveArchiveResult(dateKey, guesses, solved, answer, byName) {
  localStorage.removeItem(`waArchiveProgress_${dateKey}`);
  const n = guesses.length;
  const label = !solved ? `X/${WA_MAX_GUESSES}` : n > WA_MAX_GUESSES ? `🎬/${WA_MAX_GUESSES}` : `${n}/${WA_MAX_GUESSES}`;
  const grid = guesses.map(g => waRowEmoji(byName.get(g), answer)).join('\n');
  return daSaveLate(WA_ARCHIVE, dateKey, {
    label,
    scoreHtml: `
      <div class="daily-score-box"><span style="font-size:1.4rem;font-weight:800;">${answer.n}</span></div>
      <p style="text-align:center;margin:6px 0 10px;font-size:1rem;">${solved ? `Got it in ${label}` : 'Not solved'}</p>
      <pre style="text-align:center;font-size:1.1rem;line-height:1.4;margin:0 0 12px;">${grid}</pre>`,
  });
}

/* ── Homepage / Daily Challenges card ── */
function waInitDailyHomepageCard() {
  const card = document.querySelector('.daily-whoami-card');
  if (!card) return;
  const state  = waGetState();
  const streak = waGetStreak();
  const subEl  = card.querySelector('.daily-card-sub');
  if (!subEl) return;
  const saveText = srCardText('waStreak');
  if (state && state.completed) {
    subEl.textContent = 'Done for today — come back tomorrow';
  } else if (saveText) {
    subEl.textContent = saveText;
  } else if (streak.current > 0 && (streak.lastCompleted === waTodayKey() || streak.lastCompleted === waYesterdayKey())) {
    subEl.textContent = `🔥 ${streak.current} day streak`;
  }
}

/* ── How to Play (opens by itself the first time) ── */
function waInitHowTo(credit) {
  const modal = document.getElementById('waHowTo');
  if (!modal) return;
  const creditEl = modal.querySelector('.wa-credit');
  if (creditEl) creditEl.textContent = credit || '';
  const open  = () => { modal.style.display = 'flex'; };
  const close = () => { modal.style.display = 'none'; try { localStorage.setItem('waHowToSeen', '1'); } catch {} };
  document.getElementById('waHowToBtn')?.addEventListener('click', open);
  modal.querySelector('.dw-info-close')?.addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  if (!localStorage.getItem('waHowToSeen')) open();
}

/* ── Page ── */
async function renderDailyWhoAmIPage() {
  const loadingEl = document.getElementById('waLoading');
  const gameEl    = document.getElementById('waGame');

  let data;
  try { data = await fetchJSON('data/whoami_people.json'); }
  catch {
    if (loadingEl) loadingEl.textContent = "Failed to load today's puzzle. Please try again.";
    return;
  }
  const byName = new Map(data.people.map(p => [p.n, p]));
  WA_ARCHIVE.launch = data.start;   // calendar only counts days since launch
  waInitHowTo(data.credit);

  srSetupTestIfRequested('waStreak', [`waState_${waTodayKey()}`, 'cbWebDailyUsed_whoami']);
  daSeedTest(WA_ARCHIVE);

  // ?date=YYYY-MM-DD → a missed day from the calendar, not today's person.
  // Its in-progress guesses live under their own key, never waState_.
  const archiveDate = daResolveDateParam(WA_ARCHIVE);
  if (archiveDate === false) return;
  const playDate  = archiveDate || waTodayKey();
  // ?random=1 (testing): a random person from the daily list, nothing saved.
  const randomTest = new URLSearchParams(window.location.search).get('random') === '1';
  const answer    = randomTest
    ? byName.get(data.answers[Math.floor(Math.random() * data.answers.length)])
    : byName.get(waAnswerForDate(data, playDate));
  const loadState = () => randomTest ? null : archiveDate
    ? JSON.parse(localStorage.getItem(`waArchiveProgress_${archiveDate}`) || 'null')
    : waGetState();
  const saveState = data => randomTest ? null : archiveDate
    ? localStorage.setItem(`waArchiveProgress_${archiveDate}`, JSON.stringify(data))
    : waSaveState(data);

  // ?replay=1: wipe today's game on this device so it can be played again (testing).
  if (new URLSearchParams(window.location.search).get('replay') === '1') {
    localStorage.removeItem(`waState_${waTodayKey()}`);
    localStorage.removeItem('cbWebDailyUsed_whoami');
    history.replaceState(null, '', 'daily-whoami.html');
  }

  const existing = loadState();
  if (!archiveDate && existing && existing.completed && existing.guesses) {
    if (loadingEl) loadingEl.style.display = 'none';
    waShowResult(existing, answer, byName);
    return;
  }

  if (!archiveDate && !randomTest) srMaybeOfferRepair('waStreak');

  // Web (non-native, non-premium): one free game ever, same as the other dailies.
  if (!archiveDate && !randomTest && typeof isLimitedWeb === 'function' && isLimitedWeb() && localStorage.getItem('cbWebDailyUsed_whoami') === 'true') {
    if (loadingEl) loadingEl.style.display = 'none';
    if (gameEl) {
      gameEl.style.display = 'block';
      gameEl.innerHTML = typeof webWallHTML === 'function'
        ? webWallHTML("You've played your free Who Am I? 🎉", null, 'daily games', 1) : '';
    }
    return;
  }

  if (loadingEl) loadingEl.style.display = 'none';
  if (gameEl)    gameEl.style.display    = 'block';

  const dateLabel = document.getElementById('waDateLabel');
  if (dateLabel) {
    dateLabel.textContent = daFormatDay(playDate, { weekday: 'long', month: 'long', day: 'numeric' }) + (archiveDate ? ' · Missed day' : '');
  }

  // Search index: display name + aliases → person name, A–Z
  const index = [];
  data.people.forEach(p => {
    index.push({ key: waNormalize(p.n), name: p.n });
    (p.al || []).forEach(a => index.push({ key: waNormalize(a), name: p.n }));
  });
  index.sort((a, b) => a.name.localeCompare(b.name));

  // (older saved states from the hints version have no `guesses` — start fresh)
  let guesses    = existing && existing.guesses ? existing.guesses.filter(n => byName.has(n)) : [];
  let extraGuess = existing ? !!existing.extraGuess : false;
  let hint       = existing && existing.hint ? existing.hint : null;
  let gameOver   = false;

  const input      = document.getElementById('waInput');
  const suggestEl  = document.getElementById('waSuggest');
  const rowsEl     = document.getElementById('waRows');
  const leftEl     = document.getElementById('waGuessesLeft');
  const feedbackEl = document.getElementById('waFeedback');

  const maxGuesses = () => WA_MAX_GUESSES + (extraGuess ? 1 : 0);
  const save = () => saveState({ completed: false, guesses, extraGuess, hint });

  const isPremium = typeof isPremiumUser === 'function' && isPremiumUser();
  const canShowAd = (isInApp() && ADMOB_ADS_ENABLED);
  const hintBtn = document.getElementById('waHintBtn');
  const hintEl  = document.getElementById('waHint');

  // The first fact the player hasn't already matched with a 🟩.
  function pickHint() {
    const rows = guesses.map(n => byName.get(n));
    const matched = key => rows.some(g => waCompare(g, answer, key).state === 'hit');
    if (!matched('s')) return `Field: ${answer.s}`;
    if (!matched('y')) return `Born in the ${Math.floor(answer.y / 10) * 10}s`;
    if (!matched('c')) return `Born in ${answer.c}`;
    return `Their name starts with "${answer.n[0]}"`;
  }
  function renderHint() {
    if (!hint) return;
    hintEl.textContent = `💡 ${hint}`;
    hintEl.style.display = 'block';
    hintBtn.disabled = true;
    hintBtn.textContent = '💡 Used';
  }
  // Website (no rewarded ads): no hint button. Test links still show it.
  if (!isPremium && !canShowAd && !srIsTest() && !randomTest) hintBtn.style.display = 'none';
  hintBtn.addEventListener('click', () => {
    if (hint || gameOver) return;
    const reveal = () => { hint = pickHint(); save(); renderHint(); };
    if (isPremium) return reveal();
    _offerRewardedLifeline('Hint', () => {
      if (typeof gtag === 'function' && !srIsTest()) gtag('event', 'whoami_hint_ad');
      reveal();
    }, "Stuck? Watch a short ad to get a <strong>hint</strong> about today's person?");
  });
  renderHint();

  if (!guesses.length) daAddHeaderButton(WA_ARCHIVE, gameEl.querySelector('h2'), gameEl.querySelector('.wa-title-mid'));

  function render() {
    rowsEl.innerHTML = guesses.slice().reverse().map(n => waRowHTML(byName.get(n), answer)).join('');
    leftEl.textContent = `Guess ${Math.min(guesses.length + 1, maxGuesses())} of ${maxGuesses()}`;
  }

  function finish(solved) {
    gameOver = true;
    if (archiveDate) {
      gameEl.style.display = 'none';
      daShowLateResult(WA_ARCHIVE, archiveDate, waSaveArchiveResult(archiveDate, guesses, solved, answer, byName));
      return;
    }
    if (randomTest) {
      gameEl.style.display = 'none';
      waShowResult({ completed: true, solved, guesses, extraGuess, hint }, answer, byName);
      return;
    }
    const streak = waUpdateStreak(solved);
    const result = { completed: true, solved, guesses, extraGuess, hint, streak: streak.current, bestStreak: streak.best };
    waSaveState(result);
    if (typeof gtag === 'function' && !srIsTest()) gtag('event', 'daily_finished', { mode: 'whoami', solved, score: guesses.length });
    if (typeof isLimitedWeb === 'function' && isLimitedWeb()) localStorage.setItem('cbWebDailyUsed_whoami', 'true');
    gameEl.style.display = 'none';
    waShowResult(result, answer, byName);
  }

  function outOfGuesses() {
    if (extraGuess || (!isPremium && !canShowAd)) return finish(false);
    const grant = () => { extraGuess = true; save(); render(); feedbackEl.textContent = '🎬 One more guess — make it count!'; feedbackEl.className = 'feedback'; };
    if (isPremium) return grant();
    _offerRewardedLifeline('Extra Guess', () => {
      if (typeof gtag === 'function') gtag('event', 'whoami_extra_guess_ad');
      grant();
    }, 'Out of guesses! Watch a short ad for <strong>one more guess</strong>?', () => finish(false));
  }

  function submitGuess(name) {
    if (gameOver || !byName.has(name)) return;
    input.value = '';
    suggestEl.innerHTML = '';
    if (guesses.includes(name)) {
      feedbackEl.textContent = `You already guessed ${name}`;
      feedbackEl.className = 'feedback wrong';
      return;
    }
    feedbackEl.textContent = '';
    guesses.push(name);
    daRemoveHeaderButton();
    if (name === answer.n) {
      gameOver = true;
      if (typeof SoundFX !== 'undefined') SoundFX.play('correct');
      render();
      setTimeout(() => finish(true), 900);
      return;
    }
    if (typeof SoundFX !== 'undefined') SoundFX.play('wrong');
    save();
    render();
    if (guesses.length >= maxGuesses()) outOfGuesses();
  }

  // Empty box: browse everyone A–Z. Typing: filter, still A–Z (names that
  // start with what's typed first, then names with a word that does).
  // Alphabetical everywhere — nothing about the order hints at the answer.
  const alphabetical = data.people.map(p => p.n).sort((a, b) => a.localeCompare(b));
  function suggestions() {
    const q = waNormalize(input.value);
    if (!q) return alphabetical.filter(n => !guesses.includes(n));
    const seen = new Set(), out = [];
    for (const test of [key => key.startsWith(q), key => key.split(' ').some(w => w.startsWith(q))]) {
      for (const { key, name } of index) {
        if (out.length >= 30) return out;
        if (!seen.has(name) && !guesses.includes(name) && test(key)) { seen.add(name); out.push(name); }
      }
    }
    return out;
  }

  function showSuggestions() {
    suggestEl.innerHTML = suggestions().map(n => `<button type="button" class="wa-suggest-item">${n}</button>`).join('')
      || (input.value.trim() ? '<div class="wa-suggest-empty">No one by that name in our list</div>' : '');
  }
  input.addEventListener('input', showSuggestions);
  input.addEventListener('focus', showSuggestions);
  // close the list when tapping elsewhere (but not when tapping a name in it)
  document.addEventListener('click', e => {
    if (!e.target.closest('.wa-guess-row') && !e.target.closest('#waSuggest')) suggestEl.innerHTML = '';
  });
  suggestEl.addEventListener('click', e => {
    const item = e.target.closest('.wa-suggest-item');
    if (item) submitGuess(item.textContent);
  });
  input.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const first = suggestEl.querySelector('.wa-suggest-item');
    if (first) submitGuess(first.textContent);
  });

  render();
  if (guesses.length >= maxGuesses()) outOfGuesses();
}

function waRowHTML(guess, answer) {
  const correct = guess.n === answer.n;
  const cells = WA_COLS.map(c => {
    const r = waCompare(guess, answer, c.key);
    const state = correct ? 'hit' : r.state;
    return `<div class="wa-cell wa-${state}"><span>${r.text}</span>${!correct && r.arrow ? `<b>${r.arrow}</b>` : ''}</div>`;
  }).join('');
  return `<div class="wa-row${correct ? ' wa-row-correct' : ''}"><div class="wa-row-name">${correct ? '✅ ' : ''}${guess.n}</div><div class="wa-cells">${cells}</div></div>`;
}

function waShowResult(state, answer, byName) {
  const resultEl = document.getElementById('waResult');
  if (!resultEl) return;
  resultEl.style.display = 'block';

  const n = state.guesses.length;
  const onExtra = state.solved && n > WA_MAX_GUESSES;
  const scoreText = !state.solved ? `X/${WA_MAX_GUESSES}` : onExtra ? `🎬/${WA_MAX_GUESSES}` : `${n}/${WA_MAX_GUESSES}`;
  const grid = state.guesses.filter(g => byName.has(g)).map(g => waRowEmoji(byName.get(g), answer)).join('\n');

  document.getElementById('waResultName').textContent = answer.n;
  document.getElementById('waResultStatus').textContent = !state.solved ? 'Not solved 😔'
    : onExtra ? 'Got it on the 🎬 extra guess 😅'
    : `Got it in ${n} ${n === 1 ? 'guess' : 'guesses'}${state.hint ? ' · 💡 hint' : ''} ${n <= 2 ? '🎯' : n <= 4 ? '🎉' : '😅'}`;
  document.getElementById('waResultSummary').textContent =
    `${answer.g === 'F' ? 'Female' : 'Male'} · born ${answer.y < 0 ? `${-answer.y} BC` : answer.y} in ${answer.c} · ${answer.f} (${answer.s})`;
  document.getElementById('waResultGrid').textContent = grid;

  const streak = waGetStreak();
  document.getElementById('waStreakBox').innerHTML = `
    <div class="streak-current">🔥 ${streak.current} day streak</div>
    <div class="streak-best">Best: ${streak.best} days</div>`;
  if (typeof dailyResultAppBannerHTML === 'function') {
    document.getElementById('waStreakBox').insertAdjacentHTML('afterend', dailyResultAppBannerHTML('Who Am I?'));
  }
  daInitButton(WA_ARCHIVE, document.getElementById('waArchiveBtn'));

  const countdownEl = document.getElementById('waCountdown');
  if (countdownEl) {
    const tick = () => {
      const now = new Date();
      const ms  = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now;
      const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
      countdownEl.textContent = `Next person in ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    };
    tick();
    setInterval(tick, 1000);
  }

  const shareBtn = document.getElementById('waShareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const text = `Trivia Gauntlet — Who Am I?\n${waTodayKey()}\n${scoreText}${state.hint ? ' 💡' : ''}\n${grid}\n\ntriviagauntlet.app/daily-whoami.html`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          shareBtn.textContent = 'Copied!';
          setTimeout(() => { shareBtn.textContent = 'Share Results'; }, 2000);
        });
      }
    });
  }

  // First-ever game in this mode stays ad-free (see adMobIsFirstGameGrace in admob.js).
  if (typeof adMobShowInterstitial === 'function' && !(typeof adMobIsFirstGameGrace === 'function' && adMobIsFirstGameGrace())) adMobShowInterstitial();
}

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page === 'daily-whoami') renderDailyWhoAmIPage();
  if (document.body.dataset.page === 'home' || document.body.dataset.page === 'daily-challenges') waInitDailyHomepageCard();
});
