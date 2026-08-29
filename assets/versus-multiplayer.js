// Versus Mode — real-time online multiplayer (Create/Join a room).
// Client-trusted, poll-based (same Supabase project + REST pattern as
// leaderboard.js — no Realtime channels, no Edge Function). See
// supabase/multiplayer-rooms.sql for the two tables this talks to.
//
// Reuses from versus.js: VS_PLAYER_COLORS, vsBuildSchedule, vsDrawQuestion,
// vsBuildLeaderboard, vsShow, vsSessionUsedIds, vsBuildQuestionPools.

const MP_URL = "https://avasbapxzgmpcosixgio.supabase.co";
const MP_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YXNiYXB4emdtcGNvc2l4Z2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjM4MzUsImV4cCI6MjA5NTIzOTgzNX0.DLNnasmaQ1hdKXb2xqXrTBnBjISo0RxOiwy7TrlN9bg";

const MP_POLL_MS = 1500;
const MP_ROUND_SECONDS = 30;
const MP_DISCONNECT_MS = 15000;
const MP_TIEBREAK_BUFFER = 5;      // extra sudden-death questions drawn in case of a tie after regulation
const MP_REVEAL_PAUSE_MS = 2500;
const MP_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L — easy to read aloud

let mpAllThemes = [];
let mpRoom = null;
let mpPollTimer = null;

function mpPlayerId() {
  let id = localStorage.getItem('tg_player_id');
  if (!id) {
    id = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    localStorage.setItem('tg_player_id', id);
  }
  return id;
}

function mpMyId()  { return mpRoom.role === 'host' ? mpRoom.hostId : mpRoom.guestId; }
function mpOppId() { return mpRoom.role === 'host' ? mpRoom.guestId : mpRoom.hostId; }

function mpGenCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += MP_CODE_CHARS[Math.floor(Math.random() * MP_CODE_CHARS.length)];
  return code;
}

async function mpGet(path) {
  const res = await fetch(`${MP_URL}/rest/v1/${path}`, {
    headers: { apikey: MP_KEY, Authorization: `Bearer ${MP_KEY}` }
  });
  if (!res.ok) throw new Error(`mp GET ${res.status}`);
  return res.json();
}

async function mpPost(path, body) {
  const res = await fetch(`${MP_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: MP_KEY, Authorization: `Bearer ${MP_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=representation'
    },
    body: JSON.stringify(body)
  });
  return { ok: res.ok, status: res.status, data: res.ok ? await res.json() : [] };
}

async function mpPatch(path, body) {
  const res = await fetch(`${MP_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      apikey: MP_KEY, Authorization: `Bearer ${MP_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=representation'
    },
    body: JSON.stringify(body)
  });
  return { ok: res.ok, status: res.status, data: res.ok ? await res.json() : [] };
}

async function mpDelete(path) {
  const res = await fetch(`${MP_URL}/rest/v1/${path}`, {
    method: 'DELETE',
    headers: { apikey: MP_KEY, Authorization: `Bearer ${MP_KEY}` }
  });
  return res.ok;
}

// ── Setup screen wiring ──────────────────────────────────────────────────

