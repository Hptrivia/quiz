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

// ── Web Question Limit (Android, iOS, Desktop) ───────────────────────────────

const _PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.trivia.trivia_gauntlet';
const _APP_STORE  = 'https://apps.apple.com/app/trivia-gauntlet/id6749189557';
const _WEB_LIMITS = { Q: 30, Wordle: 2, WS: 1, Ep: 1 };

const _isNative = !!(window.Capacitor && (window.Capacitor.isNativePlatform?.() || window.Capacitor.isNative));

// ── KILL SWITCH: mobile-web "pay to keep playing on web" option (2026-06-17) ──
// Master on/off for the whole mobile-web unlock experiment. Set to `false` to
// instantly restore the OLD behaviour with no other edits:
//   • mobile walls/banner go back to app-download only (no "Keep playing on web")
//   • footer link + theme unlock card revert to desktop-web only
//   • the end-of-game auto-redirect runs uninterrupted (never cancels on tap)
// (The /remove-ads.html "add to home screen" line is self-contained and harmless
//  when this is off — mobile simply has no link pointing visitors to that page.)
const WEB_PAY_OPTION = true;

// ── SUB-TOGGLE: "Keep playing on web" button on MOBILE walls/banner (2026-06-18) ──
// Narrower than WEB_PAY_OPTION above. Controls ONLY the secondary "Keep playing on
// web" button on the mobile-web app-install walls/banner (and the matching
// auto-redirect cancel-on-tap). Set to `false` to show the OLD mobile banner with
// just the "Get the free app" option — while STILL keeping the "Unlock Full Access"
// link in the footer + the theme-page unlock card (those follow WEB_PAY_OPTION).
// Desktop walls are unaffected (they have their own inline "Unlock all questions").
// Currently OFF (app-only) — flip to `true` to show the "Keep playing on web" button.
const WEB_PAY_OPTION_MOBILE = false;

function isAndroidWeb() { return /android/i.test(navigator.userAgent) && !_isNative; }
function isIosWeb() {
  if (_isNative) return false;
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  // iPadOS 13+ Safari defaults to "Request Desktop Website", so it reports a
  // Macintosh UA with no "iPad" string. A real Mac has no touchscreen, so a
  // touch-capable "Macintosh" is an iPad in disguise.
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}
// Desktop = any limited-web visitor that isn't iOS or Android web. Defined as the
// negation so it can never disagree with the mobile checks (esp. the iPad case).
function isDesktopWeb() { return !_isNative && !isIosWeb() && !isAndroidWeb(); }
// Self-contained premium check (mirrors app.js's isPremiumUser so the gate works
// even on pages that don't load app.js). A valid unlock code sets this expiry.
function _isPremium() {
  const e = localStorage.getItem('adsRemovedUntil');
  return !!e && new Date(e) > new Date();
}
// Any browser visitor (not the native app) is subject to the free-play limit —
// unless they've unlocked full access with a code.
function isLimitedWeb() { return !_isNative && !_isPremium(); }

if (_isNative) {
  document.body.classList.add('in-app');
  // The bottom banner now shows on every in-app screen, game/quiz pages
  // included, so reserve bottom space everywhere to avoid a first-paint jump.
  document.body.classList.add('has-banner');
}

// On DESKTOP web, questions reset DAILY (build a return habit) — you can't
// install a phone app from a browser, so "come back tomorrow" is the ask.
// On iOS/Android web the 30 questions are a ONE-TIME taster (no reset) — the
// wall pushes the free app instead. Wordle/Word Search/Episode stay lifetime.
const _DAILY_KEYS = { Q: true };
function _todayStr() { return new Date().toISOString().split('T')[0]; }
function _maybeDailyReset(key) {
  if (!_DAILY_KEYS[key]) return;
  if (!isDesktopWeb()) return; // iOS/Android: one-time allowance, never resets
  const dk = 'tgWeb' + key + 'Date';
  const today = _todayStr();
  if (localStorage.getItem(dk) !== today) {
    localStorage.setItem('tgWeb' + key, '0');
    localStorage.setItem(dk, today);
  }
}

