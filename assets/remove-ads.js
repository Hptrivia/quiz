const VALID_CODE = "=z7.K[md4z7Q";

function initCoffeePage() {
  const indicator = document.getElementById('premiumIndicator');
  const activationSection = document.getElementById('activationSection');

  if (isPremiumUser()) {
    indicator.textContent = '✓ Features unlocked';
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
      const permanent = new Date('2999-12-31').toISOString();
      localStorage.setItem('adsRemovedUntil', permanent);
      msg.textContent = 'Activated! Features are now unlocked.';
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