function mpInit(allThemes, resolvedThemes) {
  mpAllThemes = allThemes;

  const nameInput = document.getElementById('vsMpName');
  const savedName = localStorage.getItem('tg_mp_name');
  if (savedName) nameInput.value = savedName;

  let mpBestOf = 5;
  const bestOfSeg = document.getElementById('vsMpBestOfSeg');
  bestOfSeg.querySelectorAll('button').forEach(btn => {
    if (parseInt(btn.dataset.val) === mpBestOf) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      mpBestOf = parseInt(btn.dataset.val);
      bestOfSeg.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  const errorEl = document.getElementById('vsMpError');
  const showMpError = (msg) => { errorEl.textContent = msg; errorEl.style.display = ''; };
  const clearMpError = () => { errorEl.style.display = 'none'; };

  const createBtn = document.getElementById('vsMpCreateBtn');
  createBtn.addEventListener('click', async () => {
    clearMpError();
    const name = nameInput.value.trim() || 'Player 1';
    localStorage.setItem('tg_mp_name', name);
    if (!resolvedThemes.length) {
      showMpError('No theme selected — please go back and pick a theme first.');
      return;
    }
    createBtn.disabled = true;
    try {
      await mpCreateRoom(resolvedThemes, mpBestOf, name);
    } catch (e) {
      showMpError(e.message || 'Could not create a room. Please try again.');
    } finally {
      createBtn.disabled = false;
    }
  });

  document.getElementById('vsMpShowJoinBtn').addEventListener('click', () => {
    document.getElementById('vsMpJoinFields').style.display = '';
  });

  const topBanner = document.getElementById('vsMpAppBanner');
  if (topBanner && typeof lobbyAppBannerHTML === 'function') topBanner.innerHTML = lobbyAppBannerHTML();

  // A shared invite link (?mpJoin=CODE) works from any theme's Versus page —
  // joining doesn't depend on the theme resolved for this page load, only on
  // the room's own stored theme(s). Prefill and jump straight to the code.
  const joinParam = getParam('mpJoin');
  if (joinParam) {
    document.getElementById('vsMpJoinFields').style.display = '';
    document.getElementById('vsMpCodeInput').value = joinParam.toUpperCase();
    nameInput.focus();
  }

  const joinBtn = document.getElementById('vsMpJoinBtn');
  joinBtn.addEventListener('click', async () => {
    clearMpError();
    const name = nameInput.value.trim() || 'Player 2';
    localStorage.setItem('tg_mp_name', name);
    const code = document.getElementById('vsMpCodeInput').value.trim().toUpperCase();
    if (!code) { showMpError('Enter a room code.'); return; }
    joinBtn.disabled = true;
    try {
      await mpJoinRoom(code, name);
    } catch (e) {
      showMpError(e.message || 'Could not join that room.');
    } finally {
      joinBtn.disabled = false;
    }
  });

  document.getElementById('vsMpCopyLinkBtn').addEventListener('click', mpCopyInviteLink);
  document.getElementById('vsMpCancelBtn').addEventListener('click', mpCancelWaiting);
  document.getElementById('vsMpLeaveBtn').addEventListener('click', mpLeaveMatch);

  document.getElementById('vsMpPlayAgainBtn').addEventListener('click', mpPlayAgain);
  document.getElementById('vsMpBackBtn').addEventListener('click', () => {
    mpTeardown();
    const backHref = document.getElementById('vsBackLink')?.href;
    window.location.href = backHref || 'index.html';
  });
}

// ── Create / join ────────────────────────────────────────────────────────

// Draws a fresh question set for `resolvedThemes` — used both for the initial
// room creation and for a same-room rematch (mpPlayAgain), which just needs a
// new set of ids for the same theme(s).
async function mpDrawQuestionSet(resolvedThemes, bestOf) {
  const { pools, themeQueues, isMashup } = await vsBuildQuestionPools(resolvedThemes);

  const hasExpert = isMashup
    ? themeQueues.some(tq => (tq.expert || []).length > 0)
    : (pools.expert || []).length > 0;
  const schedule = vsBuildSchedule(bestOf, hasExpert);
  const bufferDiffs = Array(MP_TIEBREAK_BUFFER).fill(hasExpert ? 'expert' : 'hard');
  const drawState = isMashup
    ? { pools, usedIds: new Set(vsSessionUsedIds), isMashup: true, themeQueues, themeRotationIdx: 0 }
    : { pools, usedIds: new Set(vsSessionUsedIds) };

  const questionIds = [];
  const questionMap = new Map();
  for (const diff of [...schedule, ...bufferDiffs]) {
    const q = vsDrawQuestion(drawState, diff);
    if (!q) break;
    const key = vsQKey(q);
    questionIds.push(key);
    questionMap.set(key, q);
  }
  if (questionIds.length < bestOf) {
    throw new Error("This theme doesn't have enough questions for online play.");
  }
  return { questionIds, questionMap };
}

async function mpCreateRoom(resolvedThemes, bestOf, name) {
  const { questionIds, questionMap } = await mpDrawQuestionSet(resolvedThemes, bestOf);

  const themeSlugs = resolvedThemes.map(t => t.slug).join(',');
  let code, insertRes;
  for (let attempt = 0; attempt < 5; attempt++) {
    code = mpGenCode();
    insertRes = await mpPost('multiplayer_rooms', {
      code, theme_slugs: themeSlugs, best_of: bestOf, question_ids: questionIds,
      host_id: mpPlayerId(), host_name: name, status: 'waiting'
    });
    if (insertRes.ok) break;
  }
  if (!insertRes.ok) throw new Error('Could not create a room right now — please try again.');

  mpRoom = {
    code, role: 'host', bestOf, questionIds, questionMap, resolvedThemes,
    hostId: mpPlayerId(), guestId: null,
    myName: name, oppName: null,
    currentRound: 0, myScore: 0, oppScore: 0,
    answeredThisRound: false, roundResolved: false,
  };

  document.getElementById('vsMpRoomCode').textContent = code;
  document.getElementById('vsMpWaitingStatus').textContent = 'Waiting for them to join…';
  vsShow('vsMpWaiting');
  mpPollTimer = setInterval(mpPollWaiting, MP_POLL_MS);
}

async function mpPollWaiting() {
  if (!mpRoom) return;
  try {
    const rows = await mpGet(`multiplayer_rooms?code=eq.${mpRoom.code}&select=guest_id,guest_name,status,round_started_at`);
    const row = rows[0];
    if (!row || row.status === 'abandoned') return;
    if (row.guest_id) {
      clearInterval(mpPollTimer);
      mpRoom.guestId = row.guest_id;
      mpRoom.oppName = row.guest_name;
      mpRoom.roundStartedAt = row.round_started_at;
      mpBeginMatch();
    }
  } catch (e) { /* transient — next tick retries */ }
}

function mpInviteLink(code) {
  return `${location.origin}${location.pathname}?mpJoin=${code}`;
}

async function mpCopyInviteLink() {
  if (!mpRoom) return;
  const link = mpInviteLink(mpRoom.code);
  const btn = document.getElementById('vsMpCopyLinkBtn');
  const original = btn.textContent;
  const done = () => { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = original; }, 1800); };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(link).then(done).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = link; ta.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove(); done();
    });
  }
}