function _webCount(key)     { _maybeDailyReset(key); return parseInt(localStorage.getItem('tgWeb' + key) || '0'); }
function _addWebCount(key, n) { if (isLimitedWeb()) localStorage.setItem('tgWeb' + key, _webCount(key) + (n || 1)); }

function webAddQ(n)     { _addWebCount('Q', n); }
function webAddWordle() { _addWebCount('Wordle', 1); }
function webAddWS()     { _addWebCount('WS', 1); }
function webAddEp()     { _addWebCount('Ep', 1); }

function isWebQLimit()      { return isLimitedWeb() && _webCount('Q')      >= _WEB_LIMITS.Q; }
function isWebWordleLimit() { return isLimitedWeb() && _webCount('Wordle') >= _WEB_LIMITS.Wordle; }
function isWebWSLimit()     { return isLimitedWeb() && _webCount('WS')     >= _WEB_LIMITS.WS; }
function isWebEpLimit()     { return isLimitedWeb() && _webCount('Ep')     >= _WEB_LIMITS.Ep; }
function webQUsed()         { return _webCount('Q'); }

// Store call-to-action for the paywall, tailored to the visitor's platform.
// Mobile users (already on a phone) get a one-tap store button. Desktop users
// can't install a phone app from their browser, so they get a QR code instead —
// they scan it with their phone and land on the right store. The QR points at
// /app.html, which redirects iPhones → App Store and Android → Play Store.
const _APP_REDIRECT = '/app.html';
function _appUrl() { return location.origin + _APP_REDIRECT; }

// The visitor's store URL on mobile web (empty elsewhere — desktop can't install
// a phone app, so it never auto-redirects).
function _storeUrl() {
  if (isAndroidWeb()) return _PLAY_STORE;
  if (isIosWeb())     return _APP_STORE;
  return '';
}

// ── House-ad click tracking ──────────────────────────────────────────────────
// Logs every tap on an app-install banner / house-ad to Supabase so we can
// compare which placement actually drives store visits. This tracks CLICKS, not
// installs — the app store is a black box, so we measure intent (which banner
// gets tapped, by how many unique sessions) and read installs/day separately
// from the install table. Web-only: in-app users already installed. Reuses the
// public anon key already shipped for leaderboards. Fire-and-forget with
// `keepalive` so the request survives the navigation to the store.
const _PROMO_TRACK_URL = 'https://avasbapxzgmpcosixgio.supabase.co/rest/v1/promo_clicks';
const _PROMO_TRACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YXNiYXB4emdtcGNvc2l4Z2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjM4MzUsImV4cCI6MjA5NTIzOTgzNX0.DLNnasmaQ1hdKXb2xqXrTBnBjISo0RxOiwy7TrlN9bg';
// Stable random id per browser, so we can tell 100 taps from 1 person apart from
// 100 people (unique sessions vs raw clicks). Lives in localStorage.
function _promoSessionId() {
  let s = localStorage.getItem('tg_sid');
  if (!s) {
    s = (window.crypto && crypto.randomUUID && crypto.randomUUID())
      || (Date.now() + '-' + Math.random().toString(36).slice(2));
    localStorage.setItem('tg_sid', s);
  }
  return s;
}
function _promoPlatform() {
  if (isAndroidWeb()) return 'android';
  if (isIosWeb())     return 'ios';
  return 'desktop';
}
function trackPromoClick(bannerId, themeSlug) {
  if (_isNative || !bannerId) return; // only browser taps matter
  try {
    fetch(_PROMO_TRACK_URL, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: _PROMO_TRACK_KEY,
        Authorization: 'Bearer ' + _PROMO_TRACK_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        banner_id: bannerId,
        theme_slug: themeSlug || null,
        platform: _promoPlatform(),
        session_id: _promoSessionId()
      })
    }).catch(() => {});
  } catch (e) {}
}
// One delegated CAPTURE-phase listener covers every current + future banner: tag
// the clickable element with data-promo="<banner_id>" (and optionally
// data-promo-theme="<slug>") and the tap is logged before navigation. Capture
// phase so it still fires when a banner's own handler calls stopPropagation, and
// we never preventDefault here so the normal store link / wall still works.
document.addEventListener('click', (e) => {
  const el = e.target.closest && e.target.closest('[data-promo]');
  if (el) trackPromoClick(el.dataset.promo, el.dataset.promoTheme);
}, true);

