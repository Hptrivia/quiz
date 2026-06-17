// Full-access unlock via a monthly code (sold on Ko-fi). Entering a valid code
// unlocks all questions + premium features for 30 days, after which it expires
// and the user must re-subscribe. The code is rotated monthly (change VALID_CODE
// each month) so any shared/leaked code only works until the next rotation.
// (Ko-fi auto-renewing Memberships can replace the manual re-purchase later.)
const VALID_CODE = "=z7.K[md4z7Q"; // ← rotate this every month
const ACTIVATION_DAYS = 30;

function formatExpiry(date) {
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function initCoffeePage() {
  const indicator = document.getElementById('premiumIndicator');
  const activationSection = document.getElementById('activationSection');

  if (isPremiumUser()) {
    const expiry = new Date(localStorage.getItem('adsRemovedUntil'));
    if (indicator) {
      indicator.textContent = '✓ Full access active until ' + formatExpiry(expiry);
      indicator.style.display = 'block';
    }
    if (activationSection) activationSection.style.display = 'none';
    return;
  }

  const btn = document.getElementById('adFreeActivateBtn');
  const input = document.getElementById('adFreeCodeInput');
  const msg = document.getElementById('activationMsg');

  if (!btn) return;

  btn.addEventListener('click', function () {
    const entered = input.value.trim();
    if (entered === VALID_CODE) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + ACTIVATION_DAYS);
      localStorage.setItem('adsRemovedUntil', expiry.toISOString());
      msg.textContent = 'Activated! Full access unlocked until ' + formatExpiry(expiry) + '.';
      msg.className = 'activation-msg success';
      setTimeout(function () { location.href = 'index.html'; }, 1800);
    } else {
      msg.textContent = 'Invalid code.';
      msg.className = 'activation-msg error';
    }
  });
}

// Desktop-only "scan to get the free app" QR on the unlock page. (This page
// doesn't load profile.js, so the QR is rendered self-contained here.)
const _RA_APP_STORE  = "https://apps.apple.com/app/trivia-gauntlet/id6749189557";
const _RA_PLAY_STORE = "https://play.google.com/store/apps/details?id=com.trivia.trivia_gauntlet";

function _raIsDesktopWeb() {
  const native = !!(window.Capacitor && (window.Capacitor.isNativePlatform?.() || window.Capacitor.isNative));
  const ua = navigator.userAgent || "";
  // iPadOS 13+ Safari reports a Macintosh UA (no "iPad"); a touch-capable Mac is
  // really an iPad, so treat it as mobile, not desktop.
  const isIpadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return !native && !isIpadOS && !/android|iphone|ipad|ipod/i.test(ua);
}

function initAppQr() {
  if (!_raIsDesktopWeb()) return;
  const wrap = document.getElementById("raAppQr");
  if (!wrap) return;
  const box = wrap.querySelector(".web-qr-box");
  const url = location.origin + "/app.html";
  box.dataset.qr = url;
  wrap.style.display = "";

  const fallback = () => {
    box.innerHTML = `<a href="${_RA_APP_STORE}" target="_blank">App Store</a> · <a href="${_RA_PLAY_STORE}" target="_blank">Google Play</a>`;
  };
  const loadQr = window.qrcode
    ? Promise.resolve()
    : new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "assets/qrcode.min.js";
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
  loadQr.then(() => {
    try {
      const qr = window.qrcode(0, "M");
      qr.addData(url); qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    } catch (e) { fallback(); }
  }).catch(fallback);
}

// "Add it like an app" — mobile-web only. Lets a web subscriber install the site
// as a PWA so they get a home-screen icon (the app's main remaining edge) without
// the app store. Desktop gets the QR instead; the native app + an already-installed
// PWA need nothing. Android exposes a programmatic install via beforeinstallprompt;
// iOS Safari has none, so we reveal the manual Share → Add to Home Screen steps.
let _raDeferredPrompt = null;
// beforeinstallprompt can fire before DOMContentLoaded, so capture it at top level.
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  _raDeferredPrompt = e;
});

function _raIsNative() {
  return !!(window.Capacitor && (window.Capacitor.isNativePlatform?.() || window.Capacitor.isNative));
}
function _raIsStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
function _raIsIosDevice() {
  const ua = navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function initPwaInstall() {
  if (_raIsDesktopWeb() || _raIsNative() || _raIsStandalone()) return;
  const wrap = document.getElementById("raPwa");
  if (!wrap) return;
  const btn = document.getElementById("raPwaBtn");
  const iosSteps = document.getElementById("raPwaIosSteps");
  wrap.style.display = "";

  if (_raIsIosDevice()) {
    // No programmatic install on iOS — tapping toggles the manual instructions.
    btn.addEventListener("click", () => {
      iosSteps.style.display = iosSteps.style.display === "none" ? "" : "none";
    });
  } else {
    btn.addEventListener("click", async () => {
      if (!_raDeferredPrompt) {
        // Already installed, unsupported browser, or the event hasn't fired —
        // point them at the browser menu fallback.
        btn.textContent = "Open your browser menu → \"Add to Home screen\"";
        return;
      }
      _raDeferredPrompt.prompt();
      await _raDeferredPrompt.userChoice;
      _raDeferredPrompt = null;
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "remove-ads") {
    initCoffeePage();
    initAppQr();
    initPwaInstall();
  }
});
