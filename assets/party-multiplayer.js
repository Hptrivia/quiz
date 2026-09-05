// Party Mode — real-time online multiplayer for 2+ players (not just 2).
// Same client-trusted, poll-based Supabase REST pattern as versus-multiplayer.js
// (see that file for the 2-player version this generalizes from), but the
// roster lives in multiplayer_players instead of multiplayer_rooms'
// host/guest columns, since those don't generalize past 2 players. See
// supabase/multiplayer-party.sql for the schema and column-reuse notes.
//
// Two sub-modes, same question-sync mechanics, different win condition:
//   score    — everyone answers every question, most correct wins.
//   survival — a wrong/timed-out answer eliminates you; last one standing wins.
//
// The player roster is frozen once the host clicks Start (no joining
// mid-match), so unlike the lobby phase, the active-match code never needs to
// handle the roster growing — only each player's `eliminated` flag changing.
//
// Reuses from app.js: fetchJSON, getParam, shuffleArray, shuffleQuestionOptions,
// normalizeDifficulty, loadThemes. Reuses from versus.js: vsShow, VS_DIFF_ORDER,
// vsBuildSchedule, vsDrawQuestion, vsQKey, vsBuildQuestionPools,
// vsResolveThemeContext — this file does NOT load versus.js's online-specific
// code (versus-multiplayer.js), only its shared local-mode helpers.

const PTY_URL = "https://avasbapxzgmpcosixgio.supabase.co";
const PTY_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YXNiYXB4emdtcGNvc2l4Z2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjM4MzUsImV4cCI6MjA5NTIzOTgzNX0.DLNnasmaQ1hdKXb2xqXrTBnBjISo0RxOiwy7TrlN9bg";

const PTY_POLL_MS = 1500;
const PTY_ROUND_SECONDS = 15;
const PTY_DISCONNECT_MS = 15000;
const PTY_REVEAL_PAUSE_MS = 2500;
const PTY_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L — easy to read aloud
const PTY_COLORS = ['#38bdf8', '#f59e0b', '#34d399', '#f472b6', '#a78bfa', '#fb7185', '#2dd4bf', '#facc15'];

let ptyAllThemes = [];
let ptyRoom = null;
let ptyPollTimer = null;

function ptyPlayerId() {
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

function ptyGenCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += PTY_CODE_CHARS[Math.floor(Math.random() * PTY_CODE_CHARS.length)];
  return code;
}

async function ptyGet(path) {
  const res = await fetch(`${PTY_URL}/rest/v1/${path}`, {
    headers: { apikey: PTY_KEY, Authorization: `Bearer ${PTY_KEY}` }
  });
  if (!res.ok) throw new Error(`pty GET ${res.status}`);
  return res.json();
}

async function ptyPost(path, body) {
  const res = await fetch(`${PTY_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: PTY_KEY, Authorization: `Bearer ${PTY_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=representation'
    },
    body: JSON.stringify(body)
  });
  return { ok: res.ok, status: res.status, data: res.ok ? await res.json() : [] };
}