function _webStoreLinksHTML() {
  // Secondary "pay to keep playing on web, ad-free" link — the SAME unlock page
  // desktop uses. Shown under the app button on every mobile wall so a visitor who
  // won't install an app can still continue (a €0 segment otherwise). Styled as a
  // subtle outlined link so the free app stays the primary call to action.
  const webUnlock = (WEB_PAY_OPTION && WEB_PAY_OPTION_MOBILE) ? `<div class="web-or"><span>or</span></div>
  <a href="/remove-ads.html" class="primary-btn web-unlock-btn">Keep playing on web</a>` : '';
  if (isAndroidWeb()) return `<a href="${_PLAY_STORE}" class="primary-btn" data-promo="wall_store_btn" target="_blank">Get the free app</a>${webUnlock}`;
  if (isIosWeb())     return `<a href="${_APP_STORE}"  class="primary-btn" data-promo="wall_store_btn" target="_blank">Get the free app</a>${webUnlock}`;
  // Desktop / unknown: a compact button opens the QR in an overlay (keeps the
  // inline wall small), OR pay to unlock all questions right here on desktop.
  return `<button type="button" class="primary-btn web-qr-trigger" data-promo="wall_store_btn" data-qr="${_appUrl()}">📱 Get the free app</button>
  <div class="web-or"><span>or</span></div>
  <a href="/remove-ads.html" class="primary-btn web-unlock-btn">Unlock all questions here</a>`;
}

// QR rendering — the library (assets/qrcode.min.js) is only fetched the first
// time a desktop paywall actually appears, so it never loads on normal pages.
let _qrLibLoading = null;
function _loadQrLib() {
  if (window.qrcode) return Promise.resolve();
  if (_qrLibLoading) return _qrLibLoading;
  _qrLibLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/assets/qrcode.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return _qrLibLoading;
}

function _renderQr(box) {
  if (box._qrDone) return;
  box._qrDone = true;
  const url = box.dataset.qr;
  const fallback = () => {
    box.innerHTML = `<a href="${_APP_STORE}" target="_blank">App Store</a> · <a href="${_PLAY_STORE}" target="_blank">Google Play</a>`;
  };
  _loadQrLib().then(() => {
    try {
      const qr = window.qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    } catch (e) { fallback(); }
  }).catch(fallback);
}

// QR shown on demand in a dismissible overlay (keeps the inline wall compact).
function _openQrOverlay(url) {
  if (document.querySelector('.qr-overlay')) return;
  const overlay = document.createElement('div');
  overlay.className = 'qr-overlay';
  overlay.innerHTML = `
    <div class="qr-overlay-card">
      <button type="button" class="qr-overlay-close" aria-label="Close">✕</button>
      <h3>Get the free app</h3>
      <div class="web-qr-box" data-qr="${url}">…</div>
      <p class="web-qr-cap">📱 Scan with your phone camera to download free</p>
    </div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('.qr-overlay-close')) overlay.remove();
  });
  document.body.appendChild(overlay);
  _renderQr(overlay.querySelector('.web-qr-box'));
}

// Promo wall opened by clicking the lobby banner on desktop — the SAME card the
// end-of-game screens show (QR to grab the free app + the desktop "unlock all
// questions" option), but dismissible. Reuses _webStoreLinksHTML() so it always
// matches whatever the result-screen wall offers.
function _openWebWallOverlay(opts) {
  if (document.querySelector('.android-wall-overlay')) return;
  const title = (opts && opts.title) || 'Get 100+ questions for every theme 🎉';
  const body  = (opts && opts.body)  || 'Unlock unlimited questions — or scan to grab the free app.';
  const overlay = document.createElement('div');
  overlay.className = 'android-wall-overlay';
  overlay.innerHTML = `<div class="android-wall">
    <button type="button" class="qr-overlay-close" aria-label="Close">✕</button>
    <div class="android-wall-icon">📱</div>
    <h3>${title}</h3>
    <p>${body}</p>
    ${_webStoreLinksHTML()}
  </div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('.qr-overlay-close')) overlay.remove();
  });
  document.body.appendChild(overlay);
}

