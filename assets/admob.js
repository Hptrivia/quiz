// AdMob — only active inside the Capacitor native app

// Per-platform ad mode. One switch per OS:
//   'off'  — no ads at all. Use while a platform is still pending AdMob
//            approval: the app runs completely ad-free (no "Test Ad"
//            placeholders shown to real users).
//   'test' — Google's sample/test ad units. Safe (no invalid-traffic risk),
//            earns nothing, and every ad renders a visible "Test Ad" badge.
//   'live' — your real production ad units (earns revenue). Only flip a
//            platform to 'live' AFTER AdMob has approved that platform.
//
const ADMOB_MODE_BY_PLATFORM = {
  ios: 'live',
  android: 'test',
};
const _ADMOB_PLATFORM = window.Capacitor?.getPlatform?.();

// The separate "Trivia Gauntlet - Premium" Android app (com.trivia.triviagauntlet_premium)
// is a plain hand-written WebView wrapper (Kotlin, not Capacitor — no window.Capacitor
// bridge at all) that loads this same live site and tags its WebView user agent
// directly — no ads regardless of platform ad mode above.
const _IS_PREMIUM_APP = /TriviaGauntletPremium/.test(navigator.userAgent || '');

const ADMOB_MODE = _IS_PREMIUM_APP ? 'off' : (ADMOB_MODE_BY_PLATFORM[_ADMOB_PLATFORM] || 'off');
const ADMOB_TEST_MODE = ADMOB_MODE === 'test';
const ADMOB_ADS_ENABLED = ADMOB_MODE !== 'off';

// Real production ad unit IDs, one set per platform (each platform is its own
// AdMob app with its own unit IDs — never share IDs across platforms).
const _ADMOB_LIVE_IDS = {
  android: {
    banner:       'ca-app-pub-9506123851374920/2446089149',
    interstitial: 'ca-app-pub-9506123851374920/5206994172',
    rewarded:     'ca-app-pub-9506123851374920/8819925805',
  },
  ios: {
    banner:       'ca-app-pub-9506123851374920/4221888010',
    interstitial: 'ca-app-pub-9506123851374920/1512953871',
    rewarded:     'ca-app-pub-9506123851374920/1704453155',
  },
};
const _ADMOB_TEST_IDS = {
  banner:       'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded:     'ca-app-pub-3940256099942544/5224354917',
};
const ADMOB_IDS = ADMOB_TEST_MODE
  ? _ADMOB_TEST_IDS
  : (_ADMOB_LIVE_IDS[_ADMOB_PLATFORM] || _ADMOB_TEST_IDS);

function isInApp() {
  return !!(window.Capacitor && (window.Capacitor.isNativePlatform?.() || window.Capacitor.isNative));
}

// Pings a Telegram bot the first time the app is ever opened on a device,
// giving a near-real-time "new install" alert. Fires once per device (guarded
// by localStorage), only inside the native app.
const _INSTALL_PING = {
  // Telegram token lives server-side as a Supabase secret — never in this file.
  endpoint: 'https://avasbapxzgmpcosixgio.supabase.co/functions/v1/clever-task',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YXNiYXB4emdtcGNvc2l4Z2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjM4MzUsImV4cCI6MjA5NTIzOTgzNX0.DLNnasmaQ1hdKXb2xqXrTBnBjISo0RxOiwy7TrlN9bg',
};
async function _pingNewInstall() {
  if (!isInApp()) return;
  if (localStorage.getItem('_installPinged')) return;
  localStorage.setItem('_installPinged', '1'); // set first so a failure can't double-fire on retry
  const platform = (window.Capacitor.getPlatform?.() || 'unknown');
  try {
    await fetch(_INSTALL_PING.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: _INSTALL_PING.anonKey,
        Authorization: `Bearer ${_INSTALL_PING.anonKey}`,
      },
      body: JSON.stringify({ platform }),
    });
  } catch (e) {
    // Network hiccup on first open — clear the flag so the next launch retries.
    localStorage.removeItem('_installPinged');
    console.warn('[install-ping] failed', e);
  }
}

// Same idea, for the premium apps (iOS WKWebView + Android WebView — neither
// uses Capacitor, so isInApp() is always false for them and _pingNewInstall
// above never fires). Detected off the UA tag alone, fires once per device.
async function _pingPremiumInstall() {
  if (!_IS_PREMIUM_APP) return;
  if (localStorage.getItem('_premiumInstallPinged')) return;
  localStorage.setItem('_premiumInstallPinged', '1');
  const platform = /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'ios' : 'android';
  try {
    await fetch(_INSTALL_PING.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: _INSTALL_PING.anonKey,
        Authorization: `Bearer ${_INSTALL_PING.anonKey}`,
      },
      body: JSON.stringify({ platform, app: 'premium' }),
    });
  } catch (e) {
    localStorage.removeItem('_premiumInstallPinged');
    console.warn('[premium-install-ping] failed', e);
  }
}