// Join needs upsert-on-conflict so a page refresh mid-lobby (same player_id
// re-POSTing its own roster row) doesn't fail on the primary key instead of
// just confirming the existing row.
async function ptyUpsert(path, body) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${PTY_URL}/rest/v1/${path}${sep}on_conflict=room_code,player_id`, {
    method: 'POST',
    headers: {
      apikey: PTY_KEY, Authorization: `Bearer ${PTY_KEY}`,
      'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(body)
  });
  return { ok: res.ok, status: res.status, data: res.ok ? await res.json() : [] };
}

async function ptyPatch(path, body) {
  const res = await fetch(`${PTY_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      apikey: PTY_KEY, Authorization: `Bearer ${PTY_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=representation'
    },
    body: JSON.stringify(body)
  });
  return { ok: res.ok, status: res.status, data: res.ok ? await res.json() : [] };
}

async function ptyDelete(path) {
  const res = await fetch(`${PTY_URL}/rest/v1/${path}`, {
    method: 'DELETE',
    headers: { apikey: PTY_KEY, Authorization: `Bearer ${PTY_KEY}` }
  });
  return res.ok;
}

// ── Setup screen wiring ──────────────────────────────────────────────────

function ptyInit(allThemes, resolvedThemes) {
  ptyAllThemes = allThemes;

  const nameInput = document.getElementById('ptyName');
  const savedName = localStorage.getItem('tg_mp_name');
  if (savedName) nameInput.value = savedName;

  // Same free-questions bucket as 2-player Versus Online (both are "online
  // with other people" web usage) — no separate budget bucket for Party.
  const remaining = (typeof isLimitedWeb === 'function' && isLimitedWeb() && typeof webVsOnlineRemaining === 'function')
    ? webVsOnlineRemaining() : Infinity;

  let ptyBestOf = 10;
  const bestOfSeg = document.getElementById('ptyBestOfSeg');
  const bestOfBtns = [...bestOfSeg.querySelectorAll('button')];
  let firstFitting = null;
  bestOfBtns.forEach(btn => {
    const val = parseInt(btn.dataset.val, 10);
    const fits = val <= remaining;
    if (!fits) {
      btn.disabled = true;
      btn.style.opacity = '0.4';
      btn.title = val === 20
        ? 'Only available in the app'
        : `Not enough free questions left today (${remaining} left) — try a shorter game or get the app`;
    } else if (firstFitting === null) {
      firstFitting = val;
    }
  });
  ptyBestOf = bestOfBtns.some(b => parseInt(b.dataset.val, 10) === 10 && !b.disabled) ? 10 : (firstFitting || 10);
  bestOfBtns.forEach(btn => {
    if (parseInt(btn.dataset.val, 10) === ptyBestOf && !btn.disabled) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      ptyBestOf = parseInt(btn.dataset.val, 10);
      bestOfBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  let ptySubMode = 'score';
  const subModeSeg = document.getElementById('ptySubModeSeg');
  const subModeSetupNote = document.getElementById('ptySubModeSetupNote');
  const subModeDescriptions = {
    score: 'Everyone answers the same questions — most correct answers wins.',
    survival: 'Everyone answers the same questions — get one wrong and you\'re out. Last player standing wins.',
  };
  subModeSetupNote.textContent = subModeDescriptions[ptySubMode];
  subModeSeg.querySelectorAll('button').forEach(btn => {
    if (btn.dataset.val === ptySubMode) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      ptySubMode = btn.dataset.val;
      subModeSeg.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      subModeSetupNote.textContent = subModeDescriptions[ptySubMode];
    });
  });

  const errorEl = document.getElementById('ptyError');
  const showError = (msg) => { errorEl.textContent = msg; errorEl.style.display = ''; };
  const clearError = () => { errorEl.style.display = 'none'; };

  const createBtn = document.getElementById('ptyCreateBtn');
  const noLengthFits = firstFitting === null;
  createBtn.addEventListener('click', async () => {
    clearError();
    if (noLengthFits) {
      showError("You've used your free online questions for now — get the app for unlimited online Party mode.");
      return;
    }
    const name = nameInput.value.trim() || 'Host';
    localStorage.setItem('tg_mp_name', name);
    if (!resolvedThemes.length) {
      showError('No theme selected — please go back and pick a theme first.');
      return;
    }
    createBtn.disabled = true;
    try {
      await ptyCreateRoom(resolvedThemes, ptySubMode, ptyBestOf, name);
    } catch (e) {
      showError(e.message || 'Could not create a room. Please try again.');
    } finally {
      createBtn.disabled = false;
    }
  });

  document.getElementById('ptyShowJoinBtn').addEventListener('click', () => {
    document.getElementById('ptyJoinFields').style.display = '';
  });

  const topBanner = document.getElementById('ptyAppBanner');
  if (topBanner && typeof lobbyAppBannerHTML === 'function') topBanner.innerHTML = lobbyAppBannerHTML();

  // Same "get the app" nudge as lobbyAppBannerHTML above, folded into the
  // waiting-for-the-timer copy itself — appended once here rather than
  // baked into the static HTML, since which store link applies depends on
  // the visitor's platform.
  const browseNoteEl = document.getElementById('ptyBrowseNote');
  if (browseNoteEl && typeof isLimitedWeb === 'function' && isLimitedWeb()) {
    const href = (typeof isIosWeb === 'function' && isIosWeb()) ? _APP_STORE
      : (typeof isAndroidWeb === 'function' && isAndroidWeb()) ? _PLAY_STORE : '#';
    const cls = href === '#' ? 'tg-inline-link web-wall-trigger' : 'tg-inline-link';
    const promo = href === '#' ? ' data-promo="pty_browse_note"' : '';
    browseNoteEl.innerHTML += ` Or <a href="${href}" class="${cls}"${promo}>download the app</a> to play without limits.`;
  }

  // Arriving via a shared invite link — this person is joining an already
  // host-configured room, so the game-type/question-count pickers and the
  // Create/Join toggle buttons are all noise (those decisions were already
  // made by whoever sent the link). Collapse straight to "type your name and
  // join" instead of showing the full create-a-room form underneath it.
  const joinParam = getParam('ptyJoin');
  if (joinParam) {
    document.getElementById('ptySubModeGroup').style.display = 'none';
    document.getElementById('ptyBestOfGroup').style.display = 'none';
    document.getElementById('ptyCreateJoinRow').style.display = 'none';
    document.getElementById('ptySetupTitle').textContent = 'Join the Party';
    document.getElementById('ptySetupSubtitle').textContent = 'Enter your name to join this room.';
    const codeInput = document.getElementById('ptyCodeInput');
    codeInput.value = joinParam.toUpperCase();
    codeInput.readOnly = true;
    document.getElementById('ptyJoinFields').style.display = '';
    nameInput.focus();
  }

  const joinBtn = document.getElementById('ptyJoinBtn');
  joinBtn.addEventListener('click', async () => {
    clearError();
    let name = nameInput.value.trim();
    const code = document.getElementById('ptyCodeInput').value.trim().toUpperCase();
    if (!code) { showError('Enter a room code.'); return; }
    joinBtn.disabled = true;
    try {
      // A blank name defaults to a numbered "Player N" (N = current roster
      // size + 1), not a bare "Player" — with up to a roomful of silent
      // joiners, an unnumbered default would show identical, indistinguishable
      // rows in the lobby and scoreboard. A near-simultaneous double-join can
      // still race to the same number (rare, cosmetic only) — not worth a
      // reservation step for.
      if (!name) {
        const existing = await ptyGet(`multiplayer_players?room_code=eq.${code}&select=player_id`).catch(() => []);
        name = `Player ${existing.length + 1}`;
      }
      localStorage.setItem('tg_mp_name', name);
      await ptyJoinRoom(code, name);
    } catch (e) {
      showError(e.message || 'Could not join that room.');
    } finally {
      joinBtn.disabled = false;
    }
  });

  document.getElementById('ptyCopyLinkBtn').addEventListener('click', ptyCopyInviteLink);
  document.getElementById('ptyCopyCodeBtn').addEventListener('click', ptyCopyCode);
  document.getElementById('ptyCancelBtn').addEventListener('click', ptyCancelWaiting);
  document.getElementById('ptyStartBtn').addEventListener('click', ptyStartMatch);
  document.getElementById('ptyLeaveBtn').addEventListener('click', ptyLeaveMatch);

  document.querySelectorAll('#ptyScheduleSeg button').forEach(btn => {
    btn.addEventListener('click', () => ptySetSchedule(parseInt(btn.dataset.mins, 10)));
  });
  document.getElementById('ptyAdd30Btn').addEventListener('click', () => ptyAdjustSchedule(30));
  document.getElementById('ptyAdd60Btn').addEventListener('click', () => ptyAdjustSchedule(60));
  document.getElementById('ptyClearScheduleBtn').addEventListener('click', () => ptySetSchedule(0));

  ptyWireChatForm('ptyLobbyChatForm', 'ptyLobbyChatInput');
  ptyWireChatForm('ptyResultsChatForm', 'ptyResultsChatInput');

  // Tap the compact status line to open the full ranking as an overlay
  // (absolutely positioned — see .pty-live-score-panel) instead of a
  // permanent block pushing the question down. Outside click closes it.
  const liveStatusBtn = document.getElementById('ptyLiveStatus');
  const liveScorePanel = document.getElementById('ptyLiveScorePanel');
  liveStatusBtn.addEventListener('click', () => {
    const open = liveScorePanel.style.display === 'none';
    if (open) ptyRenderScoreboardInto('ptyLiveScorePanel');
    liveScorePanel.style.display = open ? '' : 'none';
    liveStatusBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', (e) => {
    if (liveScorePanel.style.display === 'none') return;
    if (e.target === liveStatusBtn || liveScorePanel.contains(e.target)) return;
    liveScorePanel.style.display = 'none';
    liveStatusBtn.setAttribute('aria-expanded', 'false');
  });

  document.getElementById('ptyNewGameBtn').addEventListener('click', ptyNewGame);
  document.getElementById('ptyBackBtn').addEventListener('click', () => {
    ptyTeardown();
    const backHref = document.getElementById('ptyBackLink')?.href;
    window.location.href = backHref || 'index.html';
  });
}

// ── Create / join ────────────────────────────────────────────────────────

async function ptyDrawQuestionSet(resolvedThemes, bestOf) {
  const { pools, themeQueues, isMashup } = await vsBuildQuestionPools(resolvedThemes);

  const hasExpert = isMashup
    ? themeQueues.some(tq => (tq.expert || []).length > 0)
    : (pools.expert || []).length > 0;
  const schedule = vsBuildSchedule(bestOf, hasExpert);
  const drawState = isMashup
    ? { pools, usedIds: new Set(vsSessionUsedIds), isMashup: true, themeQueues: shuffleArray(themeQueues), themeRotationIdx: 0 }
    : { pools, usedIds: new Set(vsSessionUsedIds) };

  const questionIds = [];
  const questionMap = new Map();
  for (const diff of schedule) {
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

async function ptyCreateRoom(resolvedThemes, subMode, bestOf, name) {
  const { questionIds, questionMap } = await ptyDrawQuestionSet(resolvedThemes, bestOf);

  const themeSlugs = resolvedThemes.map(t => t.slug).join(',');
  const myId = ptyPlayerId();
  let code, insertRes;
  for (let attempt = 0; attempt < 5; attempt++) {
    code = ptyGenCode();
    insertRes = await ptyPost('multiplayer_rooms', {
      code, game_mode: 'party', theme_slugs: themeSlugs, best_of: bestOf, question_ids: questionIds,
      host_id: myId, host_name: name, status: 'waiting', payload: { subMode }
    });
    if (insertRes.ok) break;
  }
  if (!insertRes.ok) throw new Error('Could not create a room right now — please try again.');

  try {
    await ptyPost('multiplayer_players', { room_code: code, player_id: myId, name, is_host: true });
  } catch (e) {
    throw new Error('Could not create a room right now — please try again.');
  }

  ptyRoom = {
    code, role: 'host', isHost: true, subMode, bestOf, questionIds, questionMap, resolvedThemes,
    myId, myName: name,
    currentRound: 0, eliminated: false,
    players: new Map([[myId, { name, isHost: true, eliminated: false, lastSeen: Date.now() }]]),
    scores: new Map([[myId, 0]]),
    eliminatedAtRound: new Map(),
    knownPlayerIds: new Set([myId]),
    chatLog: [], lastSeenChatId: 0, scheduledStartAt: null,
  };

  document.getElementById('ptyRoomCode').textContent = code;
  ptyRenderLobby();
  vsShow('ptyLobby');
  ptyStartCountdownTicker();
  ptyPollTimer = setInterval(ptyPollLobby, PTY_POLL_MS);
}

async function ptyJoinRoom(code, name) {
  const rows = await ptyGet(`multiplayer_rooms?code=eq.${code}&select=*`);
  const room = rows[0];
  if (!room) throw new Error('No room found with that code.');
  if (room.game_mode !== 'party') throw new Error('That code is for a different game mode.');
  if (room.status === 'abandoned') throw new Error('The host closed this room.');

  const myId = ptyPlayerId();
  // Someone who already joined this room's lobby before it started (or
  // before they wandered off) gets to rejoin mid-match or after it's
  // finished — a brand-new player_id with just the code does not, since
  // they'd have no scores/answers for the rounds already played.
  let existingMembership = [];
  try {
    existingMembership = await ptyGet(`multiplayer_players?room_code=eq.${code}&player_id=eq.${myId}&select=player_id,banned`);
  } catch (e) {}
  if (existingMembership.length && existingMembership[0].banned) throw new Error('You were removed from this room by the host.');
  const alreadyInRoom = existingMembership.length > 0;
  if (room.status !== 'waiting' && !alreadyInRoom) throw new Error('That game has already started.');

  if (room.status === 'waiting' && !alreadyInRoom
      && typeof isLimitedWeb === 'function' && isLimitedWeb() && typeof webVsOnlineRemaining === 'function'
      && room.best_of > webVsOnlineRemaining()) {
    throw new Error(`Not enough free questions left to join this game — try a shorter one or get the app.`);
  }

  const slugs = room.theme_slugs.split(',').map(s => s.trim()).filter(Boolean);
  const themes = slugs.map(s => ptyAllThemes.find(t => t.slug === s)).filter(Boolean);
  if (!themes.length) throw new Error("Could not load that room's theme.");
  const batches = await Promise.all(themes.map(t => fetchJSON(t.questionFile)));
  const questionMap = new Map();
  batches.forEach((qs, i) => {
    (Array.isArray(qs) ? qs : []).forEach(q => {
      const entry = themes.length > 1 ? { ...q, _themeTitle: themes[i].title } : q;
      questionMap.set(vsQKey(q), entry);
    });
  });

  // Omit is_host on a rejoin so this upsert (which only touches the columns
  // it sends) can't accidentally clobber an existing roster row's host flag.
  const upsertBody = { room_code: code, player_id: myId, name };
  if (!alreadyInRoom) upsertBody.is_host = false;
  const upsertRes = await ptyUpsert('multiplayer_players', upsertBody);
  if (!upsertRes.ok) throw new Error('Could not join that room — please try again.');

  const subMode = (room.payload && room.payload.subMode) || 'score';
  ptyRoom = {
    code, role: 'guest', isHost: false, subMode, bestOf: room.best_of,
    questionIds: room.question_ids, questionMap, resolvedThemes: themes, hasFullMap: true,
    myId, myName: name,
    currentRound: room.current_round || 0, eliminated: false,
    players: new Map(),
    scores: new Map([[myId, 0]]),
    eliminatedAtRound: new Map(),
    knownPlayerIds: new Set([myId]),
    chatLog: [], lastSeenChatId: 0, scheduledStartAt: room.scheduled_start_at || null,
  };

  document.getElementById('ptyRoomCode').textContent = code;

  if (room.status === 'waiting') {
    ptyRenderLobby();
    vsShow('ptyLobby');
    ptyStartCountdownTicker();
    ptyPollTimer = setInterval(ptyPollLobby, PTY_POLL_MS);
    ptyLoadChatHistory();
  } else {
    await ptyResumeIntoMatch(room);
  }
}

// Reconnect path for someone who left (or got dropped) after the host
// started the match, or who's coming back after it already finished — see
// the alreadyInRoom check in ptyJoinRoom above. Rebuilds the roster and each
// player's cumulative score from the server instead of the blank slate a
// normal join starts with, since this player already has answers on record.
async function ptyResumeIntoMatch(room) {
  const [players, answers] = await Promise.all([
    ptyGet(`multiplayer_players?room_code=eq.${ptyRoom.code}&banned=eq.false&select=player_id,name,is_host,eliminated&order=joined_at.asc`),
    ptyGet(`multiplayer_answers?room_code=eq.${ptyRoom.code}&select=player_id,score`),
  ]);
  players.forEach(p => {
    ptyRoom.players.set(p.player_id, { name: p.name, isHost: p.is_host, eliminated: p.eliminated, lastSeen: Date.now() });
    ptyRoom.knownPlayerIds.add(p.player_id);
    if (!ptyRoom.scores.has(p.player_id)) ptyRoom.scores.set(p.player_id, 0);
  });
  answers.forEach(a => {
    ptyRoom.scores.set(a.player_id, (ptyRoom.scores.get(a.player_id) || 0) + (a.score || 0));
  });

  await ptyLoadChatHistory();

  if (room.status === 'finished') {
    ptyRoom.matchEnded = true;
    ptyShowResults();
    ptyPollTimer = setInterval(ptyPollChat, PTY_POLL_MS);
    return;
  }

  ptyRoom.currentRound = room.current_round;
  ptyRoom.roundStartedAt = room.round_started_at;
  ptyRoom.matchEnded = false;
  vsShow('ptyQuestion');
  ptyRenderRound();
  ptyPollTimer = setInterval(ptyPollActive, PTY_POLL_MS);
}

async function ptyEnsureFullQuestionMap() {
  if (!ptyRoom || ptyRoom.hasFullMap) return;
  const batches = await Promise.all(ptyRoom.resolvedThemes.map(t => fetchJSON(t.questionFile)));
  batches.forEach((qs, i) => {
    (Array.isArray(qs) ? qs : []).forEach(q => {
      const entry = ptyRoom.resolvedThemes.length > 1 ? { ...q, _themeTitle: ptyRoom.resolvedThemes[i].title } : q;
      const key = vsQKey(q);
      if (!ptyRoom.questionMap.has(key)) ptyRoom.questionMap.set(key, entry);
    });
  });
  ptyRoom.hasFullMap = true;
}

// ── Lobby ────────────────────────────────────────────────────────────────

function ptyInviteLink(code) {
  return `${location.origin}${location.pathname}?ptyJoin=${code}`;
}

function ptyCopyText(text, btn) {
  const original = btn.textContent;
  const done = () => { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = original; }, 1800); };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(done).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove(); done();
    });
  }
}

async function ptyCopyInviteLink() {
  if (!ptyRoom) return;
  ptyCopyText(ptyInviteLink(ptyRoom.code), document.getElementById('ptyCopyLinkBtn'));
}

async function ptyCopyCode() {
  if (!ptyRoom) return;
  ptyCopyText(ptyRoom.code, document.getElementById('ptyCopyCodeBtn'));
}

function ptyRenderLobby() {
  if (!ptyRoom) return;
  const listEl = document.getElementById('ptyPlayerList');
  const countEl = document.getElementById('ptyPlayerCount');
  const startBtn = document.getElementById('ptyStartBtn');
  const entries = [...ptyRoom.players.entries()];
  // Someone who wandered off (no beforeunload signal on a plain navigation)
  // otherwise just sits in the roster forever looking present — reuse the
  // same lastSeen/PTY_DISCONNECT_MS staleness check the mid-match banner
  // already relies on, so the host sees who's actually here before hitting
  // Start instead of finding out mid-game.
  const isStale = ([id, p]) => id !== ptyRoom.myId && (Date.now() - p.lastSeen > PTY_DISCONNECT_MS);
  const activeEntries = entries.filter(e => !isStale(e));
  countEl.textContent = activeEntries.length === entries.length
    ? `${entries.length} joined`
    : `${activeEntries.length} joined (${entries.length - activeEntries.length} away)`;
  listEl.innerHTML = '';
  entries.forEach(([id, p], i) => {
    const away = isStale([id, p]);
    const row = document.createElement('div');
    row.className = 'pty-lobby-row' + (p._justJoined ? ' pty-just-joined' : '') + (away ? ' pty-away' : '');
    row.style.borderColor = PTY_COLORS[i % PTY_COLORS.length];
    const kickBtn = (ptyRoom.isHost && id !== ptyRoom.myId)
      ? `<button type="button" class="pty-kick-btn" data-id="${id}" title="Remove ${p.name}">✕</button>` : '';
    row.innerHTML = `<span style="color:${PTY_COLORS[i % PTY_COLORS.length]}">${p.name}</span><span style="display:flex;align-items:center;gap:8px;">${away ? '<span class="pty-away-tag">Away</span>' : ''}${p.isHost ? '<span class="pty-host-tag">Host</span>' : ''}${kickBtn}</span>`;
    listEl.appendChild(row);
  });
  listEl.querySelectorAll('.pty-kick-btn').forEach(btn => {
    btn.addEventListener('click', () => ptyKickPlayer(btn.dataset.id));
  });
  document.getElementById('ptySubModeNote').textContent =
    ptyRoom.subMode === 'survival' ? 'Survival — miss a question and you\'re out' : 'Score Attack — most correct wins';

  if (ptyRoom.isHost) {
    startBtn.style.display = '';
    startBtn.disabled = activeEntries.length < 2;
    startBtn.textContent = activeEntries.length < 2 ? 'Waiting for players…' : `Start (${activeEntries.length} players)`;
  } else {
    startBtn.style.display = 'none';
  }
  document.getElementById('ptyWaitingStatus').textContent = ptyRoom.isHost
    ? 'Share the code or link — start whenever you\'re ready.'
    : 'Waiting for the host to start…';

  ptyRenderCountdown();
}

// ── Scheduled start ──────────────────────────────────────────────────────
// Host-only controls to schedule a start time; everyone in the lobby (host
// included) sees the live countdown. There's no server/cron here — whichever
// lobby tab (host's or a guest's) is polling when the countdown hits zero is
// the one that flips the room to active (see ptyTryAutoStart), so the game
// still auto-starts even if the host's own tab isn't open at that moment.
// The host's manual Start button always works too, timer or not.

function ptyStartCountdownTicker() {
  if (!ptyRoom) return;
  if (ptyRoom.countdownTicker) clearInterval(ptyRoom.countdownTicker);
  ptyRoom.countdownTicker = setInterval(ptyRenderCountdown, 1000);
  ptyRenderCountdown();
}

function ptyStopCountdownTicker() {
  if (ptyRoom && ptyRoom.countdownTicker) clearInterval(ptyRoom.countdownTicker);
}

function ptyFormatCountdown(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(s).padStart(2, '0')}`;
}