async function mpCancelWaiting() {
  if (mpPollTimer) clearInterval(mpPollTimer);
  if (mpRoom) {
    try { await mpPatch(`multiplayer_rooms?code=eq.${mpRoom.code}`, { status: 'abandoned' }); } catch (e) {}
  }
  mpRoom = null;
  vsShow('vsSetup');
}

async function mpJoinRoom(code, name) {
  const rows = await mpGet(`multiplayer_rooms?code=eq.${code}&select=*`);
  const room = rows[0];
  if (!room) throw new Error('No room found with that code.');
  if (room.guest_id) throw new Error('That room is already full.');
  if (room.status !== 'waiting') throw new Error('That room is no longer accepting players.');

  const slugs = room.theme_slugs.split(',').map(s => s.trim()).filter(Boolean);
  const themes = slugs.map(s => mpAllThemes.find(t => t.slug === s)).filter(Boolean);
  if (!themes.length) throw new Error("Could not load that room's theme.");
  const batches = await Promise.all(themes.map(t => fetchJSON(t.questionFile)));
  const questionMap = new Map();
  batches.forEach((qs, i) => {
    (Array.isArray(qs) ? qs : []).forEach(q => {
      const entry = themes.length > 1 ? { ...q, _themeTitle: themes[i].title } : q;
      questionMap.set(vsQKey(q), entry);
    });
  });

  const nowIso = new Date().toISOString();
  const patchRes = await mpPatch(
    `multiplayer_rooms?code=eq.${code}&guest_id=is.null`,
    { guest_id: mpPlayerId(), guest_name: name, status: 'active', current_round: 0, round_started_at: nowIso }
  );
  if (!patchRes.ok || !patchRes.data.length) throw new Error('That room was just taken by someone else.');

  const updated = patchRes.data[0];
  mpRoom = {
    code, role: 'guest', bestOf: updated.best_of, questionIds: updated.question_ids, questionMap,
    resolvedThemes: themes, hasFullMap: true, // built from the full theme batches above, so any future id resolves
    hostId: updated.host_id, guestId: mpPlayerId(),
    myName: name, oppName: updated.host_name,
    currentRound: 0, myScore: 0, oppScore: 0,
    answeredThisRound: false, roundResolved: false,
    roundStartedAt: updated.round_started_at,
  };
  mpBeginMatch();
}

