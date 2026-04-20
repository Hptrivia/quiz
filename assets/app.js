async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

function getParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function getRelatedThemes(allThemes, currentTheme, limit = 5) {
  const sameCategory = allThemes.filter(t =>
    t.slug !== currentTheme.slug &&
    t.category === currentTheme.category
  );

  return shuffleArray(sameCategory).slice(0, limit);
}

function slugify(text) {
  return text.toLowerCase().replace(/\s+/g, "-");
}

function updateRemoveAdsFooter(themeSlug = "", mode = "normal") {
  const link = document.getElementById("removeAdsLink");
  if (!link) return;

  if (!themeSlug) {
    link.href = "remove-ads.html";
    return;
  }

  link.href = `remove-ads.html?theme=${encodeURIComponent(themeSlug)}&mode=${encodeURIComponent(mode)}`;
}

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function shuffleQuestionOptions(question) {
  return {
    ...question,
    options: shuffleArray(question.options)
  };
}

function groupByCategory(items) {
  const map = {};
  items.forEach(item => {
    if (!map[item.category]) map[item.category] = [];
    map[item.category].push(item);
  });
  return map;
}

function normalizeDifficulty(value) {
  return String(value || "").trim().toLowerCase();
}

function getDifficultyGroups(questions) {
  const easyMedium = [];
  const hardExpert = [];

  questions.forEach(question => {
    const difficulty = normalizeDifficulty(question.difficulty);

    if (difficulty === "easy" || difficulty === "medium") {
      easyMedium.push(question);
    } else if (difficulty === "hard" || difficulty === "expert") {
      hardExpert.push(question);
    }
  });

  return { easyMedium, hardExpert };
}

function buildBalancedBatches(allQuestions, batchSize, easyMediumCount, hardExpertCount) {
  const { easyMedium, hardExpert } = getDifficultyGroups(allQuestions);

  let easyMediumIndex = 0;
  let hardExpertIndex = 0;
  const batches = [];

  while (easyMediumIndex < easyMedium.length || hardExpertIndex < hardExpert.length) {
    const batch = [];

    const takeEasyMedium = Math.min(easyMediumCount, easyMedium.length - easyMediumIndex);
    const takeHardExpert = Math.min(hardExpertCount, hardExpert.length - hardExpertIndex);

    for (let i = 0; i < takeEasyMedium; i++) {
      batch.push(easyMedium[easyMediumIndex++]);
    }

    for (let i = 0; i < takeHardExpert; i++) {
      batch.push(hardExpert[hardExpertIndex++]);
    }

    while (batch.length < batchSize && easyMediumIndex < easyMedium.length) {
      batch.push(easyMedium[easyMediumIndex++]);
    }

    while (batch.length < batchSize && hardExpertIndex < hardExpert.length) {
      batch.push(hardExpert[hardExpertIndex++]);
    }

    if (!batch.length) break;

    batches.push(shuffleArray(batch));
  }

  return batches;
}

async function loadThemes() {
  return await fetchJSON("data/themes.json");
}