function ptyRenderCountdown() {
  if (!ptyRoom) return;
  const scheduleGroup = document.getElementById('ptyScheduleGroup');
  const activeBlock = document.getElementById('ptyScheduleActive');
  const countdownEl = document.getElementById('ptyCountdownText');
  const browseNoteEl = document.getElementById('ptyBrowseNote');
  const segBtns = document.querySelectorAll('#ptyScheduleSeg button');
  if (!scheduleGroup || !countdownEl) return;

  scheduleGroup.style.display = ptyRoom.isHost ? '' : 'none';

  if (!ptyRoom.scheduledStartAt) {
    countdownEl.style.display = 'none';
    browseNoteEl.style.display = 'none';
    activeBlock.style.display = 'none';
    segBtns.forEach(b => b.classList.toggle('selected', b.dataset.mins === '0'));
    return;
  }

  segBtns.forEach(b => b.classList.remove('selected'));
  activeBlock.style.display = '';

  const remaining = new Date(ptyRoom.scheduledStartAt).getTime() - Date.now();
  let label;
  if (remaining > 0) {
    label = `Game starts in ${ptyFormatCountdown(remaining)}`;
  } else if (ptyRoom.players.size < 2) {
    label = 'Ready to start — waiting for at least one more player…';
  } else {
    label = 'Starting…';
  }
  countdownEl.textContent = label;
  countdownEl.style.display = '';
  browseNoteEl.style.display = ptyRoom.isHost ? 'none' : '';
}

