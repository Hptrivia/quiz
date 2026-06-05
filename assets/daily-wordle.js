/* ── Daily Wordle ─────────────────────────────────────────────────── */

const DW_MAX_GUESSES = 6;
const DW_WORD_LENGTH = 5;

/* ── PRNG (same algo as daily.js) ── */
function dwRng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function dwHash(str) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function dwTodayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

function dwYesterdayKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

/* ── Word selection ── */
async function getDailyWordEntry() {
  const entries = await fetchJSON('data/daily_wordle_words.json');
  const dateKey = dwTodayKey();
  const cycle   = parseInt(localStorage.getItem('dwCycle') || '0', 10);
  const rng     = dwRng(dwHash(`${dateKey}_dw_c${cycle}`));
  const idx     = Math.floor(rng() * entries.length);
  return entries[idx];
}

/* ── Valid guess checking ── */
let _dwValidGuesses = null;
async function dwLoadValidGuesses() {
  if (_dwValidGuesses) return _dwValidGuesses;
  const [list, daily] = await Promise.all([
    fetchJSON('data/wordle_valid_guesses.json'),
    fetchJSON('data/daily_wordle_words.json'),
  ]);
  _dwValidGuesses = new Set(list.map(w => w.toUpperCase()));
  daily.forEach(e => _dwValidGuesses.add(e.word));
  return _dwValidGuesses;
}

/* ── State ── */
function getDWState() {
  return JSON.parse(localStorage.getItem(`dwState_${dwTodayKey()}`) || 'null');
}

function saveDWState(data) {
  localStorage.setItem(`dwState_${dwTodayKey()}`, JSON.stringify(data));
}

/* ── Streak ── */
function getDWStreak() {
  return JSON.parse(localStorage.getItem('dwStreak') || '{"current":0,"best":0,"lastCompleted":""}');
}

function updateDWStreak(solved) {
  const dateKey = dwTodayKey();
  const streak  = getDWStreak();
  if (streak.lastCompleted === dateKey) return streak;
  if (solved) {
    streak.current    = streak.lastCompleted === dwYesterdayKey() ? streak.current + 1 : 1;
    streak.best       = Math.max(streak.best, streak.current);
  } else {
    streak.current = 0;
  }
  streak.lastCompleted = dateKey;
  localStorage.setItem('dwStreak', JSON.stringify(streak));
  return streak;
}

