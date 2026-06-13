// Versus Mode — local multiplayer trivia

const VS_DIFF_ORDER = ['easy', 'medium', 'hard', 'expert'];
const VS_DIFF_POINTS = { easy: 1, medium: 2, hard: 3, expert: 4 };
const VS_PLAYER_COLORS = ['#38bdf8', '#f59e0b', '#34d399', '#f472b6']; // sky, amber, green, pink

let vsState = null;
let vsRevealAnswers = false;
let vsSessionUsedIds = new Set(); // persists across games within a tab session
let vsLastPlayerNames = [];       // remember names for Play Again

function vsShow(screenId) {
  document.querySelectorAll('.vs-screen').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(screenId);
  if (el) {
    el.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function vsColorBadge(el, color) {
  if (!el) return;
  if (color) {
    el.style.color = color;
    el.style.borderColor = color;
    el.style.background = 'transparent';
  } else {
    el.style.color = '';
    el.style.borderColor = '';
    el.style.background = '';
  }
}

function vsRenderScoreboard(elId, currentIdx) {
  const el = document.getElementById(elId);
  if (!el || !vsState) return;
  el.innerHTML = '';
  vsState.players.forEach((p, i) => {
    const chip = document.createElement('span');
    chip.className = 'vs-score-chip' + (i === currentIdx ? ' current' : '');
    if (p.color) chip.style.borderColor = p.color;
    chip.innerHTML = `<span class="vs-chip-name"${p.color ? ` style="color:${p.color}"` : ''}>${p.name}</span><span class="vs-chip-score">${p.score}</span>`;
    el.appendChild(chip);
  });
}

function vsBuildSchedule(n, hasExpert) {
  const e = hasExpert ? 'expert' : 'hard';
  const schedules = {
    3:  ['easy', 'medium', 'hard'],
    5:  ['easy', 'medium', 'hard', 'hard', e],
    10: ['easy', 'easy', 'medium', 'medium', 'hard', 'hard', 'hard', e, e, e],
  };
  return schedules[n] || schedules[5];
}

function vsDrawQuestion(state, preferredDiff) {
  const diffIndex = VS_DIFF_ORDER.indexOf(preferredDiff);

  if (state.isMashup && state.themeQueues) {
    const numThemes = state.themeQueues.length;
    // Outer: try preferred difficulty first, then fall back
    for (let offset = 0; offset < VS_DIFF_ORDER.length; offset++) {
      const diff = VS_DIFF_ORDER[(diffIndex + offset) % VS_DIFF_ORDER.length];
      // Inner: rotate through themes starting at current index
      for (let t = 0; t < numThemes; t++) {
        const themeIdx = (state.themeRotationIdx + t) % numThemes;
        const pool = state.themeQueues[themeIdx][diff];
        while (pool.length > 0) {
          const q = pool.shift();
          const key = q.id || q.question;
          if (!state.usedIds.has(key)) {
            state.usedIds.add(key);
            vsSessionUsedIds.add(key);
            state.themeRotationIdx = (themeIdx + 1) % numThemes;
            return { ...q, _diff: diff };
          }
        }
      }
    }
    return null;
  }

  for (let offset = 0; offset < VS_DIFF_ORDER.length; offset++) {
    const diff = VS_DIFF_ORDER[(diffIndex + offset) % VS_DIFF_ORDER.length];
    const pool = state.pools[diff];
    while (pool.length > 0) {
      const q = pool.shift();
      const key = q.id || q.question;
      if (!state.usedIds.has(key)) {
        state.usedIds.add(key);
        vsSessionUsedIds.add(key);
        return { ...q, _diff: diff };
      }
    }
  }
  return null;
}

function vsShowQuestion(player, diff, round, numQuestions) {
  const state = vsState;
  const q = vsDrawQuestion(state, diff);
  if (!q) {
    vsAdvanceTurn(player, 0, null);
    return;
  }

  const stealLabelEl = document.getElementById('vsStealLabel');
  const playerEl = document.getElementById('vsQuestionPlayer');
  const questionEl = document.getElementById('vsQuestionText');
  const optionsEl = document.getElementById('vsOptions');
  const feedbackEl = document.getElementById('vsQuestionFeedback');
  const submitBtn = document.getElementById('vsSubmitBtn');
  const nextBtn = document.getElementById('vsNextBtn');
  const progressEl = document.getElementById('vsQuestionProgress');

  stealLabelEl.style.display = 'none';
  vsRenderScoreboard('vsScoreboard', state.currentPlayerIdx);
  playerEl.textContent = player.name;
  vsColorBadge(playerEl, player.color);
  questionEl.textContent = q.question;
  feedbackEl.style.display = 'none';
  submitBtn.style.display = '';
  submitBtn.textContent = 'Submit';
  nextBtn.style.display = 'none';
  progressEl.textContent = `Question ${round + 1} of ${numQuestions}`;

  const themeLabelEl = document.getElementById('vsQuestionTheme');
  if (themeLabelEl) {
    if (state.isMashup && q._themeTitle) {
      themeLabelEl.textContent = q._themeTitle;
      themeLabelEl.style.display = '';
    } else {
      themeLabelEl.style.display = 'none';
    }
  }

  const shuffled = shuffleQuestionOptions(q);
  optionsEl.innerHTML = '';
  shuffled.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      optionsEl.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    optionsEl.appendChild(btn);
  });

  let phase = 'primary';
  let stealPlayer = null;
  let missedBtn = null;

  submitBtn.onclick = () => {
    const sel = optionsEl.querySelector('.option-btn.selected');
    if (!sel) return;

    const isCorrect = sel.textContent === q.answer;
    optionsEl.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
    submitBtn.style.display = 'none';

    if (phase === 'primary') {
      if (typeof webAddQ === 'function') webAddQ(1);
      if (isCorrect) {
        const points = VS_DIFF_POINTS[q._diff] || 1;
        sel.classList.add('correct-anim');
        feedbackEl.textContent = 'Correct!';
        feedbackEl.className = 'vs-feedback-box correct';
        feedbackEl.style.display = '';
        if (typeof SoundFX !== 'undefined') SoundFX.play('correct');
        nextBtn.style.display = '';
        nextBtn.onclick = () => vsAdvanceTurn(player, points, null);
      } else {
        sel.classList.add('wrong-anim');
        missedBtn = sel;
        feedbackEl.textContent = 'Missed!';
        feedbackEl.className = 'vs-feedback-box wrong';
        feedbackEl.style.display = '';
        if (typeof SoundFX !== 'undefined') SoundFX.play('wrong');
        setTimeout(vsSetupSteal, 700);
      }
    } else {
      if (isCorrect) {
        sel.classList.add('correct-anim');
        feedbackEl.textContent = `${stealPlayer.name} steals 1 pt!`;
        feedbackEl.className = 'vs-feedback-box correct';
        if (typeof SoundFX !== 'undefined') SoundFX.play('correct');
        nextBtn.onclick = () => vsAdvanceTurn(player, 0, { player: stealPlayer, success: true });
      } else {
        sel.classList.add('wrong-anim');
        feedbackEl.textContent = vsRevealAnswers ? `Steal missed! The correct answer is ${q.answer}.` : 'Steal missed!';
        feedbackEl.className = 'vs-feedback-box wrong';
        if (typeof SoundFX !== 'undefined') SoundFX.play('wrong');
        nextBtn.onclick = () => vsAdvanceTurn(player, 0, { player: stealPlayer, success: false });
      }
      feedbackEl.style.display = '';
      nextBtn.style.display = '';
    }
  };

  function vsSetupSteal() {
    const stealIdx = (state.currentPlayerIdx + 1) % state.players.length;
    stealPlayer = state.players[stealIdx];
    phase = 'steal';

    stealLabelEl.textContent = `Steal opportunity for ${stealPlayer.name} — 1 pt`;
    stealLabelEl.style.display = '';
    playerEl.textContent = stealPlayer.name;
    vsColorBadge(playerEl, stealPlayer.color);
    feedbackEl.style.display = 'none';

    optionsEl.querySelectorAll('.option-btn').forEach(b => {
      if (b === missedBtn) {
        b.disabled = true;
        // keep wrong-anim to show what was already tried
      } else {
        b.disabled = false;
        b.classList.remove('selected', 'correct-anim');
      }
    });

    submitBtn.textContent = 'Steal';
    submitBtn.style.display = '';
  }

  vsShow('vsQuestion');
}

