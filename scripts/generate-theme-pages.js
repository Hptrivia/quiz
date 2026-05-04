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
function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function getRelatedThemes(allThemes, currentTheme, limit = 5) {
  const sameCategory = allThemes.filter(t =>
    t.slug !== currentTheme.slug &&
    t.category === currentTheme.category
  );

  return shuffleArray(sameCategory).slice(0, limit);
}

function getThemeCoverageText(theme) {
  const category = theme.category || "";
  const title = theme.title || "this theme";

  const map = {
    "TV/Series": `This quiz is built for fans who remember both the major moments and the smaller details from ${title}, including character dynamics, memorable scenes, recurring jokes, quotes, and storylines across the series.`,
    "Games": `This quiz is built for players who know more than just the basics of ${title}, mixing characters, story moments, bosses, gameplay details, locations, weapons, and stronger fan-level knowledge.`,
    "Sports": `This quiz mixes well-known facts with deeper fan knowledge from ${title}, including players, teams, championships, records, rivalries, and major moments connected to the sport.`,
    "Education": `This quiz is designed to mix quick recall with broader knowledge in ${title}, covering important ideas, facts, terms, and subject-specific details in a faster quiz format.`,
    "General": `This quiz is designed as a broader themed round on ${title}, mixing familiar facts, harder details, and quick-recall knowledge instead of focusing on only one narrow angle.`,
    "Books": `This quiz is aimed at readers and fans who know the world of ${title} beyond the surface, mixing characters, settings, themes, major events, and more detailed source-material knowledge.`,
    "Countries": `This quiz works as a broader knowledge round on ${title}, mixing geography, cities, culture, history, landmarks, famous people, and national identity rather than just one narrow topic.`
  };

  return map[category] || `This quiz is designed to test a mix of straightforward trivia, fan knowledge, and harder details linked to ${title}.`;
}

function getBestModeText(hasEpisodeMode) {
  if (hasEpisodeMode) {
    return "Marathon Mode is best for a longer run with bigger rounds, while Challenge Mode works better for shorter 10-question sessions. Episode Mode is also available for selected themes where questions can be played episode by episode.";
  }

  return "Marathon Mode is best for a longer run with bigger rounds, while Challenge Mode works better for shorter 10-question sessions.";
}

function getSampleQuestions(questionFilePath) {
  try {
    const fullPath = path.join(rootDir, questionFilePath);
    if (!fs.existsSync(fullPath)) return [];

    const questions = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    if (!Array.isArray(questions)) return [];

    return questions
      .map((q) => (q && q.question ? String(q.question).trim() : ""))
      .filter(Boolean)
      .sort(() => Math.random() - 0.5)
      .slice(0, 10);
  } catch (err) {
    return [];
  }
}

function getTotalQuestions(questionFilePath) {
  try {
    const fullPath = path.join(rootDir, questionFilePath);
    if (!fs.existsSync(fullPath)) return 0;

    const questions = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    if (!Array.isArray(questions)) return 0;

    return questions.length;
  } catch (err) {
    return 0;
  }
}

