// Category Blitz — Versus, real-time online multiplayer (Create/Join a room).
// Same client-trusted, poll-based pattern as assets/versus-multiplayer.js,
// reusing the multiplayer_rooms/multiplayer_answers tables (game_mode:
// 'category-blitz') plus a small multiplayer_reactions table — see
// supabase/multiplayer-category-blitz.sql.
//
// Unlike Trivia Versus, both players get the SAME letter each round (a
// deliberate departure from hot-seat, which gives each player their own
// letter) and each side's round timer runs independently via the existing
// cbRenderRound — there's no shared deadline to keep in sync. Instead, the
// moment one player submits, the other gets force-submitted too (whatever
// they've typed so far, same as their own timer running out) — see
// mpCheckOpponentFinishedFirst — so the round always ends for both together
// rather than the faster player waiting on the slower one's own pace.
//
// Contest works opposite of hot-seat: you can never mark your OWN unrecognized
// word correct (nothing stops that from being self-serving online, unlike
// hot-seat where the other player is physically watching). Instead, on the
// reveal screen, each player gets the toggle on the OTHER's unrecognized
// words only — same "Mark as Correct"/"Mark as Incorrect" control
// cbRenderResult already has, just pointed at the opponent's column. Toggling
// PATCHes the opponent's row directly (single writer per field, same as
// everywhere else in this file); each side polls to see the other's verdict
// land live. "Continue" no longer advances immediately on click — it marks
// your own row `ready` and waits; mpAdvanceRound only runs once BOTH rows
// show ready=true (see mpClickContinue/mpSyncReveal), so neither player can
// jump to the next letter while the other is still reviewing.
// Reuses cbRenderRound, cbGradeRound, cbRenderResult, cbRenderCategoryPicker,
// cbRenderDifficultyPicker from catblitz-engine.js unchanged.

const MP_URL = "https://avasbapxzgmpcosixgio.supabase.co";
const MP_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YXNiYXB4emdtcGNvc2l4Z2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjM4MzUsImV4cCI6MjA5NTIzOTgzNX0.DLNnasmaQ1hdKXb2xqXrTBnBjISo0RxOiwy7TrlN9bg";

const MP_POLL_MS = 1500;
const MP_DISCONNECT_MS = 15000;
const MP_TIEBREAK_BUFFER = 5;
const MP_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

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
  // Online has no live "both spin together" moment the way local pass-and-
  // play does (the letters are pre-drawn at room creation and each side just
  // plays a local reveal animation) — and both players MUST end up with the
  // identical category set, so randomizing has to happen here, before the
  // room exists, rather than on a per-player wheel screen.
  const mpRandomizeBox = document.getElementById('cbMpRandomizeBox');
  if (mpRandomizeBox) {
    cbRenderRandomizeCategoriesBox(mpRandomizeBox, {
      onRandomize: (picked) => activeCategories.replaceAll(picked),
    });
  }
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
  if (topBanner && typeof lobbyAppBannerHTML === 'function') topBanner.innerHTML = lobbyAppBannerHTML();

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

  // Shared with local hot-seat's "New Match" button — reload for local
  // (mpRoom never got set), instant same-room rematch for an online match.
  document.getElementById('cbVersusRematchBtn').addEventListener('click', () => {
    if (mpRoom) mpPlayAgain();
    else location.reload();
  });

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

// Draws a fresh letter sequence — used both for the initial room creation
// and for a same-room rematch (mpPlayAgain), which just needs new letters
// for the same categories/settings.
function mpDrawLetters(bestOf) {
  const totalLetters = Math.min(26, bestOf + MP_TIEBREAK_BUFFER);
  const used = new Set();
  const letters = [];
  for (let i = 0; i < totalLetters; i++) {
    const l = cbPickLetter(used);
    used.add(l);
    letters.push(l);
  }
  return letters;
}

async function mpCreateRoom(name, bestOf, categories, seconds) {
  const letters = mpDrawLetters(bestOf);

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
    answeredThisRound: false, roundResolved: false, chatLog: [], rematchCount: 0, rematchReady: false,
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
    answeredThisRound: false, roundResolved: false, chatLog: [], rematchCount: 0, rematchReady: false,
  };
  document.getElementById('cbVersusSetup').style.display = 'none';
  mpBeginMatch();
}

// ── Match loop ───────────────────────────────────────────────────────────