async function ptySetSchedule(mins) {
  if (!ptyRoom || !ptyRoom.isHost) return;
  const iso = mins > 0 ? new Date(Date.now() + mins * 60000).toISOString() : null;
  ptyRoom.scheduledStartAt = iso;
  ptyRenderCountdown();
  try { await ptyPatch(`multiplayer_rooms?code=eq.${ptyRoom.code}`, { scheduled_start_at: iso }); } catch (e) {}
}

async function ptyAdjustSchedule(mins) {
  if (!ptyRoom || !ptyRoom.isHost || !ptyRoom.scheduledStartAt) return;
  const iso = new Date(new Date(ptyRoom.scheduledStartAt).getTime() + mins * 60000).toISOString();
  ptyRoom.scheduledStartAt = iso;
  ptyRenderCountdown();
  try { await ptyPatch(`multiplayer_rooms?code=eq.${ptyRoom.code}`, { scheduled_start_at: iso }); } catch (e) {}
}

// First lobby tab (host or guest) to notice the scheduled time has passed
// tries the same conditional PATCH the manual Start button uses — only one
// of them can win it (status=eq.waiting), so a race between multiple tabs
// just means the loser's PATCH matches zero rows and does nothing.
async function ptyTryAutoStart() {
  if (!ptyRoom || ptyRoom.autoStartAttempted) return;
  ptyRoom.autoStartAttempted = true;
  const startAt = new Date(Date.now() + 300).toISOString();
  try {
    const res = await ptyPatch(`multiplayer_rooms?code=eq.${ptyRoom.code}&status=eq.waiting`, {
      status: 'active', current_round: 0, round_started_at: startAt
    });
    if (res.ok && res.data.length) {
      clearInterval(ptyPollTimer);
      ptyStopCountdownTicker();
      ptyRoom.roundStartedAt = startAt;
      ptyBeginMatch();
      return;
    }
  } catch (e) {}
  ptyRoom.autoStartAttempted = false;
}

