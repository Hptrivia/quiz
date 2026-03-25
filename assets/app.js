async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

function getParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
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
  card.href = `category.html?category=${encodeURIComponent("Newly Added")}`;
  card.innerHTML = `
    <h3>Coming Soon</h3>
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
      card.href = `category.html?category=${encodeURIComponent(category)}`;
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
  const totalPages = Math.ceil(allQuestions.length / PAGE_SIZE);
  const safePage = Math.min(currentPage, totalPages);

  const startIndex = (safePage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, allQuestions.length);

  // same 10 questions for each page, but randomized order inside the page
  quizState.questions = shuffleArray(allQuestions.slice(startIndex, endIndex));
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

  resultBox.innerHTML = `
    <h2>Quiz Complete</h2>
    <p>Your score: ${quizState.score} / ${quizState.questions.length}</p>
    <p class="result-tier">${tierText}</p>
    <div class="cta-row">
      ${hasNextPage ? `<a class="primary-btn" href="play.html?theme=${theme.slug}&page=${safePage + 1}">More Questions</a>` : ""}
      <a class="secondary-btn" href="contact.html">Report a Question</a>
    </div>
  `;

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
