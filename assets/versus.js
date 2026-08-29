// Versus Mode — local multiplayer trivia

const VS_DIFF_ORDER = ['easy', 'medium', 'hard', 'expert'];
const VS_DIFF_POINTS = { easy: 1, medium: 2, hard: 3, expert: 4 };
const VS_PLAYER_COLORS = ['#38bdf8', '#f59e0b', '#34d399', '#f472b6']; // sky, amber, green, pink

// Bot skill presets: chance the computer answers correctly, by question difficulty.
const VS_BOT_PRESETS = {
  easy:   { easy: 0.55, medium: 0.40, hard: 0.25, expert: 0.15 },
  medium: { easy: 0.80, medium: 0.60, hard: 0.40, expert: 0.25 },
  hard:   { easy: 0.95, medium: 0.85, hard: 0.70, expert: 0.55 },
};
const VS_BOT_STEAL_FACTOR = 0.5; // stealing is a blind guess, harder than the first attempt

let vsState = null;
let vsRevealAnswers = false;
let vsSessionUsedIds = new Set(); // persists across games within a tab session
let vsLastPlayerNames = [];       // remember names for Play Again
let vsLastAiMode = false;         // remember vs-AI setup for Play Again
let vsLastBotLevel = 'medium';

function vsBotAccuracy(player, diff, isSteal) {
  const preset = VS_BOT_PRESETS[player.botLevel] || VS_BOT_PRESETS.medium;
  const base = preset[diff] ?? 0.5;
  return isSteal ? base * VS_BOT_STEAL_FACTOR : base;
}

// Simulates the computer's turn: waits a beat, picks an option weighted by
// skill, then submits through the exact same path a human click would.
function vsRunBotTurn(botPlayer, question, optionsEl, submitBtn, isSteal, feedbackEl) {
  if (feedbackEl) {
    feedbackEl.textContent = isSteal ? '🤖 Computer is trying to steal…' : '🤖 Computer is thinking…';
    feedbackEl.className = 'vs-feedback-box vs-bot-thinking';
    feedbackEl.style.display = '';
  }
  const delay = 2200 + Math.random() * 2000; // 2.2–4.2s, so it reads like the bot is actually thinking
  setTimeout(() => {
    const accuracy   = vsBotAccuracy(botPlayer, question._diff, isSteal);
    const candidates = [...optionsEl.querySelectorAll('.option-btn:not(:disabled)')];
    const correctBtn = candidates.find(b => b.textContent === question.answer);
    const wrongBtns  = candidates.filter(b => b.textContent !== question.answer);
    const willBeCorrect = Math.random() < accuracy && correctBtn;
    const chosen = willBeCorrect ? correctBtn : (wrongBtns[Math.floor(Math.random() * wrongBtns.length)] || correctBtn);
    if (chosen) chosen.classList.add('selected');
    if (typeof submitBtn.onclick === 'function') submitBtn.onclick();
  }, delay);
}

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

