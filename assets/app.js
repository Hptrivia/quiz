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
  const featuredList = document.getElementById("featuredThemes");
  const categoryList = document.getElementById("categoryList");

  function render(filteredThemes) {
    if (featuredList) featuredList.innerHTML = "";
    categoryList.innerHTML = "";

    if (featuredList) {
      filteredThemes.forEach(theme => {
        const card = document.createElement("a");
        card.className = "card";
        card.href = `quiz.html?theme=${theme.slug}`;
        card.innerHTML = `
          <h3>${theme.title}</h3>
          <p>${theme.description}</p>
          <span class="badge">${theme.category}</span>
        `;
        featuredList.appendChild(card);
      });
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

  pageTitle.textContent = categoryName || "Category";

  const filtered = themes
    .filter(theme => theme.category.toLowerCase() === (categoryName || "").toLowerCase())
    .sort((a, b) => a.title.localeCompare(b.title));

  if (!filtered.length) {
    themeList.innerHTML = `<p>No themes found.</p>`;
    return;
  }

  filtered.forEach(theme => {
    const card = document.createElement("a");
    card.className = "card";
    card.href = `quiz.html?theme=${theme.slug}`;
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

  if (!theme) {
    title.textContent = "Theme not found";
    desc.textContent = "Lorem ipsum dolor sit amet.";
    meta.textContent = "";
    playBtn.style.display = "none";
    return;
  }

  title.textContent = theme.title;
  desc.textContent = theme.description;
  playBtn.href = `play.html?theme=${theme.slug}`;
}

/* ---------------- PLAY PAGE / SPEED MODE ---------------- */
let quizState = {
  questions: [],
  currentIndex: 0,
  score: 0,
  selectedAnswer: null
};

async function renderPlayPage() {
  const slug = getParam("theme");
  const themes = await loadThemes();
  const theme = themes.find(t => t.slug === slug);

  const title = document.getElementById("playTitle");
  const progress = document.getElementById("progressText");
  const questionEl = document.getElementById("questionText");
  const optionsEl = document.getElementById("optionsList");
  const feedbackEl = document.getElementById("feedbackText");
  const submitBtn = document.getElementById("submitButton");
  const nextBtn = document.getElementById("nextButton");
  const resultBox = document.getElementById("resultBox");
  const scoreEl = document.getElementById("scoreText");

  if (!theme) {
    title.textContent = "Theme not found";
    return;
  }

  title.textContent = theme.title;

  const allQuestions = await fetchJSON(theme.questionFile);
  quizState.questions = allQuestions.slice(0, 30);
  quizState.currentIndex = 0;
  quizState.score = 0;
  quizState.selectedAnswer = null;

  function renderQuestion() {
    const q = quizState.questions[quizState.currentIndex];
    feedbackEl.textContent = "";
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
        document.querySelectorAll(".option-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
      optionsEl.appendChild(btn);
    });
  }

  function renderResult() {
    document.getElementById("quizBox").style.display = "none";
    resultBox.style.display = "block";
    resultBox.innerHTML = `
      <h2>Quiz Complete</h2>
      <p>Your score: ${quizState.score} / ${quizState.questions.length}</p>
      <a class="primary-btn" href="quiz.html?theme=${theme.slug}">Back to Theme</a>
      <a class="secondary-btn" href="play.html?theme=${theme.slug}">Play Again</a>
    `;
  }

  submitBtn.addEventListener("click", () => {
    if (!quizState.selectedAnswer) return;

    const q = quizState.questions[quizState.currentIndex];
  if (quizState.selectedAnswer === q.answer) {
    quizState.score += 1;
    feedbackEl.textContent = "Correct";
    feedbackEl.className = "feedback correct";
  } else {
    feedbackEl.textContent = "Wrong";
    feedbackEl.className = "feedback wrong";
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
