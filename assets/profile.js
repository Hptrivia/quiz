// Player profile & stats — localStorage schema and helpers

const PROFILE_KEY = "tg_profile";
const REPLAY_KEY  = "tg_replay";

const AVATAR_COLORS = [
  "#3b82f6","#8b5cf6","#ec4899","#10b981",
  "#f59e0b","#ef4444","#06b6d4","#84cc16"
];

function _defaultProfile() {
  return {
    name: "",
    email: "",
    avatarColor: AVATAR_COLORS[0],
    createdAt: new Date().toISOString().split("T")[0],
    stats: {
      marathon:   { roundsCompleted: 0, bestScore: 0, bestScoreTheme: null, totalCorrect: 0, totalAnswered: 0, themes: {} },
      challenge:  { roundsCompleted: 0, bestScore: 0, bestScoreTheme: null, totalCorrect: 0, totalAnswered: 0, themes: {} },
      survival:   { longestRun: 0, longestRunTheme: null, totalRuns: 0, themes: {} },
      triviaRush: { highestScore: 0, highestScoreTheme: null, longestStreak: 0, totalRuns: 0, themes: {} },
      wordle:     { totalSolved: 0, totalAttempted: 0, themes: {} },
      wordSearch: { totalCompleted: 0, themes: {} }
    },
    sessions: {},
    savedMashups: [],
    savedMashupStats: {}
  };
}

function getProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return _defaultProfile();
    const p = JSON.parse(raw);
    // merge any missing top-level keys from default
    const def = _defaultProfile();
    for (const k of Object.keys(def)) {
      if (p[k] === undefined) p[k] = def[k];
    }
    for (const mode of Object.keys(def.stats)) {
      if (!p.stats[mode]) p.stats[mode] = def.stats[mode];
    }
    if (!p.savedMashupStats) p.savedMashupStats = {};
    return p;
  } catch { return _defaultProfile(); }
}

function saveProfile(p) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
}

// --- Stats update helpers ---

function _ensureTheme(modeObj, slug) {
  if (!modeObj.themes[slug]) modeObj.themes[slug] = {};
  return modeObj.themes[slug];
}

function recordMarathon(themeSlug, score, total, wrongQuestions, isReplaySession, round, totalRoundsArg) {
  const p = getProfile();
  const m = p.stats.marathon;
  const t = _ensureTheme(m, themeSlug);

  m.roundsCompleted++;
  m.totalCorrect   += score;
  m.totalAnswered  += total;
  if (score > m.bestScore) { m.bestScore = score; m.bestScoreTheme = themeSlug; }

  t.rounds    = (t.rounds    || 0) + 1;
  t.correct   = (t.correct   || 0) + score;
  t.answered  = (t.answered  || 0) + total;
  if (!t.bestScore || score > t.bestScore) t.bestScore = score;
  if (!isReplaySession && round && round > (t.highestRound || 0)) {
    t.highestRound = round;
    if (totalRoundsArg) t.totalRounds = totalRoundsArg;
  }

  let cumulativeCount = 0;
  if (isReplaySession) {
    localStorage.removeItem(REPLAY_KEY);
  } else {
    let bank = [];
    try {
      const raw = localStorage.getItem(REPLAY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.mode === "marathon" && parsed.themeSlug === themeSlug) bank = parsed.questions || [];
      }
    } catch {}
    if (wrongQuestions && wrongQuestions.length) {
      const merged = [...bank, ...wrongQuestions].filter((q, i, arr) =>
        arr.findIndex(x => x.question === q.question) === i
      );
      localStorage.setItem(REPLAY_KEY, JSON.stringify({ mode: "marathon", themeSlug, questions: merged }));
      cumulativeCount = merged.length;
    } else {
      cumulativeCount = bank.length;
    }
  }

  saveProfile(p);
  return cumulativeCount;
}

