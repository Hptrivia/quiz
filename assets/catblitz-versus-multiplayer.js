// Category Blitz — Versus, real-time online multiplayer (Create/Join a room).
// Same client-trusted, poll-based pattern as assets/versus-multiplayer.js,
// reusing the multiplayer_rooms/multiplayer_answers tables (game_mode:
// 'category-blitz') plus a small multiplayer_reactions table — see
// supabase/multiplayer-category-blitz.sql.
//
// Unlike Trivia Versus, both players get the SAME letter each round (a
// deliberate departure from hot-seat, which gives each player their own
// letter) and each side's round timer runs independently via the existing
// cbRenderRound — there's no shared deadline to keep in sync, only a
// "wait for the other player's submitted row" gate.
//
// Contest works opposite of hot-seat: you can never mark your OWN unrecognized
// word correct (nothing stops that from being self-serving online, unlike
// hot-seat where the other player is physically watching). Instead, on the
// reveal screen, each player gets the toggle on the OTHER's unrecognized
// words only — same "Mark as Correct"/"Mark as Incorrect" control
// cbRenderResult already has, just pointed at the opponent's column. Toggling
// PATCHes the opponent's row directly (single writer per field, same as
// everywhere else in this file); each side polls to see the other's verdict
// land live, and "Continue" locks in whatever the scores are at that moment.
// Reuses cbRenderRound, cbGradeRound, cbRenderResult, cbRenderCategoryPicker,
// cbRenderDifficultyPicker from catblitz-engine.js unchanged.

const MP_URL = "https://avasbapxzgmpcosixgio.supabase.co";
const MP_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YXNiYXB4emdtcGNvc2l4Z2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjM4MzUsImV4cCI6MjA5NTIzOTgzNX0.DLNnasmaQ1hdKXb2xqXrTBnBjISo0RxOiwy7TrlN9bg";

const MP_POLL_MS = 1500;
const MP_DISCONNECT_MS = 15000;
const MP_TIEBREAK_BUFFER = 5;
const MP_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MP_REACTIONS = ['😂', '🔥', '😭', '👏', '😮', '🎯'];

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

// ── Setup screen wiring ──────────────────────────────────────────────────