// Mobile-web only: a result-screen button that teases an app-only feature
// (e.g. "Reveal Answers", "Unlimited Lifelines"). Tapping opens the existing
// dismissible app-promo banner (_openWebWallOverlay) with feature-specific copy —
// honouring the click and showing the benefit instead of cold-redirecting to the
// store. Desktop web has its own upsell links (→ remove-ads.html); the native app
// has the real rewarded feature; premium is excluded (isLimitedWeb covers both
// native + premium). Inserted before "Report a Question" in the given cta-row.
function injectWebFeatureTease(ctaRow, label, title, body) {
  if (!ctaRow) return;
  if (!isLimitedWeb() || isDesktopWeb()) return; // mobile web (iOS/Android) only
  if (ctaRow.querySelector('.web-feature-tease')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'secondary-btn web-feature-tease';
  btn.textContent = label;
  btn.addEventListener('click', () => _openWebWallOverlay({ title, body }));
  const report = [...ctaRow.querySelectorAll('a.secondary-btn')]
    .find(a => /Report a Question/i.test(a.textContent));
  if (report) ctaRow.insertBefore(btn, report);
  else ctaRow.appendChild(btn);
}

// In-quiz "Skip"/"Next batch" links (Marathon page, Challenge round, Episode)
// bypass the answered-question counter — without this a tapper could farm
// unlimited free batches without ever finishing a round. Gate them positionally;
// `blocked` is the caller's per-mode rule (e.g. challenge safeRound >= 3).
//
// MOBILE WEB ONLY. Desktop's 30 questions reset DAILY, so a positional "always
// block page 1" would wrongly lock out a returning desktop visitor the next day;
// desktop instead stays gated by the daily counter at the result/page-load walls.
// (chat 2026-06-14)
function gateWebSkip(linkEl, blocked, opts) {
  if (!linkEl || !blocked || !isLimitedWeb()) return;
  if (isDesktopWeb()) return; // mobile web (iOS/Android) only
  linkEl.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    _openWebWallOverlay({
      title: (opts && opts.title) || "Get 100+ questions for every theme 🎉",
      body: (opts && opts.body) ||
        "Download Trivia Gauntlet to keep playing — it's free."
    });
  });
}

// "Replay them all" (replaying your missed questions) is reserved for the app on
// web — one global capture listener covers every Challenge + Marathon result and
// resume screen. Native app + premium replay normally; limited web (mobile +
// desktop) gets the app-promo wall instead.
document.addEventListener('click', (e) => {
  const link = e.target.closest && e.target.closest('a[href*="replay=1"]');
  if (!link || !isLimitedWeb()) return;
  e.preventDefault();
  e.stopPropagation();
  _openWebWallOverlay({
    title: 'Replay missed questions in the app 🎉',
    body: "Replaying the ones you got wrong is a free feature in the app — grab Trivia Gauntlet to use it."
  });
}, true);

// Walls are injected from several places (result screens, modals…), so watch
// the DOM and fill any QR placeholder as soon as it mounts. Also wire the
// "Get the free app" buttons to open the QR overlay.
function _watchForQr() {
  if (!isDesktopWeb()) return;
  const scan = (root) => root.querySelectorAll?.('.web-qr-box[data-qr]').forEach(_renderQr);
  scan(document);
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches?.('.web-qr-box[data-qr]')) _renderQr(n);
        else scan(n);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', (e) => {
    const w = e.target.closest?.('.web-wall-trigger');
    if (w) { e.preventDefault(); _openWebWallOverlay(); return; }
    const t = e.target.closest?.('.web-qr-trigger');
    if (t) { e.preventDefault(); _openQrOverlay(t.dataset.qr || _appUrl()); }
  });
}