// A host's questionMap only ever holds the ids it personally drew. If the
// opponent wins a rematch's redraw race, the host needs to resolve ids it
// never drew itself — fetch the full theme batch(es) once, same as a guest
// already gets at join time.
async function mpEnsureFullQuestionMap() {
  if (!mpRoom || mpRoom.hasFullMap) return;
  const batches = await Promise.all(mpRoom.resolvedThemes.map(t => fetchJSON(t.questionFile)));
  batches.forEach((qs, i) => {
    (Array.isArray(qs) ? qs : []).forEach(q => {
      const entry = mpRoom.resolvedThemes.length > 1 ? { ...q, _themeTitle: mpRoom.resolvedThemes[i].title } : q;
      const key = vsQKey(q);
      if (!mpRoom.questionMap.has(key)) mpRoom.questionMap.set(key, entry);
    });
  });
  mpRoom.hasFullMap = true;
}

// ── Match loop ───────────────────────────────────────────────────────────

function mpBeginMatch() {
  vsShow('vsMpQuestion');
  mpRenderRound();
  mpPollTimer = setInterval(mpPollActive, MP_POLL_MS);
}

function mpRenderScoreboard() {
  const el = document.getElementById('vsMpScoreboard');
  if (!el || !mpRoom) return;
  el.innerHTML = '';
  [
    { name: mpRoom.myName, score: mpRoom.myScore, color: VS_PLAYER_COLORS[0] },
    { name: mpRoom.oppName || 'Opponent', score: mpRoom.oppScore, color: VS_PLAYER_COLORS[1] },
  ].forEach(p => {
    const chip = document.createElement('span');
    chip.className = 'vs-score-chip current';
    chip.style.borderColor = p.color;
    chip.innerHTML = `<span class="vs-chip-name" style="color:${p.color}">${p.name}</span><span class="vs-chip-score">${p.score}</span>`;
    el.appendChild(chip);
  });
}

function mpRenderRound() {
  const round = mpRoom.currentRound;
  const qId = mpRoom.questionIds[round];
  const q = mpRoom.questionMap.get(qId);

  if (!q) { mpFinishMatch(); return; } // buffer exhausted while still tied — treat as a draw

  mpRoom.answeredThisRound = false;
  mpRoom.roundResolved = false;
  mpRoom.roundDeadline = mpRoom.roundStartedAt
    ? new Date(mpRoom.roundStartedAt).getTime() + MP_ROUND_SECONDS * 1000
    : Date.now() + MP_ROUND_SECONDS * 1000;

  document.getElementById('vsMpDisconnectBanner').style.display = 'none';
  const isSuddenDeath = round >= mpRoom.bestOf;
  document.getElementById('vsMpTiebreakerLabel').style.display = isSuddenDeath ? '' : 'none';
  document.getElementById('vsMpProgress').textContent = isSuddenDeath
    ? `Tied — decider round ${round - mpRoom.bestOf + 1}`
    : `Question ${round + 1} of ${mpRoom.bestOf}`;
  mpRenderScoreboard();

  const textEl = document.getElementById('vsMpQuestionText');
  const optionsEl = document.getElementById('vsMpOptions');
  const feedbackEl = document.getElementById('vsMpFeedback');
  const themeLabelEl = document.getElementById('vsMpQuestionTheme');
  feedbackEl.style.display = 'none';
  textEl.textContent = q.question;
  if (themeLabelEl) {
    if (q._themeTitle) { themeLabelEl.textContent = q._themeTitle; themeLabelEl.style.display = ''; }
    else themeLabelEl.style.display = 'none';
  }

  const shuffled = shuffleQuestionOptions(q);
  optionsEl.innerHTML = '';
  shuffled.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => mpSubmitAnswer(opt));
    optionsEl.appendChild(btn);
  });

  if (mpRoom.tickTimer) clearInterval(mpRoom.tickTimer);
  mpTickTimer();
  mpRoom.tickTimer = setInterval(mpTickTimer, 250);
}

