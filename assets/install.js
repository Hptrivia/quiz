let deferredPrompt = null;
let installDismissed = false;

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isInStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function showInstallCard() {
  const card = document.getElementById("installCard");
  const text = document.getElementById("installText");
  const btn = document.getElementById("installButton");

  if (!card || !text || !btn) return;

  text.textContent = "Install TriviaGauntlet for faster access from your home screen.";
  btn.textContent = "Install App";
  card.style.display = "block";
}

function hideInstallCard() {
  const card = document.getElementById("installCard");
  if (card) card.style.display = "none";
  installDismissed = true;
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  hideInstallCard();
});

function pwaPopupDismissAllowed() {
  if (isInStandaloneMode()) return false;
  if (localStorage.getItem("pwaDone")) return false;
  const dismissCount = parseInt(localStorage.getItem("pwaDismissCount") || "0", 10);
  const dismissedAt = parseInt(localStorage.getItem("pwaDismissedAt") || "0", 10);
  if (dismissedAt) {
    const waitDays = dismissCount >= 2 ? 30 : 7;
    const elapsed = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
    if (elapsed < waitDays) return false;
  }
  return true;
}

function showPwaPopupUI() {
  const iosDevice = isIos();
  const overlay = document.createElement("div");
  overlay.className = "email-popup-overlay";

  const instructions = iosDevice
    ? `<ol class="pwa-steps"><li>Tap the <strong>Share</strong> button in Safari</li><li>Choose <strong>Add to Home Screen</strong></li><li>Tap <strong>Add</strong></li></ol>`
    : `<button class="email-popup-submit" id="pwaInstallBtn" style="margin-top:4px;width:100%">Add to Home Screen</button>`;

  overlay.innerHTML = `
    <div class="email-popup">
      <button class="email-popup-close" aria-label="Close">&times;</button>
      <h3>Install Trivia Gauntlet for faster access and better performance</h3>
      <p>Play in one tap straight from your home screen.</p>
      ${instructions}
    </div>
  `;
  document.body.appendChild(overlay);

  const removeOverlay = () => {
    overlay.classList.remove("visible");
    setTimeout(() => overlay.remove(), 400);
  };

  overlay.querySelector(".email-popup-close").addEventListener("click", () => {
    const newCount = parseInt(localStorage.getItem("pwaDismissCount") || "0", 10) + 1;
    localStorage.setItem("pwaDismissCount", newCount);
    localStorage.setItem("pwaDismissedAt", Date.now());
    if (newCount >= 3) localStorage.setItem("pwaDone", "1");
    removeOverlay();
  });

  if (!iosDevice) {
    overlay.querySelector("#pwaInstallBtn").addEventListener("click", async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (outcome === "accepted") localStorage.setItem("pwaDone", "1");
        removeOverlay();
      }
    });
  }

  setTimeout(() => overlay.classList.add("visible"), 3500);
}

let pwaPopupShown = false;

function maybeShowPwaPopup() {
  if (pwaPopupShown) return false;
  if (!pwaPopupDismissAllowed()) return false;
  if (!isIos() && !deferredPrompt) return false;
  pwaPopupShown = true;
  showPwaPopupUI();
  return true;
}

document.addEventListener("click", async (e) => {
  if (e.target.id === "installButton") {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      hideInstallCard();
      return;
    }

    if (isIos()) {
      alert("On iPhone/iPad: tap the Share button in Safari, then choose 'Add to Home Screen'.");
    }
  }

  if (e.target.id === "installDismiss") {
    hideInstallCard();
  }
});