function recordChallenge(themeSlug, score, total, wrongQuestions, isReplaySession, round, totalRoundsArg) {
  const p = getProfile();
  const m = p.stats.challenge;
  const t = _ensureTheme(m, themeSlug);

  m.roundsCompleted++;
  m.totalCorrect  += score;
  m.totalAnswered += total;
  if (score > m.bestScore) { m.bestScore = score; m.bestScoreTheme = themeSlug; }

  t.rounds   = (t.rounds   || 0) + 1;
  t.correct  = (t.correct  || 0) + score;
  t.answered = (t.answered || 0) + total;
  if (!t.bestScore || score > t.bestScore) t.bestScore = score;
  if (!isReplaySession && round && round > (t.highestRound || 0)) {
    t.highestRound = round;
    if (totalRoundsArg) t.totalRounds = totalRoundsArg;
  }

  let cumulativeCount = 0;
  if (isReplaySession) {
    localStorage.removeItem(REPLAY_KEY);
  } else {
    let bank = [];
    try {
      const raw = localStorage.getItem(REPLAY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.mode === "challenge" && parsed.themeSlug === themeSlug) bank = parsed.questions || [];
      }
    } catch {}
    if (wrongQuestions && wrongQuestions.length) {
      const merged = [...bank, ...wrongQuestions].filter((q, i, arr) =>
        arr.findIndex(x => x.question === q.question) === i
      );
      localStorage.setItem(REPLAY_KEY, JSON.stringify({ mode: "challenge", themeSlug, questions: merged }));
      cumulativeCount = merged.length;
    } else {
      cumulativeCount = bank.length;
    }
  }

  saveProfile(p);
  return cumulativeCount;
}

function recordSurvival(themeSlug, score) {
  const p = getProfile();
  const m = p.stats.survival;
  const t = _ensureTheme(m, themeSlug);

  m.totalRuns++;
  if (score > m.longestRun) { m.longestRun = score; m.longestRunTheme = themeSlug; }

  t.runs = (t.runs || 0) + 1;
  if (!t.longestRun || score > t.longestRun) t.longestRun = score;

  saveProfile(p);
}

function recordTriviaRush(themeSlug, score, streak) {
  const p = getProfile();
  const m = p.stats.triviaRush;
  const t = _ensureTheme(m, themeSlug);

  m.totalRuns++;
  if (score   > m.highestScore)  { m.highestScore = score; m.highestScoreTheme = themeSlug; }
  if (streak  > m.longestStreak) { m.longestStreak = streak; }

  t.runs = (t.runs || 0) + 1;
  if (!t.highestScore  || score  > t.highestScore)  t.highestScore  = score;
  if (!t.longestStreak || streak > t.longestStreak) t.longestStreak = streak;

  saveProfile(p);
}

function recordWordle(themeSlug, solved) {
  const p = getProfile();
  const m = p.stats.wordle;
  const t = _ensureTheme(m, themeSlug);

  m.totalAttempted++;
  if (solved) m.totalSolved++;

  t.attempted = (t.attempted || 0) + 1;
  if (solved) t.solved = (t.solved || 0) + 1;

  saveProfile(p);
}

function recordWordSearch(themeSlug) {
  const p = getProfile();
  const m = p.stats.wordSearch;
  const t = _ensureTheme(m, themeSlug);

  m.totalCompleted++;
  t.completed = (t.completed || 0) + 1;

  saveProfile(p);
}

// --- Mashup stats (only for saved mashups) ---

function recordMashupStats(sessionKey, mode, data) {
  const p = getProfile();
  // Only record if user has saved this mashup
  const isSaved = (p.savedMashups || []).some(m => {
    return (m.themes || []).slice().sort().join(",") === sessionKey;
  });
  if (!isSaved) return;

  if (!p.savedMashupStats) p.savedMashupStats = {};
  if (!p.savedMashupStats[sessionKey]) p.savedMashupStats[sessionKey] = {};
  const ms = p.savedMashupStats[sessionKey];
  if (!ms[mode]) ms[mode] = {};
  const m = ms[mode];

  if (mode === "marathon" || mode === "challenge") {
    m.rounds   = (m.rounds   || 0) + 1;
    m.correct  = (m.correct  || 0) + (data.correct  || 0);
    m.answered = (m.answered || 0) + (data.answered || 0);
    if (!m.bestScore || (data.correct || 0) > m.bestScore) m.bestScore = data.correct || 0;
    if (data.round && data.round > (m.highestRound || 0)) {
      m.highestRound = data.round;
      if (data.totalRounds) m.totalRounds = data.totalRounds;
    }
  } else if (mode === "survival") {
    m.runs = (m.runs || 0) + 1;
    if (!m.longestRun || (data.score || 0) > m.longestRun) m.longestRun = data.score || 0;
  } else if (mode === "wordle") {
    m.attempted = (m.attempted || 0) + 1;
    if (data.solved) m.solved = (m.solved || 0) + 1;
  } else if (mode === "wordSearch") {
    m.completed = (m.completed || 0) + 1;
  }

  saveProfile(p);
}