// Mobile web only: when a question-limit wall mounts (e.g. end of marathon at 30),
// count down a few seconds so the player sees their score/rank, then send them to
// the app store. Most cold Reddit traffic won't tap a button, so we flip the
// default from opt-in to opt-out — they can still tap the button early, or leave.
function _watchForWallRedirect() {
  if (!isIosWeb() && !isAndroidWeb()) return;
  const arm = (el) => {
    if (el._redirectArmed) return;
    // Only the end-of-game result wall auto-redirects. The same wall is also used
    // as a full-screen gate when browsing INTO a locked page (_checkWebPageWall),
    // wrapped in .android-wall-overlay — leave those a manual choice so exploring
    // related quizzes doesn't fire you off to the store on every page load.
    if (el.closest('.android-wall-overlay')) return;
    el._redirectArmed = true;
    const url = el.dataset.store;
    if (!url) return;
    // Inject the countdown line only now, so it never lingers on walls that don't
    // actually redirect (e.g. the page-load gate, which bails out above).
    const note = document.createElement('p');
    note.className = 'wall-redirect-note';
    note.innerHTML = 'Taking you to the app in <span class="wall-redirect-count">4</span>…';
    el.appendChild(note);
    const countEl = note.querySelector('.wall-redirect-count');
    let n = 4;
    let timer = null;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      countEl.textContent = n;
      if (n <= 0) {
        // Passive auto-redirect (nobody tapped) — log under its own id so it's
        // distinguishable from an actual banner/button tap in the data.
        trackPromoClick('wall_auto_redirect', null);
        window.location.href = url;
        return;
      }
      n--; timer = setTimeout(tick, 1000);
    };
    // The auto-redirect serves the passive majority who won't tap anything. But the
    // moment a visitor actually engages with the wall (taps it, or scrolls to read
    // the "Keep playing on web" option), cancel the countdown — don't yank an
    // intentful chooser off to the store mid-decision. The wall (and its web-unlock
    // link) then stays put for as long as they're on the result screen.
    if (WEB_PAY_OPTION && WEB_PAY_OPTION_MOBILE) {
      const cancel = () => {
        if (cancelled) return;
        cancelled = true;
        clearTimeout(timer);
        note.remove();
      };
      el.addEventListener('pointerdown', cancel);
      window.addEventListener('scroll', cancel, { once: true, passive: true });
    }
    tick();
  };
  const scan = (root) => root.querySelectorAll?.('.web-wall-redirect[data-store]').forEach(arm);
  scan(document);
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches?.('.web-wall-redirect[data-store]')) arm(n);
        else scan(n);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}

// Footer link — every web visitor (desktop + mobile), site-wide (lives here in
// profile.js, which loads on every page, so every footer gets it). Non-premium
// users see an "Unlock Full Access" upsell; premium users get a "Membership" link
// so they can still reach remove-ads.html to view their status / re-enter a code.
// Skipped in the native app, which has its own store-billed unlock.
function _injectFooterUnlock() {
  if (_isNative) return;
  if (!WEB_PAY_OPTION && !isDesktopWeb()) return; // off → desktop-web only (old behaviour)
  if (/\/remove-ads\.html$/.test(window.location.pathname)) return;
  const premium = _isPremium();
  document.querySelectorAll('.footer-links').forEach(el => {
    if (el.querySelector('a[href*="remove-ads"]')) return;
    const a = document.createElement('a');
    a.href = '/remove-ads.html';
    a.className = 'footer-highlight';
    a.textContent = premium ? 'Membership' : 'Unlock Full Access';
    el.appendChild(a);
  });
}