function mpTickTimer() {
  if (!mpRoom) return;
  const remaining = Math.max(0, mpRoom.roundDeadline - Date.now());
  const timerEl = document.getElementById('vsMpTimer');
  if (timerEl) timerEl.textContent = remaining > 0 ? `⏱ ${Math.ceil(remaining / 1000)}s` : '';
  if (remaining <= 0 && !mpRoom.answeredThisRound) {
    mpSubmitAnswer(null);
  }
}

async function mpSubmitAnswer(choice) {
  if (!mpRoom || mpRoom.answeredThisRound) return;
  mpRoom.answeredThisRound = true;
  if (mpRoom.tickTimer) clearInterval(mpRoom.tickTimer);
  if (typeof webAddQ === 'function') webAddQ(1);

  document.querySelectorAll('#vsMpOptions .option-btn').forEach(b => {
    b.disabled = true;
    if (choice && b.textContent === choice) b.classList.add('selected');
  });
  const feedbackEl = document.getElementById('vsMpFeedback');
  feedbackEl.textContent = 'Waiting for your opponent…';
  feedbackEl.className = 'vs-feedback-box vs-bot-thinking';
  feedbackEl.style.display = '';

  try {
    await mpPost('multiplayer_answers', {
      room_code: mpRoom.code, round_num: mpRoom.currentRound, player_id: mpMyId(), choice
    });
  } catch (e) { /* poll loop will keep checking regardless */ }

  mpMaybeResolveRound();
}

async function mpMaybeResolveRound() {
  if (!mpRoom || mpRoom.roundResolved) return;
  const timeUp = Date.now() >= mpRoom.roundDeadline;
  if (!mpRoom.answeredThisRound && !timeUp) return;

  let rows;
  try {
    rows = await mpGet(`multiplayer_answers?room_code=eq.${mpRoom.code}&round_num=eq.${mpRoom.currentRound}&select=player_id,choice`);
  } catch (e) { return; }

  const myRow = rows.find(r => r.player_id === mpMyId());
  const oppRow = rows.find(r => r.player_id === mpOppId());
  const iDone = !!myRow || timeUp;
  const oppDone = !!oppRow || timeUp;
  if (!iDone || !oppDone) return;

  mpRoom.roundResolved = true;
  if (mpRoom.tickTimer) clearInterval(mpRoom.tickTimer);

  const q = mpRoom.questionMap.get(mpRoom.questionIds[mpRoom.currentRound]);
  const myChoice = myRow ? myRow.choice : null;
  const oppChoice = oppRow ? oppRow.choice : null;
  const iCorrect = !!q && myChoice === q.answer;
  const oppCorrect = !!q && oppChoice === q.answer;
  if (iCorrect) mpRoom.myScore++;
  if (oppCorrect) mpRoom.oppScore++;

  mpRenderReveal(q, myChoice, iCorrect, oppChoice, oppCorrect);
  mpAdvanceRound();
}