// --- Round-level session save ---

function saveSession(mode, themeSlug, round, score, total) {
  const p = getProfile();
  p.sessions[`${mode}_${themeSlug}`] = { round, score, total, timestamp: Date.now() };
  saveProfile(p);
}

function getSession(mode, themeSlug) {
  return getProfile().sessions[`${mode}_${themeSlug}`] || null;
}

function clearSession(mode, themeSlug) {
  const p = getProfile();
  delete p.sessions[`${mode}_${themeSlug}`];
  saveProfile(p);
}

// --- Export / Import ---

function exportProfile() {
  const data = JSON.stringify(getProfile(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "trivia-gauntlet-stats.json"; a.click();
  URL.revokeObjectURL(url);
}

function importProfile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const p = JSON.parse(e.target.result);
        if (!p.stats) throw new Error("Invalid file");
        saveProfile(p);
        resolve(p);
      } catch { reject(new Error("Could not read file")); }
    };
    reader.readAsText(file);
  });
}

// --- Avatar rendering ---

const _PERSON_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" style="width:55%;height:55%;opacity:0.9;"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>`;

function getAvatarHtml(size = 32) {
  const p      = getProfile();
  const color  = p.avatarColor || AVATAR_COLORS[0];
  const inner  = p.name
    ? `<span style="font-size:${Math.round(size * 0.44)}px;">${p.name.trim().charAt(0).toUpperCase()}</span>`
    : _PERSON_SVG;
  return `<span class="avatar-circle" style="width:${size}px;height:${size}px;background:${color};">${inner}</span>`;
}

function injectAvatarNav() {
  const slot = document.getElementById("navAvatarSlot");
  if (!slot) return;
  slot.innerHTML = `<a href="${_profilePath()}" class="avatar-nav-btn" title="My Profile">${getAvatarHtml(32)}</a>`;
  setTimeout(maybeShowProfileOnboarding, 1200);
}

function _profilePath() {
  const depth = (window.location.pathname.match(/\//g) || []).length - 1;
  return "../".repeat(Math.max(0, depth)) + "profile.html";
}

// ── Profile onboarding toast (one-time, returning users only) ─────────────────
const _ONBOARD_KEY = "tg_profile_onboard_v1";

function maybeShowProfileOnboarding() {
  // Only show for returning users — fresh visitors have no localStorage data
  if (localStorage.length === 0) return;
  // Only show once
  if (localStorage.getItem(_ONBOARD_KEY)) return;

  const profilePath = _profilePath();
  const avatarHtml  = getAvatarHtml(30);

  const toast = document.createElement("div");
  toast.className = "profile-onboard-toast";
  toast.innerHTML = `
    <div class="profile-onboard-body">
      <div class="profile-onboard-icon">${avatarHtml}</div>
      <div class="profile-onboard-text">
        <strong>✨ Your stats are now live!</strong>
        <span>Every theme you play is tracked — scores, streaks, wrong answers to replay, and survival leaderboards.</span>
      </div>
    </div>
    <div class="profile-onboard-actions">
      <a href="${profilePath}" class="profile-onboard-btn">View Profile</a>
      <button class="profile-onboard-dismiss" aria-label="Dismiss">&#10005;</button>
    </div>
  `;

  document.body.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add("profile-onboard-toast--in")));

  function dismiss() {
    localStorage.setItem(_ONBOARD_KEY, "1");
    toast.classList.remove("profile-onboard-toast--in");
    setTimeout(() => toast.remove(), 350);
  }

  toast.querySelector(".profile-onboard-dismiss").addEventListener("click", dismiss);
  // Mark as seen when navigating to profile (won't show again on return)
  toast.querySelector(".profile-onboard-btn").addEventListener("click", () => {
    localStorage.setItem(_ONBOARD_KEY, "1");
  });
}

