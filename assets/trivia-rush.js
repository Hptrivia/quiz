// Trivia Rush — game logic

const TR_DIFF_ORDER = ['easy', 'medium', 'hard', 'expert'];
const TR_DIFF_POINTS = { easy: 100, medium: 200, hard: 300, expert: 400 };
const TR_MAX_HEAT = 10;
const TR_TIMER_SEC = 20;
const TR_DOUBLE_COUNT = 3;

const TR_COMBO_MSGS = {
  2: 'COMBO x2',
  3: 'ON FIRE',
  4: 'BLAZING',
  5: 'UNSTOPPABLE',
  6: 'GODLIKE',
};

function trComboMsg(mult) {
  if (mult <= 1) return '';
  return TR_COMBO_MSGS[Math.min(mult, 6)] || 'LEGENDARY';
}

let trState = null;

function trMakeState(themeName, themeSlug, allThemes) {
  return {
    themeName, themeSlug, allThemes,
    pools: { easy: [], medium: [], hard: [], expert: [] },
    diffIndex: 0,
    poolIndex: 0,
    score: 0,
    peakScore: 0,
    streak: 0,
    wrongStreak: 0,
    bestStreak: 0,
    multiplier: 1,
    heat: 0,
    doubleRemaining: 0,
    timeLeft: TR_TIMER_SEC,
    timerInterval: null,
    locked: false,
    gameOver: false,
    totalAnswered: 0,
    totalCorrect: 0,
    currentQ: null,
    currentDiff: 'easy',
    personalBest: 0,
  };
}

async function trInit() {
  const loadBox = document.getElementById('trLoadingBox');
  const gamePanel = document.getElementById('trGamePanel');
  if (!loadBox) return;

  const slug = getParam('theme');
  if (!slug) {
    loadBox.querySelector('p').textContent = 'No theme specified. Add ?theme=slugname to the URL.';
    return;
  }

  try {
    const themes = await loadThemes();
    const theme = themes.find(t => t.slug === slug);
    if (!theme) throw new Error('Theme not found: ' + slug);

    const questions = await fetchJSON(theme.questionFile);
    trState = trMakeState(theme.title, theme.slug, themes);
    trState.personalBest = parseInt(localStorage.getItem('trRushBest_' + theme.slug) || '0', 10);

    TR_DIFF_ORDER.forEach(d => {
      trState.pools[d] = shuffleArray(questions.filter(q => normalizeDifficulty(q.difficulty) === d));
    });

    // Advance to first non-empty pool
    while (trState.diffIndex < TR_DIFF_ORDER.length &&
           trState.pools[TR_DIFF_ORDER[trState.diffIndex]].length === 0) {
      trState.diffIndex++;
    }

    if (trState.diffIndex >= TR_DIFF_ORDER.length) {
      loadBox.querySelector('p').textContent = 'No questions found for this theme.';
      return;
    }

    trState.currentDiff = TR_DIFF_ORDER[trState.diffIndex];

    const titleEl = document.getElementById('trTitle');
    if (titleEl) titleEl.textContent = theme.title;
    document.title = `${theme.title} — Trivia Rush | Trivia Gauntlet`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', `Play ${theme.title} Trivia Rush on Trivia Gauntlet. Answer fast, build streaks, chase the rush.`);

    if (typeof updateRemoveAdsFooter === 'function') updateRemoveAdsFooter(theme.slug, 'trivia-rush');

    // Wire How to Play buttons (start screen + in-game if present)
    const openModal = () => document.getElementById('trHowToModal').classList.add('tr-modal-show');
    document.getElementById('trHowToBtn')?.addEventListener('click', openModal);
    document.getElementById('trStartHowToBtn')?.addEventListener('click', openModal);

    // Populate start screen
    const startThemeEl = document.getElementById('trStartTheme');
    if (startThemeEl) startThemeEl.textContent = theme.title;

    // Start button — timer only fires after this click
    document.getElementById('trStartBtn')?.addEventListener('click', () => {
      document.getElementById('trStartBox').style.display = 'none';
      gamePanel.style.display = '';
      trUpdateStats();
      trUpdateHeat();
      trNext();
    });

    loadBox.style.display = 'none';
    document.getElementById('trStartBox').style.display = '';

    const startBestEl = document.getElementById('trStartBest');
    if (startBestEl && trState.personalBest > 0) {
      startBestEl.textContent = 'Your best: ' + trState.personalBest.toLocaleString();
      startBestEl.style.display = '';
    }

  } catch (err) {
    loadBox.querySelector('p').textContent = 'Failed to load questions. Please try again.';
    console.error(err);
  }
}