function mpInit() {
  const modeSeg = document.getElementById('cbModeSeg');
  const onlineFields = document.getElementById('cbOnlineFields');
  const localFields = document.getElementById('cbLocalFields');
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

  const nameInput = document.getElementById('cbMpName');
  const savedName = localStorage.getItem('tg_mp_name');
  if (savedName) nameInput.value = savedName;

  let mpBestOf = 5;
  const lengthRow = document.getElementById('cbMpLengthRow');
  lengthRow.querySelectorAll('button').forEach(btn => {
    if (parseInt(btn.dataset.len, 10) === mpBestOf) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      mpBestOf = parseInt(btn.dataset.len, 10);
      lengthRow.querySelectorAll('button').forEach(b => b.classList.toggle('selected', b === btn));
    });
  });

  const activeCategories = cbRenderCategoryPicker({
    listEl: document.getElementById('cbMpCategoryList'),
    inputEl: document.getElementById('cbMpNewCategory'),
    addBtnEl: document.getElementById('cbMpAddCategoryBtn'),
    initialCategories: CB_VERSUS_DEFAULT_CATEGORIES,
  });
  const getDifficulty = cbRenderDifficultyPicker(document.getElementById('cbMpDifficultyRow'));

  const errorEl = document.getElementById('cbMpError');
  const showMpError = (msg) => { errorEl.textContent = msg; errorEl.style.display = ''; };
  const clearMpError = () => { errorEl.style.display = 'none'; };

  const createBtn = document.getElementById('cbMpCreateBtn');
  createBtn.addEventListener('click', async () => {
    clearMpError();
    // Same one-time "1 free round, shared with Solo" web wall hot-seat already
    // has — applies equally whether you're creating or joining (an invite
    // link is not an exemption from the limit).
    if (typeof isLimitedWeb === 'function' && isLimitedWeb() && typeof cbGetWebPlayUsed === 'function' && cbGetWebPlayUsed()) {
      document.getElementById('cbVersusSetup').style.display = 'none';
      const wallHost = document.getElementById('cbVersusPlay');
      wallHost.style.display = 'block';
      wallHost.innerHTML = typeof webWallHTML === 'function'
        ? webWallHTML('Come back with the app for unlimited Category Blitz 🎉', null, 'rounds', 1) : '';
      return;
    }
    const name = nameInput.value.trim() || 'Player 1';
    localStorage.setItem('tg_mp_name', name);
    if (!activeCategories.length) { showMpError('Add at least one category.'); return; }
    createBtn.disabled = true;
    try {
      await mpCreateRoom(name, mpBestOf, activeCategories, CB_DIFFICULTY_SECONDS[getDifficulty()]);
    } catch (e) {
      showMpError(e.message || 'Could not create a room. Please try again.');
    } finally {
      createBtn.disabled = false;
    }
  });

  document.getElementById('cbMpShowJoinBtn').addEventListener('click', () => {
    document.getElementById('cbMpJoinFields').style.display = '';
  });

  const topBanner = document.getElementById('cbMpAppBanner');
  if (topBanner && typeof resultAppBannerHTML === 'function') topBanner.innerHTML = resultAppBannerHTML();

  const joinBtn = document.getElementById('cbMpJoinBtn');
  joinBtn.addEventListener('click', async () => {
    clearMpError();
    // Same wall as Create — no exemption for arriving via a friend's invite
    // link. If you're out of your free round, you're out, same as anywhere else.
    if (typeof isLimitedWeb === 'function' && isLimitedWeb() && typeof cbGetWebPlayUsed === 'function' && cbGetWebPlayUsed()) {
      document.getElementById('cbVersusSetup').style.display = 'none';
      const wallHost = document.getElementById('cbVersusPlay');
      wallHost.style.display = 'block';
      wallHost.innerHTML = typeof webWallHTML === 'function'
        ? webWallHTML('Come back with the app for unlimited Category Blitz 🎉', null, 'rounds', 1) : '';
      return;
    }
    const name = nameInput.value.trim() || 'Player 2';
    localStorage.setItem('tg_mp_name', name);
    const code = document.getElementById('cbMpCodeInput').value.trim().toUpperCase();
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

  document.getElementById('cbMpCopyLinkBtn').addEventListener('click', mpCopyInviteLink);
  document.getElementById('cbMpCancelBtn').addEventListener('click', mpCancelWaiting);
  document.getElementById('cbMpLeaveBtn').addEventListener('click', mpLeaveMatch);

  // A shared invite link (?mpJoin=CODE) works regardless of local setup —
  // joining only depends on the room's own stored settings.
  const joinParam = getParam('mpJoin');
  if (joinParam) {
    document.getElementById('cbMpJoinFields').style.display = '';
    document.getElementById('cbMpCodeInput').value = joinParam.toUpperCase();
    nameInput.focus();
  }
}

// ── Create / join ────────────────────────────────────────────────────────

async function mpCreateRoom(name, bestOf, categories, seconds) {
  const totalLetters = Math.min(26, bestOf + MP_TIEBREAK_BUFFER);
  const used = new Set();
  const letters = [];
  for (let i = 0; i < totalLetters; i++) {
    const l = cbPickLetter(used);
    used.add(l);
    letters.push(l);
  }

  const catPayload = categories.map(c => ({ id: c.id, label: c.label }));
  let code, insertRes;
  for (let attempt = 0; attempt < 5; attempt++) {
    code = mpGenCode();
    insertRes = await mpPost('multiplayer_rooms', {
      code, game_mode: 'category-blitz', best_of: bestOf, question_ids: letters,
      payload: { categories: catPayload, seconds },
      host_id: mpPlayerId(), host_name: name, status: 'waiting'
    });
    if (insertRes.ok) break;
  }
  if (!insertRes.ok) throw new Error('Could not create a room right now — please try again.');

  mpRoom = {
    code, role: 'host', bestOf, letters, categories: catPayload, seconds,
    hostId: mpPlayerId(), guestId: null,
    myName: name, oppName: null,
    currentRound: 0, myScore: 0, oppScore: 0,
    answeredThisRound: false, roundResolved: false,
  };

  document.getElementById('cbVersusSetup').style.display = 'none';
  document.getElementById('cbMpRoomCode').textContent = code;
  document.getElementById('cbMpWaitingStatus').textContent = 'Waiting for them to join…';
  document.getElementById('cbMpWaiting').style.display = 'block';
  mpPollTimer = setInterval(mpPollWaiting, MP_POLL_MS);
}

async function mpPollWaiting() {
  if (!mpRoom) return;
  try {
    const rows = await mpGet(`multiplayer_rooms?code=eq.${mpRoom.code}&select=guest_id,guest_name,status`);
    const row = rows[0];
    if (!row || row.status === 'abandoned') return;
    if (row.guest_id) {
      clearInterval(mpPollTimer);
      mpRoom.guestId = row.guest_id;
      mpRoom.oppName = row.guest_name;
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
  const btn = document.getElementById('cbMpCopyLinkBtn');
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
  location.reload();
}

async function mpJoinRoom(code, name) {
  const rows = await mpGet(`multiplayer_rooms?code=eq.${code}&select=*`);
  const room = rows[0];
  if (!room) throw new Error('No room found with that code.');
  if (room.game_mode !== 'category-blitz') throw new Error('That code is for a different game mode.');
  if (room.guest_id) throw new Error('That room is already full.');
  if (room.status !== 'waiting') throw new Error('That room is no longer accepting players.');

  const patchRes = await mpPatch(
    `multiplayer_rooms?code=eq.${code}&guest_id=is.null`,
    { guest_id: mpPlayerId(), guest_name: name, status: 'active', current_round: 0 }
  );
  if (!patchRes.ok || !patchRes.data.length) throw new Error('That room was just taken by someone else.');

  const updated = patchRes.data[0];
  mpRoom = {
    code, role: 'guest', bestOf: updated.best_of, letters: updated.question_ids,
    categories: updated.payload.categories, seconds: updated.payload.seconds,
    hostId: updated.host_id, guestId: mpPlayerId(),
    myName: name, oppName: updated.host_name,
    currentRound: 0, myScore: 0, oppScore: 0,
    answeredThisRound: false, roundResolved: false,
  };
  document.getElementById('cbVersusSetup').style.display = 'none';
  mpBeginMatch();
}

// ── Match loop ───────────────────────────────────────────────────────────

function mpBeginMatch() {
  document.getElementById('cbMpWaiting').style.display = 'none';
  document.getElementById('cbVersusPlay').style.display = 'block';
  // The hot-seat howto ("both players spin their own letter") doesn't apply
  // online — both get the same letter, so hide it rather than show wrong info.
  const howto = document.getElementById('cbVersusHowto');
  if (howto) howto.style.display = 'none';
  mpGet(`multiplayer_reactions?room_code=eq.${mpRoom.code}&order=id.desc&limit=1`)
    .then(rows => { mpRoom.lastSeenReactionId = rows[0] ? rows[0].id : 0; })
    .catch(() => { mpRoom.lastSeenReactionId = 0; });
  mpRenderRound();
  mpPollTimer = setInterval(mpPollActive, MP_POLL_MS);
}

function cbMpSpinToLetter(container, letter, onDone) {
  container.innerHTML = `<div class="cb-wheel"><div class="cb-wheel-letter" id="cbWheelLetter">?</div></div>`;
  const letterEl = container.querySelector('#cbWheelLetter');
  const tickMs = 60, spinMs = 1000;
  const maxTicks = Math.round(spinMs / tickMs);
  let ticks = 0;
  const interval = setInterval(() => {
    letterEl.textContent = CB_ALPHABET[Math.floor(Math.random() * CB_ALPHABET.length)];
    ticks++;
    if (ticks >= maxTicks) {
      clearInterval(interval);
      letterEl.textContent = letter;
      letterEl.classList.add('cb-wheel-letter--landed');
      setTimeout(onDone, 400);
    }
  }, tickMs);
}

function mpRenderRound() {
  const round = mpRoom.currentRound;
  const letter = mpRoom.letters[round];
  if (!letter) { mpFinishMatch(); return; } // buffer exhausted while still tied — treat as a draw

  mpRoom.answeredThisRound = false;
  mpRoom.roundResolved = false;

  const statusEl = document.getElementById('cbVersusStatus');
  const wheelContainer = document.getElementById('cbWheelContainer');
  const roundEl = document.getElementById('cbRoundContainer');
  const isSuddenDeath = round >= mpRoom.bestOf;
  if (statusEl) statusEl.textContent = isSuddenDeath
    ? `Tied — decider round ${round - mpRoom.bestOf + 1}`
    : `Round ${round + 1} of ${mpRoom.bestOf}`;

  wheelContainer.style.display = 'block';
  roundEl.style.display = 'none';
  document.getElementById('cbMpDisconnectBanner').style.display = 'none';

  cbMpSpinToLetter(wheelContainer, letter, () => {
    wheelContainer.style.display = 'none';
    roundEl.style.display = 'block';
    cbRenderRound(roundEl, {
      letter, categories: mpRoom.categories, seconds: mpRoom.seconds,
      onSubmit: async ({ answers, elapsedMs }) => {
        if (typeof webAddQ === 'function') webAddQ(1);
        const grade = await cbGradeRound({ letter, categories: mpRoom.categories, answers, elapsedMs, mode: 'versus' });
        mpSubmitRoundAnswer(grade, elapsedMs);
      },
    });
  });
}

// Submits the raw wordlist score immediately — no self-review. Your
// opponent gets the chance to upgrade any of your unrecognized words on the
// shared reveal screen instead (see mpRenderReveal / mpSyncReveal).
async function mpSubmitRoundAnswer(grade, elapsedMs) {
  if (mpRoom.answeredThisRound) return;
  mpRoom.answeredThisRound = true;

  const roundEl = document.getElementById('cbRoundContainer');
  cbRenderResult(roundEl, grade, { categories: mpRoom.categories, contestable: false, mode: 'versus' });
  const waitNote = document.createElement('p');
  waitNote.className = 'daily-date';
  waitNote.style.cssText = 'text-align:center;margin-top:10px;';
  waitNote.textContent = 'Waiting for your opponent…';
  roundEl.appendChild(waitNote);

  const answers = {};
  mpRoom.categories.forEach(c => { answers[c.id] = (grade.perCategory[c.id] || {}).answer || ''; });

  try {
    await mpPost('multiplayer_answers', {
      room_code: mpRoom.code, round_num: mpRoom.currentRound, player_id: mpMyId(),
      score: grade.score, payload: { answers, elapsedMs }
    });
  } catch (e) { /* poll loop keeps checking regardless */ }

  mpMaybeResolveRound();
}

// No shared deadline in this mode (each side's own cbRenderRound timer
// already forces a submission) — resolution is purely "has the other
// player's row shown up yet," bounded only by the disconnect banner.
async function mpMaybeResolveRound() {
  if (!mpRoom || mpRoom.roundResolved || !mpRoom.answeredThisRound) return;

  let rows;
  try {
    rows = await mpGet(`multiplayer_answers?room_code=eq.${mpRoom.code}&round_num=eq.${mpRoom.currentRound}&select=player_id,score,payload`);
  } catch (e) { return; }

  const myRow = rows.find(r => r.player_id === mpMyId());
  const oppRow = rows.find(r => r.player_id === mpOppId());
  if (!myRow || !oppRow) return;

  mpRoom.roundResolved = true;
  mpRenderReveal(myRow, oppRow);
}

// Read-only column — used for MY OWN answers on the reveal screen (I can't
// touch my own score; my opponent's toggles land here via polling instead).
function mpRenderRevealColumn(container, name, answers, letter, score, categories) {
  const rows = categories.map(c => ({ id: c.id, label: c.label, raw: (answers[c.id] || '').trim() }));
  Promise.all(rows.map(r => cbCheckAnswer(r.id, letter, r.raw))).then(results => {
    const rowsHtml = rows.map((r, i) => {
      const correct = results[i].status === 'correct';
      const icon = correct ? '✓' : (r.raw ? '✗' : '—');
      const answerHtml = r.raw ? _cbEscapeHtml(r.raw) : `<span class="cb-result-blank">(blank)</span>`;
      return `<div class="cb-result-row cb-result-row--${correct ? 'correct' : 'incorrect'}">
        <span class="cb-result-label">${_cbEscapeHtml(r.label)}</span>
        <span class="cb-result-answer">${answerHtml}</span>
        <span class="cb-result-icon">${icon}</span>
      </div>`;
    }).join('');
    container.innerHTML = `
      <div class="cb-result">
        <p class="daily-date" style="text-align:center;font-weight:700;">${_cbEscapeHtml(name)}</p>
        <div class="cb-result-score">${score} / ${categories.length}</div>
        <div class="cb-result-breakdown">${rowsHtml}</div>
      </div>`;
  });
}

function mpRenderReactionBar() {
  const row = document.getElementById('cbMpReactionsRow');
  if (!row) return;
  row.innerHTML = MP_REACTIONS.map(e => `<button type="button" class="secondary-btn cb-mp-reaction-btn" data-emoji="${e}">${e}</button>`).join('');
  row.querySelectorAll('.cb-mp-reaction-btn').forEach(btn => {
    btn.addEventListener('click', () => mpSendReaction(btn.dataset.emoji));
  });
}

async function mpSendReaction(emoji) {
  if (!mpRoom) return;
  try { await mpPost('multiplayer_reactions', { room_code: mpRoom.code, player_id: mpMyId(), emoji }); } catch (e) {}
}

function mpShowReactionToast(emoji) {
  const toast = document.createElement('div');
  toast.className = 'cb-mp-reaction-toast';
  toast.textContent = emoji;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}

function mpRenderReveal(myRow, oppRow) {
  const letter = mpRoom.letters[mpRoom.currentRound];
  document.getElementById('cbVersusPlay').style.display = 'none';
  const resultEl = document.getElementById('cbVersusRoundResult');
  resultEl.style.display = 'block';
  resultEl.querySelector('h2').textContent = `Round ${mpRoom.currentRound + 1} — Letter ${letter}`;

  const box = document.getElementById('cbVersusRoundResultBox');
  box.innerHTML = `
    <div class="cb-mp-reveal-cols">
      <div id="cbMpMyResult"></div>
      <div id="cbMpOppResult"></div>
    </div>
    <p class="daily-date" id="cbMpRevealSummary" style="text-align:center;margin:10px 0;"></p>
    <div class="cb-mp-reactions" id="cbMpReactionsRow"></div>
  `;

  mpRoom.liveMyScore = myRow.score;
  mpRoom.liveOppScore = oppRow.score;
  mpRoom.oppRevealApi = null;

  mpRenderRevealColumn(document.getElementById('cbMpMyResult'), mpRoom.myName, myRow.payload.answers, letter, myRow.score, mpRoom.categories);

  const oppName = mpRoom.oppName || 'Opponent';
  cbGradeRound({ letter, categories: mpRoom.categories, answers: oppRow.payload.answers, elapsedMs: (oppRow.payload.elapsedMs || 0), mode: 'versus' })
    .then(oppGrade => {
      const oppContainer = document.getElementById('cbMpOppResult');
      if (!oppContainer) return; // round already advanced past this reveal
      const label = document.createElement('p');
      label.className = 'daily-date';
      label.style.cssText = 'text-align:center;font-weight:700;';
      label.textContent = oppName;
      oppContainer.appendChild(label);
      mpRoom.oppRevealApi = cbRenderResult(oppContainer, oppGrade, {
        categories: mpRoom.categories, contestable: true, letter, mode: 'versus',
      });
    });

  mpRenderReactionBar();
  mpUpdateRevealSummary();

  const continueBox = document.getElementById('cbVersusContinueBox');
  continueBox.innerHTML = `<button type="button" class="primary-btn" id="cbMpContinueBtn" style="width:100%;">Continue</button>`;
  document.getElementById('cbMpContinueBtn').addEventListener('click', mpAdvanceRound);
}

function mpUpdateRevealSummary() {
  const summaryEl = document.getElementById('cbMpRevealSummary');
  if (!summaryEl || !mpRoom) return;
  const myLive = mpRoom.liveMyScore, oppLive = mpRoom.liveOppScore;
  const myTotal = mpRoom.myScore + myLive, oppTotal = mpRoom.oppScore + oppLive;
  const oppName = mpRoom.oppName || 'Opponent';
  const aheadLine = myTotal === oppTotal ? 'Tied so far' : `${myTotal > oppTotal ? mpRoom.myName : oppName} is ahead`;
  summaryEl.textContent = `${myLive} vs ${oppLive} this round — ${myTotal} to ${oppTotal} overall. ${aheadLine}.`;
}

// Called every poll tick while the reveal screen is up: pushes my review of
// the opponent's words (if I've toggled anything since last tick) and pulls
// in whatever review they've made of mine.
async function mpSyncReveal() {
  if (mpRoom.oppRevealApi) {
    const newOppScore = mpRoom.oppRevealApi.getScore();
    if (newOppScore !== mpRoom.liveOppScore) {
      mpRoom.liveOppScore = newOppScore;
      try {
        await mpPatch(
          `multiplayer_answers?room_code=eq.${mpRoom.code}&round_num=eq.${mpRoom.currentRound}&player_id=eq.${mpOppId()}`,
          { score: newOppScore }
        );
      } catch (e) {}
      mpUpdateRevealSummary();
    }
  }

  try {
    const rows = await mpGet(`multiplayer_answers?room_code=eq.${mpRoom.code}&round_num=eq.${mpRoom.currentRound}&select=player_id,score`);
    const myRow = rows.find(r => r.player_id === mpMyId());
    if (myRow && myRow.score !== mpRoom.liveMyScore) {
      mpRoom.liveMyScore = myRow.score;
      const scoreEl = document.querySelector('#cbMpMyResult .cb-result-score');
      if (scoreEl) scoreEl.textContent = `${myRow.score} / ${mpRoom.categories.length}`;
      mpUpdateRevealSummary();
    }
  } catch (e) {}
}

async function mpAdvanceRound() {
  // Burns the same one-time web allowance the Create/Join wall checks —
  // completing round 1 uses it up, same as hot-seat.
  if (mpRoom.currentRound === 0 && typeof isLimitedWeb === 'function' && isLimitedWeb() && typeof cbMarkWebPlayUsed === 'function') {
    cbMarkWebPlayUsed();
  }

  const newMyScore = mpRoom.myScore + mpRoom.liveMyScore;
  const newOppScore = mpRoom.oppScore + mpRoom.liveOppScore;

  const nextRound = mpRoom.currentRound + 1;
  const regulationDone = nextRound >= mpRoom.bestOf;
  const tied = newMyScore === newOppScore;
  const finished = regulationDone && !tied;

  const scoreFields = mpRoom.role === 'host'
    ? { host_score: newMyScore, guest_score: newOppScore }
    : { host_score: newOppScore, guest_score: newMyScore };

  try {
    await mpPatch(`multiplayer_rooms?code=eq.${mpRoom.code}&current_round=eq.${mpRoom.currentRound}`, {
      current_round: nextRound, status: finished ? 'finished' : 'active', ...scoreFields,
    });
  } catch (e) { /* other client's matching write covers us either way */ }

  mpRoom.myScore = newMyScore;
  mpRoom.oppScore = newOppScore;
  mpRoom.oppRevealApi = null;

  if (finished || nextRound >= mpRoom.letters.length) {
    mpFinishMatch();
  } else {
    mpRoom.currentRound = nextRound;
    document.getElementById('cbVersusRoundResult').style.display = 'none';
    document.getElementById('cbVersusPlay').style.display = 'block';
    mpRenderRound();
  }
}

async function mpPollActive() {
  if (!mpRoom) return;

  const lastSeenField = mpRoom.role === 'host' ? 'host_last_seen' : 'guest_last_seen';
  try { await mpPatch(`multiplayer_rooms?code=eq.${mpRoom.code}`, { [lastSeenField]: new Date().toISOString() }); } catch (e) {}

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
  const banner = document.getElementById('cbMpDisconnectBanner');
  if (banner) banner.style.display = stale ? '' : 'none';

  try {
    const reacts = await mpGet(`multiplayer_reactions?room_code=eq.${mpRoom.code}&order=id.desc&limit=1`);
    const r = reacts[0];
    if (r && r.id > (mpRoom.lastSeenReactionId || 0)) {
      mpRoom.lastSeenReactionId = r.id;
      if (r.player_id !== mpMyId()) mpShowReactionToast(r.emoji);
    }
  } catch (e) {}

  if (mpRoom.roundResolved) {
    await mpSyncReveal();
  } else if (mpRoom.answeredThisRound) {
    await mpMaybeResolveRound();
  }
}

function mpShowOpponentLeft() {
  if (mpPollTimer) clearInterval(mpPollTimer);
  mpShowResults();
}

async function mpLeaveMatch() {
  if (mpPollTimer) clearInterval(mpPollTimer);
  if (mpRoom) {
    try { await mpPatch(`multiplayer_rooms?code=eq.${mpRoom.code}`, { status: 'abandoned' }); } catch (e) {}
  }
  mpRoom = null;
  location.reload();
}

async function mpFinishMatch() {
  if (mpPollTimer) clearInterval(mpPollTimer);
  if (mpRoom) {
    try { await mpPatch(`multiplayer_rooms?code=eq.${mpRoom.code}`, { status: 'finished' }); } catch (e) {}
  }
  mpShowResults();
}

function mpShowResults() {
  if (!mpRoom) return;
  document.getElementById('cbMpDisconnectBanner').style.display = 'none';
  document.getElementById('cbVersusRoundResult').style.display = 'none';
  document.getElementById('cbVersusPlay').style.display = 'none';
  const finalEl = document.getElementById('cbVersusFinal');
  finalEl.style.display = 'block';

  const oppName = mpRoom.oppName || 'Opponent';
  let winnerLine;
  if (mpRoom.myScore > mpRoom.oppScore) winnerLine = `🏆 ${_cbEscapeHtml(mpRoom.myName)} wins!`;
  else if (mpRoom.oppScore > mpRoom.myScore) winnerLine = `🏆 ${_cbEscapeHtml(oppName)} wins!`;
  else winnerLine = `🤝 It's a draw!`;

  document.getElementById('cbVersusFinalBox').innerHTML = `
    <div class="cb-versus-final-score">
      <div><strong>${_cbEscapeHtml(mpRoom.myName)}</strong>: ${mpRoom.myScore}</div>
      <div><strong>${_cbEscapeHtml(oppName)}</strong>: ${mpRoom.oppScore}</div>
    </div>
    <p class="cb-versus-winner">${winnerLine}</p>
  `;

  const feedbackWrap = document.getElementById('cbFeedbackBoxWrap');
  if (feedbackWrap) {
    feedbackWrap.innerHTML = cbFeedbackBoxHtml();
    cbBindFeedbackBox();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page !== 'catblitz-versus') return;
  if (!document.getElementById('cbModeSeg')) return;
  mpInit();
});