function mpRenderReveal(q, myChoice, iCorrect, oppChoice, oppCorrect) {
  const optionsEl = document.getElementById('vsMpOptions');
  optionsEl.querySelectorAll('.option-btn').forEach(b => {
    b.disabled = true;
    if (b.textContent === q.answer) b.classList.add('correct-anim');
    else if (b.textContent === myChoice) b.classList.add('wrong-anim');
  });
  if (typeof SoundFX !== 'undefined') SoundFX.play(iCorrect ? 'correct' : 'wrong');

  const feedbackEl = document.getElementById('vsMpFeedback');
  const myLine = `You: ${myChoice || '(no answer)'} ${iCorrect ? '✅' : '❌'}`;
  const oppLine = `${mpRoom.oppName || 'Opponent'}: ${oppChoice || '(no answer)'} ${oppCorrect ? '✅' : '❌'}`;
  feedbackEl.innerHTML = `${myLine}<br>${oppLine}`;
  feedbackEl.className = 'vs-feedback-box ' + (iCorrect ? 'correct' : 'wrong');
  feedbackEl.style.display = '';

  document.getElementById('vsMpTimer').textContent = '';
  mpRenderScoreboard();
}

async function mpAdvanceRound() {
  const nextRound = mpRoom.currentRound + 1;
  const regulationDone = nextRound >= mpRoom.bestOf;
  const tied = mpRoom.myScore === mpRoom.oppScore;
  const finished = regulationDone && !tied;
  const nextRoundStartedAt = new Date(Date.now() + MP_REVEAL_PAUSE_MS).toISOString();

  const scoreFields = mpRoom.role === 'host'
    ? { host_score: mpRoom.myScore, guest_score: mpRoom.oppScore }
    : { host_score: mpRoom.oppScore, guest_score: mpRoom.myScore };

  try {
    await mpPatch(`multiplayer_rooms?code=eq.${mpRoom.code}&current_round=eq.${mpRoom.currentRound}`, {
      current_round: nextRound,
      round_started_at: nextRoundStartedAt,
      status: finished ? 'finished' : 'active',
      ...scoreFields,
    });
  } catch (e) { /* other client's matching write covers us either way */ }

  setTimeout(() => {
    if (finished || nextRound >= mpRoom.questionIds.length) {
      mpFinishMatch();
    } else {
      mpRoom.currentRound = nextRound;
      mpRoom.roundStartedAt = nextRoundStartedAt;
      mpRenderRound();
    }
  }, MP_REVEAL_PAUSE_MS);
}

async function mpPollActive() {
  if (!mpRoom) return;

  const lastSeenField = mpRoom.role === 'host' ? 'host_last_seen' : 'guest_last_seen';
  try {
    await mpPatch(`multiplayer_rooms?code=eq.${mpRoom.code}`, { [lastSeenField]: new Date().toISOString() });
  } catch (e) {}

  let room;
  try {
    const rows = await mpGet(`multiplayer_rooms?code=eq.${mpRoom.code}&select=*`);
    room = rows[0];
  } catch (e) { return; }
  if (!room || !mpRoom) return;

  if (room.status === 'abandoned') { mpShowOpponentLeft(); return; }

  mpRoom.oppName = mpRoom.role === 'host' ? room.guest_name : room.host_name;
  const oppLastSeen = mpRoom.role === 'host' ? room.guest_last_seen : room.host_last_seen;
  const stale = oppLastSeen && (Date.now() - new Date(oppLastSeen).getTime() > MP_DISCONNECT_MS);
  const banner = document.getElementById('vsMpDisconnectBanner');
  if (banner) banner.style.display = stale ? '' : 'none';

  // Safety net: if our own resolve logic stalled (e.g. backgrounded tab) but
  // the other client already moved the match forward, catch up from the DB
  // rather than recomputing locally.
  if (!mpRoom.roundResolved && room.current_round > mpRoom.currentRound) {
    mpRoom.myScore = mpRoom.role === 'host' ? room.host_score : room.guest_score;
    mpRoom.oppScore = mpRoom.role === 'host' ? room.guest_score : room.host_score;
    mpRoom.roundResolved = true;
    if (mpRoom.tickTimer) clearInterval(mpRoom.tickTimer);
    mpRoom.currentRound = room.current_round;
    mpRoom.roundStartedAt = room.round_started_at;
    if (room.status === 'finished') mpFinishMatch();
    else mpRenderRound();
    return;
  }

  mpMaybeResolveRound();
}