// ── Chat (lobby + results) ───────────────────────────────────────────────
// Shared multiplayer_reactions table (chatSanitize/chatCanSend live in
// app.js) — one continuous log for the room's whole lifetime, shown on the
// lobby and results screens. There's no chat during the live question
// rounds themselves; that screen moves too fast for it to be worth the
// clutter.

function ptyChatName(playerId) {
  if (playerId === ptyRoom.myId) return ptyRoom.myName;
  const p = ptyRoom.players.get(playerId);
  return p ? p.name : 'Player';
}

function ptyRenderChatInto(elId) {
  const el = document.getElementById(elId);
  if (!el || !ptyRoom) return;
  el.innerHTML = (ptyRoom.chatLog || []).map(m =>
    `<div class="tg-chat-msg${m.mine ? ' mine' : ''}">${!m.mine ? `<span class="tg-chat-name">${m.name}:</span>` : ''}${m.text}</div>`
  ).join('');
  el.scrollTop = el.scrollHeight;
}

function ptyRenderChat() {
  ptyRenderChatInto('ptyLobbyChatLog');
  ptyRenderChatInto('ptyResultsChatLog');
}

async function ptySendChatMessage(raw) {
  if (!ptyRoom) return;
  const text = chatSanitize(raw);
  if (!text || !chatCanSend(ptyRoom)) return;
  ptyRoom.chatLog.push({ text, name: ptyRoom.myName, mine: true });
  ptyRenderChat();
  try { await ptyPost('multiplayer_reactions', { room_code: ptyRoom.code, player_id: ptyRoom.myId, message: text }); } catch (e) {}
}

function ptyWireChatForm(formId, inputId) {
  const form = document.getElementById(formId);
  const input = document.getElementById(inputId);
  if (!form || !input) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    ptySendChatMessage(input.value);
    input.value = '';
  });
}

async function ptyLoadChatHistory() {
  if (!ptyRoom) return;
  try {
    const rows = await ptyGet(`multiplayer_reactions?room_code=eq.${ptyRoom.code}&order=id.asc`);
    ptyRoom.chatLog = rows.map(r => ({
      text: r.message, name: ptyChatName(r.player_id), mine: r.player_id === ptyRoom.myId,
    }));
    ptyRoom.lastSeenChatId = rows.length ? rows[rows.length - 1].id : 0;
    ptyRenderChat();
  } catch (e) {}
}

async function ptyPollChat() {
  if (!ptyRoom) return;
  try {
    const rows = await ptyGet(`multiplayer_reactions?room_code=eq.${ptyRoom.code}&id=gt.${ptyRoom.lastSeenChatId || 0}&order=id.asc`);
    rows.forEach(r => {
      ptyRoom.lastSeenChatId = Math.max(ptyRoom.lastSeenChatId || 0, r.id);
      if (r.player_id !== ptyRoom.myId) {
        ptyRoom.chatLog.push({ text: r.message, name: ptyChatName(r.player_id), mine: false });
        ptyRenderChat();
      }
    });
  } catch (e) {}
}

// Host-only, lobby-only. Bans (rather than deletes) the roster row so the
// same browser can't just rejoin — see the banned check in ptyJoinRoom.
async function ptyKickPlayer(playerId) {
  if (!ptyRoom || !ptyRoom.isHost) return;
  if (!confirm('Remove this player from the room?')) return;
  try { await ptyPatch(`multiplayer_players?room_code=eq.${ptyRoom.code}&player_id=eq.${playerId}`, { banned: true }); } catch (e) {}
  ptyRoom.players.delete(playerId);
  ptyRoom.knownPlayerIds.delete(playerId);
  ptyRenderLobby();
}