// "Which Character Are You?" quiz pages (character-quiz/<slug>.html, not the
// index hub). They opt out of the page-load interstitial via data-defer-game-ad
// and call adMobShowGameStartInterstitial() when Start is pressed.
function _isCharacterQuizPage(path) {
  return /\/character-quiz\/(?!index\.html$)[^/]+\.html$/.test(path);
}

function isGamePage() {
  const path = window.location.pathname;
  if (_isCharacterQuizPage(path)) return true;
  // Keep this list in sync with getRoundStartParams() below — both must cover every
  // in-game page so the banner stays hidden during play (mashup-* were missing,
  // which left a banner on the mashup trivia-rush / marathon gameplay screens).
  return /\/(play|challenge|survival|episode|trivia-rush|mashup-trivia-rush|versus|wordle|wordsearch|mashup-play|daily|daily-wordle|daily-whoami|daily-order|daily-blitz|category-blitz-solo|category-blitz-versus)\.html$/.test(path);
}

function getRoundStartParams() {
  const path = window.location.pathname;
  if (_isCharacterQuizPage(path)) return true;
  return /\/(play|challenge|survival|episode|trivia-rush|mashup-trivia-rush|versus|wordle|wordsearch|mashup-play|daily|daily-wordle|daily-whoami|daily-order|daily-blitz|category-blitz-solo|category-blitz-versus)\.html$/.test(path);
}

// Category Blitz is a brand-new mode — existing users hit it for the first
// time too, often long after they've already burned the one-time whole-app
// _iadFirstOpenDone grace on some other mode. This is a second, separate
// "first ever" flag scoped only to Category Blitz's three pages, so everyone
// gets one ad-free look at the new mode regardless of _iadFirstOpenDone.
const _IAD_CATBLITZ_FIRST_OPEN_KEY = '_iadCatBlitzFirstOpenDone';
function _isCatBlitzPath(path) {
  return /\/(daily-blitz|category-blitz-solo|category-blitz-versus)\.html$/.test(path);
}

// Same one-time grace for each newer daily mode, one flag per mode so a user
// gets a free first game in every new mode they try.
const _IAD_NEW_MODE_FIRST_OPEN_KEYS = {
  'daily-whoami': '_iadWhoAmIFirstOpenDone',
  'daily-order': '_iadOrderFirstOpenDone',
};
function _newModeFirstOpenKey(path) {
  const m = path.match(/\/([^/]+)\.html$/);
  return m ? _IAD_NEW_MODE_FIRST_OPEN_KEYS[m[1]] || null : null;
}

let _AdMob = null;
let _adMobReady = false;
let _rewardedLoaded = false;
let _interstitialLoaded = false;
let _attRequested = false;

// App Tracking Transparency.
// In @capacitor-community/admob v8 the `requestTrackingAuthorization: true`
// option passed to initialize() is a NO-OP — initialize() only calls
// MobileAds.start(). ATT must be requested explicitly via this dedicated
// method, and it MUST happen before any tracking-capable data is collected
// (i.e. before the ads SDK starts). iOS only; shows the system prompt once.
async function _requestATT() {
  if (_attRequested) return;
  _attRequested = true;
  if (!isInApp() || window.Capacitor.getPlatform?.() !== 'ios') return;
  try {
    const AdMob = window.Capacitor.Plugins.AdMob;
    // iOS only presents the ATT prompt while the app is foreground-active.
    // On a cold launch the webview can run this a beat too early, so wait
    // until the page is visible and give the launch transition a moment.
    if (document.visibilityState !== 'visible') {
      await new Promise((r) => {
        const on = () => {
          if (document.visibilityState === 'visible') {
            document.removeEventListener('visibilitychange', on);
            r();
          }
        };
        document.addEventListener('visibilitychange', on);
        on();
      });
    }
    await new Promise((r) => setTimeout(r, 800));
    await AdMob.requestTrackingAuthorization();
    // Surfaces the resulting status in the console for debugging (use Safari
    // Web Inspector against the device). 0=notDetermined 1=restricted
    // 2=denied 3=authorized.
    try {
      const s = await AdMob.trackingAuthorizationStatus();
      console.log('[AdMob] ATT status', s);
    } catch {}
  } catch (e) {
    _attRequested = false; // allow a retry if the call threw before prompting
    console.warn('[AdMob] ATT request failed', e);
  }
}