// ---- Question progression ----

function trPeekNext() {
  let { diffIndex, poolIndex } = trState;
  while (diffIndex < TR_DIFF_ORDER.length) {
    const pool = trState.pools[TR_DIFF_ORDER[diffIndex]];
    if (poolIndex < pool.length) {
      const q = pool[poolIndex];
      trState.diffIndex = diffIndex;
      trState.poolIndex = poolIndex + 1;
      trState.currentDiff = TR_DIFF_ORDER[diffIndex];
      return q;
    }
    diffIndex++;
    poolIndex = 0;
  }
  return null;
}

function trNext() {
  if (trState.totalAnswered > 0 && trState.totalAnswered % 1 === 0) {
    trMidBreak();
    return;
  }
  const q = trPeekNext();
  if (!q) { trEnd(true); return; }
  trState.currentQ = shuffleQuestionOptions(q);
  trState.locked = false;
  trRender();
  trTimerStart();
}

function trResume() {
  const q = trPeekNext();
  if (!q) { trEnd(true); return; }
  trState.currentQ = shuffleQuestionOptions(q);
  trState.locked = false;
  trRender();
  trTimerStart();
}

function trMidBreak() {
  trTimerStop();
  const round = Math.floor(trState.totalAnswered / 30);
  const accuracy = trState.totalAnswered > 0
    ? Math.round((trState.totalCorrect / trState.totalAnswered) * 100) : 0;

  const overlay = document.createElement('div');
  overlay.id = '_trBreakOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px';
  overlay.innerHTML = `
    <div style="background:#1e1e2e;padding:24px 20px;border-radius:16px;text-align:center;max-width:300px;width:100%;color:#fff">
      <div style="font-size:0.75rem;letter-spacing:2px;color:#6c63ff;margin-bottom:6px">ROUND ${round} COMPLETE</div>
      <div style="display:flex;justify-content:center;gap:24px;margin:12px 0 20px">
        <div><div style="font-size:1.4rem;font-weight:bold">${trState.score.toLocaleString()}</div><div style="font-size:0.7rem;color:#94a3b8">SCORE</div></div>
        <div><div style="font-size:1.4rem;font-weight:bold">${trState.bestStreak}</div><div style="font-size:0.7rem;color:#94a3b8">STREAK</div></div>
        <div><div style="font-size:1.4rem;font-weight:bold">${accuracy}%</div><div style="font-size:0.7rem;color:#94a3b8">ACCURACY</div></div>
      </div>
      <button id="_trBreakContinue" style="width:100%;padding:13px;border-radius:10px;background:#6c63ff;color:#fff;border:none;cursor:pointer;font-size:1em;font-weight:600">Continue</button>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('_trBreakContinue').addEventListener('click', () => {
    overlay.remove();
    if (typeof isInApp === 'function' && isInApp()) {
      trAdOffer();
    } else {
      trResume();
    }
  });
}

function trAdOffer() {
  const adOverlay = document.createElement('div');
  adOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px';
  adOverlay.innerHTML = `
    <div style="background:#1e1e2e;padding:24px 20px;border-radius:14px;text-align:center;max-width:280px;width:100%;color:#fff">
      <p style="margin:0 0 16px;font-size:1em">Watch a short ad to continue?</p>
      <button id="_trAdWatch" style="width:100%;padding:12px;border-radius:8px;background:#6c63ff;color:#fff;border:none;cursor:pointer;font-size:1em;margin-bottom:8px">Watch Ad</button>
      <button id="_trAdNo" style="width:100%;padding:10px;border-radius:8px;background:#2d2d3d;color:#94a3b8;border:none;cursor:pointer;font-size:0.9em">No</button>
    </div>`;
  document.body.appendChild(adOverlay);

  document.getElementById('_trAdNo').addEventListener('click', () => {
    adOverlay.remove();
    trEnd(false);
  });

  document.getElementById('_trAdWatch').addEventListener('click', async () => {
    adOverlay.remove();
    if (typeof adMobShowRewarded === 'function') {
      const earned = await adMobShowRewarded();
      if (earned || typeof adMobShowRewarded === 'undefined') trResume();
      else trEnd(false);
    } else {
      trResume();
    }
  });
}

function trRender() {
  const { currentQ, currentDiff } = trState;

  const badge = document.getElementById('trDiffBadge');
  if (badge) {
    badge.textContent = currentDiff.toUpperCase();
    badge.className = 'tr-diff-badge tr-diff-' + currentDiff;
  }

  const themeBadge = document.getElementById('trThemeBadge');
  if (themeBadge && currentQ._themeName) {
    const c = trState.themeColorMap && trState.themeColorMap[currentQ._themeSlug];
    if (c) {
      themeBadge.style.background = c.bg;
      themeBadge.style.borderColor = c.border;
      themeBadge.style.color = c.text;
    }
    themeBadge.textContent = currentQ._themeName;
  }

  document.getElementById('trQuestionText').textContent = currentQ.question;

  const grid = document.getElementById('trOptionsGrid');
  grid.innerHTML = '';
  currentQ.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'tr-option-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => trSelect(opt));
    grid.appendChild(btn);
  });

  trUpdateStats();
  trUpdateHeat();
  trUpdateDoubleBar();
}

// ---- Answer handling ----

function trSelect(chosen) {
  if (trState.locked || trState.gameOver) return;
  trState.locked = true;
  trState.totalAnswered++;
  trTimerStop();

  const correct = chosen === trState.currentQ.answer;
  trMarkButtons(chosen, correct);
  if (typeof SoundFX !== 'undefined') SoundFX.play(correct ? 'correct' : 'wrong');

  if (correct) {
    trOnCorrect();
    setTimeout(() => { if (!trState.gameOver) trNext(); }, 1400);
  } else {
    trOnWrong();
    if (!trState.gameOver) setTimeout(() => trNext(), 1500);
  }
}

function trTimerOut() {
  if (trState.locked || trState.gameOver) return;
  trState.locked = true;
  trState.totalAnswered++;

  trMarkButtons(null, false);
  trFx('combo', "TIME'S UP", 'tr-times-up');
  trOnWrong();

  if (!trState.gameOver) setTimeout(() => trNext(), 1600);
}

function trMarkButtons(chosen, correct) {
  document.querySelectorAll('#trOptionsGrid .tr-option-btn').forEach(btn => {
    if (correct && btn.textContent === chosen) btn.classList.add('tr-correct');
    if (!correct && btn.textContent === chosen) btn.classList.add('tr-wrong');
    btn.disabled = true;
  });
}

function trOnCorrect() {
  trState.totalCorrect++;

  const base = TR_DIFF_POINTS[trState.currentDiff] || 100;

  trState.wrongStreak = 0;
  trState.streak++;
  if (trState.streak > trState.bestStreak) trState.bestStreak = trState.streak;

  if (trState.streak % 3 === 0) {
    trState.multiplier++;
    trAnim('mult-up');
  }

  trState.heat = Math.min(TR_MAX_HEAT, trState.heat + 1);

  let earned = base * trState.multiplier;
  let isDouble = false;
  if (trState.doubleRemaining > 0) {
    earned *= 2;
    isDouble = true;
    trState.doubleRemaining--;
  }
  trState.score += earned;
  if (trState.score > trState.peakScore) trState.peakScore = trState.score;

  if (trState.heat >= TR_MAX_HEAT) trTriggerMaxHeat();

  trScorePopup(earned, isDouble);
  const msg = trComboMsg(trState.multiplier);
  if (msg) trFx('combo', msg);
  if (trState.streak > 0 && trState.streak % 6 === 0) trShake('light');

  trUpdateStats();
  trUpdateHeat();
  trUpdateDoubleBar();
}

function trOnWrong() {
  const base = TR_DIFF_POINTS[trState.currentDiff] || 100;

  // Score-based deduction tier — higher score = bigger penalty
  const tierMult = trState.score >= 4000 ? 3 : trState.score >= 2000 ? 2 : trState.score >= 500 ? 1.5 : 1;

  const hadStreak = trState.streak > 0;

  trState.streak = 0;
  trState.wrongStreak++;
  trState.heat = 0;
  trState.doubleRemaining = 0;

  // 2nd consecutive wrong doubles the deduction
  const isDoubleDeduct = trState.wrongStreak >= 2;
  let deduction = Math.round(base * trState.multiplier * tierMult);
  if (isDoubleDeduct) deduction *= 2;

  trState.score = Math.max(0, trState.score - deduction);

  // Every 2 wrong in a row drops multiplier by 1
  if (trState.wrongStreak >= 2) {
    const prev = trState.multiplier;
    trState.multiplier = Math.max(1, trState.multiplier - 1);
    trState.wrongStreak = 0;
    if (trState.multiplier < prev) {
      trAnim('mult-crack');
      trFx('combo', isDoubleDeduct ? 'DOUBLE DEDUCT!' : 'MULTIPLIER DOWN', 'tr-times-up');
    } else {
      if (isDoubleDeduct) trFx('combo', 'DOUBLE DEDUCT!', 'tr-times-up');
    }
  }

  trDeductPopup(deduction);
  trShake('hard');
  trFlash();
  if (hadStreak) trFx('broken');

  trUpdateStats();
  trUpdateHeat();
  trUpdateDoubleBar();

  if (trState.score <= 0) {
    trState.gameOver = true;
    setTimeout(() => trEnd(false), 1700);
  }
}

// ---- Timer ----

function trTimerStart() {
  trState.timeLeft = TR_TIMER_SEC;
  trTimerDraw();

  trState.timerInterval = setInterval(() => {
    trState.timeLeft--;
    trTimerDraw();
    if (trState.timeLeft <= 0) {
      clearInterval(trState.timerInterval);
      trState.timerInterval = null;
      trTimerOut();
    }
  }, 1000);
}

function trTimerStop() {
  if (trState.timerInterval) {
    clearInterval(trState.timerInterval);
    trState.timerInterval = null;
  }
}

function trTimerDraw() {
  const fill = document.getElementById('trTimerFill');
  const text = document.getElementById('trTimerText');
  if (!fill || !text) return;

  const pct = (trState.timeLeft / TR_TIMER_SEC) * 100;
  fill.style.width = pct + '%';
  text.textContent = trState.timeLeft;

  const urgent = trState.timeLeft <= 5;
  const warm   = trState.timeLeft <= 10;
  fill.style.background = urgent ? '#ef4444' : warm ? '#f59e0b' : '#22c55e';
  text.style.color       = urgent ? '#ef4444' : warm ? '#f59e0b' : '#94a3b8';
  fill.classList.toggle('tr-timer-urgent', urgent);
}

// ---- UI Updates ----

function trUpdateStats() {
  const scoreEl = document.getElementById('trScore');
  if (scoreEl) scoreEl.textContent = trState.score.toLocaleString();
  const streakEl = document.getElementById('trStreak');
  if (streakEl) streakEl.textContent = trState.streak;
  const multEl = document.getElementById('trMultiplier');
  if (multEl) {
    multEl.textContent = 'x' + trState.multiplier;
    multEl.className = 'tr-multiplier tr-mult-' + Math.min(trState.multiplier, 6);
  }
  const bestEl = document.getElementById('trInGameBest');
  if (bestEl) {
    if (trState.personalBest > 0) {
      bestEl.textContent = trState.personalBest.toLocaleString();
      bestEl.classList.toggle('tr-beating-best', trState.peakScore > trState.personalBest);
    } else {
      bestEl.textContent = '—';
      bestEl.classList.remove('tr-beating-best');
    }
  }
}

function trUpdateHeat() {
  const fill = document.getElementById('trHeatFill');
  const text = document.getElementById('trHeatText');
  if (fill) {
    fill.style.width = (trState.heat / TR_MAX_HEAT * 100) + '%';
    if (trState.heat >= 7) fill.style.background = 'linear-gradient(90deg,#f97316,#fbbf24)';
    else if (trState.heat >= 4) fill.style.background = 'linear-gradient(90deg,#f59e0b,#fbbf24)';
    else fill.style.background = 'linear-gradient(90deg,#3b82f6,#60a5fa)';
  }
  if (text) text.textContent = trState.heat + '/' + TR_MAX_HEAT;

  const panel = document.getElementById('trGamePanel');
  if (panel) {
    panel.classList.remove('tr-glow-warm', 'tr-glow-hot');
    if (trState.heat >= 7) panel.classList.add('tr-glow-hot');
    else if (trState.heat >= 4) panel.classList.add('tr-glow-warm');
  }
}

function trUpdateDoubleBar() {
  const el = document.getElementById('trDoubleBar');
  if (!el) return;
  if (trState.doubleRemaining > 0) {
    el.textContent = `DOUBLE POINTS — ${trState.doubleRemaining} question${trState.doubleRemaining !== 1 ? 's' : ''} left`;
    el.classList.add('tr-double-active');
  } else {
    el.classList.remove('tr-double-active');
  }
}

// ---- Max heat ----

function trTriggerMaxHeat() {
  trState.heat = 0;
  trState.doubleRemaining = TR_DOUBLE_COUNT;

  const panel = document.getElementById('trGamePanel');
  if (panel) {
    panel.classList.add('tr-glow-max');
    setTimeout(() => panel.classList.remove('tr-glow-max'), 1500);
  }

  // Override combo text with max heat message
  const el = document.getElementById('trComboText');
  if (el) {
    el.textContent = 'MAX HEAT! DOUBLE POINTS x3';
    el.className = 'tr-combo-text tr-combo-show tr-max-heat-msg';
    el.addEventListener('animationend', () => { el.className = 'tr-combo-text'; }, { once: true });
  }
}

// ---- Visual effects ----

function trDeductPopup(pts) {
  const el = document.getElementById('trDeductPopup');
  if (!el) return;
  el.textContent = '−' + pts;
  el.className = 'tr-deduct-popup';
  void el.offsetWidth;
  el.className = 'tr-deduct-popup tr-deduct-show';
  el.addEventListener('animationend', () => { el.className = 'tr-deduct-popup'; }, { once: true });
}

function trScorePopup(pts, isDouble) {
  const el = document.getElementById('trScorePopup');
  if (!el) return;
  el.textContent = (isDouble ? '2x ' : '') + '+' + pts;
  el.className = 'tr-score-popup';
  void el.offsetWidth;
  el.className = 'tr-score-popup tr-pop-show' + (isDouble ? ' tr-pop-double' : '');
  el.addEventListener('animationend', () => { el.className = 'tr-score-popup'; }, { once: true });
}

function trFx(type, text, extra) {
  if (type === 'combo') {
    const el = document.getElementById('trComboText');
    if (!el) return;
    el.textContent = text;
    el.className = 'tr-combo-text';
    void el.offsetWidth;
    el.className = 'tr-combo-text tr-combo-show' + (extra ? ' ' + extra : '');
    el.addEventListener('animationend', () => { el.className = 'tr-combo-text'; }, { once: true });
  } else if (type === 'broken') {
    const el = document.getElementById('trStreakBroken');
    if (!el) return;
    el.className = 'tr-streak-broken';
    void el.offsetWidth;
    el.className = 'tr-streak-broken tr-broken-show';
    el.addEventListener('animationend', () => { el.className = 'tr-streak-broken'; }, { once: true });
  }
}

function trAnim(type) {
  const el = document.getElementById('trMultiplier');
  if (!el) return;
  el.classList.remove('tr-mult-up', 'tr-mult-crack');
  void el.offsetWidth;
  el.classList.add(type === 'mult-up' ? 'tr-mult-up' : 'tr-mult-crack');
  el.addEventListener('animationend', () => el.classList.remove('tr-mult-up', 'tr-mult-crack'), { once: true });
}

function trShake(strength) {
  const el = document.getElementById('trGamePanel');
  if (!el) return;
  const cls = strength === 'hard' ? 'tr-shake-hard' : 'tr-shake';
  el.classList.remove('tr-shake', 'tr-shake-hard');
  void el.offsetWidth;
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

function trFlash() {
  const el = document.getElementById('trFlashOverlay');
  if (!el) return;
  el.classList.remove('tr-flash-red');
  void el.offsetWidth;
  el.classList.add('tr-flash-red');
  el.addEventListener('animationend', () => el.classList.remove('tr-flash-red'), { once: true });
}

// ---- Game Over ----

function trEnd(completed) {
  trTimerStop();
  trState.gameOver = true;

  const gamePanel = document.getElementById('trGamePanel');
  const gameOverBox = document.getElementById('trGameOverBox');
  if (gamePanel) gamePanel.style.display = 'none';
  if (!gameOverBox) return;
  gameOverBox.style.display = '';

  const accuracy = trState.totalAnswered > 0
    ? Math.round((trState.totalCorrect / trState.totalAnswered) * 100)
    : 0;

  const runScore = completed ? trState.score : trState.peakScore;
  const bestKey = 'trRushBest_' + trState.themeSlug;
  const prev = parseInt(localStorage.getItem(bestKey) || '0', 10);
  const isNewBest = runScore > prev;
  if (isNewBest) localStorage.setItem(bestKey, runScore);
  if (typeof recordTriviaRush === "function") recordTriviaRush(trState.themeSlug, runScore, trState.bestStreak || 0);
  const currentBest = isNewBest ? runScore : prev;
  const isImprovement = isNewBest && prev > 0;
  const pbTile = currentBest > 0
    ? `<div class="tr-pb-result${isImprovement ? ' tr-pb-result-new' : ''}">
        <span class="tr-stat-label">${isImprovement ? '★ New ' : ''}Personal Best</span>
        <span class="tr-pb-result-val">${currentBest.toLocaleString()}</span>
      </div>`
    : '';

  const pageBase = window.location.pathname.includes('mashup-trivia-rush') ? 'mashup-trivia-rush.html' :
                   window.location.pathname.includes('test') ? 'trivia-rush-test.html' : 'trivia-rush.html';
  const isMashup = pageBase === 'mashup-trivia-rush.html';

  const playAgainHref = isMashup
    ? `${pageBase}?themes=${encodeURIComponent(trState.themeSlug)}`
    : `${pageBase}?theme=${trState.themeSlug}`;

  const themeObj = trState.allThemes.find(t => t.slug === trState.themeSlug) || { slug: trState.themeSlug, category: '' };
  const related = (!isMashup && typeof getRelatedThemes === 'function') ? getRelatedThemes(trState.allThemes, themeObj, 4) : [];

  const relatedHtml = isMashup
    ? (() => {
        const mashupThemes = trState.themeSlug.split(',').map(s => trState.allThemes.find(t => t.slug === s.trim())).filter(Boolean);
        if (!mashupThemes.length) return '';
        return `<div class="theme-related-quizzes" style="margin-top:1.5rem">
          <h3>Play Individually</h3>
          <div class="grid">
            ${mashupThemes.map(t => `<a class="card" href="trivia-rush.html?theme=${t.slug}"><h3>${t.title}</h3></a>`).join('')}
          </div>
        </div>`;
      })()
    : `<div class="theme-related-quizzes" style="margin-top:1.5rem">
      <h3>Related Quizzes</h3>
      <div class="grid">
        <a class="card card-mix" href="mashup.html?preset=${trState.themeSlug}&mode=trivia-rush">
          <h3>${trState.themeName} + other themes</h3>
          <span class="card-mix-sub">Play as a mashup</span>
        </a>
        ${related.map(t => `<a class="card" href="${pageBase}?theme=${t.slug}"><h3>${t.title}</h3></a>`).join('')}
      </div>
    </div>`;

  const searchLinkBase = isMashup ? 'trivia-rush.html' : pageBase;

  gameOverBox.innerHTML = `
    <div class="tr-gameover">
      <h2 class="tr-gameover-title">${completed ? 'Rush Complete!' : 'Rush Over'}</h2>
      <div class="tr-final-score">${runScore.toLocaleString()}</div>
      ${!completed && trState.peakScore > 0 ? '<p style="font-size:0.72rem;color:#475569;margin:-8px 0 10px;letter-spacing:0.5px">PEAK SCORE</p>' : ''}
      <div class="tr-final-stats">
        <div class="tr-stat"><span class="tr-stat-label">Accuracy</span><span class="tr-stat-val">${accuracy}%</span></div>
        <div class="tr-stat"><span class="tr-stat-label">Answered</span><span class="tr-stat-val">${trState.totalAnswered}</span></div>
        <div class="tr-stat"><span class="tr-stat-label">Best Streak</span><span class="tr-stat-val">${trState.bestStreak}</span></div>
        <div class="tr-stat"><span class="tr-stat-label">Peak Multi</span><span class="tr-stat-val">x${trState.multiplier}</span></div>
      </div>
      ${pbTile}
      <div class="cta-row" style="margin-top:1.5rem">
        <a class="primary-btn" href="${playAgainHref}">Play Again</a>
        <a class="secondary-btn" href="contact.html">Report a Question</a>
      </div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:1.75rem 0">
      <div class="result-theme-search">
        <p class="result-theme-search-title">Try another theme</p>
        <div class="search-wrap">
          <input id="trResultSearch" class="theme-search-input" type="text" placeholder="Search themes..." autocomplete="off" />
          <div id="trResultSearchResults" class="search-results"></div>
        </div>
      </div>
      ${relatedHtml}
    </div>`;


  const si = document.getElementById('trResultSearch');
  const sr = document.getElementById('trResultSearchResults');
  if (si && sr) {
    const render = items => {
      sr.innerHTML = items.length
        ? items.map(t => `<a class="search-item" href="${searchLinkBase}?theme=${t.slug}">${t.title}</a>`).join('')
        : '<div class="search-item">No results found</div>';
    };
    si.addEventListener('focus', () => { render(trState.allThemes); sr.style.display = 'block'; });
    si.addEventListener('input', e => {
      const v = e.target.value.trim().toLowerCase();
      render(trState.allThemes.filter(t => t.title.toLowerCase().includes(v)));
      sr.style.display = 'block';
    });
    document.addEventListener('click', e => {
      if (!si.contains(e.target) && !sr.contains(e.target)) sr.style.display = 'none';
    });
  }

}

const TR_BADGE_COLORS = [
  { bg: 'rgba(59,130,246,0.15)',  border: '#3b82f6', text: '#93c5fd' },
  { bg: 'rgba(34,197,94,0.12)',   border: '#22c55e', text: '#86efac' },
  { bg: 'rgba(249,115,22,0.15)',  border: '#f97316', text: '#fdba74' },
  { bg: 'rgba(168,85,247,0.15)', border: '#a855f7', text: '#d8b4fe' },
  { bg: 'rgba(236,72,153,0.15)', border: '#ec4899', text: '#f9a8d4' },
];

async function trMashupInit() {
  const loadBox = document.getElementById('trLoadingBox');
  const gamePanel = document.getElementById('trGamePanel');
  if (!loadBox) return;

  const themesParam = getParam('themes');
  if (!themesParam) {
    loadBox.querySelector('p').textContent = 'No themes specified.';
    return;
  }

  const slugs = themesParam.split(',').map(s => s.trim()).filter(Boolean);
  if (slugs.length < 2) {
    window.location.href = 'mashup.html';
    return;
  }

  try {
    const allThemes = await loadThemes();
    const selectedThemes = slugs.map(s => allThemes.find(t => t.slug === s)).filter(Boolean);
    if (selectedThemes.length < 2) {
      window.location.href = 'mashup.html';
      return;
    }

    const allQuestions = [];
    await Promise.all(selectedThemes.map(async (theme) => {
      try {
        const qs = await fetchJSON(theme.questionFile);
        if (Array.isArray(qs)) {
          qs.forEach(q => allQuestions.push(Object.assign({}, q, { _themeSlug: theme.slug, _themeName: theme.title })));
        }
      } catch (e) {}
    }));

    const mashupSlug = selectedThemes.map(t => t.slug).join(',');
    const mashupTitle = selectedThemes.map(t => t.title).join(' + ');
    trState = trMakeState(mashupTitle, mashupSlug, allThemes);
    trState.personalBest = parseInt(localStorage.getItem('trRushBest_' + mashupSlug) || '0', 10);

    trState.themeColorMap = {};
    selectedThemes.forEach((t, i) => {
      trState.themeColorMap[t.slug] = TR_BADGE_COLORS[i % TR_BADGE_COLORS.length];
    });

    TR_DIFF_ORDER.forEach(d => {
      trState.pools[d] = shuffleArray(allQuestions.filter(q => normalizeDifficulty(q.difficulty) === d));
    });

    while (trState.diffIndex < TR_DIFF_ORDER.length &&
           trState.pools[TR_DIFF_ORDER[trState.diffIndex]].length === 0) {
      trState.diffIndex++;
    }

    if (trState.diffIndex >= TR_DIFF_ORDER.length) {
      loadBox.querySelector('p').textContent = 'No questions found for these themes.';
      return;
    }

    trState.currentDiff = TR_DIFF_ORDER[trState.diffIndex];

    const titleEl = document.getElementById('trTitle');
    if (titleEl) titleEl.textContent = mashupTitle;
    document.title = mashupTitle + ' — Trivia Rush | Trivia Gauntlet';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', `Play ${mashupTitle} Trivia Rush on Trivia Gauntlet. Answer fast, build streaks, chase the rush.`);

    const backLink = document.getElementById('trBackLink');
    if (backLink) backLink.href = 'mashup-landing.html?themes=' + encodeURIComponent(mashupSlug);

    const openModal = () => document.getElementById('trHowToModal').classList.add('tr-modal-show');
    document.getElementById('trHowToBtn')?.addEventListener('click', openModal);
    document.getElementById('trStartHowToBtn')?.addEventListener('click', openModal);

    const startThemeEl = document.getElementById('trStartTheme');
    if (startThemeEl) startThemeEl.textContent = 'Mashup · ' + selectedThemes.length + ' themes';

    document.getElementById('trStartBtn')?.addEventListener('click', () => {
      document.getElementById('trStartBox').style.display = 'none';
      gamePanel.style.display = '';
      trUpdateStats();
      trUpdateHeat();
      trNext();
    });

    loadBox.style.display = 'none';
    document.getElementById('trStartBox').style.display = '';

    const startBestElM = document.getElementById('trStartBest');
    if (startBestElM && trState.personalBest > 0) {
      startBestElM.textContent = 'Your best: ' + trState.personalBest.toLocaleString();
      startBestElM.style.display = '';
    }

  } catch (err) {
    loadBox.querySelector('p').textContent = 'Failed to load questions. Please try again.';
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page === 'trivia-rush') trInit();
  else if (document.body.dataset.page === 'mashup-trivia-rush') trMashupInit();
});