document.addEventListener("DOMContentLoaded", injectAvatarNav);

// ── Android Web Question Limit ───────────────────────────────────────────────

const _PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.trivia.trivia_gauntlet';
const _WEB_LIMITS = { Q: 30, Wordle: 2, WS: 1, Ep: 1 };

function isAndroidWeb() {
  return /android/i.test(navigator.userAgent)
    && !(window.Capacitor && (window.Capacitor.isNativePlatform?.() || window.Capacitor.isNative));
}

if (window.Capacitor && (window.Capacitor.isNativePlatform?.() || window.Capacitor.isNative)) {
  document.body.classList.add('in-app');
}

function _webCount(key)     { return parseInt(localStorage.getItem('tgWeb' + key) || '0'); }
function _addWebCount(key, n) { if (isAndroidWeb()) localStorage.setItem('tgWeb' + key, _webCount(key) + (n || 1)); }

function webAddQ(n)     { _addWebCount('Q', n); }
function webAddWordle() { _addWebCount('Wordle', 1); }
function webAddWS()     { _addWebCount('WS', 1); }
function webAddEp()     { _addWebCount('Ep', 1); }

function isWebQLimit()      { return isAndroidWeb() && _webCount('Q')      >= _WEB_LIMITS.Q; }
function isWebWordleLimit() { return isAndroidWeb() && _webCount('Wordle') >= _WEB_LIMITS.Wordle; }
function isWebWSLimit()     { return isAndroidWeb() && _webCount('WS')     >= _WEB_LIMITS.WS; }
function isWebEpLimit()     { return isAndroidWeb() && _webCount('Ep')     >= _WEB_LIMITS.Ep; }
function webQUsed()         { return _webCount('Q'); }

function webWallHTML(msg) {
  return `<div class="android-wall">
    <div class="android-wall-icon">📱</div>
    <h3>${msg || "You've used your free questions!"}</h3>
    <p>Download the free app for unlimited trivia — no limits, no hassle.</p>
    <a href="${_PLAY_STORE}" class="primary-btn" target="_blank">Get the Free App</a>
  </div>`;
}

function webQCounterHTML() {
  if (!isAndroidWeb()) return '';
  return `<p class="web-q-counter">${webQUsed()}/${_WEB_LIMITS.Q} free questions used</p>`;
}

function _injectAndroidBanner() {
  if (!isAndroidWeb()) return;
  const path = window.location.pathname;
  const isLobby = path.endsWith('/index.html') || path === '/' || path.endsWith('/index')
    || path.endsWith('/category.html')
    || /\/themes\//.test(path)
    || /\/(wordle|wordsearch)\//.test(path);
  if (!isLobby) return;
  const banner = document.createElement('div');
  banner.className = 'android-cta-banner';
  banner.innerHTML = `📱 Get 100+ questions for all themes on the <a href="${_PLAY_STORE}" target="_blank">free Android app</a>`;
  const anchor = document.querySelector('.homepage-intro') || document.querySelector('main, .container');
  if (anchor && anchor.classList.contains('homepage-intro')) anchor.before(banner);
  else if (anchor) anchor.prepend(banner);
}

function _checkWebPageWall() {
  if (!isAndroidWeb()) return;
  const path = window.location.pathname;
  let msg = null;
  if (/\/(play|challenge|survival|versus|trivia-rush|mashup-play)\.html$/.test(path) && isWebQLimit())
    msg = "You've used your 30 free questions on Android browser.";
  else if (path.endsWith('/episode.html') && isWebEpLimit())
    msg = "You've played your free episode on Android browser.";
  else if ((path.endsWith('/wordle.html') || /\/wordle\//.test(path)) && isWebWordleLimit())
    msg = "You've played your 2 free Wordle words on Android browser.";
  else if ((path.endsWith('/wordsearch.html') || /\/wordsearch\//.test(path)) && isWebWSLimit())
    msg = "You've played your free Word Search on Android browser.";
  if (!msg) return;
  const overlay = document.createElement('div');
  overlay.className = 'android-wall-overlay';
  overlay.innerHTML = webWallHTML(msg);
  document.body.appendChild(overlay);
}

document.addEventListener('DOMContentLoaded', () => {
  _injectAndroidBanner();
  _checkWebPageWall();
});
