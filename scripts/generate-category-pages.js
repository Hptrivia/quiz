const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const themesPath = path.join(rootDir, "data", "themes.json");
const newThemesPath = path.join(rootDir, "data", "new_themes.json");
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
  "TV/Series": [
    "This category includes trivia quizzes based on sitcoms, fantasy dramas, teen shows, anime, and other popular TV series. Each theme is playable in multiple ways, including Marathon Mode for longer rounds and Challenge Mode for quicker 10-question sessions.",
    "Some TV themes also include Episode Mode, where questions are grouped by episode for a more story-based quiz experience. Use this page to browse shows by fandom and jump into the mode that fits how you want to play."
  ],
  "Games": [
    "This category focuses on video game trivia across action, RPG, horror, open-world, and classic franchises. Quizzes cover characters, bosses, weapons, lore, story moments, mechanics, and other fan knowledge from major game series.",
    "Game themes work especially well in Marathon and Challenge Mode, depending on whether you want a deeper run or a shorter score-based round. This page is built for players looking for focused game trivia by title."
  ],
  "Sports": [
    "This category includes sports trivia on basketball, football, boxing, MMA, wrestling, and more. Themes cover famous players, teams, championships, records, and major moments across different sports.",
    "If you want a quick test, Challenge Mode is the fastest way to play. If you want a longer session, Marathon Mode gives you larger rounds with more questions per page."
  ],
  "Education": [
    "This category includes educational trivia on language, spelling, math, science, technology, and related topics. These quizzes are designed to mix straightforward knowledge with faster recall questions across different subjects.",
    "Some themes suit quick challenge rounds, while others work better as longer marathon sessions. Use this category to play through broader knowledge areas in a more quiz-focused format."
  ],
  "General": [
    "This category includes mixed trivia themes covering geography, history, music, movies, world facts, odd-one-out rounds, and other broad quiz topics. It is designed for players who want variety rather than one single fandom.",
    "These themes are useful for casual quiz sessions, faster challenge rounds, and broad general knowledge play. Browse the list below to jump into a topic and test what you know."
  ],
  "Books": [
    "This category includes trivia based on major books, fantasy franchises, and religious texts. Questions cover characters, stories, settings, themes, and major details from the source material.",
    "These quizzes are built for readers and fans who want more than surface-level recall. Marathon Mode is usually the best fit if you want a fuller run through a book-based theme."
  ],
  "Countries": [
    "This category focuses on country-based trivia covering geography, cities, culture, history, sport, and national identity. Each theme is built around a specific country and can be played in multiple quiz modes.",
    "These pages are ideal for players who want broad knowledge rounds rather than one single show or game franchise. Use the themes below to jump into a country and test your score."
  ],
  "Newly Added": [
    "This section highlights the latest trivia themes added to the site across TV, games, countries, sports, education, and general knowledge.",
    "Use it to find new quizzes quickly and jump into recently added themes before browsing the full categories."
  ]
};

