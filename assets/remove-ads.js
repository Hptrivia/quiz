const VALID_CODE = "=z7.K[md4z7Q";
const ACTIVATION_DAYS = 30;

function formatExpiry(date) {
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function initCoffeePage() {
  const indicator = document.getElementById('premiumIndicator');
  const activationSection = document.getElementById('activationSection');

  if (isPremiumUser()) {
    const expiry = new Date(localStorage.getItem('adsRemovedUntil'));
    indicator.textContent = '✓ Features active until ' + formatExpiry(expiry);
    indicator.style.display = 'block';
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
      msg.textContent = 'Activated! Features unlocked until ' + formatExpiry(expiry) + '.';
      msg.className = 'activation-msg success';
      setTimeout(function () { location.reload(); }, 2000);
    } else {
      msg.textContent = 'Invalid code.';
      msg.className = 'activation-msg error';
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "remove-ads") {
    initCoffeePage();
  }
});
