const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const themesPath = path.join(rootDir, "data", "themes.json");
const wordsearchWordsPath = path.join(rootDir, "data", "wordsearch_words.json");
const outputDir = path.join(rootDir, "wordsearch");
const sitemapPath = path.join(rootDir, "sitemap.xml");
const SITE_URL = "https://triviagauntlet.app";

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeTitle(t) {
  return t.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getThemeContext(category) {
  if (category === "Games") return "the game";
  if (category === "Sports") return "the sport";
  if (category === "Books") return "the books";
  if (category === "Movies") return "the film";
  return "the series";
}

const HARDCODED_RELATED = {
  "harry-potter": [
    { slug: "lord-of-the-rings",          title: "Lord of The Rings" },
    { slug: "avatar-the-last-airbender",  title: "Avatar: The Last Airbender" },
    { slug: "game-of-thrones",            title: "Game of Thrones" },
    { slug: "house-of-the-dragon",        title: "House of the Dragon" },
    { slug: "arcane",                     title: "Arcane" }
  ]
};

function getRelatedThemes(allThemes, currentTheme, wordsearchSet, limit = 4) {
  if (HARDCODED_RELATED[currentTheme.slug]) {
    return HARDCODED_RELATED[currentTheme.slug]
      .filter(t => wordsearchSet.has(normalizeTitle(t.title)))
      .slice(0, limit);
  }
  const sameCategory = allThemes.filter(t =>
    t.slug !== currentTheme.slug &&
    t.category === currentTheme.category &&
    wordsearchSet.has(normalizeTitle(t.title))
  );
  return sameCategory.sort(() => Math.random() - 0.5).slice(0, limit);
}

function buildWordsearchPage(theme, allThemes, wordsearchSet) {
  const title = escapeHtml(theme.title);
  const slug = escapeHtml(theme.slug);
  const ctx = getThemeContext(theme.category);

  const descParagraph = `The ${theme.title} Word Search hides words from across ${ctx} in a 10×10 grid. Drag across the letters to discover hidden words — characters, locations, and key terms from ${theme.title} are all in there. Words can run in any direction including diagonals and backwards. You won't see the word list upfront — finding each word is part of the challenge. Multiple grids work through the theme from familiar names to more specific terms.`;

  const relatedThemes = getRelatedThemes(allThemes, theme, wordsearchSet);
  const relatedHtml = `
        <div class="theme-related-quizzes">
          <h2>More Word Search Themes</h2>
          <div class="grid">
            <a class="card card-mix" href="../mashup.html?preset=${slug}&mode=wordsearch">
              <h3>${title} + other themes</h3>
              <span class="card-mix-sub">Play as a mashup</span>
            </a>
            ${relatedThemes.map(t => `
              <a class="card" href="${escapeHtml(t.slug)}.html">
                <h3>${escapeHtml(t.title)} Word Search</h3>
              </a>
            `).join("")}
          </div>
        </div>`;

  const metaDesc = `Play ${theme.title} Word Search on Trivia Gauntlet. Find hidden words from ${theme.title} in a themed grid — no word list shown upfront.`;

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": `${SITE_URL}/` },
          { "@type": "ListItem", "position": 2, "name": "Word Search", "item": `${SITE_URL}/wordsearch.html` },
          { "@type": "ListItem", "position": 3, "name": `${theme.title} Word Search`, "item": `${SITE_URL}/wordsearch/${theme.slug}.html` }
        ]
      }
    ]
  }, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} Word Search | Trivia Gauntlet</title>
  <meta name="description" content="${escapeHtml(metaDesc)}" />
  <link rel="canonical" href="${SITE_URL}/wordsearch/${theme.slug}.html" />
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-E6BY9F2ZDT"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-E6BY9F2ZDT');
  </script>
  <link rel="manifest" href="/manifest.json" />
  <link rel="apple-touch-icon" href="/assets/icon-192.png" />
  <meta name="theme-color" content="#0f172a" />
  <link rel="stylesheet" href="../assets/style.css" />
  <meta property="og:title" content="${title} Word Search | Trivia Gauntlet" />
  <meta property="og:description" content="${escapeHtml(metaDesc)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${SITE_URL}/wordsearch/${theme.slug}.html" />
  <meta property="og:image" content="${SITE_URL}/assets/icon-192.png" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${title} Word Search | Trivia Gauntlet" />
  <meta name="twitter:description" content="${escapeHtml(metaDesc)}" />
  <script type="application/ld+json">${jsonLd}</script>
