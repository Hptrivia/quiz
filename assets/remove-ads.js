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
    titleEl.textContent = `Ad-Free + Extras for ${selectedThemeTitle}`;
    introEl.textContent = `Purchase the pack for ${selectedThemeTitle} to play without ads and unlock extra benefits.`;
    buyBtn.textContent = `Buy ${selectedThemeTitle} Pack`;
  } else {
    titleEl.textContent = "Ad-Free + Extras";
    introEl.textContent = "Purchase a pack to play without ads and unlock extra benefits.";
    buyBtn.textContent = "View Shop";
  }

  buyBtn.href = selectedUrl;
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "remove-ads") {
    renderRemoveAdsPage();
  }
});
