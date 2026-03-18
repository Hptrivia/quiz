const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const themesPath = path.join(rootDir, "data", "themes.json");
const episodeThemesPath = path.join(rootDir, "data", "episode_themes.json");
const outputDir = path.join(rootDir, "themes");
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

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function buildThemePage(theme, hasEpisodeMode) {
  const title = escapeHtml(theme.title);
  const description = escapeHtml(theme.description || "");
  const slug = escapeHtml(theme.slug);

  const episodeButton = hasEpisodeMode
    ? `
        <a class="card" href="../episode.html?theme=${slug}&episode=1">
          <h3>Episode Mode</h3>
        </a>
      `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} Trivia Quiz | Trivia Gauntlet</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${SITE_URL}/themes/${slug}.html" />
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2544021252380572"
     crossorigin="anonymous"></script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-E6BY9F2ZDT"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-E6BY9F2ZDT');
  </script>
  <link rel="manifest" href="/manifest.json" />
  <link rel="apple-touch-icon" href="/assets/icons/icon-192.png" />
  <meta name="theme-color" content="#0f172a" />
  <link rel="stylesheet" href="../assets/style.css" />
</head>
<body>
  <main class="container narrow">
    <div class="theme-top-links">
      <a href="../index.html" class="back-link" onclick="if (history.length > 1) { history.back(); return false; }">← Back</a>
      <a href="../index.html" class="back-link">⌂ Home</a>
    </div>

    <div class="theme-search-wrap">
      <div class="search-wrap">
        <input id="themeSearchInput" class="theme-search-input" type="text" placeholder="Search themes..." autocomplete="off" />
        <div id="themeSearchResults" class="search-results"></div>
      </div>
    </div>

    <section class="panel">
      <h1>${title}</h1>
      <p>${description}</p>

      <div class="grid">
        <a class="card" href="../play.html?theme=${slug}">
          <h3>Marathon Mode</h3>
        </a>

        <a class="card" href="../survival.html?theme=${slug}">
          <h3>Survival Mode</h3>
        </a>

        <a class="card" href="../challenge.html?theme=${slug}&round=1">
          <h3>Challenge Mode</h3>
        </a>

        ${episodeButton}

        <a class="card" href="../wordle.html?theme=${slug}&page=1">
          <h3>Wordle</h3>
        </a>

        <div class="card">
          <h3>Leaderboard</h3>
        </div>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container">
      <div class="footer-links">
        <a id="removeAdsLink" class="footer-highlight" href="../remove-ads.html?theme=${slug}&mode=normal">Ad-Free + Extras</a>
        <a href="../about.html">About</a>
        <a href="../how-it-works.html">How It Works</a>
        <a href="../contact.html">Contact</a>
        <a href="../privacy.html">Privacy Policy</a>
        <a href="../terms.html">Terms</a>
      </div>
    </div>
  </footer>

  <script>
    async function setupThemePageSearch() {
      const input = document.getElementById("themeSearchInput");
      const results = document.getElementById("themeSearchResults");
      if (!input || !results) return;

      try {
        const res = await fetch("../data/themes.json");
        const themes = await res.json();

        function render(items) {
          if (!items.length) {
            results.innerHTML = '<div class="search-item">No results found</div>';
            return;
          }

          results.innerHTML = items.map(theme => \`
            <a class="search-item" href="../themes/\${theme.slug}.html">\${theme.title}</a>
          \`).join("");
        }

        input.addEventListener("focus", () => {
          render(themes);
          results.style.display = "block";
        });

        input.addEventListener("input", (e) => {
          const value = e.target.value.trim().toLowerCase();
          const filtered = themes.filter(theme =>
            theme.title.toLowerCase().includes(value)
          );
          render(filtered);
          results.style.display = "block";
        });

        document.addEventListener("click", (e) => {
          if (!input.contains(e.target) && !results.contains(e.target)) {
            results.style.display = "none";
          }
        });
      } catch (err) {
        console.error("Theme search failed", err);
      }
    }

    setupThemePageSearch();
  </script>
</body>
</html>`;
}

function buildSitemap(urls) {
  const now = new Date().toISOString();

  const entries = urls.map((url) => {
    return `  <url>
    <loc>${escapeHtml(url)}</loc>
    <lastmod>${now}</lastmod>
  </url>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

function main() {
  if (!fs.existsSync(themesPath)) {
    throw new Error(`Could not find themes file at ${themesPath}`);
  }

  const themes = JSON.parse(fs.readFileSync(themesPath, "utf8"));

  let episodeThemes = {};
  if (fs.existsSync(episodeThemesPath)) {
    episodeThemes = JSON.parse(fs.readFileSync(episodeThemesPath, "utf8"));
  }

  ensureDir(outputDir);

  const seen = new Set();
  const sitemapUrls = [
    `${SITE_URL}/`,
    `${SITE_URL}/index.html`,
    `${SITE_URL}/about.html`,
    `${SITE_URL}/how-it-works.html`,
    `${SITE_URL}/contact.html`,
    `${SITE_URL}/privacy.html`,
    `${SITE_URL}/terms.html`,
    `${SITE_URL}/remove-ads.html`
  ];

  themes.forEach((theme) => {
    if (!theme.slug || !theme.title) return;

    if (seen.has(theme.slug)) {
      console.warn(`Duplicate slug detected: ${theme.slug} — later file will overwrite earlier one.`);
    }
    seen.add(theme.slug);

    const hasEpisodeMode = Boolean(episodeThemes[theme.slug]);
    const html = buildThemePage(theme, hasEpisodeMode);
    const outPath = path.join(outputDir, `${theme.slug}.html`);

    fs.writeFileSync(outPath, html, "utf8");
    console.log(`Generated themes/${theme.slug}.html`);

    sitemapUrls.push(`${SITE_URL}/themes/${theme.slug}.html`);
  });

  fs.writeFileSync(sitemapPath, buildSitemap(sitemapUrls), "utf8");
  console.log("Generated sitemap.xml");
  console.log("Done.");
}

main();