async function ptyPollLobby() {
  if (!ptyRoom) return;
  try {
    await ptyPatch(`multiplayer_players?room_code=eq.${ptyRoom.code}&player_id=eq.${ptyRoom.myId}`, { last_seen: new Date().toISOString() });
  } catch (e) {}

  let room, players;
  try {
    [room, players] = await Promise.all([
      ptyGet(`multiplayer_rooms?code=eq.${ptyRoom.code}&select=status,scheduled_start_at`).then(r => r[0]),
      ptyGet(`multiplayer_players?room_code=eq.${ptyRoom.code}&banned=eq.false&select=player_id,name,is_host,eliminated,last_seen&order=joined_at.asc`),
    ]);
  } catch (e) { return; }
  if (!ptyRoom || !room) return;

  if (room.status === 'abandoned') {
    clearInterval(ptyPollTimer);
    ptyStopCountdownTicker();
    document.getElementById('ptyWaitingStatus').textContent = 'The host closed this room.';
    document.getElementById('ptyStartBtn').style.display = 'none';
    return;
  }

  if (!ptyRoom.isHost && !players.some(p => p.player_id === ptyRoom.myId)) {
    clearInterval(ptyPollTimer);
    ptyStopCountdownTicker();
    ptyRoom = null;
    vsShow('ptySetup');
    const err = document.getElementById('ptyError');
    if (err) { err.textContent = 'You were removed from this room by the host.'; err.style.display = ''; }
    return;
  }

  const prevIds = ptyRoom.knownPlayerIds;
  const nextPlayers = new Map();
  players.forEach(p => {
    nextPlayers.set(p.player_id, {
      name: p.name, isHost: p.is_host, eliminated: p.eliminated,
      lastSeen: new Date(p.last_seen).getTime(),
      _justJoined: !prevIds.has(p.player_id) && p.player_id !== ptyRoom.myId,
    });
  });
  ptyRoom.players = nextPlayers;
  ptyRoom.knownPlayerIds = new Set(players.map(p => p.player_id));
  players.forEach(p => { if (!ptyRoom.scores.has(p.player_id)) ptyRoom.scores.set(p.player_id, 0); });
  ptyRoom.scheduledStartAt = room.scheduled_start_at || null;
  ptyRenderLobby();
  ptyPollChat();

  if (room.status === 'waiting' && ptyRoom.scheduledStartAt && ptyRoom.players.size >= 2
      && Date.now() >= new Date(ptyRoom.scheduledStartAt).getTime()) {
    ptyTryAutoStart();
  }

  if (room.status === 'active') {
    clearInterval(ptyPollTimer);
    ptyStopCountdownTicker();
    ptyBeginMatch();
  }
}

async function ptyStartMatch() {
  if (!ptyRoom || !ptyRoom.isHost) return;
  if (ptyRoom.players.size < 2) return;
  const btn = document.getElementById('ptyStartBtn');
  btn.disabled = true;
  const startAt = new Date(Date.now() + 1200).toISOString();
  try {
    const res = await ptyPatch(`multiplayer_rooms?code=eq.${ptyRoom.code}&status=eq.waiting`, {
      status: 'active', current_round: 0, round_started_at: startAt
    });
    if (!res.ok || !res.data.length) { btn.disabled = false; return; }
  } catch (e) { btn.disabled = false; return; }
  clearInterval(ptyPollTimer);
  ptyStopCountdownTicker();
  ptyRoom.roundStartedAt = startAt;
  ptyBeginMatch();
}

async function ptyCancelWaiting() {
  if (ptyPollTimer) clearInterval(ptyPollTimer);
  ptyStopCountdownTicker();
  if (ptyRoom) {
    try {
      if (ptyRoom.isHost) {
        await ptyPatch(`multiplayer_rooms?code=eq.${ptyRoom.code}`, { status: 'abandoned' });
      } else {
        await ptyDelete(`multiplayer_players?room_code=eq.${ptyRoom.code}&player_id=eq.${ptyRoom.myId}`);
      }
    } catch (e) {}
  }
  ptyRoom = null;
  vsShow('ptySetup');
}

// ── Match loop ───────────────────────────────────────────────────────────

function ptyBeginMatch() {
  if (!ptyRoom) return;
  ptyRoom.currentRound = 0;
  ptyRoom.matchEnded = false;
  vsShow('ptyQuestion');
  ptyRenderRound();
  ptyPollTimer = setInterval(ptyPollActive, PTY_POLL_MS);
}

function ptyActivePlayers() {
  return [...ptyRoom.players.entries()].filter(([, p]) => !p.eliminated);
}

function ptyBuildScoreRows() {
  const rows = [...ptyRoom.players.entries()].map(([id, p], i) => ({
    id, name: p.name, eliminated: p.eliminated, isMe: id === ptyRoom.myId,
    score: ptyRoom.scores.get(id) || 0, color: PTY_COLORS[i % PTY_COLORS.length],
    eliminatedAt: ptyRoom.eliminatedAtRound.get(id),
  }));
  rows.sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    if (a.eliminated && b.eliminated) return (b.eliminatedAt || 0) - (a.eliminatedAt || 0);
    return b.score - a.score;
  });
  return rows;
}

// Full per-player vertical ranking — used on the Results screen only, where
// seeing everyone's final placement is the point. Live gameplay uses the
// compact single-line ptyRenderLiveStatus below instead: a full N-row list
// re-rendered at the top of every question dominates the screen and pushes
// the actual question down, especially with a 10-player room.
function ptyRenderScoreboardInto(elId) {
  const el = document.getElementById(elId);
  if (!el || !ptyRoom) return;
  el.innerHTML = '';
  ptyBuildScoreRows().forEach(p => {
    const row = document.createElement('div');
    row.className = 'pty-score-row' + (p.eliminated ? ' pty-eliminated' : '') + (p.isMe ? ' pty-me' : '');
    row.style.borderColor = p.color;
    row.innerHTML = `<span class="pty-score-name" style="color:${p.color}">${p.name}${p.isMe ? ' (you)' : ''}${p.eliminated ? ' — out' : ''}</span><span class="pty-score-val">${p.score}</span>`;
    el.appendChild(row);
  });
}

function ptyRenderLiveStatus() {
  const el = document.getElementById('ptyLiveStatus');
  if (!el || !ptyRoom) return;
  const rows = ptyBuildScoreRows();
  const me = rows.find(r => r.id === ptyRoom.myId);
  if (ptyRoom.subMode === 'survival') {
    const aliveCount = rows.filter(r => !r.eliminated).length;
    el.textContent = ptyRoom.eliminated
      ? `You're out — ${aliveCount} player${aliveCount !== 1 ? 's' : ''} still in`
      : `${aliveCount} player${aliveCount !== 1 ? 's' : ''} still in`;
  } else {
    const leader = rows[0];
    const myScore = me ? me.score : 0;
    el.textContent = (me && leader && me.id === leader.id)
      ? `You're in the lead — ${myScore} pt${myScore !== 1 ? 's' : ''}`
      : `You: ${myScore} pt${myScore !== 1 ? 's' : ''} · ${leader.name} leads with ${leader.score}`;
  }
  // Keep the panel current if the player left it open across a round.
  const panel = document.getElementById('ptyLiveScorePanel');
  if (panel && panel.style.display !== 'none') ptyRenderScoreboardInto('ptyLiveScorePanel');
}