// sessionStorage key for the start-of-game interstitial: mode + show, so a new
// show is a new game (another start ad, cooldown permitting) while later
// rounds/episodes of the same show aren't. Pages with no show (dailies,
// Category Blitz) stay once per mode per session. `url`: Location or URL.
function _iadGameKey(url) {
  const perShowPath = url.pathname.match(/\/(wordsearch|wordle)\/([^/]+)\.html$/);
  if (perShowPath) return `_iad_${perShowPath[1]}_${perShowPath[2]}`;
  const m = url.pathname.match(/\/([^/]+)\.html$/);
  const params = new URLSearchParams(url.search);
  const show = params.get('theme') || params.get('themes');
  return '_iad_' + (m ? m[1] : 'other') + (show ? '_' + show : '');
}

async function adMobInit() {
  if (!isInApp() || !ADMOB_ADS_ENABLED || _adMobReady) return;
  const _modeKey = _iadGameKey(window.location);
  // Skip the interstitial-first if we're still inside the cooldown window — no
  // point preparing/showing one we'd be blocked from displaying anyway.
  // data-defer-game-ad: pages with an in-page setup step before play actually
  // starts (Category Blitz Versus's match setup screen) opt out of the
  // automatic page-load interstitial and call adMobShowGameStartInterstitial()
  // themselves once the user presses Start/Resume — "page load" isn't "game
  // start" there the way it is for challenge/marathon/episode/daily/etc.
  const isGameStart = getRoundStartParams() && document.body?.dataset.deferGameAd !== '1';
  // One-time grace period: give a brand-new install its first game with no
  // interstitial (Reddit reports of users bouncing after the very first ad).
  // Gated on isGameStart so the home/menu page can't consume the flag before
  // the user ever reaches a game.
  const isFirstEverOpen = (isGameStart || _isMpJoinLink()) && !localStorage.getItem('_iadFirstOpenDone');
  if (isFirstEverOpen) localStorage.setItem('_iadFirstOpenDone', '1');
  // Separate one-time grace for Category Blitz specifically — see
  // _IAD_CATBLITZ_FIRST_OPEN_KEY above. Independent of isFirstEverOpen: a
  // long-time user with that flag already consumed still gets one free look
  // at this new mode.
  const isFirstCatBlitzOpen = isGameStart && _isCatBlitzPath(window.location.pathname)
    && !localStorage.getItem(_IAD_CATBLITZ_FIRST_OPEN_KEY);
  if (isFirstCatBlitzOpen) localStorage.setItem(_IAD_CATBLITZ_FIRST_OPEN_KEY, '1');
  const _newModeKey = _newModeFirstOpenKey(window.location.pathname);
  const isFirstNewModeOpen = isGameStart && !!_newModeKey && !localStorage.getItem(_newModeKey);
  if (isFirstNewModeOpen) localStorage.setItem(_newModeKey, '1');
  const _iadFirstGameGrace = isFirstEverOpen || isFirstCatBlitzOpen || isFirstNewModeOpen;
  const isMpJoinLink = _isMpJoinLink();
  const showInterstitialFirst = ((isGameStart && !sessionStorage.getItem(_modeKey)) || isMpJoinLink)
    && !_interstitialOnCooldown() && !_iadFirstGameGrace;
  const _removeLoader = () => {
    document.getElementById('_adLoader')?.remove();
    document.body.style.visibility = 'visible';
  };
  if (showInterstitialFirst) {
    sessionStorage.setItem(_modeKey, '1');
    document.body.style.visibility = 'hidden';
    const loader = document.createElement('div');
    loader.id = '_adLoader';
    loader.style.cssText = 'position:fixed;inset:0;background:#000;display:flex;align-items:center;justify-content:center;z-index:99999;color:#fff;font-size:1.2em';
    loader.textContent = 'Loading...';
    document.body.appendChild(loader);
    document.body.style.visibility = 'visible';
    // Safety net: never let the loader block the app, even if the ad hangs or fails.
    setTimeout(_removeLoader, 5000);
  }
  try {
    _AdMob = window.Capacitor.Plugins.AdMob;
    // Show the ATT prompt and wait for the user's choice BEFORE the ads SDK
    // starts (initialize() triggers MobileAds.start()).
    await _requestATT();
    await _AdMob.initialize({
      initializeForTesting: ADMOB_TEST_MODE,
      testingDevices: ['26D6708FEB5BC4BACECD99956C13350E', 'F8913AC8-ADD9-4288-9400-793D409E2C2B'],
    });
    _adMobReady = true;
    if (showInterstitialFirst) {
      try {
        await _AdMob.prepareInterstitial({ adId: ADMOB_IDS.interstitial });
        _interstitialLoaded = true;
        await adMobShowInterstitial();
      } catch (e) {
        console.warn('[AdMob] interstitial-first failed', e);
      }
      _removeLoader();
    }
    // Only request ads on pages that can actually show them. Browsing pages
    // (themes/categories/home) never trigger an interstitial or rewarded, so
    // preloading there just burns ad requests that never become impressions.
    if (isGamePage()) {
      _adMobPreloadRewarded();
      _adMobPreloadInterstitial();
    }
    adMobShowBanner();
  } catch (e) {
    _removeLoader();
    console.warn('[AdMob] init failed', e);
  }
}