/* ── Countdown ── */
function getTimeUntilNextWord() {
  const now      = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const ms       = Math.max(0, midnight - now);
  return {
    hours:   Math.floor(ms / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    seconds: Math.floor((ms % 60000) / 1000),
  };
}

function startDWCountdown(el) {
  function tick() {
    const { hours, minutes, seconds } = getTimeUntilNextWord();
    el.textContent = `Next word in ${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  }
  tick();
  setInterval(tick, 1000);
}

/* ── Homepage card ── */
function initDailyWordleHomepageCard() {
  const card = document.querySelector('.daily-wordle-card');
  if (!card) return;
  const state  = getDWState();
  const ctaEl  = card.querySelector('.daily-card-cta');
  const subEl  = card.querySelector('.daily-card-sub');
  if (ctaEl) ctaEl.textContent = (state && state.completed) ? 'Come back tomorrow' : "Play Today's Word";
  const streak = getDWStreak();
  if (subEl && streak.current > 0) subEl.textContent = `🔥 ${streak.current} day streak`;
}

/* ── Letter evaluation ── */
function dwGetLetterStates(guess, answer) {
  const result    = Array(DW_WORD_LENGTH).fill('absent');
  const answerArr = answer.split('');
  for (let i = 0; i < DW_WORD_LENGTH; i++) {
    if (guess[i] === answer[i]) { result[i] = 'correct'; answerArr[i] = null; }
  }
  for (let i = 0; i < DW_WORD_LENGTH; i++) {
    if (result[i] === 'correct') continue;
    const idx = answerArr.indexOf(guess[i]);
    if (idx !== -1) { result[i] = 'present'; answerArr[idx] = null; }
  }
  return result;
}

/* ── Main page renderer ── */
async function renderDailyWordlePage() {
  const loadingEl = document.getElementById('dwLoading');
  const gameEl    = document.getElementById('dwGame');
  const resultEl  = document.getElementById('dwResult');

  let entry;
  try { entry = await getDailyWordEntry(); }
  catch {
    if (loadingEl) loadingEl.textContent = 'Failed to load today\'s word. Please try again.';
    return;
  }

  const target = entry.word;

  // Already completed today?
  const existing = getDWState();
  if (existing && existing.completed) {
    if (loadingEl) loadingEl.style.display = 'none';
    showDWResult(existing.guesses, existing.solved, entry);
    return;
  }

  if (loadingEl) loadingEl.style.display = 'none';
  if (gameEl)    gameEl.style.display    = 'block';

  // Show date
  const dateLabel = document.getElementById('dwDateLabel');
  if (dateLabel) {
    dateLabel.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC'
    });
  }

  // Restore mid-game progress
  let guesses    = [];
  let gameOver   = false;

  if (existing && existing.guesses) {
    guesses = existing.guesses;
    if (guesses.some(g => g.word === target || g.solved) || guesses.length >= DW_MAX_GUESSES) {
      gameOver = true;
    }
  }

  const boardEl    = document.getElementById('dwBoard');
  const keyboardEl = document.getElementById('dwKeyboard');
  const feedbackEl = document.getElementById('dwFeedback');
  let   currentGuess = [];
  let   keyStates    = {};
  let   validGuesses = null;
  let   _animatingRow = -1;

  // Rebuild key states from restored guesses
  for (const g of guesses) {
    g.states.forEach((s, i) => {
      const letter = g.word[i];
      const rank   = { absent: 1, present: 2, correct: 3 };
      if (!keyStates[letter] || rank[s] > rank[keyStates[letter]]) keyStates[letter] = s;
    });
  }

  function renderBoard() {
    if (!boardEl) return;
    boardEl.innerHTML = '';
    for (let row = 0; row < DW_MAX_GUESSES; row++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'wordle-row';
      rowEl.style.gridTemplateColumns = `repeat(${DW_WORD_LENGTH}, 1fr)`;
      const g = guesses[row];
      for (let col = 0; col < DW_WORD_LENGTH; col++) {
        const tile = document.createElement('div');
        tile.className = 'wordle-tile';
        if (g) {
          tile.textContent = g.word[col] || '';
          if (row !== _animatingRow && g.states[col]) tile.classList.add(g.states[col]);
        } else if (row === guesses.length) {
          if (currentGuess[col]) { tile.textContent = currentGuess[col]; tile.classList.add('filled'); }
        }
        rowEl.appendChild(tile);
      }
      boardEl.appendChild(rowEl);
    }
  }

  const keyboardRows = [
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L'],
    ['ENTER','Z','X','C','V','B','N','M','⌫']
  ];

  function renderKeyboard() {
    if (!keyboardEl) return;
    keyboardEl.innerHTML = '';
    keyboardRows.forEach(row => {
      const rowEl = document.createElement('div');
      rowEl.className = 'wordle-keyboard-row';
      row.forEach(letter => {
        const key = document.createElement('button');
        key.type      = 'button';
        key.className = 'wordle-key';
        key.textContent = letter;
        if (letter === 'ENTER' || letter === '⌫') key.classList.add('wide');
        if (keyStates[letter]) key.classList.add(keyStates[letter]);
        key.addEventListener('click', () => handleKey(letter));
        rowEl.appendChild(key);
      });
      keyboardEl.appendChild(rowEl);
    });
  }

  function setFeedback(text, type = '') {
    if (!feedbackEl) return;
    feedbackEl.textContent = text;
    feedbackEl.className   = 'feedback';
    if (type) feedbackEl.classList.add(type);
  }

  function shakeRow() {
    if (!boardEl) return;
    const rows = boardEl.querySelectorAll('.wordle-row');
    const row  = rows[guesses.length];
    if (!row) return;
    row.classList.remove('wordle-row-shake');
    void row.offsetWidth;
    row.classList.add('wordle-row-shake');
    setTimeout(() => row.classList.remove('wordle-row-shake'), 400);
  }

  function animateRow(rowIndex, states, onComplete) {
    if (!boardEl) { if (onComplete) onComplete(); return; }
    const rows  = boardEl.querySelectorAll('.wordle-row');
    const row   = rows[rowIndex];
    if (!row) { if (onComplete) onComplete(); return; }
    const tiles = row.querySelectorAll('.wordle-tile');
    const FOLD = 150, STAGGER = 110;
    tiles.forEach((tile, i) => {
      setTimeout(() => {
        tile.style.transition = `transform ${FOLD}ms ease`;
        tile.style.transform  = 'scaleY(0)';
        setTimeout(() => {
          tile.classList.add(states[i]);
          tile.style.transform = 'scaleY(1)';
          if (i === tiles.length - 1 && onComplete) setTimeout(onComplete, FOLD);
        }, FOLD);
      }, i * STAGGER);
    });
  }

  function bounceRow(rowIndex) {
    if (!boardEl) return;
    const rows = boardEl.querySelectorAll('.wordle-row');
    const row  = rows[rowIndex];
    if (!row) return;
    row.querySelectorAll('.wordle-tile').forEach((tile, i) => {
      setTimeout(() => {
        tile.classList.add('wordle-tile-bounce');
        setTimeout(() => tile.classList.remove('wordle-tile-bounce'), 600);
      }, i * 80);
    });
  }

  async function handleKey(key) {
    if (gameOver) return;
    if (key === '⌫') {
      currentGuess.pop();
      setFeedback('');
      renderBoard();
      return;
    }
    if (key === 'ENTER') {
      if (currentGuess.length < DW_WORD_LENGTH) {
        setFeedback('Not enough letters');
        shakeRow();
        return;
      }
      const word = currentGuess.join('');

      // Validate against word list (lazy load)
      if (!validGuesses) {
        setFeedback('Checking...');
        validGuesses = await dwLoadValidGuesses();
        setFeedback('');
      }
      if (!validGuesses.has(word)) {
        setFeedback('Not in word list');
        shakeRow();
        return;
      }

      const states   = dwGetLetterStates(word, target);
      const solved   = word === target;
      const rowIndex = guesses.length;

      // Update key states
      states.forEach((s, i) => {
        const letter = word[i];
        const rank   = { absent: 1, present: 2, correct: 3 };
        if (!keyStates[letter] || rank[s] > rank[keyStates[letter]]) keyStates[letter] = s;
      });

      guesses.push({ word, states });
      currentGuess = [];
      _animatingRow = rowIndex;
      renderBoard();

      animateRow(rowIndex, states, () => {
        _animatingRow = -1;
        renderBoard();
        renderKeyboard();

        if (solved) {
          bounceRow(rowIndex);
          gameOver = true;
          const streak = updateDWStreak(true);
          const result = { completed: true, solved: true, guesses, streak: streak.current, bestStreak: streak.best };
          saveDWState(result);
          setTimeout(() => {
            if (gameEl) gameEl.style.display = 'none';
            showDWResult(guesses, true, entry);
          }, 1600);
        } else if (guesses.length >= DW_MAX_GUESSES) {
          gameOver = true;
          const streak = updateDWStreak(false);
          const result = { completed: true, solved: false, guesses, streak: streak.current, bestStreak: streak.best };
          saveDWState(result);
          setTimeout(() => {
            if (gameEl) gameEl.style.display = 'none';
            showDWResult(guesses, false, entry);
          }, 1000);
        } else {
          // Save mid-game progress
          saveDWState({ completed: false, guesses });
        }
      });

      renderKeyboard();
      return;
    }

    if (/^[A-Z]$/.test(key) && currentGuess.length < DW_WORD_LENGTH) {
      currentGuess.push(key);
      setFeedback('');
      renderBoard();
    }
  }

  // Physical keyboard
  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Backspace') { handleKey('⌫'); return; }
    if (e.key === 'Enter')     { handleKey('ENTER'); return; }
    if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
  }
  document.addEventListener('keydown', onKeyDown);

  if (gameOver) {
    // Restored a finished game mid-flow (shouldn't happen due to early return above)
    if (gameEl) gameEl.style.display = 'none';
    showDWResult(guesses, guesses.some(g => g.word === target), entry);
  } else {
    renderBoard();
    renderKeyboard();
  }
}

/* ── Result screen ── */
async function showDWResult(guesses, solved, entry) {
  const resultEl = document.getElementById('dwResult');
  if (!resultEl) return;
  resultEl.style.display = 'block';

  const emojiGrid = guesses.map(g =>
    g.states.map(s => s === 'correct' ? '🟩' : s === 'present' ? '🟨' : '⬛').join('')
  ).join('\n');

  const attempts = solved ? `${guesses.length}/6` : 'X/6';
  const emoji    = solved ? (guesses.length <= 2 ? '🎯' : guesses.length <= 4 ? '🎉' : '😅') : '😔';

  const wordEl = document.getElementById('dwResultWord');
  if (wordEl) wordEl.textContent = entry.word;

  const statusEl = document.getElementById('dwResultStatus');
  if (statusEl) {
    statusEl.textContent = solved
      ? `Solved in ${attempts} ${emoji}`
      : `Not solved ${emoji}`;
  }

  const gridEl = document.getElementById('dwResultGrid');
  if (gridEl) gridEl.textContent = emojiGrid;

  // Countdown
  const countdownEl = document.getElementById('dwCountdown');
  if (countdownEl) startDWCountdown(countdownEl);

  // Share button
  const shareBtn = document.getElementById('dwShareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const text = `Trivia Gauntlet Daily Wordle\n${dwTodayKey()}\n${attempts} ${emoji}\n\n${emojiGrid}\n\ntriviagauntlet.app/daily-wordle.html`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          shareBtn.textContent = 'Copied!';
          setTimeout(() => { shareBtn.textContent = 'Share Results'; }, 2000);
        });
      }
    });
  }

  // Related wordle cards
  const relatedEl = document.getElementById('dwRelated');
  if (relatedEl && entry.slug) {
    // Load a few other themes for extra cards
    let extraCards = '';
    try {
      const allWords  = await fetchJSON('data/daily_wordle_words.json');
      const seen      = new Set([entry.slug]);
      const extras    = allWords.filter(e => !seen.has(e.slug) && (seen.add(e.slug), true)).slice(0, 2);
      extraCards = extras.map(e =>
        `<a class="card" href="wordle/${e.slug}.html"><h3>${e.title} Wordle</h3><p>Guess themed words</p></a>`
      ).join('');
    } catch {}

    relatedEl.innerHTML = `
      <div class="theme-related-quizzes">
        <h3>Play More Wordle</h3>
        <div class="grid">
          <a class="card" href="wordle/${entry.slug}.html"><h3>${entry.title} Wordle</h3><p>More words from today's theme</p></a>
          ${extraCards}
          <a class="card" href="wordle.html"><h3>All Themes</h3><p>Browse 151 themed wordles</p></a>
        </div>
      </div>`;
  }

  if (typeof adMobShowInterstitial === 'function') adMobShowInterstitial();
}

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page === 'daily-wordle') {
    renderDailyWordlePage();

    // Info modal
    const infoBtn   = document.getElementById('dwInfoBtn');
    const infoModal = document.getElementById('dwInfoModal');
    const infoClose = document.getElementById('dwInfoClose');
    if (infoBtn && infoModal) {
      infoBtn.addEventListener('click', () => { infoModal.style.display = 'flex'; });
      if (infoClose) infoClose.addEventListener('click', () => { infoModal.style.display = 'none'; });
      infoModal.addEventListener('click', e => { if (e.target === infoModal) infoModal.style.display = 'none'; });
    }
  }
  if (document.body.dataset.page === 'home') {
    initDailyWordleHomepageCard();
  }
});