function ptyRenderRound() {
  if (!ptyRoom) return;
  const round = ptyRoom.currentRound;
  const qId = ptyRoom.questionIds[round];
  const q = ptyRoom.questionMap.get(qId);
  if (!q) { ptyFinishMatch(); return; }

  ptyRoom.eliminated = !!ptyRoom.players.get(ptyRoom.myId)?.eliminated;
  ptyRoom.answeredThisRound = ptyRoom.eliminated; // eliminated players don't need to answer
  ptyRoom.roundResolved = false;
  ptyRoom.roundDeadline = ptyRoom.roundStartedAt
    ? new Date(ptyRoom.roundStartedAt).getTime() + PTY_ROUND_SECONDS * 1000
    : Date.now() + PTY_ROUND_SECONDS * 1000;

  document.getElementById('ptyDisconnectBanner').style.display = 'none';
  document.getElementById('ptyProgress').textContent = `Question ${round + 1} of ${ptyRoom.bestOf}`;
  ptyRenderLiveStatus();

  const textEl = document.getElementById('ptyQuestionText');
  const optionsEl = document.getElementById('ptyOptions');
  const feedbackEl = document.getElementById('ptyFeedback');
  const themeLabelEl = document.getElementById('ptyQuestionTheme');
  const spectateEl = document.getElementById('ptySpectateNote');
  feedbackEl.style.display = 'none';
  textEl.textContent = q.question;
  if (themeLabelEl) {
    if (q._themeTitle) { themeLabelEl.textContent = q._themeTitle; themeLabelEl.style.display = ''; }
    else themeLabelEl.style.display = 'none';
  }

  spectateEl.style.display = ptyRoom.eliminated ? '' : 'none';

  const shuffled = shuffleQuestionOptions(q);
  optionsEl.innerHTML = '';
  shuffled.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    if (ptyRoom.eliminated) btn.disabled = true;
    else btn.addEventListener('click', () => ptySubmitAnswer(opt));
    optionsEl.appendChild(btn);
  });

  if (ptyRoom.tickTimer) clearInterval(ptyRoom.tickTimer);
  ptyTickTimer();
  ptyRoom.tickTimer = setInterval(ptyTickTimer, 250);
}

function ptyTickTimer() {
  if (!ptyRoom) return;
  const remaining = Math.max(0, ptyRoom.roundDeadline - Date.now());
  const timerEl = document.getElementById('ptyTimer');
  if (timerEl) timerEl.textContent = remaining > 0 ? `⏱ ${Math.ceil(remaining / 1000)}s` : '';
  if (remaining <= 0 && !ptyRoom.answeredThisRound) {
    ptySubmitAnswer(null);
  }
  if (remaining <= 0) ptyMaybeResolveRound();
}

async function ptySubmitAnswer(choice) {
  if (!ptyRoom || ptyRoom.answeredThisRound || ptyRoom.eliminated) return;
  ptyRoom.answeredThisRound = true;
  if (ptyRoom.tickTimer) clearInterval(ptyRoom.tickTimer);
  if (typeof webAddVsOnline === 'function') webAddVsOnline(1);

  const q = ptyRoom.questionMap.get(ptyRoom.questionIds[ptyRoom.currentRound]);
  const correct = !!q && choice === q.answer;

  document.querySelectorAll('#ptyOptions .option-btn').forEach(b => {
    b.disabled = true;
    if (choice && b.textContent === choice) b.classList.add('selected');
  });
  const feedbackEl = document.getElementById('ptyFeedback');
  feedbackEl.textContent = 'Waiting for other players…';
  feedbackEl.className = 'vs-feedback-box vs-bot-thinking';
  feedbackEl.style.display = '';

  try {
    await ptyPost('multiplayer_answers', {
      room_code: ptyRoom.code, round_num: ptyRoom.currentRound, player_id: ptyRoom.myId,
      choice, score: correct ? 1 : 0,
    });
  } catch (e) { /* poll loop keeps checking regardless */ }

  ptyMaybeResolveRound();
}

// Resolution gate generalizes mpMaybeResolveRound to N players: every
// currently-active player needs an answer row for this round, OR to be past
// PTY_DISCONNECT_MS of silence, OR the round deadline itself has passed.
// Because this already waits for every active player's row to exist (not
// just a local timer), there's no separate "did the others really answer"
// step like 2p Versus needs — the gate itself is the synchronization point.
async function ptyMaybeResolveRound() {
  if (!ptyRoom || ptyRoom.roundResolved) return;
  const timeUp = Date.now() >= ptyRoom.roundDeadline;
  if (!ptyRoom.answeredThisRound && !timeUp) return;

  let rows;
  try {
    rows = await ptyGet(`multiplayer_answers?room_code=eq.${ptyRoom.code}&round_num=eq.${ptyRoom.currentRound}&select=player_id,choice,score`);
  } catch (e) { return; }

  const now = Date.now();
  const active = ptyActivePlayers();
  const answeredIds = new Set(rows.map(r => r.player_id));
  const allDone = active.every(([id, p]) => answeredIds.has(id) || timeUp || (now - p.lastSeen > PTY_DISCONNECT_MS));
  if (!allDone) return;

  ptyRoom.roundResolved = true;
  if (ptyRoom.tickTimer) clearInterval(ptyRoom.tickTimer);

  const q = ptyRoom.questionMap.get(ptyRoom.questionIds[ptyRoom.currentRound]);
  const newlyEliminated = [];
  active.forEach(([id]) => {
    const row = rows.find(r => r.player_id === id);
    const gotPoint = !!row && row.score === 1;
    if (gotPoint) ptyRoom.scores.set(id, (ptyRoom.scores.get(id) || 0) + 1);
    if (ptyRoom.subMode === 'survival' && !gotPoint) {
      const p = ptyRoom.players.get(id);
      if (p) p.eliminated = true;
      ptyRoom.eliminatedAtRound.set(id, ptyRoom.currentRound);
      newlyEliminated.push(id);
    }
  });

  if (newlyEliminated.length) {
    const list = newlyEliminated.join(',');
    try { await ptyPatch(`multiplayer_players?room_code=eq.${ptyRoom.code}&player_id=in.(${list})`, { eliminated: true }); } catch (e) {}
  }

  const myRow = rows.find(r => r.player_id === ptyRoom.myId);
  const myCorrect = !!myRow && myRow.score === 1;
  ptyRenderReveal(q, myRow ? myRow.choice : null, myCorrect);

  setTimeout(ptyAdvanceRound, PTY_REVEAL_PAUSE_MS);
}

function ptyRenderReveal(q, myChoice, myCorrect) {
  const optionsEl = document.getElementById('ptyOptions');
  optionsEl.querySelectorAll('.option-btn').forEach(b => {
    b.disabled = true;
    if (q && b.textContent === q.answer) b.classList.add('correct-anim');
    else if (b.textContent === myChoice) b.classList.add('wrong-anim');
  });
  if (!ptyRoom.eliminated && typeof SoundFX !== 'undefined') SoundFX.play(myCorrect ? 'correct' : 'wrong');

  const feedbackEl = document.getElementById('ptyFeedback');
  if (ptyRoom.eliminated) {
    feedbackEl.textContent = q ? `Correct answer: ${q.answer}` : '';
    feedbackEl.className = 'vs-feedback-box';
  } else {
    feedbackEl.textContent = `You: ${myChoice || '(no answer)'} ${myCorrect ? '✅' : '❌'}`;
    feedbackEl.className = 'vs-feedback-box ' + (myCorrect ? 'correct' : 'wrong');
  }
  feedbackEl.style.display = '';

  document.getElementById('ptyTimer').textContent = '';
  ptyRenderLiveStatus();
}