function webWallHTML(msg, themeName, noun, countOverride, noRedirect, bodyOverride) {
  const item = noun || 'questions';
  // Some callers (e.g. Challenge mode's per-round wall) enforce a smaller free
  // allowance than the global daily limit — let them say the right number.
  const qCount = countOverride || _WEB_LIMITS.Q;
  // Questions are a DAILY allowance — the wall reflects that they reset tomorrow.
  // (All callers pass the same "questions" message, so we override it centrally.)
  if (item === 'questions') {
    // Desktop web: a DAILY allowance that resets tomorrow.
    if (isDesktopWeb()) {
      return `<div class="android-wall">
    <div class="android-wall-icon">📱</div>
    <h3>You've used today's ${qCount} questions 🎉</h3>
    <p>${themeName ? `Come back tomorrow for more ${themeName} questions — or get unlimited access now.` : `Come back tomorrow for more questions — or get unlimited access now.`}</p>
    ${_webStoreLinksHTML()}
  </div>`;
    }
    // iOS / Android web: a one-time taster — get the free app to keep
    // going. Auto-redirects to the store after a few seconds — but only on the
    // result screen: _watchForWallRedirect arms it (skipping the .android-wall-overlay
    // page-load gate) and INJECTS the "Taking you to the app…" countdown itself, so
    // the note only ever shows where a redirect is genuinely happening.
    return `<div class="android-wall web-wall-redirect" data-store="${_storeUrl()}">
    <div class="android-wall-icon">📱</div>
    <h3>You've played your ${qCount} questions 🎉</h3>
    <p>${themeName ? `Download Trivia Gauntlet for more ${themeName} questions.` : `Download Trivia Gauntlet for more questions.`}</p>
    ${_webStoreLinksHTML()}
  </div>`;
  }
  // Wordle / Word Search / Episode are lifetime limits — unchanged copy. Same
  // mobile-web auto-redirect as the questions wall (armed + countdown injected by
  // _watchForWallRedirect on the result screen; page-load gate stays manual).
  const moreLine = bodyOverride
    ? bodyOverride
    : (themeName
        ? `Download Trivia Gauntlet for more ${themeName} ${item}.`
        : `Download Trivia Gauntlet for more ${item}.`);
  // Some callers want the wall present but WITHOUT the 4s store auto-redirect —
  // e.g. the "no next episode" screen, where we keep the email-notify card as a
  // real choice and don't want to yank the visitor off to the store.
  const rdClass = noRedirect ? '' : ' web-wall-redirect';
  const rdStore = noRedirect ? '' : ` data-store="${_storeUrl()}"`;
  return `<div class="android-wall${rdClass}"${rdStore}>
    <div class="android-wall-icon">📱</div>
    <h3>${msg || "Yay! You've finished this one 🎉"}</h3>
    <p>${moreLine}</p>
    ${_webStoreLinksHTML()}
  </div>`;
}

function webQCounterHTML() {
  return '';
}

function _injectWebBanner() {
  if (!isLimitedWeb()) return;
  const path = window.location.pathname;
  const isLobby = path.endsWith('/index.html') || path === '/' || path.endsWith('/index')
    || path.endsWith('/category.html')
    || /\/categories\//.test(path)
    || /\/themes\//.test(path)
    || /\/(wordle|wordsearch)\//.test(path);
  if (!isLobby) return;
  // The WHOLE banner is one clickable element. Mobile web taps straight to the
  // visitor's store. Desktop can't install a phone app from a browser, so its
  // click opens the same wall card the end-of-game screens show (QR to grab the
  // app + the desktop "unlock all questions" option) — see _openWebWallOverlay,
  // wired via the `.web-wall-trigger` listener in _watchForQr().
  const banner = document.createElement('a');
  banner.className = 'android-cta-banner';
  banner.dataset.promo = 'lobby_banner';
  banner.textContent = '📱 Get 100+ questions for all themes — Click to download the free app →';
  // Navigate in the SAME tab (no target=_blank): more reliable than a new tab,
  // which strict private/incognito modes and in-app webviews often block.
  if (isIosWeb()) {
    banner.href = _APP_STORE;
  } else if (isAndroidWeb()) {
    banner.href = _PLAY_STORE;
  } else {
    banner.href = '#';
    banner.classList.add('web-wall-trigger');
  }
  const anchor = document.querySelector('.homepage-intro') || document.querySelector('main');
  if (anchor && anchor.classList.contains('homepage-intro')) anchor.before(banner);
  else if (anchor) anchor.prepend(banner);
}