function mpShowOpponentLeft() {
  if (mpPollTimer) clearInterval(mpPollTimer);
  if (mpRoom && mpRoom.tickTimer) clearInterval(mpRoom.tickTimer);
  const feedbackEl = document.getElementById('vsMpFeedback');
  if (feedbackEl) {
    feedbackEl.textContent = 'Your opponent left the match.';
    feedbackEl.className = 'vs-feedback-box wrong';
    feedbackEl.style.display = '';
  }
  setTimeout(mpShowResults, 1500);
}

async function mpLeaveMatch() {
  if (mpPollTimer) clearInterval(mpPollTimer);
  if (mpRoom && mpRoom.tickTimer) clearInterval(mpRoom.tickTimer);
  if (mpRoom) {
    try { await mpPatch(`multiplayer_rooms?code=eq.${mpRoom.code}`, { status: 'abandoned' }); } catch (e) {}
  }
  mpTeardown();
  vsShow('vsSetup');
}

async function mpFinishMatch() {
  if (mpPollTimer) clearInterval(mpPollTimer);
  if (mpRoom && mpRoom.tickTimer) clearInterval(mpRoom.tickTimer);
  if (mpRoom) {
    try { await mpPatch(`multiplayer_rooms?code=eq.${mpRoom.code}`, { status: 'finished' }); } catch (e) {}
  }
  mpShowResults();
}

function mpShowResults() {
  if (!mpRoom) { vsShow('vsSetup'); return; }
  const players = [
    { name: mpRoom.myName, score: mpRoom.myScore, color: VS_PLAYER_COLORS[0] },
    { name: mpRoom.oppName || 'Opponent', score: mpRoom.oppScore, color: VS_PLAYER_COLORS[1] },
  ];
  const maxScore = Math.max(players[0].score, players[1].score);
  const winnerIndexes = players.map((p, i) => ({ s: p.score, i })).filter(p => p.s === maxScore).map(p => p.i);
  vsBuildLeaderboard(players, winnerIndexes);

  const titleEl = document.getElementById('vsResultsTitle');
  const subtitleEl = document.getElementById('vsResultsSubtitle');
  if (winnerIndexes.length === 1) {
    titleEl.textContent = `${players[winnerIndexes[0]].name} wins!`;
    subtitleEl.textContent = `${maxScore} point${maxScore !== 1 ? 's' : ''}`;
  } else {
    titleEl.textContent = "It's a draw!";
    subtitleEl.textContent = `Both scored ${maxScore}`;
  }
  document.getElementById('vsTiebreakerOffer').style.display = 'none';
  document.getElementById('vsLocalResultsActions').style.display = 'none';
  document.getElementById('vsMpResultsActions').style.display = 'flex';
  vsShow('vsResults');

  if (mpRoom) {
    mpRoom.rematchStarted = false;
    mpStartResultsPoll();
  }
}

function mpTeardown() {
  if (mpPollTimer) clearInterval(mpPollTimer);
  if (mpRoom && mpRoom.tickTimer) clearInterval(mpRoom.tickTimer);
  mpStopResultsPoll();
  mpRoom = null;
  document.getElementById('vsLocalResultsActions').style.display = 'flex';
  document.getElementById('vsMpResultsActions').style.display = 'none';
}

// ── Same-room rematch ────────────────────────────────────────────────────
// Both players are already sitting on the results screen with mpRoom still
// populated (mpTeardown hasn't run) — a rematch just resets the same room
// row with a fresh question set instead of sending anyone back through
// setup/create/join. Whoever clicks "Play Again" first wins a conditional
// PATCH (guarded on status=eq.finished); the other side's results-poll picks
// up the change and joins the same rematch within one poll tick.

let mpResultsPollTimer = null;

function mpStartResultsPoll() {
  if (mpResultsPollTimer) clearInterval(mpResultsPollTimer);
  mpResultsPollTimer = setInterval(mpPollForRematch, MP_POLL_MS);
}

function mpStopResultsPoll() {
  if (mpResultsPollTimer) clearInterval(mpResultsPollTimer);
  mpResultsPollTimer = null;
}