async function ptyAdvanceRound() {
  if (!ptyRoom || ptyRoom.matchEnded) return;
  const nextRound = ptyRoom.currentRound + 1;
  const remainingActive = ptyActivePlayers().length;
  const regulationDone = nextRound >= ptyRoom.bestOf;
  const survivalDone = ptyRoom.subMode === 'survival' && remainingActive <= 1;
  const finished = regulationDone || survivalDone;
  const nextRoundStartedAt = new Date(Date.now() + 300).toISOString();

  try {
    await ptyPatch(`multiplayer_rooms?code=eq.${ptyRoom.code}&current_round=eq.${ptyRoom.currentRound}`, {
      current_round: nextRound, round_started_at: nextRoundStartedAt,
      status: finished ? 'finished' : 'active',
    });
  } catch (e) { /* another client's matching write covers us either way */ }

  if (finished) {
    ptyFinishMatch();
  } else {
    ptyRoom.currentRound = nextRound;
    ptyRoom.roundStartedAt = nextRoundStartedAt;
    ptyRenderRound();
  }
}

async function ptyPollActive() {
  if (!ptyRoom) return;

  try {
    await ptyPatch(`multiplayer_players?room_code=eq.${ptyRoom.code}&player_id=eq.${ptyRoom.myId}`, { last_seen: new Date().toISOString() });
  } catch (e) {}

  let room, players;
  try {
    [room, players] = await Promise.all([
      ptyGet(`multiplayer_rooms?code=eq.${ptyRoom.code}&select=status,current_round,round_started_at`).then(r => r[0]),
      ptyGet(`multiplayer_players?room_code=eq.${ptyRoom.code}&select=player_id,name,is_host,eliminated,last_seen`),
    ]);
  } catch (e) { return; }
  if (!ptyRoom || !room) return;

  players.forEach(p => {
    const known = ptyRoom.players.get(p.player_id);
    if (known) {
      known.eliminated = p.eliminated;
      known.lastSeen = new Date(p.last_seen).getTime();
    }
  });

  const anyStale = ptyActivePlayers().some(([id, p]) => id !== ptyRoom.myId && (Date.now() - p.lastSeen > PTY_DISCONNECT_MS));
  const banner = document.getElementById('ptyDisconnectBanner');
  if (banner) banner.style.display = anyStale ? '' : 'none';

  // Safety net: our own resolve stalled (e.g. backgrounded tab) but another
  // client already moved the room forward — jump straight to that round
  // instead of replaying the reveal (an acceptable simplification vs. 2p
  // Versus's full catch-up-with-reveal, since Party can have many players
  // and a missed reveal here is much lower-stakes than in a 1v1 match).
  if (!ptyRoom.roundResolved && room.current_round > ptyRoom.currentRound) {
    if (ptyRoom.tickTimer) clearInterval(ptyRoom.tickTimer);
    ptyRoom.currentRound = room.current_round;
    ptyRoom.roundStartedAt = room.round_started_at;
    ptyRoom.roundResolved = true;
    ptyRenderRound();
    return;
  }

  if (!ptyRoom.roundResolved) ptyMaybeResolveRound();

  if (room.status === 'finished' && !ptyRoom.matchEnded) {
    ptyFinishMatch();
  }
}

async function ptyLeaveMatch() {
  if (ptyPollTimer) clearInterval(ptyPollTimer);
  if (ptyRoom && ptyRoom.tickTimer) clearInterval(ptyRoom.tickTimer);
  if (ptyRoom) {
    try { await ptyPatch(`multiplayer_players?room_code=eq.${ptyRoom.code}&player_id=eq.${ptyRoom.myId}`, { eliminated: true }); } catch (e) {}
  }
  ptyTeardown();
  vsShow('ptySetup');
}

async function ptyFinishMatch() {
  if (!ptyRoom || ptyRoom.matchEnded) return;
  ptyRoom.matchEnded = true;
  if (ptyPollTimer) clearInterval(ptyPollTimer);
  if (ptyRoom.tickTimer) clearInterval(ptyRoom.tickTimer);
  try { await ptyPatch(`multiplayer_rooms?code=eq.${ptyRoom.code}`, { status: 'finished' }); } catch (e) {}
  ptyShowResults();
  ptyPollTimer = setInterval(ptyPollChat, PTY_POLL_MS);
}

function ptyShowResults() {
  if (!ptyRoom) { vsShow('ptySetup'); return; }

  const rows = [...ptyRoom.players.entries()].map(([id, p]) => ({
    id, name: p.name, eliminated: p.eliminated,
    score: ptyRoom.scores.get(id) || 0, eliminatedAt: ptyRoom.eliminatedAtRound.get(id),
  }));

  let winners;
  if (ptyRoom.subMode === 'survival') {
    const alive = rows.filter(r => !r.eliminated);
    winners = alive.length ? alive : rows.filter(r => r.eliminatedAt === Math.max(...rows.map(r => r.eliminatedAt ?? -1)));
  } else {
    const maxScore = Math.max(...rows.map(r => r.score));
    winners = rows.filter(r => r.score === maxScore);
  }

  const titleEl = document.getElementById('ptyResultsTitle');
  const subtitleEl = document.getElementById('ptyResultsSubtitle');
  if (winners.length === 1) {
    titleEl.textContent = `${winners[0].name} wins!`;
    subtitleEl.textContent = ptyRoom.subMode === 'survival' ? 'Last one standing' : `${winners[0].score} point${winners[0].score !== 1 ? 's' : ''}`;
  } else {
    titleEl.textContent = "It's a tie!";
    subtitleEl.textContent = winners.map(w => w.name).join(', ');
  }

  ptyRenderScoreboardInto('ptyResultsScoreboard');

  vsShow('ptyResults');
}

function ptyNewGame() {
  ptyTeardown();
  vsShow('ptySetup');
}

function ptyTeardown() {
  if (ptyPollTimer) clearInterval(ptyPollTimer);
  if (ptyRoom && ptyRoom.tickTimer) clearInterval(ptyRoom.tickTimer);
  ptyStopCountdownTicker();
  ptyRoom = null;
}

// ── Setup screen bootstrap ───────────────────────────────────────────────

async function ptyPageInit() {
  if (!document.getElementById('ptySetup')) return;

  const allThemes = await loadThemes();
  const { resolvedThemes, backHref } = vsResolveThemeContext(allThemes);

  const backLink = document.getElementById('ptyBackLink');
  if (backLink) backLink.href = backHref;
  const themeTitle = resolvedThemes.length ? resolvedThemes.map(t => t.title).join(' + ') : 'Party Mode';
  document.title = `Party Mode — ${themeTitle} | Trivia Gauntlet`;

  ptyInit(allThemes, resolvedThemes);
}

document.addEventListener('DOMContentLoaded', ptyPageInit);
