#!/usr/bin/env node
// Builds character-quiz/<slug>.html for every data/character-quizzes/<slug>.json.
//
// Each page is a full SEO landing page (title targets "<show> test" / "which
// <show> character are you"), with the quiz running client-side from inlined
// JSON — no server calls. Static, crawlable content: intro, how it works (with
// the validator's measured odds), every character's profile, and an FAQ with
// FAQPage schema.
//
// Run scripts/validate-character-quizzes.js first — it writes <slug>.stats.json,
// which feeds the "rarest result" FAQ and the result-screen rarity line.
// Sitemap entries are added by scripts/generate-theme-pages.js (it rebuilds the
// whole sitemap), and also patched in here so this script works on its own.

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data", "character-quizzes");
const outputDir = path.join(rootDir, "character-quiz");
const themesPath = path.join(rootDir, "data", "themes.json");
const sitemapPath = path.join(rootDir, "sitemap.xml");
const SITE_URL = "https://triviagauntlet.app";

const CATEGORY_PAGE_MAP = {
  TV: "tv", Movies: "movies", Anime: "anime", Sitcoms: "sitcoms", Games: "games",
  Sports: "sports", General: "general", Education: "education", Books: "books", Countries: "countries",
};

function esc(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// "The Mentalist" → "Mentalist", so "the ${noThe(show)} test" never reads "the The ...".
function noThe(show) { return show.replace(/^The /, ""); }

function listNames(names) {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}` : names[0];
}

function buildFaq(quiz, stats) {
  const short = quiz.shortName || noThe(quiz.show);
  const names = quiz.characters.map(c => c.name);
  const faq = [
    {
      q: `What is the ${noThe(quiz.show)} test?`,
      a: `It's a free personality quiz that matches you to a ${quiz.show} character. You answer ${quiz.questions.length} questions set inside the world of the show, and every answer quietly scores points for different characters. You get your main character, your runner-up, who you'd clash with, and a percentage breakdown of all ${quiz.characters.length}.`,
    },
    {
      q: `Which ${short} characters can I get?`,
      a: `There are ${quiz.characters.length} possible results: ${listNames(names)}.`,
    },
    {
      q: `How long does the ${noThe(quiz.show)} test take?`,
      a: `About two minutes — ${quiz.questions.length} multiple-choice questions, one tap each.`,
    },
    {
      q: `How is the result calculated?`,
      a: `Each answer adds hidden points to the characters it fits. The character with the most points is your result, and your breakdown shows how your points split across the whole cast. The same answers always give the same result. Before publishing, every possible combination of answers was run through the scoring to make sure every character can be reached and no single character dominates.`,
    },
  ];
  if (stats && stats.share) {
    const sorted = quiz.characters.map(c => [c, stats.share[c.id]]).sort((a, b) => a[1] - b[1]);
    const [rare, rareShare] = sorted[0];
    const [common, commonShare] = sorted[sorted.length - 1];
    faq.push({
      q: `Which ${short} character is the rarest result?`,
      a: `${rare.name}. Only about ${Math.round(rareShare * 100)}% of all possible answer combinations lead to ${rare.name}, compared with about ${Math.round(commonShare * 100)}% for the most common result, ${common.name}.`,
    });
  }
  faq.push({
    q: `Is the ${noThe(quiz.show)} test free?`,
    a: `Yes. No sign-up, no email. When you're done you can test your actual ${quiz.show} knowledge with the trivia quiz.`,
  });
  return faq;
}

// "More character tests" — shown once there are 2+ quizzes. Same-category shows
// first, then the rest; alphabetical (not random) so regenerating doesn't churn
// every page's links.
function otherTestsHtml(quiz, theme, allQuizzes) {
  const others = allQuizzes.filter(o => o.quiz.slug !== quiz.slug);
  if (!others.length) return "";
  const cat = theme && theme.category;
  const byName = (a, b) => a.quiz.show.localeCompare(b.quiz.show);
  const picked = [
    ...others.filter(o => o.theme && o.theme.category === cat).sort(byName),
    ...others.filter(o => !(o.theme && o.theme.category === cat)).sort(byName),
  ].slice(0, 6);
  return `
      <h2 class="cq-small-h">More character tests</h2>
      <div class="grid">
        ${picked.map(o => `<a class="card cq-mode-card" href="${esc(o.quiz.slug)}.html"><h3>Which ${esc(noThe(o.quiz.show))} Character Are You?</h3><p>${o.quiz.questions.length}-question personality test</p></a>`).join("\n        ")}
      </div>`;
}

