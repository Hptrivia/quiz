// AdMob — only active inside the Capacitor Android app

const ADMOB_TEST_MODE = false;

const ADMOB_IDS = {
  banner:       ADMOB_TEST_MODE ? 'ca-app-pub-3940256099942544/6300978111' : 'ca-app-pub-9506123851374920/2446089149',
  interstitial: ADMOB_TEST_MODE ? 'ca-app-pub-3940256099942544/1033173712' : 'ca-app-pub-9506123851374920/5206994172',
  rewarded:     ADMOB_TEST_MODE ? 'ca-app-pub-3940256099942544/5224354917' : 'ca-app-pub-9506123851374920/8819925805',
};

function isInApp() {
  return !!(window.Capacitor && (window.Capacitor.isNativePlatform?.() || window.Capacitor.isNative));
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

async function adMobInit() {
  if (!isInApp() || _adMobReady) return;
  const _modeKey = (() => {
    const p = window.location.pathname;
    if (/\/wordsearch\//.test(p)) return '_iad_wordsearch';
    if (/\/wordle\//.test(p)) return '_iad_wordle';
    const m = p.match(/\/([^/]+)\.html$/);
    return m ? '_iad_' + m[1] : '_iad_other';
  })();
  const showInterstitialFirst = getRoundStartParams() && !sessionStorage.getItem(_modeKey);
  if (showInterstitialFirst) {
    sessionStorage.setItem(_modeKey, '1');
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
    await _AdMob.initialize({ initializeForTesting: ADMOB_TEST_MODE, requestTrackingAuthorization: true });
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
  e.preventDefault();
  const href = btn.dataset.rewardedHref;
  const label = btn.textContent.trim() || 'the next round';
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

document.addEventListener('DOMContentLoaded', () => {
  if (isInApp()) {
    adMobInit();
    _watchResultScreens();
  } else {
    let tries = 0;
    const retry = setInterval(() => {
      if (isInApp()) {
        clearInterval(retry);
        adMobInit();
        _watchResultScreens();
      }
      else if (++tries > 25) clearInterval(retry);
    }, 200);
  }
});