function vsAdvanceTurn(player, points, stealInfo) {
  const state = vsState;
  player.score += points;
  if (stealInfo && stealInfo.success) {
    stealInfo.player.score += 1;
  }

  const totalPlayers = state.players.length;
  state.currentPlayerIdx++;
  if (state.currentPlayerIdx >= totalPlayers) {
    state.currentPlayerIdx = 0;
    state.currentRound++;
  }

  const isLastRound = state.currentRound >= state.numQuestions;

  if (isLastRound) {
    vsShowResults();
    return;
  }

  const isMidpoint = state.currentPlayerIdx === 0
    && state.currentRound === Math.ceil(state.numQuestions / 2)
    && !state.midAdShown;

  if (isMidpoint && typeof isInApp === 'function' && isInApp()) {
    state.midAdShown = true;
    const adOverlay = document.createElement('div');
    adOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px';
    adOverlay.innerHTML = `
      <div style="background:#1e1e2e;padding:24px 20px;border-radius:14px;text-align:center;max-width:280px;width:100%;color:#fff">
        <p style="margin:0 0 16px;font-size:1em">Watch a short ad to continue?</p>
        <button id="_vsMidAdYes" style="width:100%;padding:12px;border-radius:8px;background:#6c63ff;color:#fff;border:none;cursor:pointer;font-size:1em;margin-bottom:8px">Yes</button>
        <button id="_vsMidAdNo" style="width:100%;padding:10px;border-radius:8px;background:#2d2d3d;color:#94a3b8;border:none;cursor:pointer;font-size:0.9em">No</button>
      </div>`;
    document.body.appendChild(adOverlay);

    document.getElementById('_vsMidAdNo').addEventListener('click', () => {
      adOverlay.remove();
      vsShowResults();
    });

    document.getElementById('_vsMidAdYes').addEventListener('click', async () => {
      adOverlay.remove();
      if (typeof adMobShowRewarded === 'function') {
        const earned = await adMobShowRewarded();
        if (!earned) { vsShowResults(); return; }
      }
      vsRunNextTurn();
    });
    return;
  }

  vsRunNextTurn();
}