// Same "once per app session, skip on cooldown / first-ever-open" gate as the
// automatic page-load interstitial-first above, exposed for pages that opted
// out via data-defer-game-ad — call this when the user actually presses
// Start/Resume, not on page load. No-op outside the app / with ads off.
async function adMobShowGameStartInterstitial() {
  if (!isInApp() || !ADMOB_ADS_ENABLED || !_adMobReady) return;
  const _modeKey = _iadGameKey(window.location);
  const isFirstEverOpen = !localStorage.getItem('_iadFirstOpenDone');
  if (isFirstEverOpen) localStorage.setItem('_iadFirstOpenDone', '1');
  const isFirstCatBlitzOpen = _isCatBlitzPath(window.location.pathname)
    && !localStorage.getItem(_IAD_CATBLITZ_FIRST_OPEN_KEY);
  if (isFirstCatBlitzOpen) localStorage.setItem(_IAD_CATBLITZ_FIRST_OPEN_KEY, '1');
  if (sessionStorage.getItem(_modeKey) || _interstitialOnCooldown() || isFirstEverOpen || isFirstCatBlitzOpen) return;
  sessionStorage.setItem(_modeKey, '1');
  await adMobShowInterstitial();
}

async function _adMobPreloadRewarded() {
  if (!_adMobReady) return;
  try {
    await _AdMob.prepareRewardVideoAd({ adId: ADMOB_IDS.rewarded });
    _rewardedLoaded = true;
  } catch (e) {
    _rewardedLoaded = false;
  }
}

async function _adMobPreloadInterstitial() {
  if (!_adMobReady) return;
  // No point preparing one we can't show for the whole cooldown window — it
  // would likely expire unshown, which is exactly the wasted-request pattern
  // that tanks show rate. We lazy-load on demand once the cooldown clears.
  if (_interstitialOnCooldown()) return;
  try {
    await _AdMob.prepareInterstitial({ adId: ADMOB_IDS.interstitial });
    _interstitialLoaded = true;
  } catch (e) {
    _interstitialLoaded = false;
  }
}

// Shows rewarded ad. Returns true if user earned the reward, false if skipped/failed.
async function adMobShowRewarded() {
  if (!_adMobReady) return false;
  if (!_rewardedLoaded) {
    await _adMobPreloadRewarded();
    if (!_rewardedLoaded) return false;
  }
  return new Promise((resolve) => {
    let earned = false;

    async function cleanup(result) {
      try { (await rewardHandle).remove(); } catch {}
      try { (await dismissHandle).remove(); } catch {}
      try { (await failHandle).remove(); } catch {}
      _rewardedLoaded = false;
      _adMobPreloadRewarded();
      resolve(result);
    }

    const rewardHandle  = _AdMob.addListener('onRewardedVideoAdReward',      () => { earned = true; });
    const dismissHandle = _AdMob.addListener('onRewardedVideoAdDismissed',    () => cleanup(earned));
    const failHandle    = _AdMob.addListener('onRewardedVideoAdFailedToShow', () => cleanup(false));

    _AdMob.showRewardVideoAd().catch(() => cleanup(false));
  });
}

// Minimum gap between full-screen ads: 3 min, except 60s on the multiplayer
// pages (games there are often 1-2 min, so 3 min skipped every other game).
// Decided by the page here, in one place, so every show/preload path agrees.
const _IAD_COOLDOWN_MS = 3 * 60 * 1000;
const _IAD_MP_COOLDOWN_MS = 60 * 1000;
function _interstitialOnCooldown() {
  const isMpPage = /\/(versus|party|category-blitz-versus)\.html$/.test(window.location.pathname);
  const last = parseInt(localStorage.getItem('_iadLastShown') || '0');
  return Date.now() - last < (isMpPage ? _IAD_MP_COOLDOWN_MS : _IAD_COOLDOWN_MS);
}