/* ---------------- HOME PAGE ---------------- */
async function renderHomePage() {
  const themes = await loadThemes();
  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");
  const categoryList = document.getElementById("categoryList");
  const newlyAddedList = document.getElementById("newlyAddedList");

  let newThemeSlugs = [];
  try {
    const data = await fetchJSON("data/new_themes.json");
    newThemeSlugs = Array.isArray(data) ? data : [];
  } catch (e) {
    newThemeSlugs = [];
  }

  function render(filteredThemes) {
    if (categoryList) categoryList.innerHTML = "";
    if (newlyAddedList) newlyAddedList.innerHTML = "";


if (newlyAddedList) {
  const matchedNewThemes = newThemeSlugs
    .map(slug => filteredThemes.find(theme => theme.slug === slug))
    .filter(Boolean);

  const card = document.createElement("a");
  card.className = "card";
  card.href = `categories/newly-added.html`;
  card.innerHTML = `
    <h3>Newly Added</h3>
    <p>${matchedNewThemes.length} theme(s)</p>
  `;
  newlyAddedList.appendChild(card);
}

    const grouped = groupByCategory(filteredThemes);

    const categoryOrder = [
      "TV/Series",
      "Games",
      "Sports",
      "General",
      "Education",
      "Books",
      "Countries"
    ];

    categoryOrder.forEach(category => {
      if (!grouped[category]) return;

      const card = document.createElement("a");
      card.className = "card";
      const categoryPageMap = {
  "TV/Series": "tv-series",
  "Games": "games",
  "Sports": "sports",
  "General": "general",
  "Education": "education",
  "Books": "books",
  "Countries": "countries"
};

card.href = `categories/${categoryPageMap[category]}.html`;
      card.innerHTML = `
        <h3>${category}</h3>
        <p>${grouped[category].length} theme(s)</p>
      `;
      categoryList.appendChild(card);
    });
  }

  function renderSearchResults(items) {
    if (!searchResults) return;

    if (!items.length) {
      searchResults.innerHTML = `<div class="search-item">No results found</div>`;
      return;
    }

    searchResults.innerHTML = "";

    items.forEach(theme => {
      const item = document.createElement("a");
      item.className = "search-item";
      item.href = `play.html?theme=${theme.slug}`;
      item.textContent = theme.title;
      searchResults.appendChild(item);
    });
  }

  render(themes);

  searchInput?.addEventListener("focus", () => {
    renderSearchResults(themes);
    searchResults.style.display = "block";
  });

  searchInput?.addEventListener("input", e => {
    const value = e.target.value.trim().toLowerCase();

    const filtered = themes.filter(theme =>
      theme.title.toLowerCase().includes(value)
    );

    renderSearchResults(filtered);
    searchResults.style.display = "block";
  });

  document.addEventListener("click", e => {
    if (
      searchInput &&
      searchResults &&
      !searchInput.contains(e.target) &&
      !searchResults.contains(e.target)
    ) {
      searchResults.style.display = "none";
    }
  });
}
/* ---------------- CATEGORY PAGE ---------------- */
async function renderCategoryPage() {
  const categoryName = getParam("category");
  const themes = await loadThemes();
  const pageTitle = document.getElementById("categoryTitle");
  const themeList = document.getElementById("categoryThemes");
  const introEl = document.getElementById("categoryIntro");
  const bottomTextEl = document.getElementById("categoryBottomText");

  pageTitle.textContent = categoryName || "Category";
  themeList.innerHTML = "";

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

if (introEl) {
  const introParts = categoryIntroMap[categoryName] || [
    "Browse trivia themes in this category and choose the mode that fits how you want to play."
  ];

  introEl.innerHTML = introParts.map(text => `<p>${text}</p>`).join("");
}

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
    <a href="why-tv-trivia-is-so-addictive.html">Read: Why TV Trivia Is So Addictive</a>
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
    <a href="why-video-game-trivia-works-so-well.html">Read: Why Video Game Trivia Works So Well</a>
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
    <a href="why-fans-love-sport-trivia.html">Read: Why Fans Love Sport Trivia</a>
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
    <a href="the-good-ole-general-trivia.html">Read: The Good Ole General Trivia</a>
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
    <a href="testing-your-knowledge-of-your-favorite.subjects.html">Read: Testing Your Knowledge Of Your Favorite Subjects</a>
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
    <a href="remembering-details-from-books-you-have-read.html">Read: Remembering Details From Books You Have Read</a>
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
    <a href="how-well-do-you-really-know-your-country.html">Read: How Well Do You Really Know Your Country</a>
  </p>
  `
};
  if (bottomTextEl) {
  bottomTextEl.innerHTML = categoryBottomMap[categoryName] || "";
}

  let filtered = [];

  if ((categoryName || "").toLowerCase() === "newly added") {
    try {
      const newThemeSlugs = await fetchJSON("data/new_themes.json");

      filtered = (Array.isArray(newThemeSlugs) ? newThemeSlugs : [])
        .map(slug => themes.find(theme => theme.slug === slug))
        .filter(Boolean);
    } catch (e) {
      filtered = [];
    }
  } else {
    filtered = themes
      .filter(theme => theme.category.toLowerCase() === (categoryName || "").toLowerCase())
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  themeList.className = "grid";
  themeList.innerHTML = "";

  if (!filtered.length) {
    themeList.innerHTML = `<p>No themes found.</p>`;
    return;
  }

  filtered.forEach(theme => {
    const card = document.createElement("a");
    card.className = "card";
    card.href = `themes/${theme.slug}.html`;
    card.innerHTML = `
      <h3>${theme.title}</h3>
      
    `;
    themeList.appendChild(card);
  });
}

/* ---------------- QUIZ LANDING PAGE ---------------- */
async function renderQuizPage() {
  const slug = getParam("theme");
  const themes = await loadThemes();
  const theme = themes.find(t => t.slug === slug);

  const title = document.getElementById("quizTitle");
  const desc = document.getElementById("quizDescription");
  const playBtn = document.getElementById("playButton");
  const survivalBtn = document.getElementById("survivalButton");
  const challengeBtn = document.getElementById("challengeButton");
  const episodeBtn = document.getElementById("episodeButton");
  const wordleBtn = document.getElementById("wordleButton");

  if (!theme) {
    title.textContent = "Theme not found";
    desc.textContent = "Lorem ipsum dolor sit amet.";
    meta.textContent = "";
    playBtn.style.display = "none";
    return;
  }

  title.textContent = theme.title;
  desc.textContent = theme.description;
  updateRemoveAdsFooter(theme.slug, "normal");
  playBtn.href = `play.html?theme=${theme.slug}`;
  challengeBtn.href = `challenge.html?theme=${theme.slug}&round=1`;
  survivalBtn.href = `survival.html?theme=${theme.slug}`;
  wordleBtn.href = `wordle.html?theme=${theme.slug}`;
  try {
  const episodeThemes = await fetchJSON("data/episode_themes.json");
  if (episodeThemes[theme.slug]) {
    episodeBtn.style.display = "block";
    episodeBtn.href = `episode.html?theme=${theme.slug}`;
  } else {
    episodeBtn.style.display = "none";
  }
} catch (e) {
  episodeBtn.style.display = "none";
}
  }

/* ---------------- PLAY PAGE / SPEED MODE ---------------- */
let quizState = {
  questions: [],
  currentIndex: 0,
  score: 0,
  selectedAnswer: null
};
function getMarathonTier(score, total) {
  if (!total || total <= 0) return "";

  const pct = (score / total) * 100;

  if (pct >= 95) {
    return "🏆 SUPERFAN! You basically know this show by heart.";
  } else if (pct >= 60) {
    return "🎬 True Fan. You know this show really well, but you are not a SUPERFAN.";
  } else if (pct >= 40) {
    return "📺 Casual Viewer. Not bad, but a rewatch wouldn’t hurt.";
  } else {
    return "👀 Rewatch time! Looks like you need another rewatch.";
  }
}

async function renderPlayPage() {
  const slug = getParam("theme");
  const themes = await loadThemes();
  const theme = themes.find(t => t.slug === slug);

  const PAGE_SIZE = 30; // later change 10 -> 30

  const progress = document.getElementById("progressText");
  const questionEl = document.getElementById("questionText");
  const optionsEl = document.getElementById("optionsList");
  const feedbackEl = document.getElementById("feedbackText");
  const submitBtn = document.getElementById("submitButton");
  const nextBtn = document.getElementById("nextButton");
  const resultBox = document.getElementById("resultBox");
  const scoreEl = document.getElementById("scoreText");
  const nextPageLink = document.getElementById("nextPageLink");

  if (!theme) {
    questionEl.textContent = "Theme not found";
    return;
  }

  if (typeof gtag === "function") {
  gtag("event", "page_view", {
    page_title: `Play Quiz - ${theme.title}`,
    page_location: window.location.href
  });
}

let buyPackUrl = "https://ko-fi.com/triviaking/shop";
 try { const normalPackLinks = await fetchJSON("data/normal_pack_links.json"); 
  buyPackUrl = normalPackLinks[theme.title] || buyPackUrl;
 } catch (e) { 
  buyPackUrl = "https://ko-fi.com/triviaking/shop"; }

  if (typeof updateRemoveAdsFooter === "function") {
    updateRemoveAdsFooter(theme.slug, "normal");
  }

  const rawPage = parseInt(getParam("page") || "1", 10);
  const currentPage = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

  const allQuestions = await fetchJSON(theme.questionFile);
  const allPages = buildBalancedBatches(allQuestions, PAGE_SIZE, 15, 15);
  const totalPages = allPages.length;
  const safePage = Math.min(currentPage, totalPages);

  quizState.questions = allPages[safePage - 1] || [];
  quizState.currentIndex = 0;
  quizState.score = 0;
  quizState.selectedAnswer = null;

  if (nextPageLink) {
    if (safePage < totalPages) {
      nextPageLink.style.display = "inline-block";
      nextPageLink.textContent = "Skip to next page";
      nextPageLink.href = `play.html?theme=${theme.slug}&page=${safePage + 1}`;
    } else {
      nextPageLink.style.display = "none";
    }
  }

  function renderQuestion() {
    const q = shuffleQuestionOptions(quizState.questions[quizState.currentIndex]);

    feedbackEl.textContent = "";
    feedbackEl.className = "feedback";
    optionsEl.innerHTML = "";
    submitBtn.disabled = false;
    nextBtn.style.display = "none";
    quizState.selectedAnswer = null;

    progress.textContent = `Question ${quizState.currentIndex + 1} of ${quizState.questions.length}`;
    scoreEl.textContent = `Score: ${quizState.score}`;
    questionEl.textContent = q.question;

    q.options.forEach(option => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = option;

btn.addEventListener("click", () => {
  quizState.selectedAnswer = option;
  document.querySelectorAll("#optionsList .option-btn").forEach(b => {
    b.classList.remove("selected", "correct-anim", "wrong-anim");
  });
  btn.classList.add("selected");
});

      optionsEl.appendChild(btn);
    });
  }

function renderResult() {
  document.getElementById("quizBox").style.display = "none";
  resultBox.style.display = "block";
  resultBox.classList.remove("result-anim");
  void resultBox.offsetWidth;
  resultBox.classList.add("result-anim");

  const hasNextPage = safePage < totalPages;
  const tierText = getMarathonTier(quizState.score, quizState.questions.length);

  const relatedThemes = getRelatedThemes(themes, theme, 5);

const relatedThemesHtml = relatedThemes.length ? `
  <div class="theme-related-quizzes">
    <h3>Related Quizzes</h3>
    <div class="grid">
      ${relatedThemes.map(item => `
        <a class="card" href="play.html?theme=${item.slug}">
          <h3>${item.title}</h3>
        </a>
      `).join("")}
    </div>
  </div>
` : "";

  resultBox.innerHTML = `
    <h2>Quiz Complete</h2>
    <p>Your score: ${quizState.score} / ${quizState.questions.length}</p>
    <p class="result-tier">${tierText}</p>
    <div class="cta-row">
      ${hasNextPage ? `<a class="primary-btn" href="play.html?theme=${theme.slug}&page=${safePage + 1}">Next Round</a>` : ""}
      <a class="secondary-btn" href="${buyPackUrl}" target="_blank" rel="noopener noreferrer">Ad-Free</a>
      <a class="secondary-btn" href="contact.html">Report a Question</a>
    </div>

      <div class="result-theme-search">
    <p class="result-theme-search-title">Try another theme</p>
    <div class="search-wrap">
      <input id="resultThemeSearchInput" class="theme-search-input" type="text" placeholder="Search themes..." autocomplete="off" />
      <div id="resultThemeSearchResults" class="search-results"></div>
    </div>
  </div>
  ${relatedThemesHtml}
  `;
  const resultSearchInput = document.getElementById("resultThemeSearchInput");
const resultSearchResults = document.getElementById("resultThemeSearchResults");

if (resultSearchInput && resultSearchResults) {
  const renderThemeResults = (items) => {
    if (!items.length) {
      resultSearchResults.innerHTML = '<div class="search-item">No results found</div>';
      return;
    }

    resultSearchResults.innerHTML = items.map(item => `
      <a class="search-item" href="play.html?theme=${item.slug}">${item.title}</a>
    `).join("");
  };

  resultSearchInput.addEventListener("focus", () => {
    renderThemeResults(themes);
    resultSearchResults.style.display = "block";
  });

  resultSearchInput.addEventListener("input", (e) => {
    const value = e.target.value.trim().toLowerCase();
    const filtered = themes.filter(item =>
      item.title.toLowerCase().includes(value)
    );
    renderThemeResults(filtered);
    resultSearchResults.style.display = "block";
  });

  document.addEventListener("click", (e) => {
    if (!resultSearchInput.contains(e.target) && !resultSearchResults.contains(e.target)) {
      resultSearchResults.style.display = "none";
    }
  });
}

  setTimeout(() => {
    if (typeof showInstallCard === "function") {
      showInstallCard();
    }
  }, 800);
}

submitBtn.addEventListener("click", () => {
  if (!quizState.selectedAnswer) return;

  const q = quizState.questions[quizState.currentIndex];
  const selectedBtn = document.querySelector("#optionsList .option-btn.selected");

  if (quizState.selectedAnswer === q.answer) {
    quizState.score += 1;
    feedbackEl.textContent = "Correct";
    feedbackEl.className = "feedback correct";
    if (selectedBtn) {
      selectedBtn.classList.remove("wrong-anim");
      void selectedBtn.offsetWidth;
      selectedBtn.classList.add("correct-anim");
    }
  } else {
    feedbackEl.textContent = "Wrong";
    feedbackEl.className = "feedback wrong";
    if (selectedBtn) {
      selectedBtn.classList.remove("correct-anim");
      void selectedBtn.offsetWidth;
      selectedBtn.classList.add("wrong-anim");
    }
  }

  submitBtn.disabled = true;
  nextBtn.style.display = "inline-block";
});

  nextBtn.addEventListener("click", () => {
    quizState.currentIndex += 1;
    if (quizState.currentIndex >= quizState.questions.length) {
      renderResult();
    } else {
      renderQuestion();
    }
  });

  renderQuestion();
}

/* ---------------- BOOTSTRAP ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  if (page === "home") renderHomePage();
  if (page === "category") renderCategoryPage();
  if (page === "quiz") renderQuizPage();
  if (page === "play") renderPlayPage();
});