function _checkWebPageWall() {
  if (!isLimitedWeb()) return;
  const path = window.location.pathname;
  let msg = null;
  let noun = 'questions';
  if (/\/(play|challenge|survival|versus|trivia-rush|mashup-play)\.html$/.test(path) && isWebQLimit())
    msg = "Yay! You've answered 30 questions";
  else if (path.endsWith('/episode.html') && isWebEpLimit()) {
    msg = "Yay! You've played an episode"; noun = 'episodes';
  }
  else if ((path.endsWith('/wordle.html') || /\/wordle\//.test(path)) && isWebWordleLimit()) {
    msg = "Yay! You've played 2 Wordle words"; noun = 'Wordles';
  }
  else if ((path.endsWith('/wordsearch.html') || /\/wordsearch\//.test(path)) && isWebWSLimit()) {
    msg = "Yay! You've finished the Word Search"; noun = 'Word Searches';
  }
  if (!msg) return;
  const overlay = document.createElement('div');
  overlay.className = 'android-wall-overlay';
  overlay.innerHTML = webWallHTML(msg, null, noun);
  document.body.appendChild(overlay);
}

// On theme pages, add a card as the last game-mode card — every web visitor
// (desktop + mobile). Non-premium users get an "Unlock Full Access" upsell;
// premium users get a "Membership" card so they can reach remove-ads.html to view
// their status. Skipped in the native app, which has its own store-billed unlock.
function _injectThemeUnlockCard() {
  if (_isNative) return;
  if (!WEB_PAY_OPTION && !isDesktopWeb()) return; // off → desktop-web only (old behaviour)
  if (!/\/themes\//.test(window.location.pathname)) return;
  const grid = document.querySelector('.panel .grid') || document.querySelector('.grid');
  if (!grid || grid.querySelector('.unlock-card')) return;
  const card = document.createElement('a');
  card.className = 'card unlock-card';
  card.href = '/remove-ads.html';
  if (_isPremium()) {
    card.innerHTML = `<h3>Membership</h3><p>View your active subscription</p>`;
  } else {
    card.innerHTML = `<h3>Unlock Full Access</h3><p>Unlimited questions + reveal answers &amp; lifelines</p>`;
  }
  grid.appendChild(card);
}

// Profile page, mobile web only: a tappable banner above the stats. Web stats
// live only in this browser's localStorage (lost on clear/new device), so the
// honest pull is "save your streak & stats in the app". Mirrors the homepage
// .android-cta-banner — a direct store tap on mobile web. No-op anywhere the
// #profileAppBanner slot is absent (i.e. every page except profile.html).
function _injectProfileAppBanner() {
  if (!isLimitedWeb() || isDesktopWeb()) return; // mobile web (iOS/Android) only
  const slot = document.getElementById('profileAppBanner');
  if (!slot || slot.querySelector('.android-cta-banner')) return;
  const banner = document.createElement('a');
  banner.className = 'android-cta-banner';
  banner.textContent = "📱 Don't lose your streak — save your stats & scores in the free app →";
  banner.href = isIosWeb() ? _APP_STORE : _PLAY_STORE;
  slot.appendChild(banner);
}

// Small "save your progress" install nudge for the Challenge round 1-2 result
// screens (mobile web, non-premium, non-native). Mirrors the homepage/profile
// .android-cta-banner — one tappable strip straight to the visitor's store. A
// soft, passive nudge sitting under the score line; deliberately distinct from
// the round-3 install wall + auto-redirect. Returns '' when it shouldn't show;
// the round gate (rounds 1-2 only) lives at the call site in challenge.js.
function resultAppBannerHTML() {
  if (!isLimitedWeb()) return ''; // non-native, non-premium (covers mobile + desktop web)
  const label = '📱 Download the free app to save your progress &amp; play more questions and topics &rarr;';
  if (isIosWeb())     return `<a class="android-cta-banner result-app-banner" data-promo="result_app_banner" href="${_APP_STORE}">${label}</a>`;
  if (isAndroidWeb()) return `<a class="android-cta-banner result-app-banner" data-promo="result_app_banner" href="${_PLAY_STORE}">${label}</a>`;
  // Desktop can't install a phone app from a browser, so the click opens the QR /
  // app-promo wall (same as the homepage banner) via the delegated .web-wall-trigger listener.
  return `<a class="android-cta-banner result-app-banner web-wall-trigger" data-promo="result_app_banner" href="#">${label}</a>`;
}

document.addEventListener('DOMContentLoaded', () => {
  _injectWebBanner();
  _checkWebPageWall();
  _watchForQr();
  _watchForWallRedirect();
  _injectThemeUnlockCard();
  _injectFooterUnlock();
  _injectProfileAppBanner();
});