function vsRunNextTurn() {
  const state = vsState;
  const { currentRound, currentPlayerIdx, numQuestions, schedule } = state;

  if (currentRound >= numQuestions) {
    vsShowResults();
    return;
  }

  const player = state.players[currentPlayerIdx];
  const diff = schedule[currentRound] || 'medium';
  vsShowQuestion(player, diff, currentRound, numQuestions);
}

function vsBuildLeaderboard(players, winnerIndexes) {
  const sorted = [...players]
    .map((p, i) => ({ ...p, originalIndex: i }))
    .sort((a, b) => b.score - a.score);

  const ul = document.getElementById('vsLeaderboard');
  ul.innerHTML = '';
  const medals = ['🥇', '🥈', '🥉'];
  sorted.forEach((p, rank) => {
    const li = document.createElement('li');
    if (winnerIndexes.includes(p.originalIndex)) li.classList.add('vs-winner');
    li.innerHTML = `
      <span class="vs-rank">${medals[rank] || rank + 1}</span>
      <span class="vs-player-name"${p.color ? ` style="color:${p.color}"` : ''}>${p.name}</span>
      <span class="vs-player-score">${p.score} pt${p.score !== 1 ? 's' : ''}</span>
    `;
    ul.appendChild(li);
  });
}

function vsShowResults() {
  const players = vsState.players;
  const maxScore = Math.max(...players.map(p => p.score));
  const winnerIndexes = players
    .map((p, i) => ({ score: p.score, i }))
    .filter(p => p.score === maxScore)
    .map(p => p.i);

  vsBuildLeaderboard(players, winnerIndexes);

  const titleEl = document.getElementById('vsResultsTitle');
  const subtitleEl = document.getElementById('vsResultsSubtitle');
  const tiebreakerOffer = document.getElementById('vsTiebreakerOffer');

  if (winnerIndexes.length === 1) {
    titleEl.textContent = `${players[winnerIndexes[0]].name} wins!`;
    subtitleEl.textContent = `${maxScore} point${maxScore !== 1 ? 's' : ''}`;
    tiebreakerOffer.style.display = 'none';
  } else {
    const isRepeatTie = vsState.tiebreakerPlayers && vsState.tiebreakerPlayers.length > 0;
    titleEl.textContent = "Still a tie!";
    subtitleEl.textContent = winnerIndexes.map(i => players[i].name).join(' and ') + ` are level at ${maxScore} pts`;
    const offerText = document.getElementById('vsTiebreakerOfferText');
    if (offerText) offerText.textContent = isRepeatTie ? 'Still level — another tiebreaker?' : 'Would you like a tiebreaker question?';
    tiebreakerOffer.style.display = '';
  }

  const backBtn = document.getElementById('vsBackToThemeBtn');
  const backHref = document.getElementById('vsBackLink')?.href;
  if (backHref && !backHref.endsWith('index.html')) {
    backBtn.href = backHref;
    backBtn.textContent = 'Back';
    backBtn.style.display = '';
  } else {
    backBtn.style.display = 'none';
  }

  vsShow('vsResults');
}