// Online multiplayer (Versus / Category Blitz Versus / Party): an ad every time
// a player creates or joins a room, not once per session — the session flag let
// players start new rooms ad-free all session. Always shown before the player
// is in a live match, so nobody misses questions: on Create Room (the host then
// waits in the lobby), on opening a join link / tapping Join Room (before the
// name + Join tap that starts the match), and at Category Blitz's match start
// (each side runs its own round timer there).
function _isMpJoinLink() {
  return /\/(versus|party)\.html$/.test(window.location.pathname)
    && /[?&](mpJoin|ptyJoin)=/.test(window.location.search);
}
async function adMobShowMultiplayerInterstitial() {
  if (!isInApp() || !ADMOB_ADS_ENABLED || !_adMobReady) return;
  // Same one-time first-game graces as everywhere else.
  if (!localStorage.getItem('_iadFirstOpenDone')) { localStorage.setItem('_iadFirstOpenDone', '1'); return; }
  if (_isCatBlitzPath(window.location.pathname) && !localStorage.getItem(_IAD_CATBLITZ_FIRST_OPEN_KEY)) {
    localStorage.setItem(_IAD_CATBLITZ_FIRST_OPEN_KEY, '1');
    return;
  }
  await adMobShowInterstitial();
}

// Shows interstitial ad (no reward, auto-dismissed).
async function adMobShowInterstitial() {
  if (!_adMobReady) return;
  if (_interstitialOnCooldown()) return;
  // We skip preloading during cooldown, so the slot can be empty even though
  // we're now clear to show — lazy-load it just-in-time.
  if (!_interstitialLoaded) {
    await _adMobPreloadInterstitial();
    if (!_interstitialLoaded) return;
  }
  try {
    await _AdMob.showInterstitial();
    localStorage.setItem('_iadLastShown', Date.now().toString());
  } catch (e) {
    console.warn('[AdMob] interstitial error', e);
  }
  _interstitialLoaded = false;
  _adMobPreloadInterstitial();
}

async function adMobShowBanner() {
  if (!_adMobReady) return;
  // Bottom anchored adaptive banner (Google's recommended placement). The
  // has-banner reserve pushes content/buttons up above the banner strip, so it
  // stays clear of the answer/submit buttons and never covers the top nav.
  try {
    await _AdMob.showBanner({
      adId: ADMOB_IDS.banner,
      adSize: 'ADAPTIVE_BANNER',
      position: 'BOTTOM_CENTER',
      margin: 0,
    });
    document.body.classList.add('has-banner');
  } catch (e) {
    console.warn('[AdMob] banner error', e);
  }
}

async function adMobHideBanner() {
  if (!_adMobReady) return;
  try { await _AdMob.hideBanner(); } catch {}
  document.body.classList.remove('has-banner');
}

// The premium ad-free app now exists on both platforms.
function _showRemoveAdsEntryPoints() {
  return _ADMOB_PLATFORM === 'android' || _ADMOB_PLATFORM === 'ios';
}