</head>
<body>
  <main class="container narrow">
    <div class="theme-top-links">
      <a href="../themes/${slug}.html" class="back-link" onclick="if (history.length > 1) { history.back(); return false; }">&#8592; Back</a>
      <span id="navAvatarSlot"></span>
      <a href="../themes/${slug}.html" class="back-link">Theme Page &#8594;</a>
    </div>

    <section class="panel">
      <h1>${title} Word Search</h1>
      <p>${escapeHtml(descParagraph)}</p>

      <div style="margin:24px 0 12px;">
        <a href="../wordsearch.html?theme=${slug}&page=1" class="primary-btn" style="display:block;text-align:center;text-decoration:none;font-size:1.1rem;padding:14px;">
          Play ${title} Word Search
        </a>
      </div>

      <p style="text-align:center;margin-top:8px;">
        <a href="../play.html?theme=${slug}" style="color:#94a3b8;font-size:0.9rem;">Also try ${title} Trivia &#8594;</a>
      </p>

      ${relatedHtml}
    </section>
  </main>

  <footer class="site-footer">
    <div class="container">
      <div class="footer-links">
        <a href="../remove-ads.html" class="footer-highlight">Buy me a coffee</a>
        <a href="../about.html">About</a>
        <a href="../how-it-works.html">How It Works</a>
        <a href="../contact.html">Contact</a>
        <a class="footer-highlight" href="../blog.html">Blog</a>
        <a href="../privacy.html">Privacy Policy</a>
        <a href="../terms.html">Terms</a>
      </div>
    </div>
  </footer>
  <script src="../assets/profile.js"></script>
</body>
</html>`;
}

function updateSitemap(slugs) {
  if (!fs.existsSync(sitemapPath)) return;
  let sitemap = fs.readFileSync(sitemapPath, "utf8");

  const today = new Date().toISOString().split("T")[0];
  const newEntries = slugs.map(slug =>
    `  <url>\n    <loc>${SITE_URL}/wordsearch/${slug}.html</loc>\n    <lastmod>${today}</lastmod>\n  </url>`
  ).join("\n");

  // Remove any existing /wordsearch/ static entries to avoid duplicates
  sitemap = sitemap.replace(/\s*<url>\s*<loc>[^<]*\/wordsearch\/[^<]*<\/loc>[\s\S]*?<\/url>/g, "");

  sitemap = sitemap.replace("</urlset>", `${newEntries}\n</urlset>`);
  fs.writeFileSync(sitemapPath, sitemap, "utf8");
  console.log(`Updated sitemap with ${slugs.length} wordsearch URLs`);
}

// --- Main ---
const themes = JSON.parse(fs.readFileSync(themesPath, "utf8"));
const wordsearchWords = JSON.parse(fs.readFileSync(wordsearchWordsPath, "utf8"));

const titleToTheme = {};
for (const theme of themes) {
  titleToTheme[normalizeTitle(theme.title)] = theme;
}

// Set of normalized titles that have word search words (for related themes filter)
const wordsearchSet = new Set(Object.keys(wordsearchWords).map(normalizeTitle));

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

let count = 0;
const unmatched = [];
const generatedSlugs = [];

for (const [wsTitle] of Object.entries(wordsearchWords)) {
  const theme = titleToTheme[normalizeTitle(wsTitle)];
  if (!theme) {
    unmatched.push(wsTitle);
    continue;
  }

  const html = buildWordsearchPage(theme, themes, wordsearchSet);
  const outPath = path.join(outputDir, `${theme.slug}.html`);
  fs.writeFileSync(outPath, html, "utf8");
  generatedSlugs.push(theme.slug);
  count++;
}

console.log(`Generated ${count} wordsearch pages in /wordsearch/`);
if (unmatched.length) {
  console.warn(`Unmatched word search keys (no theme found): ${unmatched.join(", ")}`);
}

updateSitemap(generatedSlugs);