// isRematch: skips the game-start interstitial — a rematch is gated by a
// rewarded ad instead (see mpPlayAgain), shown once before this is called.
async function mpBeginMatch(isRematch) {
  document.getElementById('cbMpWaiting').style.display = 'none';
  document.getElementById('cbVersusPlay').style.display = 'block';
  // The hot-seat howto ("both players spin their own letter") doesn't apply
  // online — both get the same letter, so hide it rather than show wrong info.
  const howto = document.getElementById('cbVersusHowto');
  if (howto) howto.style.display = 'none';
  mpGet(`multiplayer_reactions?room_code=eq.${mpRoom.code}&order=id.desc&limit=1`)
    .then(rows => { mpRoom.lastSeenReactionId = rows[0] ? rows[0].id : 0; })
    .catch(() => { mpRoom.lastSeenReactionId = 0; });
  if (!isRematch && typeof adMobShowGameStartInterstitial === 'function') await adMobShowGameStartInterstitial();
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
  mpRoom.roundControls = null;

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
    mpRoom.roundControls = cbRenderRound(roundEl, {
      letter, categories: mpRoom.categories, seconds: mpRoom.seconds,
      onSubmit: async ({ answers, elapsedMs }) => {
        if (typeof webAddQ === 'function') webAddQ(1);
        const grade = await cbGradeRound({ letter, categories: mpRoom.categories, answers, elapsedMs, mode: 'versus' });
        mpSubmitRoundAnswer(grade, elapsedMs);
      },
    });
  });
}

// The moment the OTHER player submits, force MY round to end too — whatever
// I've typed so far gets submitted, blanks and all, same as running out of
// time. Without this, a fast player's submit only started a "waiting for
// opponent" note on THEIR screen while the slower player kept playing at
// their own pace; now the round ends for both together, matching how the
// timer already force-submits on expiry.
async function mpCheckOpponentFinishedFirst() {
  if (!mpRoom || mpRoom.answeredThisRound || !mpRoom.roundControls) return;
  try {
    const rows = await mpGet(`multiplayer_answers?room_code=eq.${mpRoom.code}&round_num=eq.${mpRoom.currentRound}&player_id=eq.${mpOppId()}&select=player_id`);
    if (rows.length) mpRoom.roundControls.forceSubmit();
  } catch (e) { /* next poll tick retries */ }
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
    rows = await mpGet(`multiplayer_answers?room_code=eq.${mpRoom.code}&round_num=eq.${mpRoom.currentRound}&select=player_id,score,payload,ready,contested`);
  } catch (e) { return; }

  const myRow = rows.find(r => r.player_id === mpMyId());
  const oppRow = rows.find(r => r.player_id === mpOppId());
  if (!myRow || !oppRow) return;

  mpRoom.roundResolved = true;
  mpRenderReveal(myRow, oppRow);
}

// Used for MY OWN answers on the reveal screen — I can't touch my own
// score/verdicts myself, but my OPPONENT's contest toggles need to be able
// to re-paint this column's icons live as they land via polling (see
// mpSyncReveal), so this returns { applyContested(contestedMap) } instead of
// being fully read-only. contestedMap is keyed by category id: toggled true
// flips 'correct'->incorrect or 'unrecognized'->correct, same rule as
// cbRenderResult's own isAccepted().
function mpRenderRevealColumn(container, name, answers, letter, score, categories) {
  const rows = categories.map(c => ({ id: c.id, label: c.label, raw: (answers[c.id] || '').trim() }));
  return Promise.all(rows.map(r => cbCheckAnswer(r.id, letter, r.raw))).then(results => {
    function accepted(i, contestedMap) {
      const status = results[i].status;
      const toggled = !!(contestedMap && contestedMap[rows[i].id]);
      if (status === 'correct') return !toggled;
      if (status === 'unrecognized') return toggled;
      return false;
    }
    function rowsHtml(contestedMap) {
      return rows.map((r, i) => {
        const isAccepted = accepted(i, contestedMap);
        const icon = isAccepted ? '✓' : (r.raw ? '✗' : '—');
        const answerHtml = r.raw ? _cbEscapeHtml(r.raw) : `<span class="cb-result-blank">(blank)</span>`;
        return `<div class="cb-result-row cb-result-row--${isAccepted ? 'correct' : 'incorrect'}" data-cat="${_cbEscapeHtml(r.id)}">
          <span class="cb-result-label">${_cbEscapeHtml(r.label)}</span>
          <span class="cb-result-answer">${answerHtml}</span>
          <span class="cb-result-icon">${icon}</span>
        </div>`;
      }).join('');
    }
    container.innerHTML = `
      <div class="cb-result">
        <p class="daily-date" style="text-align:center;font-weight:700;">${_cbEscapeHtml(name)}</p>
        <div class="cb-result-score">${score} / ${categories.length}</div>
        <div class="cb-result-breakdown">${rowsHtml(null)}</div>
      </div>`;
    return {
      applyContested(contestedMap) {
        const breakdownEl = container.querySelector('.cb-result-breakdown');
        if (breakdownEl) breakdownEl.innerHTML = rowsHtml(contestedMap);
      },
    };
  });
}

