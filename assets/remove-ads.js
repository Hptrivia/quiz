const VALID_CODE = "=z7.K[md4z7Q";
const ACTIVATION_DAYS = 30;

function formatExpiry(date) {
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function initSitewideTab() {
  const indicator = document.getElementById('premiumIndicator');
  const activationSection = document.getElementById('activationSection');

  if (isPremiumUser()) {
    const expiry = new Date(localStorage.getItem('adsRemovedUntil'));
    indicator.textContent = '✓ Premium active until ' + formatExpiry(expiry);
    indicator.style.display = 'block';
    activationSection.style.display = 'none';
    return;
  }

  const btn = document.getElementById('adFreeActivateBtn');
  const input = document.getElementById('adFreeCodeInput');
  const msg = document.getElementById('activationMsg');

  btn.addEventListener('click', function () {
    const entered = input.value.trim();
    if (entered === VALID_CODE) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + ACTIVATION_DAYS);
      localStorage.setItem('adsRemovedUntil', expiry.toISOString());
      msg.textContent = 'Activated! Premium features unlocked until ' + formatExpiry(expiry) + '.';
      msg.className = 'activation-msg success';
      setTimeout(function () { location.reload(); }, 2000);
    } else {
      msg.textContent = 'Invalid code. Please check the email you received from Ko-Fi.';
      msg.className = 'activation-msg error';
    }
  });
}

async function renderRemoveAdsPage() {
  const slug = getParam("theme");
  const mode = getParam("mode") || "normal";

  const titleEl = document.getElementById("removeAdsTitle");
  const introEl = document.getElementById("removeAdsIntro");
  const buyBtn = document.getElementById("removeAdsBuyButton");

  const SHOP_URL = "https://ko-fi.com/triviaking/shop";

  let selectedThemeTitle = "";
  let selectedUrl = SHOP_URL;

  try {
    if (slug) {
      const themes = await loadThemes();
      const theme = themes.find(t => t.slug === slug);
      if (theme) {
        selectedThemeTitle = theme.title;
      }
    }
  } catch (e) {
    selectedThemeTitle = "";
  }

  try {
    if (selectedThemeTitle) {
      if (mode === "episode") {
        try {
          const episodeLinks = await fetchJSON("data/episode_pack_links.json");
          if (episodeLinks[selectedThemeTitle]) {
            selectedUrl = episodeLinks[selectedThemeTitle];
          } else {
            const normalLinks = await fetchJSON("data/normal_pack_links.json");
            if (normalLinks[selectedThemeTitle]) {
              selectedUrl = normalLinks[selectedThemeTitle];
            }
          }
        } catch (e) {
          const normalLinks = await fetchJSON("data/normal_pack_links.json");
          if (normalLinks[selectedThemeTitle]) {
            selectedUrl = normalLinks[selectedThemeTitle];
          }
        }
      } else {
        const normalLinks = await fetchJSON("data/normal_pack_links.json");
        if (normalLinks[selectedThemeTitle]) {
          selectedUrl = normalLinks[selectedThemeTitle];
        }
      }
    }
  } catch (e) {
    selectedUrl = SHOP_URL;
  }

  if (selectedThemeTitle) {
    titleEl.textContent = `Ad-Free for ${selectedThemeTitle}`;
    introEl.textContent = `Purchase the pack for ${selectedThemeTitle} to play without ads and unlock extra benefits.`;
    buyBtn.textContent = `Buy ${selectedThemeTitle} Pack`;
  } else {
    titleEl.textContent = "Ad-Free";
    introEl.textContent = "Purchase a pack to play without ads and unlock extra benefits.";
    buyBtn.textContent = "View Shop";
  }

  buyBtn.href = selectedUrl;
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "remove-ads") {
    renderRemoveAdsPage();
    initSitewideTab();
  }
});
