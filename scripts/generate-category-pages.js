const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const themesPath = path.join(rootDir, "data", "themes.json");
const outputDir = path.join(rootDir, "categories");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function categorySlug(name) {
  const map = {
    "TV/Series": "tv-series",
    "Games": "games",
    "Sports": "sports",
    "General": "general",
    "Education": "education",
    "Books": "books",
    "Countries": "countries",
    "Newly Added": "newly-added"
  };
  return map[name] || name.toLowerCase().replace(/\s+/g, "-");
}

const categoryIntroMap = {
  "TV/Series":   ["This category includes trivia quizzes based on sitcoms, fantasy dramas, teen shows, anime, and other popular TV series."],
  "Games":       ["This category focuses on video game trivia across action, RPG, horror, open-world, and classic franchises. Quizzes cover characters, bosses, weapons, lore, story moments, mechanics, and other fan knowledge from major game series."],
  "Sports":      ["This category includes sports trivia on basketball, football, boxing, MMA, wrestling, and more. Themes cover famous players, teams, championships, records, and major moments across different sports."],
  "Education":   ["This category includes educational trivia on language, spelling, math, science, technology, and related topics. These quizzes are designed to mix straightforward knowledge with faster recall questions across different subjects."],
  "General":     ["This category includes mixed trivia themes covering geography, history, music, movies, world facts, odd-one-out rounds, and other broad quiz topics. It is designed for players who want variety rather than one single fandom."],
  "Books":       ["This category includes trivia based on major books, fantasy franchises, and religious texts. Questions cover characters, stories, settings, themes, and major details from the source material."],
  "Countries":   ["This category focuses on country-based trivia covering geography, cities, culture, history, sport, and national identity. Each theme is built around a specific country and can be played in multiple quiz modes."],
  "Newly Added": ["This section highlights the latest trivia themes added to the site across TV, games, countries, sports, education, and general knowledge."]
};


function buildCategoryPage(categoryName, themes) {
  const title = escapeHtml(categoryName);
  const introParts = categoryIntroMap[categoryName] || [
    "Browse trivia themes in this category and choose the mode that fits how you want to play."
  ];

  const cardsHtml = themes.map(theme => `
    <a class="card" href="../themes/${escapeHtml(theme.slug)}.html">
      <h3>${escapeHtml(theme.title)}</h3>
    </a>
  `).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} Trivia Themes | Trivia Gauntlet</title>
  <meta name="description" content="Browse ${title} trivia themes on Trivia Gauntlet." />
  <link rel="icon" href="/favicon.ico.png" sizes="any">
  <link rel="manifest" href="/manifest.json" />
  <link rel="apple-touch-icon" href="/assets/icon-192.png" />
  <meta name="theme-color" content="#0f172a" />
  <script>function isPremiumUser(){var e=localStorage.getItem('adsRemovedUntil');if(!e)return false;return new Date(e)>new Date();}if(!isPremiumUser()){(function(s){s.dataset.zone='10961427',s.src='https://n6wxm.com/vignette.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));(function(s){s.dataset.zone='10961935',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));(function(s){s.dataset.zone='10962017',s.src='https://al5sm.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));}</script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-E6BY9F2ZDT"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-E6BY9F2ZDT');
  </script>
  <link rel="stylesheet" href="../assets/style.css" />
</head>
<body>
  <main class="container">
    <a href="../index.html" class="back-link" onclick="if (history.length > 1) { history.back(); return false; }">← Back</a>

    <section class="panel category-intro-panel">
      <h1>${title}</h1>
      <div class="category-intro-text">
        ${introParts.map(text => `<p>${escapeHtml(text)}</p>`).join("")}
      </div>
    </section>

    <section>
      <div class="grid">
        ${cardsHtml}
      </div>
    </section>

  </main>

  <footer class="site-footer">
    <div class="container">
      <div class="footer-links">
        <a id="removeAdsLink" class="footer-highlight" href="../remove-ads.html">Ad-Free</a>
        <a href="../about.html">About</a>
        <a class="footer-highlight" href="../how-it-works.html">How It Works</a>
        <a class="footer-highlight" href="../contact.html">Contact</a>
        <a class="footer-highlight" href="../blog.html">Blog</a>
        <a href="../privacy.html">Privacy Policy</a>
        <a href="../terms.html">Terms</a>
      </div>
    </div>
  </footer>
</body>
</html>`;
}

function main() {
  const themes = JSON.parse(fs.readFileSync(themesPath, "utf8"));

  ensureDir(outputDir);

  const categoryOrder = [
    "TV/Series",
    "Games",
    "Sports",
    "General",
    "Education",
    "Books",
    "Countries"
  ];

  categoryOrder.forEach(categoryName => {
    const filtered = themes
      .filter(theme => theme.category === categoryName)
      .sort((a, b) => a.title.localeCompare(b.title));

    const html = buildCategoryPage(categoryName, filtered);
    const outPath = path.join(outputDir, `${categorySlug(categoryName)}.html`);
    fs.writeFileSync(outPath, html, "utf8");
    console.log(`Generated categories/${categorySlug(categoryName)}.html`);
  });
}

main();