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
    
  ],
  "Education": [
    "This category includes educational trivia on language, spelling, math, science, technology, and related topics. These quizzes are designed to mix straightforward knowledge with faster recall questions across different subjects.",
    
  ],
  "General": [
    "This category includes mixed trivia themes covering geography, history, music, movies, world facts, odd-one-out rounds, and other broad quiz topics. It is designed for players who want variety rather than one single fandom.",
    
  ],
  "Books": [
    "This category includes trivia based on major books, fantasy franchises, and religious texts. Questions cover characters, stories, settings, themes, and major details from the source material.",
    
  ],
  "Countries": [
    "This category focuses on country-based trivia covering geography, cities, culture, history, sport, and national identity. Each theme is built around a specific country and can be played in multiple quiz modes.",
    
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
  TV trivia is one of the strongest quiz formats because fans do not just remember the main plot. They remember quotes, side characters, relationships, episode moments, finales, and the details that come from watching a show more than once. That is especially true for sitcoms, long-running dramas, fantasy series, and anime, where fandom memory tends to go much deeper over time.
</p>
<p>
  That is also why TV quizzes can work in different ways. Some work well as broad general rounds, while others are better when they focus on specific shows, seasons, or episodes. If you want to read more about why TV trivia is so replayable and which kinds of shows make the best quiz themes, these articles are a good place to start.
</p>

<div class="blog-list home-blog-list">
  <a class="card" href="../episode-mode-vs-marathon.html">
    <h3>Why Episode Mode Feels Different From Marathon Mode</h3>
    <p>A closer look at why episode-based quizzes work so well for sitcom fans and story-focused trivia.</p>
  </a>

  <a class="card" href="../why-tv-trivia-is-so-addictive.html">
    <h3>Why TV Trivia Is So Addictive</h3>
    <p>A look at why TV series, movies, and anime create some of the most replayable and detail-heavy trivia categories.</p>
  </a>

  <a class="card" href="../why-some-tv-shows-make-better-trivia-themes-than-others.html">
    <h3>Why Some TV Shows Make Better Trivia Themes Than Others</h3>
    <p>A look at why some TV shows work better as trivia themes than others, from rewatch value and memorable characters to quotable dialogue and stronger fan recall.</p>
  </a>

  <a class="card" href="../top-tv-series-of-all-time-and-what-their-trivia-usually-looks-like-part-1.html">
    <h3>Top TV Series of All Time and What Their Trivia Usually Looks Like — Part 1</h3>
    <p>A look at five major TV series and the kinds of quiz questions they naturally inspire, from plot twists to lore and character detail.</p>
  </a>

  <a class="card" href="../top-tv-series-of-all-time-and-what-their-trivia-usually-looks-like-part-2.html">
    <h3>Top TV Series of All Time and What Their Trivia Usually Looks Like — Part 2</h3>
    <p>Five more top TV series and the kinds of trivia they naturally inspire, from iconic characters and quotes to long-running storylines.</p>
  </a>
</div>
  `,
"Games": `
  <h2>Why Game Trivia Feels Different</h2>
  <p>
    Game trivia tends to feel stronger than a lot of people expect because games leave behind deeper memory than more passive entertainment. Players remember bosses, missions, maps, mechanics, upgrades, weapons, and story choices because they actually played through them rather than just watching them happen.
  </p>
  <p>
    That gives game quizzes a lot of variety. Some questions can focus on characters and lore, while others work better around gameplay systems, skills, combat, or progression. If you want to read more about why game quizzes are so replayable and which kinds of games create the strongest quiz material, these articles are a good place to start.
  </p>

  <div class="blog-list home-blog-list">
    <a class="card" href="../why-video-game-trivia-works-so-well.html">
      <h3>Why Video Game Trivia Works So Well</h3>
      <p>Why game quizzes work so well, from lore and story to gameplay mechanics, boss fights, and replayable fan knowledge.</p>
    </a>

    <a class="card" href="../the-greatest-video-games-ever-made-and-the-kinds-of-trivia-they-inspire-part-1.html">
      <h3>The Greatest Video Games Ever Made and the Kinds of Trivia They Inspire — Part 1</h3>
      <p>A look at five major video games and the kinds of trivia they naturally inspire, from missions and maps to lore, mechanics, and story moments.</p>
    </a>

    <a class="card" href="../the-greatest-video-games-ever-made-and-the-kinds-of-trivia-they-inspire-part-2.html">
      <h3>The Greatest Video Games Ever Made and the Kinds of Trivia They Inspire — Part 2</h3>
      <p>Five more major video games and the kinds of trivia they inspire, from character choices and factions to myth, survival, and world-building.</p>
    </a>
  </div>
`,
"Sports": `
  <h2>Why Sports Trivia Is So Replayable</h2>
  <p>
    Sports trivia works so well because it combines fandom, memory, loyalty, and competition. Fans remember title wins, rivalries, records, players, teams, and the moments that stayed with them for years. That gives sports quizzes a natural intensity that fits both quick rounds and longer challenge formats.
  </p>
  <p>
    It also allows for a lot of variety, from clubs and fighters to championships, nicknames, stadiums, and historic moments. If you want to read more about why sports quizzes are so addictive and which sports create the strongest quiz material, these articles are a good place to start.
  </p>

  <div class="blog-list home-blog-list">
    <a class="card" href="../why-fans-love-sport-trivia.html">
      <h3>Why Fans Love Sport Trivia</h3>
      <p>A closer look at how sports fandom, rivalries, records, and iconic moments make sports quizzes so competitive and replayable.</p>
    </a>

    <a class="card" href="../the-sports-that-create-the-best-trivia-questions-part-1.html">
      <h3>The Sports That Create the Best Trivia Questions — Part 1</h3>
      <p>A look at five sports that create especially strong trivia, from football and basketball to tennis and cricket.</p>
    </a>

    <a class="card" href="../the-sports-that-create-the-best-trivia-questions-part-2.html">
      <h3>The Sports That Create the Best Trivia Questions — Part 2</h3>
      <p>Five more sports that naturally create strong trivia, from boxing and MMA to Formula 1, baseball, and wrestling.</p>
    </a>
  </div>
`,
"General": `
  <h2>Why General Trivia Never Gets Old</h2>
  <p>
    General trivia stays popular because it rewards range rather than one single obsession. A player can move from history to science to geography to entertainment in the same round, which keeps the pace unpredictable and gives each quiz a different rhythm. That variety is a big reason general knowledge quizzes remain one of the most replayable formats.
  </p>
  <p>
    They also work well for players who want a broader challenge rather than one fandom or one narrow subject. If you want to read more about why general quizzes stay so strong and which topics make the best general knowledge rounds, these articles are a good place to start.
  </p>

  <div class="blog-list home-blog-list">
    <a class="card" href="../why-general-trivia-never-gets-old.html">
      <h3>Why General Trivia Never Gets Old</h3>
      <p>Why general knowledge quizzes remain so strong, from unpredictability and breadth to competition and everyday usefulness.</p>
    </a>

    <a class="card" href="../the-general-knowledge-topics-that-create-the-best-trivia-questions-part-1.html">
      <h3>The General Knowledge Topics That Create the Best Trivia Questions — Part 1</h3>
      <p>A look at five of the strongest general knowledge topics for trivia, from history and geography to science, entertainment, and sports.</p>
    </a>

    <a class="card" href="../the-general-knowledge-topics-that-create-the-best-trivia-questions-part-2.html">
      <h3>The General Knowledge Topics That Create the Best Trivia Questions — Part 2</h3>
      <p>Five more strong general knowledge topics for trivia, from literature and politics to food, music, and famous people.</p>
    </a>
  </div>
`,
"Education": `
  <h2>Why Education Trivia Can Be Surprisingly Fun</h2>
  <p>
    Education trivia works because it turns school-style subjects into a more playable format. Instead of feeling like a formal test, topics like physics, chemistry, biology, history, and math become faster, lighter, and more competitive. That shift makes knowledge-based categories feel more engaging than a lot of people expect.
  </p>
  <p>
    These quizzes can work both as subject practice and as general challenge rounds for players who enjoy learning while they play. If you want to read more about why educational quizzes work so well and which subjects make the strongest quiz topics, these articles are a good place to start.
  </p>

  <div class="blog-list home-blog-list">
    <a class="card" href="../testing-your-knowledge-of-your-favorite.subjects.html">
      <h3>Testing Your Knowledge Of Your Favorite Subjects</h3>
      <p>Why subjects like physics, chemistry, biology, and history become much more engaging when turned into playable quiz formats.</p>
    </a>

    <a class="card" href="../the-school-subjects-that-make-the-best-quiz-topics-part-1.html">
      <h3>The School Subjects That Make the Best Quiz Topics — Part 1</h3>
      <p>A look at five school subjects that make especially strong quiz topics, from history and geography to biology, chemistry, and physics.</p>
    </a>

    <a class="card" href="../the-school-subjects-that-make-the-best-quiz-topics-part-2.html">
      <h3>The School Subjects That Make the Best Quiz Topics — Part 2</h3>
      <p>Five more school subjects that make strong quiz topics, from literature and maths to astronomy, computer science, and economics.</p>
    </a>
  </div>
`,
"Books": `
  <h2>Why Book Trivia Rewards Closer Reading</h2>
  <p>
    Book trivia works especially well because reading creates a different kind of memory. Readers build the world in their heads, remember characters and settings in detail, and often hold onto smaller plot points longer than they expect. That makes book quizzes a strong category for both broad literary knowledge and detailed fandom-based questions.
  </p>
  <p>
    It also becomes even richer when adaptations are involved, since some players know the original books closely while others come in through film or TV versions. If you want to read more about why book quizzes work so well and which books create the strongest trivia material, these articles are a good place to start.
  </p>

  <div class="blog-list home-blog-list">
    <a class="card" href="../remembering-details-from-books-you-have-read.html">
      <h3>Remembering Details From Books You Have Read</h3>
      <p>How reading creates deeper memory, stronger detail recall, and some of the most satisfying fandom-based quiz questions.</p>
    </a>

    <a class="card" href="../the-best-selling-books-and-series-of-all-time-and-what-their-trivia-usually-covers-part-1.html">
      <h3>The Best-Selling Books and Series of All Time and What Their Trivia Usually Covers — Part 1</h3>
      <p>A look at five of the best-selling books and series of all time and the kinds of trivia they naturally inspire.</p>
    </a>

    <a class="card" href="../the-best-selling-books-and-series-of-all-time-and-what-their-trivia-usually-covers-part-2.html">
      <h3>The Best-Selling Books and Series of All Time and What Their Trivia Usually Covers — Part 2</h3>
      <p>Five more of the best-selling books and series of all time and the kinds of trivia they naturally inspire, from mysteries to children’s fantasy.</p>
    </a>
  </div>
`,
"Countries": `
  <h2>Why Country Trivia Stays So Popular</h2>
  <p>
    Country trivia looks simple until the questions go beyond flags and capitals. Once quizzes bring in geography, language, culture, landmarks, borders, and history, the category becomes much more interesting. It feels educational without becoming too heavy, which is a big part of why it works so well for repeat play.
  </p>
  <p>
    It is also one of the strongest categories for testing what people think they know versus what they can actually recall under pressure. If you want to read more about why country quizzes are so satisfying and which countries create the strongest quiz material, these articles are a good place to start.
  </p>

  <div class="blog-list home-blog-list">
    <a class="card" href="../how-well-do-you-really-know-your-country.html">
      <h3>How Well Do You Really Know Your Country</h3>
      <p>Why country quizzes go far beyond flags and capitals, and why geography and culture make them so satisfying to play.</p>
    </a>

    <a class="card" href="../the-worlds-most-visited-countries-and-the-trivia-topics-theyre-best-known-for-part-1.html">
      <h3>The World’s Most Visited Countries and the Trivia Topics They’re Best Known For — Part 1</h3>
      <p>A look at five of the world’s most visited countries and the kinds of trivia they naturally inspire, from landmarks to food, sport, and history.</p>
    </a>

    <a class="card" href="../the-worlds-most-visited-countries-and-the-trivia-topics-theyre-best-known-for-part-2.html">
      <h3>The World’s Most Visited Countries and the Trivia Topics They’re Best Known For — Part 2</h3>
      <p>Five more of the world’s most visited countries and the kinds of trivia they naturally inspire, from architecture and capitals to culture and geography.</p>
    </a>
  </div>
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
  <script>(function(s){s.dataset.zone='10961427',s.src='https://n6wxm.com/vignette.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))</script>
  <script>(function(s){s.dataset.zone='10961935',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))</script>
  <script>(function(s){s.dataset.zone='10962017',s.src='https://al5sm.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))</script>
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