// Wires the always-visible text input on the reveal screen — the box's
// innerHTML (and this input) is rebuilt fresh every round by mpRenderReveal,
// so this just needs to attach one submit handler per render.
function mpWireChatForm() {
  const form = document.getElementById('cbMpChatForm');
  const input = document.getElementById('cbMpChatInput');
  if (!form || !input) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    mpSendChatMessage(input.value);
    input.value = '';
  });
}

// Appends to my own log immediately (optimistic — don't wait on the round
// trip) so the conversation reads naturally instead of only showing what
// the other player sends.
async function mpSendChatMessage(raw) {
  if (!mpRoom) return;
  const text = chatSanitize(raw);
  if (!text || !chatCanSend(mpRoom)) return;
  mpRoom.chatLog.push({ text, mine: true });
  mpRenderChatLog();
  try { await mpPost('multiplayer_reactions', { room_code: mpRoom.code, player_id: mpMyId(), message: text }); } catch (e) {}
}

function mpReceiveChatMessage(text) {
  if (!mpRoom) return;
  mpRoom.chatLog.push({ text, mine: false });
  mpRenderChatLog();
}

// Re-renders the WHOLE match's chat history — called on every new message
// and again each round when mpRenderReveal rebuilds the reveal screen's DOM
// (mpRoom.chatLog itself is what persists across rounds, not the element).
function mpRenderChatLog() {
  const log = document.getElementById('cbMpChatLog');
  if (!log || !mpRoom) return;
  log.innerHTML = mpRoom.chatLog
    .map(m => `<div class="tg-chat-msg${m.mine ? ' mine' : ''}">${m.text}</div>`)
    .join('');
  log.scrollTop = log.scrollHeight;
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
    <div class="tg-chat">
      <div class="tg-chat-log" id="cbMpChatLog"></div>
      <form class="tg-chat-form" id="cbMpChatForm">
        <input type="text" class="tg-chat-input" id="cbMpChatInput" placeholder="Say something…" maxlength="140" autocomplete="off">
        <button type="submit" class="primary-btn tg-chat-send">Send</button>
      </form>
    </div>
  `;

  mpRoom.liveMyScore = myRow.score;
  mpRoom.liveOppScore = oppRow.score;
  mpRoom.oppRevealApi = null;
  mpRoom.myRevealApi = null;
  mpRoom.pendingMyContested = myRow.contested || null;
  mpRoom.lastSentOppContested = null;
  mpRoom.iAmReady = false;
  mpRoom.oppReady = !!oppRow.ready;
  mpRoom.advancing = false;

  mpRenderRevealColumn(document.getElementById('cbMpMyResult'), mpRoom.myName, myRow.payload.answers, letter, myRow.score, mpRoom.categories)
    .then(api => {
      mpRoom.myRevealApi = api;
      if (mpRoom.pendingMyContested) api.applyContested(mpRoom.pendingMyContested);
    });

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

  mpWireChatForm();
  mpRenderChatLog();
  mpUpdateRevealSummary();

  const continueBox = document.getElementById('cbVersusContinueBox');
  continueBox.innerHTML = `<button type="button" class="primary-btn" id="cbMpContinueBtn" style="width:100%;">Continue</button>`;
  document.getElementById('cbMpContinueBtn').addEventListener('click', mpClickContinue);
}

// Marks me ready instead of advancing immediately — mpAdvanceRound only runs
// once BOTH players have clicked Continue (checked every poll tick in
// mpSyncReveal), so nobody can jump to the next letter while the other is
// still reviewing/contesting words.
async function mpClickContinue() {
  if (!mpRoom || mpRoom.iAmReady) return;
  mpRoom.iAmReady = true;

  const btn = document.getElementById('cbMpContinueBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Waiting for opponent…'; }

  try {
    await mpPatch(
      `multiplayer_answers?room_code=eq.${mpRoom.code}&round_num=eq.${mpRoom.currentRound}&player_id=eq.${mpMyId()}`,
      { ready: true }
    );
  } catch (e) { /* poll loop keeps checking regardless */ }

  if (mpRoom.oppReady) mpAdvanceRound();
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
    const newOppContested = mpRoom.oppRevealApi.getContested();
    const contestedChanged = JSON.stringify(newOppContested) !== JSON.stringify(mpRoom.lastSentOppContested || {});
    if (newOppScore !== mpRoom.liveOppScore || contestedChanged) {
      mpRoom.liveOppScore = newOppScore;
      mpRoom.lastSentOppContested = newOppContested;
      try {
        await mpPatch(
          `multiplayer_answers?room_code=eq.${mpRoom.code}&round_num=eq.${mpRoom.currentRound}&player_id=eq.${mpOppId()}`,
          { score: newOppScore, contested: newOppContested }
        );
      } catch (e) {}
      mpUpdateRevealSummary();
    }
  }

  try {
    const rows = await mpGet(`multiplayer_answers?room_code=eq.${mpRoom.code}&round_num=eq.${mpRoom.currentRound}&select=player_id,score,ready,contested`);
    const myRow = rows.find(r => r.player_id === mpMyId());
    const oppRow = rows.find(r => r.player_id === mpOppId());
    if (myRow && myRow.score !== mpRoom.liveMyScore) {
      mpRoom.liveMyScore = myRow.score;
      const scoreEl = document.querySelector('#cbMpMyResult .cb-result-score');
      if (scoreEl) scoreEl.textContent = `${myRow.score} / ${mpRoom.categories.length}`;
      mpUpdateRevealSummary();
    }
    if (myRow && myRow.contested) {
      mpRoom.pendingMyContested = myRow.contested;
      if (mpRoom.myRevealApi) mpRoom.myRevealApi.applyContested(myRow.contested);
    }
    if (oppRow && oppRow.ready && !mpRoom.oppReady) {
      mpRoom.oppReady = true;
      if (mpRoom.iAmReady) mpAdvanceRound();
      else {
        const btn = document.getElementById('cbMpContinueBtn');
        if (btn) btn.textContent = `${mpRoom.oppName || 'Opponent'} is ready — Continue`;
      }
    }
  } catch (e) {}
}

async function mpAdvanceRound() {
  // Guards against this same client calling in twice for one round — e.g.
  // mpClickContinue() sees the opponent already ready and calls this, then
  // the next mpSyncReveal poll tick (still mid-flight) sees oppReady too.
  if (!mpRoom || mpRoom.advancing) return;
  mpRoom.advancing = true;

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
  // Each round starts its own fresh conversation — carrying last round's
  // chat into the next one reads as stale/confusing (see mpRenderChatLog).
  mpRoom.chatLog = [];

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
    const reacts = await mpGet(`multiplayer_reactions?room_code=eq.${mpRoom.code}&id=gt.${mpRoom.lastSeenReactionId || 0}&order=id.asc`);
    reacts.forEach(r => {
      mpRoom.lastSeenReactionId = Math.max(mpRoom.lastSeenReactionId || 0, r.id);
      if (r.player_id !== mpMyId()) mpReceiveChatMessage(r.message);
    });
  } catch (e) {}

  if (mpRoom.roundResolved) {
    await mpSyncReveal();
  } else if (mpRoom.answeredThisRound) {
    await mpMaybeResolveRound();
  } else {
    await mpCheckOpponentFinishedFirst();
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

  mpRoom.rematchStarted = false;
  mpRoom.rematchReady = false;
  mpStartResultsPoll();
}

// ── Same-room rematch ────────────────────────────────────────────────────
// Both players are still sitting on the results screen with mpRoom intact —
// a rematch resets the same room row with fresh letters (same categories/
// difficulty) instead of reloading into setup and creating/joining again.
//
// Play Again waits for BOTH players, same as the mid-match Continue gate:
// clicking marks your own readiness (a sentinel multiplayer_answers row,
// round_num -1, ready=true — reuses the existing `ready` column rather than
// a new one) instead of resetting the room immediately. Only once both
// sentinel rows show up does the actual reset PATCH fire (guarded on
// status=eq.finished, so only one of the two racing clients' PATCH lands);
// the loser's results-poll picks up the winner's write within one tick, same
// as before.

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
    } else if (mpRoom.rematchReady && row.status === 'finished') {
      await mpTryStartRematchIfBothReady();
    }
  } catch (e) { /* transient — next tick retries */ }
}

function mpPlayAgain() {
  if (!mpRoom || mpRoom.rematchStarted || mpRoom.rematchReady) return;
  // Only the clicking player is prompted — watching an ad only marks YOUR
  // OWN readiness; the opponent isn't pulled in (or made to watch anything)
  // until they click Play Again on their own side too. See
  // mpMarkRematchReady/mpTryStartRematchIfBothReady for the both-ready gate.
  const proceed = () => mpMarkRematchReady();
  // Best-of-5/10 matches are short, so the very first rematch after one of
  // those ends is free — the ad only kicks in from the second rematch
  // onward. Best-of-20 is long enough that the ad still applies from the start.
  const isShortMatch = mpRoom.bestOf === 5 || mpRoom.bestOf === 10;
  const skipAd = mpRoom.rematchCount === 0 && isShortMatch;
  if (!skipAd && typeof _offerRewardedLifeline === 'function' && typeof isInApp === 'function'
      && isInApp() && typeof ADMOB_ADS_ENABLED !== 'undefined' && ADMOB_ADS_ENABLED) {
    _offerRewardedLifeline('Play Again', proceed, 'Watch a short ad to start a rematch?');
  } else {
    proceed();
  }
}

// Marks me ready instead of resetting the room immediately — mirrors
// mpClickContinue's mid-match ready gate. mpTryStartRematchIfBothReady only
// actually resets the room once both players' sentinel rows are present.
async function mpMarkRematchReady() {
  if (!mpRoom || mpRoom.rematchStarted || mpRoom.rematchReady) return;
  mpRoom.rematchReady = true;

  const btn = document.getElementById('cbVersusRematchBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Waiting for opponent…'; }

  try {
    await mpPost('multiplayer_answers', {
      room_code: mpRoom.code, round_num: -1, player_id: mpMyId(), ready: true
    });
  } catch (e) { /* results-poll keeps checking regardless */ }

  await mpTryStartRematchIfBothReady();
}

// round_num -1 is a sentinel outside any real round, reusing the `ready`
// column that already exists for the mid-match Continue gate — no new
// column needed. Whichever client sees both rows first wins the conditional
// PATCH below (guarded on status=eq.finished); the other picks it up via
// mpPollForRematch/mpBeginRematch like any other rematch race.
async function mpTryStartRematchIfBothReady() {
  if (!mpRoom || mpRoom.rematchStarted) return;
  let rows;
  try {
    rows = await mpGet(`multiplayer_answers?room_code=eq.${mpRoom.code}&round_num=eq.-1&select=player_id,ready`);
  } catch (e) { return; }
  const hostReady = rows.some(r => r.player_id === mpRoom.hostId && r.ready);
  const guestReady = rows.some(r => r.player_id === mpRoom.guestId && r.ready);
  if (!hostReady || !guestReady) return;
  await mpPlayAgainConfirmed();
}

async function mpPlayAgainConfirmed() {
  if (!mpRoom || mpRoom.rematchStarted) return;
  const btn = document.getElementById('cbVersusRematchBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Starting…'; }
  try {
    const letters = mpDrawLetters(mpRoom.bestOf);
    // Clear the previous match's answers (including the round_num -1
    // readiness sentinels) — round numbers restart at 0 for the rematch and
    // would otherwise collide with the old match's rows.
    try { await mpDelete(`multiplayer_answers?room_code=eq.${mpRoom.code}`); } catch (e) {}
    const patchRes = await mpPatch(
      `multiplayer_rooms?code=eq.${mpRoom.code}&status=eq.finished`,
      { status: 'active', current_round: 0, host_score: 0, guest_score: 0, question_ids: letters }
    );
    if (patchRes.ok && patchRes.data.length && mpRoom && !mpRoom.rematchStarted) {
      await mpBeginRematch(letters);
    } else if (mpRoom && !mpRoom.rematchStarted) {
      // Our conditional PATCH didn't land — either the opponent already won
      // the rematch race (mpPollForRematch will pick it up) or they've left
      // the room entirely, in which case there's no one to rematch with.
      const rows = await mpGet(`multiplayer_rooms?code=eq.${mpRoom.code}&select=status`).catch(() => []);
      if (rows[0]?.status === 'abandoned' && btn) { btn.disabled = true; btn.textContent = 'Opponent left'; }
    }
  } catch (e) {
    if (mpRoom) mpRoom.rematchReady = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Play Again'; }
  }
}

async function mpBeginRematch(newLetters) {
  if (!mpRoom || mpRoom.rematchStarted) return;
  mpRoom.rematchStarted = true;
  mpRoom.rematchReady = false;
  mpRoom.rematchCount++;
  mpStopResultsPoll();

  mpRoom.letters = newLetters;
  mpRoom.currentRound = 0;
  mpRoom.myScore = 0;
  mpRoom.oppScore = 0;
  mpRoom.chatLog = [];

  const btn = document.getElementById('cbVersusRematchBtn');
  if (btn) { btn.disabled = false; btn.textContent = 'Play Again'; }
  document.getElementById('cbVersusFinal').style.display = 'none';

  await mpBeginMatch(true);
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page !== 'catblitz-versus') return;
  if (!document.getElementById('cbModeSeg')) return;
  mpInit();
});