function vsStartTiebreaker() {
  const players = vsState.players;
  const maxScore = Math.max(...players.map(p => p.score));
  const tiedIndexes = players
    .map((p, i) => ({ score: p.score, i }))
    .filter(p => p.score === maxScore)
    .map(p => p.i);

  vsState.tiebreakerPlayers = tiedIndexes;
  vsState.tiebreakerScores = {};
  tiedIndexes.forEach(i => { vsState.tiebreakerScores[i] = 0; });
  vsState.tiebreakerIndex = 0;
  vsNextTiebreakerTurn();
}

function vsNextTiebreakerTurn() {
  const state = vsState;
  const idx = state.tiebreakerPlayers[state.tiebreakerIndex];
  const player = state.players[idx];

  const q = vsDrawQuestion(state, 'medium') || vsDrawQuestion(state, 'easy') || vsDrawQuestion(state, 'hard');
  if (!q) {
    vsDeclareDraw();
    return;
  }

  const progressEl = document.getElementById('vsTbProgress');
  const playerEl = document.getElementById('vsTbPlayer');
  const questionEl = document.getElementById('vsTbQuestion');
  const optionsEl = document.getElementById('vsTbOptions');
  const feedbackEl = document.getElementById('vsTbFeedback');
  const submitBtn = document.getElementById('vsTbSubmitBtn');
  const nextBtn = document.getElementById('vsTbNextBtn');

  vsRenderScoreboard('vsTbScoreboard', idx);
  progressEl.textContent = `Player ${state.tiebreakerIndex + 1} of ${state.tiebreakerPlayers.length}`;
  playerEl.textContent = player.name;
  vsColorBadge(playerEl, player.color);
  questionEl.textContent = q.question;
  feedbackEl.style.display = 'none';
  submitBtn.style.display = '';
  nextBtn.style.display = 'none';

  const shuffled = shuffleQuestionOptions(q);
  optionsEl.innerHTML = '';
  shuffled.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      optionsEl.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    optionsEl.appendChild(btn);
  });

  let answered = false;
  submitBtn.onclick = () => {
    if (answered) return;
    const sel = optionsEl.querySelector('.option-btn.selected');
    if (!sel) return;
    answered = true;
    if (typeof webAddQ === 'function') webAddQ(1);

    const isCorrect = sel.textContent === q.answer;
    optionsEl.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
    submitBtn.style.display = 'none';

    if (isCorrect) {
      sel.classList.add('correct-anim');
      state.tiebreakerScores[idx] += 1;
      feedbackEl.textContent = 'Correct!';
      feedbackEl.className = 'vs-feedback-box correct';
      if (typeof SoundFX !== 'undefined') SoundFX.play('correct');
    } else {
      sel.classList.add('wrong-anim');
      feedbackEl.textContent = 'Missed!';
      feedbackEl.className = 'vs-feedback-box wrong';
      if (typeof SoundFX !== 'undefined') SoundFX.play('wrong');
    }
    feedbackEl.style.display = '';
    nextBtn.style.display = '';
    nextBtn.onclick = () => {
      state.tiebreakerIndex++;
      if (state.tiebreakerIndex < state.tiebreakerPlayers.length) {
        vsNextTiebreakerTurn();
      } else {
        vsTiebreakerResults();
      }
    };
  };

  vsShow('vsTiebreaker');
}