// Some theme files have duplicate `id`s across genuinely different questions
// (data-authoring bug, not this file's problem to fully fix) — `id` alone
// isn't a safe unique key. Question text alone isn't fully safe either (a
// handful of themes repeat wording). Combining both collapses virtually
// every collision down to true duplicate records, which is fine to treat as
// one question. Matters most for Versus Online, where host and guest build
// their question lookup two different ways and must agree on every id.
function vsQKey(q) {
  return (q.id || '') + '||' + q.question;
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
          const key = vsQKey(q);
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
      const key = vsQKey(q);
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

    if (stealPlayer.isBot) {
      submitBtn.style.display = 'none';
      vsRunBotTurn(stealPlayer, q, optionsEl, submitBtn, true, feedbackEl);
    }
  }

  if (player.isBot) {
    submitBtn.style.display = 'none';
    vsRunBotTurn(player, q, optionsEl, submitBtn, false, feedbackEl);
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

  if (isMidpoint && typeof isAdsRemoved === 'function' && isAdsRemoved()) {
    state.midAdShown = true;
    vsRunNextTurn();
    return;
  }

  if (isMidpoint && typeof isInApp === 'function' && isInApp() && typeof _offerRewardedLifeline === 'function') {
    state.midAdShown = true;
    _offerRewardedLifeline('Continue', vsRunNextTurn, 'Watch a short ad to continue?', vsShowResults);
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

  if (player.isBot) {
    submitBtn.style.display = 'none';
    vsRunBotTurn(player, q, optionsEl, submitBtn, false, feedbackEl);
  }

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

// Resolves the theme(s) for this Versus session from the URL (?theme= or
// ?themes=) against the loaded theme list. Shared by hot-seat and online
// multiplayer setup so both pick questions the same way.
function vsResolveThemeContext(allThemes) {
  const slug = getParam('theme');
  const themesParam = getParam('themes');

  let resolvedThemes = [];
  let gameTitle = 'Versus Mode';
  let backHref = 'index.html';

  if (themesParam) {
    const slugs = themesParam.split(',').map(s => s.trim()).filter(Boolean);
    resolvedThemes = slugs.map(s => allThemes.find(t => t.slug === s)).filter(Boolean);
    if (resolvedThemes.length >= 2) {
      gameTitle = resolvedThemes.map(t => t.title).join(' + ') + ' — Versus';
      backHref = slugs.length <= 5 ? `mashup-landing.html?themes=${themesParam}` : 'index.html';
    }
  } else if (slug) {
    const theme = allThemes.find(t => t.slug === slug);
    if (theme) {
      resolvedThemes = [theme];
      gameTitle = `${theme.title} — Versus Mode`;
      backHref = `themes/${slug}.html`;
    }
  }

  return { resolvedThemes, gameTitle, backHref };
}

// Fetches question files for the resolved theme(s) and builds shuffled
// per-difficulty pools, same shape vsStartGame expects. Shared by hot-seat
// and online multiplayer.
async function vsBuildQuestionPools(resolvedThemes) {
  const batches = await Promise.all(resolvedThemes.map(t => fetchJSON(t.questionFile)));
  const questionsByTheme = batches.map((qs, i) => ({
    title: resolvedThemes[i].title,
    questions: Array.isArray(qs) ? qs : [],
  }));

  const pools = {};
  let themeQueues = null;
  if (resolvedThemes.length > 1) {
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
    const allQuestions = questionsByTheme[0]?.questions || [];
    VS_DIFF_ORDER.forEach(d => {
      pools[d] = shuffleArray(allQuestions.filter(q => normalizeDifficulty(q.difficulty) === d));
    });
  }

  const themeSlug = resolvedThemes.length === 1 ? resolvedThemes[0].slug : null;
  const themeName = resolvedThemes.map(t => t.title).join(' + ');
  const isMashup = resolvedThemes.length > 1;
  return { pools, themeQueues, themeSlug, themeName, isMashup };
}

async function vsInit() {
  if (!document.getElementById('vsSetup')) return;

  const allThemes = await loadThemes();
  const { resolvedThemes, gameTitle, backHref } = vsResolveThemeContext(allThemes);

  const backLink = document.getElementById('vsBackLink');
  if (backLink) backLink.href = backHref;
  document.title = `${gameTitle} | Trivia Gauntlet`;

  // Play mode toggle (online multiplayer vs local pass & play). The online
  // fields/logic live in versus-multiplayer.js — this just switches views.
  const modeSeg = document.getElementById('vsModeSeg');
  const onlineFields = document.getElementById('vsOnlineFields');
  const localFields = document.getElementById('vsLocalFields');
  if (modeSeg) {
    modeSeg.querySelectorAll('button').forEach(btn => {
      if (btn.dataset.val === 'online') btn.classList.add('selected');
      btn.addEventListener('click', () => {
        modeSeg.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const isOnline = btn.dataset.val === 'online';
        onlineFields.style.display = isOnline ? '' : 'none';
        localFields.style.display = isOnline ? 'none' : '';
      });
    });
  }

  if (typeof mpInit === 'function') mpInit(allThemes, resolvedThemes);

  let playerCount = 2;
  let bestOf = 5;
  let aiMode = false;
  let botLevel = 'medium';

  const playerSeg = document.getElementById('vsPlayerCountSeg');
  const botDiffGroup = document.getElementById('vsBotDiffGroup');
  const botDiffSeg = document.getElementById('vsBotDiffSeg');

  playerSeg.querySelectorAll('button').forEach(btn => {
    const isAiBtn = btn.dataset.val === 'ai';
    if ((isAiBtn && aiMode) || (!isAiBtn && !aiMode && parseInt(btn.dataset.val) === playerCount)) {
      btn.classList.add('selected');
    }
    btn.addEventListener('click', () => {
      aiMode = isAiBtn;
      playerCount = isAiBtn ? 2 : parseInt(btn.dataset.val);
      playerSeg.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      botDiffGroup.style.display = aiMode ? '' : 'none';
      renderNameInputs(playerCount);
    });
  });

  botDiffSeg.querySelectorAll('button').forEach(btn => {
    if (btn.dataset.val === botLevel) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      botLevel = btn.dataset.val;
      botDiffSeg.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  function renderNameInputs(count) {
    const wrap = document.getElementById('vsNameInputs');
    const existing = wrap.querySelectorAll('input');
    const vals = [...existing].map(i => i.value);
    wrap.innerHTML = '';
    const inputCount = aiMode ? 1 : count; // in AI mode, only the human needs a name field
    for (let i = 0; i < inputCount; i++) {
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
    const humanNames = [...nameInputs].map(i => i.value.trim() || i.placeholder);
    const names = aiMode ? [...humanNames, 'Computer'] : humanNames;
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

    let pools, themeQueues, themeSlug, themeName, isMashup;
    try {
      ({ pools, themeQueues, themeSlug, themeName, isMashup } = await vsBuildQuestionPools(resolvedThemes));
    } catch(e) {
      errorEl.textContent = 'Could not load questions. Please try again.';
      errorEl.style.display = '';
      return;
    }

    vsLastPlayerNames = names;
    vsLastAiMode = aiMode;
    vsLastBotLevel = botLevel;
    const players = names.map((name, i) => {
      const isBot = aiMode && i === names.length - 1;
      return {
        name,
        score: 0,
        color: VS_PLAYER_COLORS[i % VS_PLAYER_COLORS.length],
        isBot,
        botLevel: isBot ? botLevel : undefined,
      };
    });
    vsStartGame(players, bestOf, pools, themeSlug, themeName, isMashup, themeQueues);
  });

  document.getElementById('vsPlayAgainBtn').addEventListener('click', () => {
    function vsGoSetup() {
      if (vsLastPlayerNames.length > 0) {
        aiMode = vsLastAiMode;
        botLevel = vsLastBotLevel;
        playerCount = aiMode ? 2 : vsLastPlayerNames.length;
        playerSeg.querySelectorAll('button').forEach(btn => {
          const isAiBtn = btn.dataset.val === 'ai';
          btn.classList.toggle('selected', isAiBtn ? aiMode : (!aiMode && parseInt(btn.dataset.val) === playerCount));
        });
        botDiffGroup.style.display = aiMode ? '' : 'none';
        botDiffSeg.querySelectorAll('button').forEach(b => b.classList.toggle('selected', b.dataset.val === botLevel));
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