function buildPage(quiz, stats, theme, allQuizzes) {
  const show = esc(quiz.show);
  const slug = esc(quiz.slug);
  const url = `${SITE_URL}/character-quiz/${quiz.slug}.html`;
  const h1 = `Which ${quiz.shortName || quiz.show} Character Are You?`;
  const faq = buildFaq(quiz, stats);
  const catName = theme ? theme.category : "TV";
  const catSlug = CATEGORY_PAGE_MAP[catName] || "general";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: catName, item: `${SITE_URL}/categories/${catSlug}.html` },
          { "@type": "ListItem", position: 3, name: `${quiz.show} Trivia`, item: `${SITE_URL}/themes/${quiz.slug}.html` },
          { "@type": "ListItem", position: 4, name: `${quiz.show} Test`, item: url },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };

  // Everything the runtime needs, inlined (no fetch = works offline in the app).
  const allTests = allQuizzes.map(o => ({ slug: o.quiz.slug, show: o.quiz.show })).sort((a, b) => noThe(a.show).localeCompare(noThe(b.show)));
  const runtimeData = { slug: quiz.slug, show: quiz.show, characters: quiz.characters, questions: quiz.questions, stats: stats ? { share: stats.share } : {}, allTests };
  const dataJson = JSON.stringify(runtimeData).replace(/</g, "\\u003c");

  const charCards = quiz.characters.map(c => `
          <div class="card cq-char-card" style="--cq:${esc(c.color)}">
            <h3>${c.emoji} ${esc(c.name)}</h3>
            <p class="cq-char-title">${esc(c.title)}</p>
            <p>${esc(c.summary)}</p>
            <p><strong>Strengths:</strong> ${c.strengths.map(esc).join(" · ")}</p>
          </div>`).join("");

  const shareLine = stats && stats.share
    ? ` We ran all ${(4 ** quiz.questions.length).toLocaleString("en-US")} possible answer combinations through the scoring: every character can be reached, and no result takes more than ${Math.ceil(Math.max(...Object.values(stats.share)) * 100)}% of them.`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<script>if(/TriviaGauntletPremium/.test(navigator.userAgent||''))document.documentElement.classList.add('premium-app');</script>
  <meta charset="UTF-8" />
  <link rel="manifest" href="/manifest.json" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${esc(quiz.seoTitle)} | Trivia Gauntlet</title>
  <meta name="description" content="${esc(quiz.metaDescription)}" />
  <link rel="canonical" href="${url}" />
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-E6BY9F2ZDT"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    if(!/TriviaGauntletPremium/.test(navigator.userAgent||''))gtag('config', 'G-E6BY9F2ZDT');
  </script>
  <link rel="apple-touch-icon" href="/assets/icon-192.png" />
  <meta name="theme-color" content="#0f172a" />
  <link rel="stylesheet" href="../assets/style.css" />
  <meta property="og:title" content="${esc(h1)} — ${show} Test" />
  <meta property="og:description" content="${esc(quiz.metaDescription)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${SITE_URL}/assets/icon-192.png" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${esc(h1)} — ${show} Test" />
  <meta name="twitter:description" content="${esc(quiz.metaDescription)}" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body data-defer-game-ad="1">
  <main class="container narrow">
    <div class="theme-top-links">
      <a href="../themes/${slug}.html" class="back-link" onclick="if (history.length > 1) { history.back(); return false; }">&#8592; Back</a>
      <span id="navAvatarSlot"></span>
      <a href="../themes/${slug}.html" class="back-link">More ${esc(quiz.shortName || noThe(quiz.show))} Games &#8594;</a>
    </div>

    <section class="panel">
      <h1>${esc(h1)}</h1>
      <p id="cqIntro" class="cq-intro">${esc(quiz.intro)}</p>
      <div id="cqApp"><noscript><p>This test needs JavaScript turned on.</p></noscript></div>
    </section>

${(() => { const t = otherTestsHtml(quiz, theme, allQuizzes); return t ? `    <section class="panel cq-extra" style="margin-top:16px;">${t}
    </section>
` : ""; })()}
    <section class="panel cq-about cq-extra" style="margin-top:16px;">
      <details>
        <summary>How the ${esc(noThe(quiz.show))} test works</summary>
        <p>Every question puts you in a situation from the world of ${show}. Pick the answer that's most like you, not the one you think sounds best. Each answer adds hidden points to the characters who would make the same choice.${shareLine}</p>
        <p>Your result shows your main character, the character you're secondarily like, the one you'd clash with, and a full percentage breakdown across the cast, so two people who both get the same character can still have very different mixes.</p>
      </details>
      <details>
        <summary>All ${quiz.characters.length} characters</summary>
        <div class="cq-char-grid">${charCards}
        </div>
      </details>
      <h2 class="cq-small-h">FAQ</h2>
      <div class="cq-faq">
        ${faq.map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("\n        ")}
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container">
      <div class="footer-links">
        <a href="../about.html">About</a>
        <a href="../how-it-works.html">How It Works</a>
        <a href="../contact.html">Contact</a>
        <a href="../privacy.html">Privacy Policy</a>
        <a href="../terms.html">Terms</a>
      </div>
    </div>
  </footer>

  <script type="application/json" id="cqData">${dataJson}</script>
  <script src="../assets/profile.js"></script>
  <script src="../assets/character-quiz-score.js"></script>
  <script src="../assets/character-quiz.js"></script>
  <script src="../assets/admob.js"></script>