function vsTiebreakerResults() {
  const state = vsState;
  const maxTb = Math.max(...Object.values(state.tiebreakerScores));
  const winnerIndexes = state.tiebreakerPlayers.filter(i => state.tiebreakerScores[i] === maxTb);

  state.tiebreakerPlayers.forEach(i => {
    state.players[i].score += state.tiebreakerScores[i];
  });

  const titleEl = document.getElementById('vsResultsTitle');
  const subtitleEl = document.getElementById('vsResultsSubtitle');
  const tiebreakerOffer = document.getElementById('vsTiebreakerOffer');

  if (winnerIndexes.length === 1) {
    titleEl.textContent = `${state.players[winnerIndexes[0]].name} wins the tiebreaker!`;
    subtitleEl.textContent = 'After the tiebreaker round';
    tiebreakerOffer.style.display = 'none';
    vsBuildLeaderboard(state.players, winnerIndexes);
    const backBtn = document.getElementById('vsBackToThemeBtn');
    const backHref = document.getElementById('vsBackLink')?.href;
    if (backHref && !backHref.endsWith('index.html')) {
      backBtn.href = backHref;
      backBtn.textContent = 'Back';
      backBtn.style.display = '';
    } else {
      backBtn.style.display = 'none';
    }
    vsShow('vsResults');
  } else {
    // Still tied — let vsShowResults re-detect the tie and offer another tiebreaker
    vsShowResults();
  }
}

function vsDeclareDraw() {
  const players = vsState.players;
  const maxScore = Math.max(...players.map(p => p.score));
  const tiedAll = players.map((_, i) => i).filter(i => players[i].score === maxScore);

  document.getElementById('vsResultsTitle').textContent = "It's a draw!";
  document.getElementById('vsResultsSubtitle').textContent = "Perfectly matched";
  document.getElementById('vsTiebreakerOffer').style.display = 'none';
  vsBuildLeaderboard(players, tiedAll);
  vsShow('vsResults');
}

function vsStartGame(players, numQuestions, pools, themeSlug, themeName, isMashup, themeQueues) {
  const hasExpert = themeQueues
    ? themeQueues.some(tq => (tq.expert || []).length > 0)
    : (pools.expert || []).length > 0;
  vsState = {
    players,
    numQuestions,
    pools,
    themeQueues: themeQueues || null,
    themeRotationIdx: 0,
    themeSlug,
    themeName,
    isMashup: !!isMashup,
    usedIds: new Set(vsSessionUsedIds),
    schedule: vsBuildSchedule(numQuestions, hasExpert),
    currentRound: 0,
    currentPlayerIdx: 0,
  };
  vsRunNextTurn();
}