function buildThemePage(theme, allThemes, hasEpisodeMode, sampleQuestions = []) {
  const rawTitle = theme.title || "";
  const rawDescription = theme.description || "";
  const rawSlug = theme.slug || "";
  const rawSeoIntro = theme.seoIntro || "";
  const rawSeoDetail = theme.seoDetail || "";

const title = escapeHtml(rawTitle);
const description = escapeHtml(rawDescription);
const slug = escapeHtml(rawSlug);
const coverageText = escapeHtml(rawSeoIntro);
const detailText = escapeHtml(rawSeoDetail);
const bestModeText = escapeHtml(getBestModeText(hasEpisodeMode));
  const totalQuestions = getTotalQuestions(theme.questionFile);
  const totalQuestionsText = totalQuestions > 0
    ? `${totalQuestions} questions across multiple rounds`
    : "";
  const metaDescription = totalQuestions > 0
    ? `Play ${totalQuestions} ${rawTitle} trivia questions on Trivia Gauntlet. Test your knowledge in Marathon, Challenge, Survival, and more.`
    : `Play ${rawTitle} trivia questions on Trivia Gauntlet. Test your knowledge in multiple quiz modes.`;

  const episodeButton = hasEpisodeMode
    ? `
        <a class="card" href="../episode.html?theme=${slug}&episode=1">
          <h3>Episode Mode</h3>
          <p>Episode-by-episode questions</p>
        </a>
      `
    : "";

  const sampleQuestionsHtml = sampleQuestions.length
    ? `
        <div class="theme-sample-questions">
          <h2>Sample Questions</h2>
          <ul>
            ${sampleQuestions.map((q) => `<li>${escapeHtml(q)}</li>`).join("")}
          </ul>
        </div>
      `
    : "";

  const relatedThemes = getRelatedThemes(allThemes, theme, 5);

const relatedThemesHtml = relatedThemes.length
  ? `
      <div class="theme-related-quizzes">
        <h2>Related Quizzes</h2>
        <div class="grid">
          ${relatedThemes.map((t) => `
            <a class="card" href="../themes/${escapeHtml(t.slug)}.html">
              <h3>${escapeHtml(t.title)}</h3>
            </a>
          `).join("")}
        </div>
      </div>
    `
  : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title} Trivia Questions | Trivia Gauntlet</title>
<meta name="description" content="${escapeHtml(metaDescription)}" />
  <link rel="canonical" href="${SITE_URL}/themes/${slug}.html" />
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2544021252380572"
     crossorigin="anonymous"></script>
  <script>(function(s){s.dataset.zone='10961935',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))</script>
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
      <h1>${title} Trivia Questions</h1>
      ${totalQuestionsText ? `<p class="theme-question-count">${escapeHtml(totalQuestionsText)}</p>` : ""}
<p>${description}</p>

      
      <div class="grid">
        <a class="card" href="../play.html?theme=${slug}">
          <h3>Marathon Mode</h3>
          <p>30-question rounds</p>
        </a>

        <a class="card" href="../challenge.html?theme=${slug}&round=1">
          <h3>Challenge Mode</h3>
          <p>10-question quick rounds</p>
        </a>

        <a class="card" href="../survival.html?theme=${slug}">
          <h3>Survival Mode</h3>
          <p>One mistake and the run ends</p>
        </a>

        ${episodeButton}

        <a class="card" href="../remove-ads.html?theme=${slug}&mode=normal">
          <h3>Ad-Free + Extras</h3>
          <p>Printables, answer sheets, and bonus files</p>
        </a>

        <a class="card" href="../wordle.html?theme=${slug}&page=1">
          <h3>Wordle</h3>
          <p>Guess themed words</p>
        </a>
      </div>
      ${sampleQuestionsHtml}
      ${relatedThemesHtml}
    </section>
  </main>

  <footer class="site-footer">
    <div class="container">
      <div class="footer-links">
        <a id="removeAdsLink" class="footer-highlight" href="../remove-ads.html?theme=${slug}&mode=normal">Ad-Free + Extras</a>
        <a href="../about.html">About</a>
        <a class="footer-highlight" href="../how-it-works.html">How It Works</a>
        <a class="footer-highlight" href="../contact.html">Contact</a>
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
    `${SITE_URL}/categories/tv-series.html`,
    `${SITE_URL}/categories/games.html`,
    `${SITE_URL}/categories/sports.html`,
    `${SITE_URL}/categories/general.html`,
    `${SITE_URL}/categories/education.html`,
    `${SITE_URL}/categories/books.html`,
    `${SITE_URL}/categories/countries.html`,
    `${SITE_URL}/categories/newly-added.html`,
    `${SITE_URL}/remove-ads.html`
  ];

  themes.forEach((theme) => {
    if (!theme.slug || !theme.title || !theme.questionFile) return;

    if (seen.has(theme.slug)) {
      console.warn(`Duplicate slug detected: ${theme.slug} — later file will overwrite earlier one.`);
    }
    seen.add(theme.slug);

    const hasEpisodeMode = Boolean(episodeThemes[theme.slug]);
    const sampleQuestions = getSampleQuestions(theme.questionFile);
    const html = buildThemePage(theme, themes, hasEpisodeMode, sampleQuestions);
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
