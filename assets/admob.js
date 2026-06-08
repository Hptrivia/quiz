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
// iOS is 'off' until AdMob approves it. To go live on iOS:
//   1. paste the real iOS ad unit IDs into _ADMOB_LIVE_IDS.ios below, then
//   2. change ios: 'off' → 'live' here.
const ADMOB_MODE_BY_PLATFORM = {
  ios: 'test', // TEMPORARY: on-device ad testing 2026-06-08 — revert to 'off' when done
  android: 'live',
};
const _ADMOB_PLATFORM = window.Capacitor?.getPlatform?.();
const ADMOB_MODE = ADMOB_MODE_BY_PLATFORM[_ADMOB_PLATFORM] || 'off';
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
    // Filled in once AdMob approves iOS — paste the real iOS unit IDs here,
    // then set ios: 'live' above. Left blank until then.
    banner:       '',
    interstitial: '',
    rewarded:     '',
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
  appVersion: '1.0.0', // bump this whenever you ship a new store release
};
// Country is resolved by IP at ping time (no plugin / permission needed).
async function _lookupCountry() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch('https://ipwho.is/?fields=country,country_code', { signal: ctrl.signal });
    clearTimeout(t);
    const d = await res.json();
    if (d && d.country) {
      const flag = (d.country_code || '').toUpperCase().replace(/./g, c =>
        String.fromCodePoint(127397 + c.charCodeAt(0)));
      return `${flag} ${d.country}`.trim();
    }
  } catch {}
  return 'Unknown';
}
async function _pingNewInstall() {
  if (!isInApp()) return;
  if (localStorage.getItem('_installPinged')) return;
  localStorage.setItem('_installPinged', '1'); // set first so a failure can't double-fire on retry
  const platform = (window.Capacitor.getPlatform?.() || 'unknown');
  const country = await _lookupCountry();
  try {
    await fetch(_INSTALL_PING.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: _INSTALL_PING.anonKey,
        Authorization: `Bearer ${_INSTALL_PING.anonKey}`,
      },
      body: JSON.stringify({ platform, country, version: _INSTALL_PING.appVersion }),
    });
  } catch (e) {
    // Network hiccup on first open — clear the flag so the next launch retries.
    localStorage.removeItem('_installPinged');
    console.warn('[install-ping] failed', e);
  }
}

function isGamePage() {
  const path = window.location.pathname;
  return /\/(play|challenge|survival|episode|trivia-rush|versus|wordle|wordsearch|daily|daily-wordle)\.html$/.test(path);
}

function getRoundStartParams() {
  const path = window.location.pathname;
  return /\/(play|challenge|survival|episode|trivia-rush|mashup-trivia-rush|versus|wordle|wordsearch|mashup-play|daily|daily-wordle)\.html$/.test(path);
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

async function adMobInit() {
  if (!isInApp() || !ADMOB_ADS_ENABLED || _adMobReady) return;
  const _modeKey = (() => {
    const p = window.location.pathname;
    if (/\/wordsearch\//.test(p)) return '_iad_wordsearch';
    if (/\/wordle\//.test(p)) return '_iad_wordle';
    const m = p.match(/\/([^/]+)\.html$/);
    return m ? '_iad_' + m[1] : '_iad_other';
  })();
  const showInterstitialFirst = getRoundStartParams() && !sessionStorage.getItem(_modeKey);
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
    _adMobPreloadRewarded();
    _adMobPreloadInterstitial();
    if (isGamePage()) adMobHideBanner(); else adMobShowBanner();
  } catch (e) {
    _removeLoader();
    console.warn('[AdMob] init failed', e);
  }
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

const _IAD_COOLDOWN_MS = 20 * 60 * 1000;
function _interstitialOnCooldown() {
  const last = parseInt(localStorage.getItem('_iadLastShown') || '0');
  return Date.now() - last < _IAD_COOLDOWN_MS;
}

// Shows interstitial ad (no reward, auto-dismissed).
async function adMobShowInterstitial() {
  if (!_adMobReady || !_interstitialLoaded) return;
  if (_interstitialOnCooldown()) return;
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

function _offerRewardedLifeline(name, onEarned, promptHtml) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:9999';
  overlay.innerHTML = `<div style="background:#1e1e2e;padding:24px;border-radius:12px;text-align:center;max-width:280px;color:#fff">
    <p style="margin:0 0 16px;font-size:1.1em">${promptHtml || `Watch a short ad to use <strong>${name}</strong>?`}</p>
    <button id="_adYes" style="margin-right:8px;padding:10px 20px;border-radius:8px;background:#6c63ff;color:#fff;border:none;cursor:pointer;font-size:1em">Watch Ad</button>
    <button id="_adNo" style="padding:10px 20px;border-radius:8px;background:#444;color:#fff;border:none;cursor:pointer;font-size:1em">Cancel</button>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#_adNo').onclick = () => overlay.remove();
  overlay.querySelector('#_adYes').onclick = async () => {
    overlay.remove();
    const earned = await adMobShowRewarded();
    if (earned || !_rewardedLoaded) onEarned(); // proceed if earned OR ad failed to load
  };
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
  let href, label;
  const explicit = e.target.closest('[data-rewarded-href]');
  if (explicit) {
    href  = explicit.dataset.rewardedHref;
    label = explicit.dataset.rewardedLabel || explicit.textContent.trim() || 'the next round';
  } else {
    const gate = e.target.closest('[data-reward-gate="1"]');
    const link = gate && e.target.closest('a[href]');
    if (gate && link && gate.contains(link)) {
      href  = link.getAttribute('href');
      label = link.querySelector('h3')?.textContent.trim() || link.textContent.trim() || 'the next quiz';
    }
  }
  if (!href || !isInApp() || !ADMOB_ADS_ENABLED) return;
  e.preventDefault();
  _offerRewardedLifeline(label, () => {
    try {
      const dest = new URL(href, window.location.href);
      const dp = dest.pathname;
      const dk = /\/wordsearch\//.test(dp) ? '_iad_wordsearch'
               : /\/wordle\//.test(dp) ? '_iad_wordle'
               : (dp.match(/\/([^/]+)\.html$/) || [])[1] ? '_iad_' + (dp.match(/\/([^/]+)\.html$/) || [])[1] : '_iad_other';
      sessionStorage.setItem(dk, '1');
    } catch {}
    window.location.href = href;
  });
});

// Show banner on result screens when "Try another theme" section appears
function _watchResultScreens() {
  if (!isInApp()) return;
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        const target = node.querySelector?.('.result-theme-search') || (node.classList?.contains('result-theme-search') ? node : null);
        if (target) adMobShowBanner();
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

async function _bootInApp() {
  if (ADMOB_ADS_ENABLED) {
    // ATT first: the prompt must appear before any data that could be used to
    // track the user is collected (ads SDK start, IP-geolocated install ping).
    await _requestATT();
  }
  // Install ping always fires (it's our own install analytics, not ad tracking).
  _pingNewInstall();
  // With ads off (platform pending approval) the app stays fully ad-free.
  if (ADMOB_ADS_ENABLED) {
    adMobInit();
    _watchResultScreens();
  }
}

document.addEventListener('DOMContentLoaded', () => {
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
