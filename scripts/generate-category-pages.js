const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const themesPath = path.join(rootDir, "data", "themes.json");
const outputDir = path.join(rootDir, "categories");

// Set to 1 or 2 to switch ad stacks
const AD_STACK = 2;

const PREMIUM_FN = "function isPremiumUser(){var e=localStorage.getItem('adsRemovedUntil');if(!e)return false;return new Date(e)>new Date();}";

const AD_SCRIPTS = {
  1: `  <script>${PREMIUM_FN}if(!isPremiumUser()){(function(s){s.dataset.zone='10961427',s.src='https://n6wxm.com/vignette.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));(function(s){s.dataset.zone='10961935',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));(function(s){s.dataset.zone='10962017',s.src='https://al5sm.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));}</script>`,
  2: `  <script>${PREMIUM_FN}</script>\n  <script>if(!isPremiumUser()){(function(s){s.dataset.zone='10962017',s.src='https://al5sm.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));}</script>`,
};

const BANNER_TOP = {
  1: ``,
  2: `
  <div style="text-align:center;margin:10px 0;">
    <script>if(!isPremiumUser()){atOptions={'key':'b9be7f308767ec033bd304d299704695','format':'iframe','height':50,'width':320,'params':{}};}</script>
    <script>if(!isPremiumUser()){document.write('<scr'+'ipt src="https://www.highperformanceformat.com/b9be7f308767ec033bd304d299704695/invoke.js"><\\/scr'+'ipt>');}</script>
  </div>`,
};

const BANNER_MID = {
  1: ``,
  2: `
  <div id="mid-banner-ad" style="text-align:center;margin:12px 0;">
    <script>
      if(!isPremiumUser()){
        var adDiv=document.getElementById('mid-banner-ad');
        var s1=document.createElement('script');
        s1.textContent='atOptions={"key":"6cd708c27c2130cedbed5e1a3bc703d0","format":"iframe","height":250,"width":300,"params":{}};';
        var s2=document.createElement('script');
        s2.src='https://www.highperformanceformat.com/6cd708c27c2130cedbed5e1a3bc703d0/invoke.js';
        adDiv.appendChild(s1);
        adDiv.appendChild(s2);
      }
    </script>
  </div>`,
};

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
    "TV": "tv",
    "Anime": "anime",
    "Sitcoms": "sitcoms",
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
  "TV":      ["This category includes trivia quizzes based on fantasy dramas, crime thrillers, teen shows, sci-fi, and other popular TV series."],
  "Anime":   ["This category includes trivia quizzes based on popular anime series covering shonen, action, and fan-favourite franchises."],
  "Sitcoms": ["This category includes trivia quizzes based on classic and modern sitcoms covering characters, quotes, running jokes, and memorable moments."],
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

  const cardHtml = theme => `
    <a class="card" href="../themes/${escapeHtml(theme.slug)}.html">
      <h3>${escapeHtml(theme.title)}</h3>
    </a>
  `;

  const MID_THRESHOLD = 6;
  let gridHtml;
  if (themes.length > MID_THRESHOLD) {
    const mid = Math.ceil(themes.length / 2);
    const firstHalf  = themes.slice(0, mid).map(cardHtml).join("");
    const secondHalf = themes.slice(mid).map(cardHtml).join("");
    gridHtml = `
    <section>
      <div class="grid">
        ${firstHalf}
      </div>
    </section>
${BANNER_MID[AD_STACK]}
    <section>
      <div class="grid">
        ${secondHalf}
      </div>
    </section>`;
  } else {
    gridHtml = `
    <section>
      <div class="grid">
        ${themes.map(cardHtml).join("")}
      </div>
    </section>
${BANNER_MID[AD_STACK]}`;
  }

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
${AD_SCRIPTS[AD_STACK]}
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
${BANNER_TOP[AD_STACK]}
  <main class="container">
    <a href="../index.html" class="back-link" onclick="if (history.length > 1) { history.back(); return false; }">← Back</a>

    <section class="panel category-intro-panel">
      <h1>${title}</h1>
      <div class="category-intro-text">
        ${introParts.map(text => `<p>${escapeHtml(text)}</p>`).join("")}
      </div>
    </section>

  ${gridHtml}
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
    "TV",
    "Anime",
    "Sitcoms",
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