async function mpPollForRematch() {
  if (!mpRoom || mpRoom.rematchStarted) return;
  try {
    const rows = await mpGet(`multiplayer_rooms?code=eq.${mpRoom.code}&select=status,current_round,question_ids`);
    const row = rows[0];
    if (!row) return;
    if (row.status === 'abandoned') { mpStopResultsPoll(); return; }
    if (row.status === 'active' && row.current_round === 0 && Array.isArray(row.question_ids)) {
      await mpBeginRematch(row.question_ids);
    }
  } catch (e) { /* transient — next tick retries */ }
}

function mpPlayAgain() {
  if (!mpRoom || mpRoom.rematchStarted) return;
  // Only the clicking player is prompted — the opponent gets pulled into the
  // rematch via mpBeginRematch (poll-detected) with no ad of their own; you
  // can't make a remote player watch an ad just because their opponent did.
  const proceed = () => mpPlayAgainConfirmed();
  if (typeof _offerRewardedLifeline === 'function' && typeof isInApp === 'function'
      && isInApp() && typeof ADMOB_ADS_ENABLED !== 'undefined' && ADMOB_ADS_ENABLED) {
    _offerRewardedLifeline('Play Again', proceed, 'Watch a short ad to start a rematch?');
  } else {
    proceed();
  }
}

async function mpPlayAgainConfirmed() {
  if (!mpRoom || mpRoom.rematchStarted) return;
  const btn = document.getElementById('vsMpPlayAgainBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Starting…'; }
  try {
    const { questionIds, questionMap } = await mpDrawQuestionSet(mpRoom.resolvedThemes, mpRoom.bestOf);
    if (!mpRoom || mpRoom.rematchStarted) return; // opponent's rematch already landed
    // Clear the previous match's answers — round numbers restart at 0 for
    // the rematch and would otherwise collide with the old match's rows.
    try { await mpDelete(`multiplayer_answers?room_code=eq.${mpRoom.code}`); } catch (e) {}
    const patchRes = await mpPatch(
      `multiplayer_rooms?code=eq.${mpRoom.code}&status=eq.finished`,
      {
        status: 'active', current_round: 0, host_score: 0, guest_score: 0,
        question_ids: questionIds, round_started_at: new Date().toISOString(),
      }
    );
    if (patchRes.ok && patchRes.data.length && mpRoom && !mpRoom.rematchStarted) {
      for (const [k, v] of questionMap) mpRoom.questionMap.set(k, v);
      await mpBeginRematch(questionIds);
    } else if (mpRoom && !mpRoom.rematchStarted) {
      // Our conditional PATCH didn't land — either the opponent already won
      // the rematch race (mpPollForRematch will pick it up) or they've left
      // the room entirely, in which case there's no one to rematch with.
      const rows = await mpGet(`multiplayer_rooms?code=eq.${mpRoom.code}&select=status`).catch(() => []);
      if (rows[0]?.status === 'abandoned' && btn) { btn.disabled = true; btn.textContent = 'Opponent left'; }
    }
    // Otherwise the opponent won the race — mpPollForRematch (still running)
    // will pick up their write and start the rematch on this side too.
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Play Again'; }
  }
}

async function mpBeginRematch(newQuestionIds) {
  if (!mpRoom || mpRoom.rematchStarted) return;
  mpRoom.rematchStarted = true;
  mpStopResultsPoll();

  if (newQuestionIds.some(id => !mpRoom.questionMap.has(id))) {
    try { await mpEnsureFullQuestionMap(); } catch (e) { /* best effort */ }
  }

  mpRoom.questionIds = newQuestionIds;
  mpRoom.currentRound = 0;
  mpRoom.myScore = 0;
  mpRoom.oppScore = 0;
  mpRoom.roundStartedAt = null; // mpRenderRound falls back to "starts counting now"

  const btn = document.getElementById('vsMpPlayAgainBtn');
  if (btn) { btn.disabled = false; btn.textContent = 'Play Again'; }

  mpBeginMatch();
}