async function vsInit() {
  if (!document.getElementById('vsSetup')) return;

  const slug = getParam('theme');
  const themesParam = getParam('themes');
  const allThemes = await loadThemes();

  // Resolve theme(s) and back link
  let resolvedThemes = [];
  let gameTitle = 'Versus Mode';
  let backHref = 'index.html';

  if (themesParam) {
    const slugs = themesParam.split(',').map(s => s.trim()).filter(Boolean);
    resolvedThemes = slugs.map(s => allThemes.find(t => t.slug === s)).filter(Boolean);
    if (resolvedThemes.length >= 2) {
      gameTitle = resolvedThemes.map(t => t.title).join(' + ') + ' — Versus';
      backHref = `mashup-landing.html?themes=${themesParam}`;
    }
  } else if (slug) {
    const theme = allThemes.find(t => t.slug === slug);
    if (theme) {
      resolvedThemes = [theme];
      gameTitle = `${theme.title} — Versus Mode`;
      backHref = `themes/${slug}.html`;
    }
  }

  const backLink = document.getElementById('vsBackLink');
  if (backLink) backLink.href = backHref;
  document.title = `${gameTitle} | Trivia Gauntlet`;

  let playerCount = 2;
  let bestOf = 5;

  const playerSeg = document.getElementById('vsPlayerCountSeg');
  playerSeg.querySelectorAll('button').forEach(btn => {
    if (parseInt(btn.dataset.val) === playerCount) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      playerCount = parseInt(btn.dataset.val);
      playerSeg.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      renderNameInputs(playerCount);
    });
  });

  function renderNameInputs(count) {
    const wrap = document.getElementById('vsNameInputs');
    const existing = wrap.querySelectorAll('input');
    const vals = [...existing].map(i => i.value);
    wrap.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.placeholder = `Player ${i + 1}`;
      inp.maxLength = 20;
      inp.value = vals[i] || vsLastPlayerNames[i] || '';
      wrap.appendChild(inp);
    }
  }
  renderNameInputs(playerCount);

  const bestOfSeg = document.getElementById('vsBestOfSeg');
  const bestOfNote = document.getElementById('vsBestOfNote');

  function updateBestOfNote(n) {
    bestOfNote.textContent = `Each player answers ${n} question${n !== 1 ? 's' : ''}. Miss one and the next player can steal it for 1 pt.`;
  }

  bestOfSeg.querySelectorAll('button').forEach(btn => {
    if (parseInt(btn.dataset.val) === bestOf) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      bestOf = parseInt(btn.dataset.val);
      bestOfSeg.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      updateBestOfNote(bestOf);
    });
  });
  updateBestOfNote(bestOf);

  document.getElementById('vsStartBtn').addEventListener('click', async () => {
    const errorEl = document.getElementById('vsSetupError');
    const nameInputs = document.querySelectorAll('#vsNameInputs input');
    const names = [...nameInputs].map(i => i.value.trim() || i.placeholder);
    const unique = new Set(names.map(n => n.toLowerCase()));
    if (unique.size < names.length) {
      errorEl.textContent = 'Player names must be unique.';
      errorEl.style.display = '';
      return;
    }
    if (!resolvedThemes.length) {
      errorEl.textContent = 'No theme found. Please go back and select a theme.';
      errorEl.style.display = '';
      return;
    }
    errorEl.style.display = 'none';

    // Load questions from all resolved themes
    let questionsByTheme = [];
    try {
      const batches = await Promise.all(resolvedThemes.map(t => fetchJSON(t.questionFile)));
      questionsByTheme = batches.map((qs, i) => ({
        title: resolvedThemes[i].title,
        questions: Array.isArray(qs) ? qs : [],
      }));
    } catch(e) {
      errorEl.textContent = 'Could not load questions. Please try again.';
      errorEl.style.display = '';
      return;
    }

    const pools = {};
    let themeQueues = null;
    if (resolvedThemes.length > 1) {
      // Mashup: build per-theme, per-difficulty queues for even rotation across questions
      themeQueues = questionsByTheme.map(({ title, questions }) => {
        const byDiff = {};
        VS_DIFF_ORDER.forEach(d => {
          byDiff[d] = shuffleArray(questions.filter(q => normalizeDifficulty(q.difficulty) === d))
            .map(q => ({ ...q, _themeTitle: title }));
        });
        return byDiff;
      });
      VS_DIFF_ORDER.forEach(d => { pools[d] = []; });
    } else {
      // Single theme: flat shuffle as before
      const allQuestions = questionsByTheme[0]?.questions || [];
      VS_DIFF_ORDER.forEach(d => {
        pools[d] = shuffleArray(allQuestions.filter(q => normalizeDifficulty(q.difficulty) === d));
      });
    }

    const themeSlug = resolvedThemes.length === 1 ? resolvedThemes[0].slug : null;
    const themeName = resolvedThemes.map(t => t.title).join(' + ');
    const isMashup = resolvedThemes.length > 1;
    vsLastPlayerNames = names;
    const players = names.map((name, i) => ({ name, score: 0, color: VS_PLAYER_COLORS[i % VS_PLAYER_COLORS.length] }));
    vsStartGame(players, bestOf, pools, themeSlug, themeName, isMashup, themeQueues);
  });

  document.getElementById('vsPlayAgainBtn').addEventListener('click', () => {
    function vsGoSetup() {
      if (vsLastPlayerNames.length > 0) {
        playerCount = vsLastPlayerNames.length;
        playerSeg.querySelectorAll('button').forEach(btn => {
          btn.classList.toggle('selected', parseInt(btn.dataset.val) === playerCount);
        });
        renderNameInputs(playerCount);
      }
      vsShow('vsSetup');
    }

    vsGoSetup();
  });

  if (isPremiumUser()) {
    const revealBtn = document.getElementById('vsRevealToggle');
    if (revealBtn) {
      revealBtn.style.display = '';
      revealBtn.addEventListener('click', () => {
        vsRevealAnswers = !vsRevealAnswers;
        revealBtn.className = vsRevealAnswers ? 'primary-btn reveal-answers-toggle' : 'secondary-btn reveal-answers-toggle';
        revealBtn.textContent = vsRevealAnswers ? 'Reveal Answers: ON' : 'Reveal Answers: OFF';
      });
    }
  }

  document.getElementById('vsTiebreakerYes').addEventListener('click', vsStartTiebreaker);
  document.getElementById('vsTiebreakerNo').addEventListener('click', vsDeclareDraw);
}

document.addEventListener('DOMContentLoaded', vsInit);
