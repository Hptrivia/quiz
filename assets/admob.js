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
  if (path.endsWith('/challenge.html') && parseInt(p.get('round') || '1') > 1) return true;
  if (path.endsWith('/play.html')      && parseInt(p.get('page')  || '1') > 1) return true;
  if (path.endsWith('/episode.html')   && parseInt(p.get('episode') || '1') > 1) return true;
  return false;
}

let _AdMob = null;
let _adMobReady = false;
let _rewardedLoaded = false;
let _interstitialLoaded = false;

async function adMobInit() {
  if (!isInApp() || _adMobReady) return;
  try {
    _AdMob = window.Capacitor.Plugins.AdMob;
    await _AdMob.initialize({ initializeForTesting: ADMOB_TEST_MODE });
    _adMobReady = true;
    _adMobPreloadRewarded();
    _adMobPreloadInterstitial();
    if (!isGamePage()) adMobShowBanner();
    if (getRoundStartParams()) _adMobShowInterstitialWhenReady();
  } catch (e) {
    console.warn('[AdMob] init failed', e);
  }
}

function _adMobShowInterstitialWhenReady() {
  let tries = 0;
  const poll = setInterval(() => {
    if (_interstitialLoaded) { clearInterval(poll); adMobShowInterstitial(); }
    else if (++tries > 50) clearInterval(poll);
  }, 300);
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
