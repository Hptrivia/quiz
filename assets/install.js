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
  showInstallCard();
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  hideInstallCard();
});

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