</body>
</html>
`;
}


// Hub page listing every quiz (character-quiz/index.html) — the announcement
// CTA points here. Alphabetical so regenerating doesn't churn.
function buildHub(allQuizzes) {
  const sorted = allQuizzes.slice().sort((a, b) => noThe(a.quiz.show).localeCompare(noThe(b.quiz.show)));
  const url = `${SITE_URL}/character-quiz/`;
  const desc = `Which TV character are you? Take free personality tests for ${sorted.length} shows, including ${sorted.slice(0, 4).map(o => o.quiz.show).join(", ")} and more.`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<script>if(/TriviaGauntletPremium/.test(navigator.userAgent||''))document.documentElement.classList.add('premium-app');</script>
  <meta charset="UTF-8" />
  <link rel="manifest" href="/manifest.json" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>Which Character Are You? TV Personality Tests | Trivia Gauntlet</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="canonical" href="${url}" />
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-E6BY9F2ZDT"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    if(!/TriviaGauntletPremium/.test(navigator.userAgent||''))gtag('config', 'G-E6BY9F2ZDT');
  </script>
  <link rel="apple-touch-icon" href="/assets/icon-192.png" />
  <meta name="theme-color" content="#0f172a" />
  <link rel="stylesheet" href="../assets/style.css" />
  <meta property="og:title" content="Which Character Are You? | Trivia Gauntlet" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${SITE_URL}/assets/icon-192.png" />
</head>
<body>
  <main class="container narrow">
    <div class="theme-top-links">
      <a href="../index.html" class="back-link" onclick="if (history.length > 1) { history.back(); return false; }">&#8592; Back</a>
      <span id="navAvatarSlot"></span>
      <a href="../index.html" class="back-link">&#8962; Home</a>
    </div>
    <section class="panel">
      <h1>Which Character Are You?</h1>
      <p class="cq-intro">Pick a show and answer a few questions set in its world to find out which character you really are.</p>
      <div class="grid">
        ${sorted.map(o => `<a class="card cq-mode-card" href="${esc(o.quiz.slug)}.html"><h3>${esc(o.quiz.show)}</h3><p>${o.quiz.questions.length} questions · ${o.quiz.characters.length} characters</p></a>`).join("\n        ")}
      </div>
    </section>
  </main>
  <footer class="site-footer">
    <div class="container">
      <div class="footer-links">
        <a href="../about.html">About</a>
        <a href="../how-it-works.html">How It Works</a>
        <a href="../contact.html">Contact</a>
        <a href="../privacy.html">Privacy Policy</a>
        <a href="../terms.html">Terms</a>
      </div>
    </div>
  </footer>
  <script src="../assets/profile.js"></script>
  <script src="../assets/admob.js"></script>
</body>
</html>
`;
}

function patchSitemap(slugs) {
  if (!fs.existsSync(sitemapPath)) return;
  let sitemap = fs.readFileSync(sitemapPath, "utf8");
  const today = new Date().toISOString().slice(0, 10);
  const add = [`${SITE_URL}/character-quiz/`, ...slugs.map(s => `${SITE_URL}/character-quiz/${s}.html`)]
    .filter(u => !sitemap.includes(`<loc>${u}</loc>`))
    .map(u => `  <url>\n    <loc>${u}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`);
  if (!add.length) return;
  sitemap = sitemap.replace("</urlset>", `${add.join("\n")}\n</urlset>`);
  fs.writeFileSync(sitemapPath, sitemap, "utf8");
  console.log(`Added ${add.length} character-quiz URL(s) to sitemap.xml`);
}

const themes = JSON.parse(fs.readFileSync(themesPath, "utf8"));
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
const slugs = [];
const allQuizzes = fs.readdirSync(dataDir)
  .filter(f => f.endsWith(".json") && !f.endsWith(".stats.json"))
  .map(f => {
    const quiz = JSON.parse(fs.readFileSync(path.join(dataDir, f), "utf8"));
    const statsPath = path.join(dataDir, f.replace(/\.json$/, ".stats.json"));
    const stats = fs.existsSync(statsPath) ? JSON.parse(fs.readFileSync(statsPath, "utf8")) : null;
    return { quiz, stats, theme: themes.find(t => t.slug === quiz.slug) };
  });
for (const { quiz, stats, theme } of allQuizzes) {
  if (!stats) console.warn(`No stats for ${quiz.slug} — run scripts/validate-character-quizzes.js first`);
  if (!theme) console.warn(`No theme "${quiz.slug}" in themes.json — trivia links will 404`);
  fs.writeFileSync(path.join(outputDir, `${quiz.slug}.html`), buildPage(quiz, stats, theme, allQuizzes), "utf8");
  slugs.push(quiz.slug);
  console.log(`Generated character-quiz/${quiz.slug}.html`);
}
fs.writeFileSync(path.join(outputDir, "index.html"), buildHub(allQuizzes), "utf8");
console.log("Generated character-quiz/index.html");
patchSitemap(slugs);
