// AdMob — only active inside the Capacitor Android app

const ADMOB_TEST_MODE = true; // flip to false before production release

const ADMOB_IDS = {
  appOpen:      ADMOB_TEST_MODE ? 'ca-app-pub-3940256099942544/9257395921' : 'ca-app-pub-9506123851374920/6062430756',
  banner:       ADMOB_TEST_MODE ? 'ca-app-pub-3940256099942544/6300978111' : 'ca-app-pub-9506123851374920/2446089149',
  interstitial: ADMOB_TEST_MODE ? 'ca-app-pub-3940256099942544/1033173712' : 'ca-app-pub-9506123851374920/5206994172',
  rewarded:     ADMOB_TEST_MODE ? 'ca-app-pub-3940256099942544/5224354917' : 'ca-app-pub-9506123851374920/8819925805',
};

function isInApp() {
  return !!(window.Capacitor && (window.Capacitor.isNativePlatform?.() || window.Capacitor.isNative));
}

function isGamePage() {
  const path = window.location.pathname;
  return /\/(play|challenge|survival|episode|trivia-rush|versus|wordle|wordsearch)\.html$/.test(path)
    || /\/(wordle|wordsearch)\//.test(path);
}

function getRoundStartParams() {
  const path = window.location.pathname;
  const p = new URLSearchParams(window.location.search);
  // Challenge: round 2+ but NOT rounds where rewarded fires (4, 7, 10...)
  if (path.endsWith('/challenge.html')) {
    const r = parseInt(p.get('round') || '1');
    return r > 1 && (r - 1) % 3 !== 0;
  }
  // Mashup-play: same logic as challenge/marathon depending on mode param
  if (path.endsWith('/mashup-play.html')) {
    const mode = p.get('mode') || 'marathon';
    if (mode === 'challenge') {
      const r = parseInt(p.get('round') || '1');
      return r > 1 && (r - 1) % 3 !== 0;
    }
    return parseInt(p.get('page') || '1') === 1;
  }
  // All other modes: interstitial only at the very start (page/episode 1)
  if (path.endsWith('/play.html'))      return parseInt(p.get('page')    || '1') === 1;
  if (path.endsWith('/episode.html'))   return parseInt(p.get('episode') || '1') === 1;
  if (path.endsWith('/wordle.html'))    return parseInt(p.get('page')    || '1') === 1;
  if (path.endsWith('/wordsearch.html')) return parseInt(p.get('page')   || '1') === 1;
  if (/\/(survival|versus|trivia-rush)\.html$/.test(path)) return true;
  if (/\/(wordle|wordsearch)\//.test(path)) return true;
  return false;
}

let _AdMob = null;
let _adMobReady = false;
let _rewardedLoaded = false;
let _interstitialLoaded = false;

async function adMobInit() {
  if (!isInApp() || _adMobReady) return;
  const _adKey = '_adShown_' + window.location.pathname + window.location.search;
  const showInterstitialFirst = getRoundStartParams() && !sessionStorage.getItem(_adKey);
  if (showInterstitialFirst) {
    sessionStorage.setItem(_adKey, '1');
    document.body.style.visibility = 'hidden';
    const loader = document.createElement('div');
    loader.id = '_adLoader';
    loader.style.cssText = 'position:fixed;inset:0;background:#000;display:flex;align-items:center;justify-content:center;z-index:99999;color:#fff;font-size:1.2em';
    loader.textContent = 'Loading...';
    document.body.appendChild(loader);
    document.body.style.visibility = 'visible';
  }
  try {
    _AdMob = window.Capacitor.Plugins.AdMob;
    await _AdMob.initialize({ initializeForTesting: ADMOB_TEST_MODE });
    _adMobReady = true;
    if (showInterstitialFirst) {
      await _AdMob.prepareInterstitial({ adId: ADMOB_IDS.interstitial });
      _interstitialLoaded = true;
      await adMobShowInterstitial();
      document.getElementById('_adLoader')?.remove();
      document.body.style.visibility = 'visible';
    }
    _adMobPreloadRewarded();
    _adMobPreloadInterstitial();
    if (isGamePage()) adMobHideBanner(); else adMobShowBanner();
  } catch (e) {
    document.body.style.visibility = 'visible';
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

// Shows interstitial ad (no reward, auto-dismissed).
async function adMobShowInterstitial() {
  if (!_adMobReady || !_interstitialLoaded) return;
  try {
    await _AdMob.showInterstitial();
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
  } catch (e) {
    console.warn('[AdMob] banner error', e);
  }
}

async function adMobHideBanner() {
  if (!_adMobReady) return;
  try { await _AdMob.hideBanner(); } catch {}
}

function _offerRewardedLifeline(name, onEarned) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:9999';
  overlay.innerHTML = `<div style="background:#1e1e2e;padding:24px;border-radius:12px;text-align:center;max-width:280px;color:#fff">
    <p style="margin:0 0 16px;font-size:1.1em">Watch a short ad to use <strong>${name}</strong>?</p>
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

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-rewarded-href]');
  if (!btn || !isInApp()) return;
  if (typeof isPremiumUser === 'function' && isPremiumUser()) return;
  e.preventDefault();
  const href = btn.dataset.rewardedHref;
  const label = btn.textContent.trim() || 'the next round';
  _offerRewardedLifeline(label, () => { window.location.href = href; });
});

document.addEventListener('DOMContentLoaded', () => {
  if (isInApp()) {
    adMobInit();
  } else {
    let tries = 0;
    const retry = setInterval(() => {
      if (isInApp()) { clearInterval(retry); adMobInit(); }
      else if (++tries > 25) clearInterval(retry);
    }, 200);
  }
});