const categoryBottomMap = {
  "TV/Series": `
    <h2>Why TV Trivia Works So Well</h2>
    <p>
      TV trivia is one of the most replayable quiz formats because fans do not just remember the basics. They remember quotes, episode moments, side characters, season finales, and the details that came from watching a show more than once. That is especially true for sitcoms, fantasy series, anime, and long-running fandoms where the audience builds a much deeper memory over time.
    </p>
    <p>
      That is also why TV quizzes can work in different modes. Some are better as quick general rounds, while others work best in episode-based formats where the challenge becomes much more specific. If you want a closer look at why this category is so addictive, you can read the full article below.
    </p>
    <p>
      <a href="../why-tv-trivia-is-so-addictive.html">Read: Why TV Trivia Is So Addictive</a>
    </p>
  `,
  "Games": `
    <h2>Why Game Trivia Feels Different</h2>
    <p>
      Game trivia tends to feel stronger than a lot of people expect because games leave behind deeper memory than more passive entertainment. Players remember bosses, missions, maps, mechanics, upgrades, weapons, and story choices because they actually played through them rather than just watching them happen.
    </p>
    <p>
      That gives game quizzes a lot of variety. Some questions can focus on characters and lore, while others work better around gameplay systems, skills, combat, or progression. If you want a closer look at why game quizzes are so replayable, read the full article below.
    </p>
    <p>
      <a href="../why-video-game-trivia-works-so-well.html">Read: Why Video Game Trivia Works So Well</a>
    </p>
  `,
  "Sports": `
    <h2>Why Sports Trivia Is So Replayable</h2>
    <p>
      Sports trivia works so well because it combines fandom, memory, loyalty, and competition. Fans remember title wins, rivalries, records, players, teams, and the moments that stayed with them for years. That gives sports quizzes a natural intensity that fits both quick rounds and longer challenge formats.
    </p>
    <p>
      It also allows for a lot of variety, from clubs and fighters to championships, nicknames, stadiums, and historic moments. If you want a closer look at why sports quizzes are so addictive, read the full article below.
    </p>
    <p>
      <a href="../why-fans-love-sport-trivia.html">Read: Why Fans Love Sport Trivia</a>
    </p>
  `,
  "General": `
    <h2>Why General Trivia Never Really Gets Old</h2>
    <p>
      General trivia stays popular because it rewards range rather than one single obsession. A player can move from history to science to geography to entertainment in the same round, which keeps the pace unpredictable and gives each quiz a different rhythm. That variety is a big reason general knowledge quizzes remain one of the most replayable formats.
    </p>
    <p>
      They also work well for players who want a broader challenge rather than one fandom or one narrow subject. If you want a closer look at why general quizzes are so addictive, read the full article below.
    </p>
    <p>
      <a href="../the-good-ole-general-trivia.html">Read: The Good Ole General Trivia</a>
    </p>
  `,
  "Education": `
    <h2>Why Education Trivia Can Be Surprisingly Fun</h2>
    <p>
      Education trivia works because it turns school-style subjects into a more playable format. Instead of feeling like a formal test, topics like physics, chemistry, biology, history, and math become faster, lighter, and more competitive. That shift makes knowledge-based categories feel more engaging than a lot of people expect.
    </p>
    <p>
      These quizzes can work both as subject practice and as general challenge rounds for players who enjoy learning while they play. If you want a closer look at why educational quizzes are so effective, read the full article below.
    </p>
    <p>
      <a href="../testing-your-knowledge-of-your-favorite.subjects.html">Read: Testing Your Knowledge Of Your Favorite Subjects</a>
    </p>
  `,
  "Books": `
    <h2>Why Book Trivia Rewards Closer Reading</h2>
    <p>
      Book trivia works especially well because reading creates a different kind of memory. Readers build the world in their heads, remember characters and settings in detail, and often hold onto smaller plot points longer than they expect. That makes book quizzes a strong category for both broad literary knowledge and detailed fandom-based questions.
    </p>
    <p>
      It also becomes even richer when adaptations are involved, since some players know the original books closely while others come in through film or TV versions. If you want a closer look at why this category works so well, read the full article below.
    </p>
    <p>
      <a href="../remembering-details-from-books-you-have-read.html">Read: Remembering Details From Books You Have Read</a>
    </p>
  `,
  "Countries": `
    <h2>Why Country Trivia Stays So Popular</h2>
    <p>
      Country trivia looks simple until the questions go beyond flags and capitals. Once quizzes bring in geography, language, culture, landmarks, borders, and history, the category becomes much more interesting. It feels educational without becoming too heavy, which is a big part of why it works so well for repeat play.
    </p>
    <p>
      It is also one of the strongest categories for testing what people think they know versus what they can actually recall under pressure. If you want a closer look at why country quizzes are so addictive, read the full article below.
    </p>
    <p>
      <a href="../how-well-do-you-really-know-your-country.html">Read: How Well Do You Really Know Your Country</a>
    </p>
  `,
  "Newly Added": `
    <h2>Why New Themes Matter</h2>
    <p>
      New themes keep the site feeling alive. As more shows, games, sports, and broader quiz topics get added, the range of what players can jump into keeps growing too.
    </p>
    <p>
      This section is the fastest way to see what has been added recently before exploring the full categories across the rest of the site.
    </p>
    <p>
      <a href="../blog.html">Read more on the blog</a>
    </p>
  `
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
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2544021252380572"
     crossorigin="anonymous"></script>
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

    <section class="panel category-bottom-panel">
      <div class="category-bottom-text">
        ${categoryBottomMap[categoryName] || ""}
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container">
      <div class="footer-links">
        <a id="removeAdsLink" class="footer-highlight" href="../remove-ads.html">Ad-Free + Extras</a>
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
  let newThemeSlugs = [];

  if (fs.existsSync(newThemesPath)) {
    newThemeSlugs = JSON.parse(fs.readFileSync(newThemesPath, "utf8"));
  }

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

  const newlyAddedThemes = newThemeSlugs
    .map(slug => themes.find(theme => theme.slug === slug))
    .filter(Boolean);

  const newlyAddedHtml = buildCategoryPage("Newly Added", newlyAddedThemes);
  fs.writeFileSync(path.join(outputDir, "newly-added.html"), newlyAddedHtml, "utf8");
  console.log("Generated categories/newly-added.html");
}

main();