function isPremiumUser() {
  const expiry = localStorage.getItem('adsRemovedUntil');
  if (!expiry) return false;
  return new Date(expiry) > new Date();
}

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

  function render(filteredThemes) {
    if (categoryList) categoryList.innerHTML = "";

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

  pageTitle.textContent = categoryName || "Category";
  themeList.innerHTML = "";

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
  const wordSearchBtn = document.getElementById("wordSearchButton");
  const wordleBtn = document.getElementById("wordleButton");
  const adFreeBtn = document.getElementById("adFreeButton");

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
  wordSearchBtn.href = `wordsearch.html?theme=${theme.slug}&page=1`;
  wordleBtn.href = `wordle.html?theme=${theme.slug}`;
  if (adFreeBtn) adFreeBtn.href = `remove-ads.html?theme=${theme.slug}&mode=normal`;
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

// One question per page per mode — set to false to revert to scrollable stack
const ONE_PER_PAGE_MARATHON  = true;
const ONE_PER_PAGE_CHALLENGE = true;
const ONE_PER_PAGE_SURVIVAL  = true;
const ONE_PER_PAGE_EPISODE   = true;

async function renderPlayPage() {
  const slug = getParam("theme");
  const themes = await loadThemes();
  const theme = themes.find(t => t.slug === slug);

  const PAGE_SIZE = 30; // later change 10 -> 30

  const slidesContainer = document.getElementById("playSlides");
  const resultBox = document.getElementById("resultBox");
  const nextPageLink = document.getElementById("nextPageLink");
  const progressText = document.getElementById("progressText");
  const scoreText = document.createElement("p");
  scoreText.className = "play-score-text";
  scoreText.textContent = "Score: 0";

  if (!theme) {
    slidesContainer.textContent = "Theme not found";
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

  quizState.questions = (allPages[safePage - 1] || []).map(q => shuffleQuestionOptions(q));
  quizState.currentIndex = 0;
  quizState.score = 0;
  quizState.selectedAnswer = null;

  let revealAnswers = false;

  if (progressText) progressText.textContent = `Page ${safePage}`;

  if (nextPageLink) {
    if (safePage < totalPages) {
      nextPageLink.style.display = "inline-block";
      nextPageLink.textContent = "Skip to next page";
      nextPageLink.href = `play.html?theme=${theme.slug}&page=${safePage + 1}`;
    } else {
      nextPageLink.style.display = "none";
    }
  }

  function showQuestion(index) {
    const prev = slidesContainer.querySelector(".question-slide.active");
    if (prev) {
      prev.classList.remove("active");
      prev.classList.add("answered");
      if (ONE_PER_PAGE_MARATHON) prev.style.display = "none";
    }
    const slide = slidesContainer.querySelector(`.question-slide[data-index="${index}"]`);
    if (slide) {
      slide.classList.add("active");
      if (ONE_PER_PAGE_MARATHON) slide.style.display = "block";
      slide.appendChild(scoreText);
      slide.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    quizState.selectedAnswer = null;
  }

  if (isPremiumUser()) {
    const revealToggleBtn = document.createElement("button");
    revealToggleBtn.className = "secondary-btn reveal-answers-toggle";
    revealToggleBtn.textContent = "Reveal Answers: OFF";
    revealToggleBtn.addEventListener("click", () => {
      revealAnswers = !revealAnswers;
      revealToggleBtn.className = revealAnswers
        ? "primary-btn reveal-answers-toggle"
        : "secondary-btn reveal-answers-toggle";
      revealToggleBtn.textContent = revealAnswers ? "Reveal Answers: ON" : "Reveal Answers: OFF";
    });
    const quizBoxEl = document.getElementById("quizBox");
    if (quizBoxEl) quizBoxEl.insertBefore(revealToggleBtn, slidesContainer);
  }

  // Pre-render all question slides
  quizState.questions.forEach((q, index) => {
    const slide = document.createElement("div");
    slide.className = "question-slide";
    slide.dataset.index = index;

    const qNum = document.createElement("p");
    qNum.className = "slide-question-num";
    qNum.textContent = `Question ${index + 1} of ${quizState.questions.length}`;

    const qText = document.createElement("h2");
    qText.textContent = q.question;

    const optsList = document.createElement("div");
    optsList.className = "options";

    q.options.forEach(option => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = option;
      btn.addEventListener("click", () => {
        if (quizState.currentIndex !== index) return;
        quizState.selectedAnswer = option;
        optsList.querySelectorAll(".option-btn").forEach(b => {
          b.classList.remove("selected", "correct-anim", "wrong-anim");
        });
        btn.classList.add("selected");
      });
      optsList.appendChild(btn);
    });

    const feedbackP = document.createElement("p");
    feedbackP.className = "feedback";

    const submitBtn = document.createElement("button");
    submitBtn.className = "primary-btn";
    submitBtn.textContent = "Submit";

    const nextBtn = document.createElement("button");
    nextBtn.className = "secondary-btn";
    nextBtn.textContent = "Next";
    nextBtn.style.display = "none";

    const ctaRow = document.createElement("div");
    ctaRow.className = "cta-row";
    ctaRow.appendChild(submitBtn);
    ctaRow.appendChild(nextBtn);

    submitBtn.addEventListener("click", () => {
      if (quizState.currentIndex !== index || !quizState.selectedAnswer) return;

      const selectedBtn = optsList.querySelector(".option-btn.selected");

      if (quizState.selectedAnswer === q.answer) {
        quizState.score += 1;
        feedbackP.textContent = "Correct";
        feedbackP.className = "feedback correct";
        if (selectedBtn) {
          selectedBtn.classList.remove("wrong-anim");
          void selectedBtn.offsetWidth;
          selectedBtn.classList.add("correct-anim");
        }
      } else {
        feedbackP.textContent = revealAnswers ? `Wrong. The correct answer is ${q.answer}.` : "Wrong";
        feedbackP.className = "feedback wrong";
        if (selectedBtn) {
          selectedBtn.classList.remove("correct-anim");
          void selectedBtn.offsetWidth;
          selectedBtn.classList.add("wrong-anim");
        }
      }

      if (scoreText) scoreText.textContent = `Score: ${quizState.score}`;
      submitBtn.disabled = true;
      nextBtn.style.display = "inline-block";
    });

    nextBtn.addEventListener("click", () => {
      quizState.currentIndex += 1;
      if (quizState.currentIndex >= quizState.questions.length) {
        renderResult();
      } else {
        showQuestion(quizState.currentIndex);
      }
    });

    slide.appendChild(qNum);
    slide.appendChild(qText);
    slide.appendChild(optsList);
    slide.appendChild(feedbackP);
    slide.appendChild(ctaRow);
    slidesContainer.appendChild(slide);
  });

  if (ONE_PER_PAGE_MARATHON) {
    slidesContainer.querySelectorAll(".question-slide").forEach(s => {
      s.style.display = "none";
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
      <a class="secondary-btn" href="remove-ads.html?theme=${theme.slug}">Ad-Free</a>
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

  if (typeof maybeShowPwaPopup === "function" && maybeShowPwaPopup()) return;
  maybeShowEmailPopup(theme.title);
}

  showQuestion(0);
}

/* ---------------- EMAIL POPUP ---------------- */
function emailPopupDismissAllowed() {
  if (localStorage.getItem("epDone")) return false;
  const dismissCount = parseInt(localStorage.getItem("epDismissCount") || "0", 10);
  const dismissedAt = parseInt(localStorage.getItem("epDismissedAt") || "0", 10);
  if (dismissedAt) {
    const waitDays = dismissCount >= 2 ? 30 : 7;
    const elapsed = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
    if (elapsed < waitDays) return false;
  }
  return true;
}

let emailPopupShown = false;

function showEmailPopupUI(themeName) {
  if (emailPopupShown) return;
  emailPopupShown = true;
  const dismissCount = parseInt(localStorage.getItem("epDismissCount") || "0", 10);

  const overlay = document.createElement("div");
  overlay.className = "email-popup-overlay";
  overlay.innerHTML = `
    <div class="email-popup">
      <button class="email-popup-close" aria-label="Close">&times;</button>
      <h3>Don´t miss what´s next</h3>
      <p>Get notified about new questions, themes and game modes</p>
      <div class="email-popup-form">
        <input class="email-popup-input" type="email" placeholder="you@example.com" autocomplete="email" />
        <button class="email-popup-submit">Subscribe</button>
      </div>
      <p class="email-popup-status"></p>
    </div>
  `;
  document.body.appendChild(overlay);

  const removeOverlay = () => {
    overlay.classList.remove("visible");
    setTimeout(() => overlay.remove(), 400);
  };

  overlay.querySelector(".email-popup-close").addEventListener("click", () => {
    const newCount = dismissCount + 1;
    localStorage.setItem("epDismissCount", newCount);
    localStorage.setItem("epDismissedAt", Date.now());
    if (newCount >= 3) localStorage.setItem("epDone", "1");
    removeOverlay();
  });

  const input = overlay.querySelector(".email-popup-input");
  const submitBtn = overlay.querySelector(".email-popup-submit");
  const statusEl = overlay.querySelector(".email-popup-status");

  submitBtn.addEventListener("click", async () => {
    const email = input.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      statusEl.textContent = "Please enter a valid email.";
      statusEl.style.color = "var(--feedback-wrong)";
      return;
    }

    submitBtn.disabled = true;
    statusEl.textContent = "Subscribing...";
    statusEl.style.color = "";

    const success = await submitEmailToMailchimp(email, themeName);
    if (success) {
      localStorage.setItem("epDone", "1");
      statusEl.textContent = "You're in! Thanks for subscribing.";
      statusEl.style.color = "var(--feedback-correct)";
      setTimeout(() => removeOverlay(), 2000);
    } else {
      submitBtn.disabled = false;
      statusEl.textContent = "Something went wrong. Please try again.";
      statusEl.style.color = "var(--feedback-wrong)";
    }
  });

  setTimeout(() => overlay.classList.add("visible"), 3500);
}

function maybeShowEmailPopup(themeName) {
  if (!emailPopupDismissAllowed()) return;
  const rounds = parseInt(localStorage.getItem("epMarathonRounds") || "0", 10) + 1;
  localStorage.setItem("epMarathonRounds", rounds);
  if (rounds < 2) return;
  showEmailPopupUI(themeName);
}

async function submitEmailToMailchimp(email, themeName) {
  try {
    const res = await fetch("https://formspree.io/f/mqewdrkn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, theme: themeName })
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ---------------- PWA SESSION TRACKING ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  const isPWA = window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
  if (isPWA && typeof gtag === "function") {
    gtag("event", "pwa_session");
  }
});

/* ---------------- BOOTSTRAP ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  if (page === "home") renderHomePage();
  if (page === "category") renderCategoryPage();
  if (page === "quiz") renderQuizPage();
  if (page === "play") renderPlayPage();
});