function _offerRewardedLifeline(name, onEarned, promptHtml, onCancel) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:9999';
  overlay.innerHTML = `<div style="background:#1e1e2e;padding:24px;border-radius:12px;text-align:center;max-width:280px;color:#fff">
    <p style="margin:0 0 16px;font-size:1.1em">${promptHtml || `Watch a short ad to use <strong>${name}</strong>?`}</p>
    <button id="_adYes" style="margin-right:8px;padding:10px 20px;border-radius:8px;background:#6c63ff;color:#fff;border:none;cursor:pointer;font-size:1em">Watch Ad</button>
    <button id="_adNo" style="padding:10px 20px;border-radius:8px;background:#444;color:#fff;border:none;cursor:pointer;font-size:1em">Cancel</button>
    ${_showRemoveAdsEntryPoints() ? `<div style="margin-top:14px"><button id="_adRemoveAds" style="padding:10px 20px;border-radius:8px;background:#22c55e;border:none;color:#0b1220;font-weight:700;cursor:pointer;font-size:0.95em">🚫 Remove Ads</button></div>` : ''}
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#_adNo').onclick = () => { overlay.remove(); if (onCancel) onCancel(); };
  overlay.querySelector('#_adYes').onclick = async () => {
    overlay.remove();
    const earned = await adMobShowRewarded();
    if (earned || !_rewardedLoaded) onEarned(); // proceed if earned OR ad failed to load
  };
  overlay.querySelector('#_adRemoveAds')?.addEventListener('click', () => {
    overlay.remove();
    window.location.href = '/remove-ads.html';
  });
}

// App-only "Reveal Answers" button for marathon/challenge result screens: watch a
// rewarded ad to reveal the correct answers for the round's missed questions.
// Placed between "Next Round" and "Report a Question". Non-premium only (premium
// already has the in-quiz reveal toggle). Web is unaffected (isInApp gate).
function injectRevealMissedButton(wrongQuestions, ctaRow) {
  if (!ctaRow || !Array.isArray(wrongQuestions) || !wrongQuestions.length) return;
  if (typeof isInApp !== 'function' || !isInApp()) return;
  if (!ADMOB_ADS_ENABLED) return;
  if (typeof isPremiumUser === 'function' && isPremiumUser()) return;
  if (ctaRow.querySelector('.reveal-missed-btn')) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'secondary-btn reveal-missed-btn';
  btn.textContent = 'Reveal Answers';
  btn.addEventListener('click', () => {
    _offerRewardedLifeline('Reveal Answers', () => {
      if (btn.dataset.revealed) return;
      btn.dataset.revealed = '1';
      const panel = document.createElement('div');
      panel.className = 'revealed-answers';
      const h = document.createElement('h3');
      h.textContent = 'Missed Answers';
      panel.appendChild(h);
      wrongQuestions.forEach((q) => {
        // Reuse Daily Challenge's missed-answer styling for a consistent look.
        const item = document.createElement('div');
        item.className = 'daily-missed-item';
        const qp = document.createElement('p');
        qp.className = 'daily-missed-q';
        qp.textContent = q.question || '';
        const ap = document.createElement('p');
        ap.className = 'daily-missed-a';
        ap.textContent = '✓ ' + (q.answer || '');
        item.appendChild(qp);
        item.appendChild(ap);
        panel.appendChild(item);
      });
      ctaRow.insertAdjacentElement('afterend', panel);
      btn.remove();
    }, 'Watch a short ad to <strong>reveal the answers</strong>?');
  });

  const report = ctaRow.querySelector('a[href*="contact"]');
  if (report) ctaRow.insertBefore(btn, report);
  else ctaRow.appendChild(btn);
}

document.addEventListener('click', async (e) => {
  // Two ways a click is rewarded-gated:
  //  1. An explicit control carrying data-rewarded-href (Next Round/Episode/Word).
  //  2. Any <a> inside a container marked data-reward-gate="1" — used to gate all
  //     related cards + "try another theme" search links on a result screen at once
  //     (the marker is added only when that screen is on its rewarded cadence).
  let href, label, promptHtml;
  const explicit = e.target.closest('[data-rewarded-href]');
  if (explicit) {
    href  = explicit.dataset.rewardedHref;
    label = explicit.dataset.rewardedLabel || explicit.textContent.trim() || 'the next round';
    // "Next Round" / "Next Episode" — you're continuing the game, not "using" a thing.
    promptHtml = `Watch a short ad to continue to the <strong>${label.toLowerCase()}</strong>?`;
  } else {
    const gate = e.target.closest('[data-reward-gate="1"]');
    const link = gate && e.target.closest('a[href]');
    if (gate && link && gate.contains(link)) {
      href  = link.getAttribute('href');
      label = link.querySelector('h3')?.textContent.trim() || link.textContent.trim() || 'the next quiz';
      // Related cards + "try another theme" links are quizzes you go play, not
      // a lifeline you "use" — so phrase the prompt accordingly.
      promptHtml = `Watch a short ad to play <strong>${label}</strong>?`;
    }
  }
  if (!href || !isInApp() || !ADMOB_ADS_ENABLED) return;
  e.preventDefault();
  _offerRewardedLifeline(label, () => {
    try {
      const dest = new URL(href, window.location.href);
      sessionStorage.setItem(_iadGameKey(dest), '1');
    } catch {}
    window.location.href = href;
  }, promptHtml);
});

// App-only "Remove Ads" card appended to the mode grid on theme pages. Theme
// pages are static HTML generated from one build template (hundreds of files),
// so this is injected at runtime rather than baked into the template — the mode
// grid is the .grid that's a direct child of .panel (theme pages also have a
// second .grid nested inside .theme-related-quizzes, which we must not touch).
function injectRemoveAdsThemeCard() {
  if (!isInApp() || !ADMOB_ADS_ENABLED || !_showRemoveAdsEntryPoints()) return;
  if (!/\/themes\//.test(window.location.pathname)) return;
  const grid = document.querySelector('.panel > .grid');
  if (!grid || grid.querySelector('.remove-ads-card')) return;
  const card = document.createElement('a');
  card.href = '/remove-ads.html';
  card.className = 'card remove-ads-card';
  card.innerHTML = `<h3>Remove Ads <span style="font-size:0.65rem;font-weight:700;background:#22c55e;color:#fff;padding:2px 7px;border-radius:4px;vertical-align:middle;margin-left:6px;">GO AD-FREE</span></h3><p>No ads, ever — get the ad-free app</p>`;
  grid.appendChild(card);
}

// App-only "Remove Ads" link appended to the standard site footer (present on
// nearly every page, generated and static alike) so the option is reachable
// from anywhere in the app, not just theme pages.
function injectRemoveAdsFooterLink() {
  if (!isInApp() || !ADMOB_ADS_ENABLED || !_showRemoveAdsEntryPoints()) return;
  const footerLinks = document.querySelector('.footer-links');
  if (!footerLinks || footerLinks.querySelector('.remove-ads-footer-link')) return;
  const link = document.createElement('a');
  link.href = '/remove-ads.html';
  link.className = 'remove-ads-footer-link footer-highlight';
  link.textContent = 'Remove Ads';
  footerLinks.prepend(link);
}

async function _bootInApp() {
  injectRemoveAdsThemeCard();
  injectRemoveAdsFooterLink();
  if (ADMOB_ADS_ENABLED) {
    // ATT first: the prompt must appear before any data that could be used to
    // track the user is collected (ads SDK start, IP-geolocated install ping).
    await _requestATT();
  }
  // Install ping always fires (it's our own install analytics, not ad tracking).
  _pingNewInstall();
  // With ads off (platform pending approval) the app stays fully ad-free.
  if (ADMOB_ADS_ENABLED) {
    // The banner now shows from init on game pages (top) and browse pages
    // (bottom), so the old result-screen banner watcher is no longer needed.
    adMobInit();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  _pingPremiumInstall();
  if (isInApp()) {
    _bootInApp();
  } else {
    let tries = 0;
    const retry = setInterval(() => {
      if (isInApp()) {
        clearInterval(retry);
        _bootInApp();
      }
      else if (++tries > 25) clearInterval(retry);
    }, 200);
  }
});

// ── Daily streak repair (shared by Daily Trivia / Wordle / Mashup / Blitz) ──
// Missed only yesterday with a streak worth keeping → offer to save it.
// Non-premium in-app: costs a rewarded ad. Premium: saved automatically.
// Web (no rewarded ads there): not offered, streak resets as before.
// Repairing just marks yesterday as played, so today's play continues the
// count via each mode's own update-streak function. Never touches score
// history or leaderboards. Max once per 7 days per mode.
//
// Test switch: add ?testmissed=1 to any daily page — fakes a 12-day streak
// last played two days ago and offers the repair on web too (the "ad"
// auto-completes there). Stays on for the rest of that tab's session and
// keeps leaderboard submissions off. Overwrites that mode's streak on this
// device, so use a private window.
const SR_MIN_STREAK = 3;
const SR_COOLDOWN_DAYS = 7;

function srDaysAgoKey(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

function srIsTest() {
  if (new URLSearchParams(window.location.search).get('testmissed') === '1') return true;
  try { return sessionStorage.getItem('srRepairTest') === '1'; } catch { return false; }
}

// stateKeys: that mode's "already played today" / web-limit keys to clear.
function srSetupTestIfRequested(streakKey, stateKeys) {
  if (new URLSearchParams(window.location.search).get('testmissed') !== '1') return;
  localStorage.setItem(streakKey, JSON.stringify({ current: 12, best: 12, lastCompleted: srDaysAgoKey(2) }));
  localStorage.removeItem(`${streakKey}RepairAt`);
  localStorage.removeItem(`${streakKey}RepairDeclined_${srDaysAgoKey(0)}`);
  (stateKeys || []).forEach(k => localStorage.removeItem(k));
  try { sessionStorage.setItem('srRepairTest', '1'); } catch {}
}

function srCanRepair(streakKey) {
  const streak = JSON.parse(localStorage.getItem(streakKey) || '{"current":0,"best":0,"lastCompleted":""}');
  if (streak.lastCompleted !== srDaysAgoKey(2)) return false;
  if (streak.current < SR_MIN_STREAK) return false;
  if (localStorage.getItem(`${streakKey}RepairDeclined_${srDaysAgoKey(0)}`)) return false;
  const lastRepair = localStorage.getItem(`${streakKey}RepairAt`);
  if (lastRepair && lastRepair > srDaysAgoKey(SR_COOLDOWN_DAYS)) return false;
  return true;
}

// Same check as app.js's isPremiumUser() — daily-challenges.html doesn't load
// app.js, so its cards need this copy.
function srIsPremium() {
  if (typeof isPremiumUser === 'function') return isPremiumUser();
  if (/TriviaGauntletPremium/.test(navigator.userAgent || '')) return true;
  const expiry = localStorage.getItem('adsRemovedUntil');
  return !!expiry && new Date(expiry) > new Date();
}

function srOfferedHere() {
  return srIsPremium() || (isInApp() && ADMOB_ADS_ENABLED);
}

function srRepair(streakKey) {
  const streak = JSON.parse(localStorage.getItem(streakKey) || '{"current":0,"best":0,"lastCompleted":""}');
  streak.lastCompleted = srDaysAgoKey(1);
  localStorage.setItem(streakKey, JSON.stringify(streak));
  localStorage.setItem(`${streakKey}RepairAt`, srDaysAgoKey(0));
}

// Call on page load, only when today's game hasn't been played yet.
function srMaybeOfferRepair(streakKey) {
  if (!srCanRepair(streakKey)) return;
  if (srIsPremium()) { srRepair(streakKey); return; }
  if (!srOfferedHere() && !srIsTest()) return;
  const streak = JSON.parse(localStorage.getItem(streakKey));
  _offerRewardedLifeline(
    'Save Streak',
    () => {
      if (typeof gtag === 'function' && !srIsTest()) gtag('event', 'streak_save_ad', { mode: { dcStreak: 'trivia', dwStreak: 'wordle', dmStreak: 'mashup', cbStreak_daily: 'blitz', wfStreak: 'order', waStreak: 'whoami' }[streakKey] });
      srRepair(streakKey);
    },
    `🔥 Your <strong>${streak.current}-day streak</strong> is about to end!<br>Watch a short ad to save it?`,
    () => localStorage.setItem(`${streakKey}RepairDeclined_${srDaysAgoKey(0)}`, '1')
  );
}

// Homepage / Daily Challenges card subtext, or null if nothing to save.
function srCardText(streakKey) {
  if (!srCanRepair(streakKey) || !srOfferedHere()) return null;
  const streak = JSON.parse(localStorage.getItem(streakKey));
  return `🔥 ${streak.current}-day streak at risk — tap to save it`;
}

// Local notifications (assets/notifications.js) — only in app builds that
// include the LocalNotifications plugin; older store builds skip it entirely.
if (isInApp() && window.Capacitor.isPluginAvailable?.('LocalNotifications')) {
  const s = document.createElement('script');
  s.src = '/assets/notifications.js';
  document.head.appendChild(s);
}

// "Update the app" nudge for iPhone users still on a build without
// notifications (4.0 and older). Shown on the Daily Challenges page and after
// finishing a daily; "Not now" hides it for 7 days.
// OFF until 4.1 is live in the App Store — set to true then (otherwise
// "Update" opens a store page with nothing new to install).
const TG_UPDATE_NUDGE_IOS = false;
const _TG_NUDGE_KEY = 'tg_update_nudge_hidden_until';
function tgMaybeShowUpdateNudge() {
  if (!TG_UPDATE_NUDGE_IOS || !isInApp() || _ADMOB_PLATFORM !== 'ios') return;
  if (window.Capacitor.isPluginAvailable?.('LocalNotifications')) return; // already updated
  try { if (Date.now() < parseInt(localStorage.getItem(_TG_NUDGE_KEY) || '0', 10)) return; } catch { return; }
  if (document.getElementById('_tgUpdateNudge')) return;
  const box = document.createElement('div');
  box.id = '_tgUpdateNudge';
  box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:9998;background:#1e1e2e;color:#fff;border:1px solid #6c63ff;border-radius:12px;padding:14px 16px;box-shadow:0 6px 24px rgba(0,0,0,.5);max-width:420px;margin:0 auto';
  box.innerHTML = `<p style="margin:0 0 4px;font-weight:700">New: streak reminders 🔥</p>
    <p style="margin:0 0 12px;font-size:.9em;opacity:.85">Update the app to get a heads-up before your streak runs out — and pick when your daily reminder arrives.</p>
    <div style="display:flex;gap:8px">
      <a id="_tgNudgeUpdate" href="https://apps.apple.com/app/trivia-gauntlet/id6749189557" style="flex:1;text-align:center;padding:10px;border-radius:8px;background:#6c63ff;color:#fff;text-decoration:none;font-weight:600">Update</a>
      <button id="_tgNudgeLater" style="flex:1;padding:10px;border-radius:8px;background:#444;color:#fff;border:none">Not now</button>
    </div>`;
  document.body.appendChild(box);
  if (typeof gtag === 'function') gtag('event', 'update_nudge', { action: 'shown' });
  const hide = () => { box.remove(); try { localStorage.setItem(_TG_NUDGE_KEY, String(Date.now() + 7 * 86400000)); } catch {} };
  box.querySelector('#_tgNudgeLater').onclick = () => { hide(); if (typeof gtag === 'function') gtag('event', 'update_nudge', { action: 'later' }); };
  box.querySelector('#_tgNudgeUpdate').onclick = () => { hide(); if (typeof gtag === 'function') gtag('event', 'update_nudge', { action: 'update' }); };
}
// Old builds never load notifications.js, so the dailies' finish hook lands here instead.
if (isInApp() && !window.Capacitor.isPluginAvailable?.('LocalNotifications')) {
  window.tgNotifyDailyFinished = () => setTimeout(tgMaybeShowUpdateNudge, 2500);
  if (/\/daily-challenges\.html$/.test(window.location.pathname)) {
    document.addEventListener('DOMContentLoaded', () => setTimeout(tgMaybeShowUpdateNudge, 1500));
  }
}
