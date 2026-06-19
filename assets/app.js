function setCanonical(url) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) { el = document.createElement('link'); el.rel = 'canonical'; document.head.appendChild(el); }
  el.href = url;
}
function addNoIndex() {
  let el = document.querySelector('meta[name="robots"]');
  if (!el) { el = document.createElement('meta'); el.name = 'robots'; document.head.appendChild(el); }
  el.content = 'noindex,follow';
}

function isPremiumUser() {
  const expiry = localStorage.getItem('adsRemovedUntil');
  if (!expiry) return false;
  return new Date(expiry) > new Date();
}

// Adsterra 300x250 medium rectangle — web only (never in native app), non-premium.
// Rendered inside a sandboxed srcdoc iframe so the ad loader can't touch the page.
function injectAdsterraRect(container) {
  if (!container || isPremiumUser()) return;
  const native = !!(window.Capacitor && (window.Capacitor.isNativePlatform?.() || window.Capacitor.isNative));
  if (native) return;
  const f = document.createElement('iframe');
  f.scrolling = 'no';
  f.setAttribute('frameborder', '0');
  f.setAttribute('aria-hidden', 'true');
  f.style.cssText = 'width:300px;height:250px;border:0;overflow:hidden;display:block;margin:16px auto;';
  f.srcdoc = '<!doctype html><html><head><meta charset="utf-8">'
    + '<style>html,body{margin:0;padding:0;overflow:hidden}</style></head><body>'
    + '<script type="text/javascript">atOptions={"key":"6cd708c27c2130cedbed5e1a3bc703d0","format":"iframe","height":250,"width":300,"params":{}};<\/script>'
    + '<script type="text/javascript" src="https://www.highperformanceformat.com/6cd708c27c2130cedbed5e1a3bc703d0/invoke.js"><\/script>'
    + '</body></html>';
  container.appendChild(f);
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

function getThemeContext(category) {
  if (category === "Games") return "the game";
  if (category === "Sports") return "the sport";
  if (category === "Books") return "the books";
  if (category === "Movies") return "the film";
  return "the series";
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
      "TV",
      "Anime",
      "Sitcoms",
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
  "TV": "tv",
  "Anime": "anime",
  "Sitcoms": "sitcoms",
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
  "TV":      ["This category includes trivia quizzes based on fantasy dramas, crime thrillers, teen shows, sci-fi, and other popular TV series."],
  "Anime":   ["This category includes trivia quizzes based on popular anime series covering shonen, action, and fan-favourite franchises."],
  "Sitcoms": ["This category includes trivia quizzes based on classic and modern sitcoms covering characters, quotes, running jokes, and memorable moments."],
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
  const triviaRushBtn = document.getElementById("triviaRushButton");
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
  challengeBtn.href = `challenge.html?theme=${theme.slug}&round=1`;
  survivalBtn.href = `survival.html?theme=${theme.slug}`;
  wordSearchBtn.href = `wordsearch.html?theme=${theme.slug}&page=1`;
  wordleBtn.href = `wordle.html?theme=${theme.slug}`;
  if (triviaRushBtn) triviaRushBtn.href = `trivia-rush.html?theme=${theme.slug}`;
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

// ---- Multi-theme (Mashup) shared helpers — used by app.js, challenge.js, survival.js ----
const MASHUP_BADGE_COLORS = [
  { bg: "rgba(59,130,246,0.15)", border: "#3b82f6", text: "#93c5fd" },
  { bg: "rgba(34,197,94,0.12)",  border: "#22c55e", text: "#86efac" },
  { bg: "rgba(249,115,22,0.15)", border: "#f97316", text: "#fdba74" },
  { bg: "rgba(168,85,247,0.15)", border: "#a855f7", text: "#d8b4fe" },
  { bg: "rgba(236,72,153,0.15)", border: "#ec4899", text: "#f9a8d4" },
];
function makeMashupBadge(slug, colorBySlug, themeName) {
  const c = colorBySlug[slug] || MASHUP_BADGE_COLORS[0];
  const span = document.createElement("span");
  span.className = "mashup-q-badge";
  span.style.cssText = `background:${c.bg};border-color:${c.border};color:${c.text}`;
  span.textContent = themeName;
  return span;
}
function renderMashupThemeBreakdown(themeScores, selectedThemes, colorBySlug) {
  const div = document.createElement("div");
  div.className = "mashup-score-breakdown";
  selectedThemes.forEach(theme => {
    const s = themeScores[theme.slug] || { correct: 0, total: 0 };
    const c = colorBySlug[theme.slug] || MASHUP_BADGE_COLORS[0];
    const p = document.createElement("p");
    p.innerHTML = `<span class="mashup-q-badge" style="background:${c.bg};border-color:${c.border};color:${c.text}">${theme.title}</span>${s.correct} / ${s.total}`;
    div.appendChild(p);
  });
  return div;
}
function buildMashupPools(selectedThemes, questionsByTheme) {
  const nd = v => String(v || "").trim().toLowerCase();
  return selectedThemes.map(theme => ({
    slug: theme.slug,
    em: shuffleArray((questionsByTheme[theme.slug] || []).filter(q => ["easy","medium"].includes(nd(q.difficulty)))),
    he: shuffleArray((questionsByTheme[theme.slug] || []).filter(q => ["hard","expert"].includes(nd(q.difficulty))))
  }));
}
function sliceFromMashupPools(pools, batchSize, batchIndex) {
  const n = pools.length;
  const base = Math.floor(batchSize / n);
  const extra = batchSize - base * n;
  const out = [];
  pools.forEach((pool, idx) => {
    const count = base + (idx < extra ? 1 : 0);
    const emPer = Math.ceil(count / 2), hePer = Math.floor(count / 2);
    let slice = [...pool.em.slice(batchIndex * emPer, (batchIndex + 1) * emPer),
                  ...pool.he.slice(batchIndex * hePer, (batchIndex + 1) * hePer)];
    if (slice.length < count) {
      const used = new Set(slice.map(q => q.question));
      slice = [...slice, ...shuffleArray([...pool.em, ...pool.he]).filter(q => !used.has(q.question)).slice(0, count - slice.length)];
    }
    slice.forEach(q => out.push(Object.assign({}, q, { _themeSlug: pool.slug })));
  });
  return shuffleArray(out);
}
function calcMashupTotalBatches(pools, batchSize) {
  const n = pools.length, base = Math.floor(batchSize / n), extra = batchSize - base * n;
  return Math.max(1, Math.max(...pools.map((pool, idx) => {
    const count = base + (idx < extra ? 1 : 0);
    const emPer = Math.ceil(count / 2), hePer = Math.floor(count / 2);
    return Math.max(emPer > 0 ? Math.ceil(pool.em.length / emPer) : 0, hePer > 0 ? Math.ceil(pool.he.length / hePer) : 0);
  })));
}
function injectMashupResultAd(container) {}

// ── Mid-quiz resume ──────────────────────────────────────────────────────────
// Long rounds (marathon = 30 questions, episode = 30+) are easy to lose on a
// reload or app-close. These helpers persist the in-progress question set,
// index and score so the round resumes where it stopped. Platform-agnostic
// (works on web AND the native app — it's a UX feature, not a paywall).
// Single-slot: only the most recent in-progress round is kept.
const _MIDQUIZ_KEY = "tg_midquiz";
function _midQuizId(mode, key, page) { return `${mode}::${key}::${page}`; }
function _saveMidQuiz(mode, key, page, data) {
  try {
    localStorage.setItem(_MIDQUIZ_KEY, JSON.stringify({ id: _midQuizId(mode, key, page), ts: Date.now(), ...data }));
  } catch (e) {}
}
function _loadMidQuiz(mode, key, page) {
  try {
    const raw = localStorage.getItem(_MIDQUIZ_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d.id !== _midQuizId(mode, key, page)) return null;
    if (d.ts && Date.now() - d.ts > 7 * 864e5) { localStorage.removeItem(_MIDQUIZ_KEY); return null; } // expire after 7 days
    if (!Array.isArray(d.questions) || !d.questions.length) return null;
    if (!(d.currentIndex > 0 && d.currentIndex < d.questions.length)) return null;
    return d;
  } catch (e) { return null; }
}
function _clearMidQuiz(mode, key, page) {
  try {
    const raw = localStorage.getItem(_MIDQUIZ_KEY);
    if (!raw) return;
    if (JSON.parse(raw).id === _midQuizId(mode, key, page)) localStorage.removeItem(_MIDQUIZ_KEY);
  } catch (e) {}
}

// ── Cumulative score across rounds/pages (per session) ───────────────────────
// Each round/page is a separate page load, so the running total is stashed in
// localStorage keyed by session. Recording is idempotent per round (a refresh
// re-writes the same round, never double-counts) and resets at round 1 or when a
// different session starts. Shared by Challenge (challenge.js) and Marathon.
function _cumLoad(storeKey, key) {
  try {
    const d = JSON.parse(localStorage.getItem(storeKey) || 'null');
    if (d && d.key === key && d.rounds) return d;
  } catch {}
  return { key, rounds: {} };
}
function _cumSum(d) {
  let c = 0, t = 0;
  Object.keys(d.rounds).forEach(r => { c += d.rounds[r].c; t += d.rounds[r].t; });
  return { c, t, rounds: Object.keys(d.rounds).length };
}
function _cumRecord(storeKey, key, round, correct, total) {
  let d = _cumLoad(storeKey, key);
  if (round <= 1) d = { key, rounds: {} }; // new game — clear prior rounds
  d.rounds[round] = { c: correct, t: total };
  try { localStorage.setItem(storeKey, JSON.stringify(d)); } catch {}
  return _cumSum(d);
}
function _cumReset(storeKey, key) {
  try { localStorage.setItem(storeKey, JSON.stringify({ key, rounds: {} })); } catch {}
}
// Score line: this-round score, plus a Total line once more than one round is in.
function cumScoreLine(roundScore, roundTotal, cum) {
  const main = `<p>Your score: ${roundScore} / ${roundTotal}</p>`;
  if (cum && cum.rounds > 1) return `${main}<p class="cum-total">Total: ${cum.c} / ${cum.t}</p>`;
  return main;
}

async function renderMultiThemeMarathon() {
  const params = new URLSearchParams(window.location.search);
  const slugs = (params.get("themes") || "").split(",").map(s => s.trim()).filter(Boolean);
  if (slugs.length < 2) { window.location.href = "mashup.html"; return; }

  const allThemeMeta = await loadThemes();
  const selectedThemes = slugs.map(slug => allThemeMeta.find(t => t.slug === slug)).filter(Boolean);
  if (selectedThemes.length < 2) { window.location.href = "mashup.html"; return; }

  const themesParam = selectedThemes.map(t => t.slug).join(",");
  const mashupKey = slugs.slice().sort().join(",");
  let isReplay = getParam("replay") === "1";
  const colorBySlug = {};
  selectedThemes.forEach((t, i) => { colorBySlug[t.slug] = MASHUP_BADGE_COLORS[i % MASHUP_BADGE_COLORS.length]; });

  document.title = selectedThemes.map(t => t.title).join(" + ") + " — Marathon | Trivia Gauntlet";
  if (typeof gtag === "function") gtag("event", "page_view", { page_title: document.title, page_location: window.location.href });
  addNoIndex();

  const questionsByTheme = {};
  await Promise.all(selectedThemes.map(async theme => {
    try { questionsByTheme[theme.slug] = (await fetchJSON(theme.questionFile)) || []; }
    catch(e) { questionsByTheme[theme.slug] = []; }
  }));

  const PAGE_SIZE = 30;
  const slidesContainer = document.getElementById("playSlides");
  const resultBox = document.getElementById("resultBox");
  const nextPageLink = document.getElementById("nextPageLink");
  const progressText = document.getElementById("progressText");
  const scoreText = document.createElement("p");
  scoreText.className = "play-score-text";
  scoreText.textContent = "Score: 0";

  const rawPage = parseInt(params.get("page") || "1", 10);
  const currentPage = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  let pools, totalPages, safePage, pageQuestions;
  if (isReplay) {
    try {
      const replayData = JSON.parse(localStorage.getItem("tg_replay") || "null");
      if (replayData && replayData.mashupKey === mashupKey && replayData.questions && replayData.questions.length) {
        pageQuestions = replayData.questions.map(q => shuffleQuestionOptions(q));
        totalPages = 1; safePage = 1;
        if (typeof gtag === "function") gtag("event", "wrong_answers_replayed", { theme: mashupKey, count: replayData.questions.length });
      } else { isReplay = false; }
    } catch { isReplay = false; }
  }
  if (!isReplay) {
    pools = buildMashupPools(selectedThemes, questionsByTheme);
    totalPages = calcMashupTotalBatches(pools, PAGE_SIZE);
    safePage = Math.min(currentPage, totalPages);
    pageQuestions = sliceFromMashupPools(pools, PAGE_SIZE, safePage - 1).map(q => shuffleQuestionOptions(q));
  }

  // Resume an in-progress round (reuse the exact saved question set/order).
  let _resume = isReplay ? null : _loadMidQuiz("marathon", mashupKey, safePage);
  if (_resume) pageQuestions = _resume.questions;

  const themeScores = {};
  selectedThemes.forEach(t => { themeScores[t.slug] = { correct: 0, total: 0 }; });
  pageQuestions.forEach(q => { if (themeScores[q._themeSlug]) themeScores[q._themeSlug].total++; });

  let score = 0, currentIndex = 0, revealAnswers = false;
  const wrongQuestions = [];

  if (_resume) {
    score = _resume.score || 0;
    currentIndex = _resume.currentIndex;
    (_resume.wrongQuestions || []).forEach(q => wrongQuestions.push(q));
    if (_resume.themeScores) for (const k in _resume.themeScores) if (themeScores[k]) themeScores[k] = _resume.themeScores[k];
    scoreText.textContent = `Score: ${score}`;
  }

  if (progressText) progressText.textContent = `Page ${safePage}`;
  if (nextPageLink) {
    if (safePage < totalPages) {
      nextPageLink.style.display = "inline-block";
      nextPageLink.textContent = "Skip to next page";
      nextPageLink.href = `play.html?themes=${themesParam}&page=${safePage + 1}`;
      nextPageLink.dataset.rewardedHref = `play.html?themes=${themesParam}&page=${safePage + 1}`;
    } else { nextPageLink.style.display = "none"; }
  }
  // Limited web: only the first page is free — any skip pops the app-download wall.
  if (typeof gateWebSkip === 'function') gateWebSkip(nextPageLink, true);

  function showQuestion(index) {
    const prev = slidesContainer.querySelector(".question-slide.active");
    if (prev) { prev.classList.remove("active"); prev.classList.add("answered"); prev.style.display = "none"; }
    const slide = slidesContainer.querySelector(`.question-slide[data-index="${index}"]`);
    if (slide) { slide.classList.add("active"); slide.style.display = "block"; slide.appendChild(scoreText); slide.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }

  if (isPremiumUser()) {
    const revealBtn = document.createElement("button");
    revealBtn.className = "secondary-btn reveal-answers-toggle";
    revealBtn.textContent = "Reveal Answers: OFF";
    revealBtn.addEventListener("click", () => {
      revealAnswers = !revealAnswers;
      revealBtn.className = revealAnswers ? "primary-btn reveal-answers-toggle" : "secondary-btn reveal-answers-toggle";
      revealBtn.textContent = revealAnswers ? "Reveal Answers: ON" : "Reveal Answers: OFF";
    });
    const quizBoxEl = document.getElementById("quizBox");
    if (quizBoxEl) quizBoxEl.insertBefore(revealBtn, slidesContainer);
  }

  pageQuestions.forEach((q, index) => {
    const slug = q._themeSlug;
    const themeName = (selectedThemes.find(t => t.slug === slug) || {}).title || slug;
    const slide = document.createElement("div");
    slide.className = "question-slide";
    slide.dataset.index = index;
    const qNum = document.createElement("p");
    qNum.className = "slide-question-num";
    qNum.textContent = `Question ${index + 1} of ${pageQuestions.length}`;
    const qText = document.createElement("h2");
    qText.textContent = q.question;
    const optsList = document.createElement("div");
    optsList.className = "options";
    q.options.forEach(option => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = option;
      btn.addEventListener("click", () => {
        if (currentIndex !== index) return;
        optsList.querySelectorAll(".option-btn").forEach(b => b.classList.remove("selected", "correct-anim", "wrong-anim"));
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
      if (currentIndex !== index) return;
      const selBtn = optsList.querySelector(".option-btn.selected");
      if (!selBtn) return;
      if (selBtn.textContent === q.answer) {
        score++; themeScores[slug].correct++;
        feedbackP.textContent = "Correct"; feedbackP.className = "feedback correct";
        selBtn.classList.remove("wrong-anim"); void selBtn.offsetWidth; selBtn.classList.add("correct-anim");
        if (typeof SoundFX !== 'undefined') SoundFX.play('correct');
      } else {
        feedbackP.textContent = revealAnswers ? `Wrong. The correct answer is ${q.answer}.` : "Wrong";
        feedbackP.className = "feedback wrong";
        selBtn.classList.remove("correct-anim"); void selBtn.offsetWidth; selBtn.classList.add("wrong-anim");
        if (typeof SoundFX !== 'undefined') SoundFX.play('wrong');
        wrongQuestions.push(q);
      }
      if (scoreText) scoreText.textContent = `Score: ${score}`;
      submitBtn.disabled = true; nextBtn.style.display = "inline-block";
    });
    nextBtn.addEventListener("click", () => {
      currentIndex++;
      if (currentIndex >= pageQuestions.length) renderResult();
      else {
        _saveMidQuiz("marathon", mashupKey, safePage, { questions: pageQuestions, currentIndex, score, wrongQuestions, themeScores });
        showQuestion(currentIndex);
      }
    });
    slide.appendChild(qNum);
    slide.appendChild(makeMashupBadge(slug, colorBySlug, themeName));
    slide.appendChild(qText);
    slide.appendChild(optsList);
    slide.appendChild(feedbackP);
    slide.appendChild(ctaRow);
    slidesContainer.appendChild(slide);
  });

  slidesContainer.querySelectorAll(".question-slide").forEach(s => { s.style.display = "none"; });

  function renderResult() {
    _clearMidQuiz("marathon", mashupKey, safePage);
    if (typeof webAddQ === 'function') webAddQ(pageQuestions.length);
    document.getElementById("quizBox").style.display = "none";
    resultBox.style.display = "block";
    resultBox.classList.remove("result-anim"); void resultBox.offsetWidth; resultBox.classList.add("result-anim");
    if (typeof recordMashupStats === "function") {
      recordMashupStats(mashupKey, "marathon", { correct: score, answered: pageQuestions.length, round: safePage, totalRounds: totalPages });
    }
    if (!isReplay && typeof saveSession === "function") saveSession("marathon", mashupKey, safePage, score, pageQuestions.length);
    const cum = isReplay ? null : _cumRecord('tg_mara_cum', mashupKey, safePage, score, pageQuestions.length);
    let wrongCount = 0;
    if (isReplay) {
      localStorage.removeItem("tg_replay");
    } else {
      let bank = [];
      try {
        const raw = localStorage.getItem("tg_replay");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.mode === "marathon" && parsed.mashupKey === mashupKey) bank = parsed.questions || [];
        }
      } catch {}
      if (wrongQuestions.length) {
        const merged = [...bank, ...wrongQuestions].filter((q, i, arr) => arr.findIndex(x => x.question === q.question) === i);
        localStorage.setItem("tg_replay", JSON.stringify({ mode: "marathon", mashupKey, questions: merged }));
        wrongCount = merged.length;
      } else {
        wrongCount = bank.length;
      }
    }
    const hasNextPage = safePage < totalPages;
    const replayHtml = wrongCount > 0
      ? `<div class="wrong-replay-row">You have ${wrongCount} wrong answer${wrongCount !== 1 ? "s" : ""} &mdash; <a href="play.html?themes=${themesParam}&replay=1" data-rewarded-href="play.html?themes=${themesParam}&replay=1" data-rewarded-label="Replay">Replay them all</a></div>`
      : "";
    resultBox.innerHTML = `
      <h2>Quiz Complete</h2>
      ${cumScoreLine(score, pageQuestions.length, cum)}
      <p class="result-tier">${getMarathonTier(score, pageQuestions.length)}</p>
      <div id="mashupMarathonBreakdown"></div>
      ${typeof webQCounterHTML === 'function' ? webQCounterHTML() : ''}
      <div class="cta-row">
        ${hasNextPage && !(typeof isWebQLimit === 'function' && isWebQLimit()) ? `<a class="primary-btn" href="play.html?themes=${themesParam}&page=${safePage + 1}" data-rewarded-href="play.html?themes=${themesParam}&page=${safePage + 1}">Next Round</a>` : ""}
        ${hasNextPage && (typeof isWebQLimit === 'function' && isWebQLimit()) ? (typeof webWallHTML === 'function' ? webWallHTML("Yay! You've answered 30 questions") : "") : ""}
        <a class="secondary-btn" href="contact.html">Report a Question</a>
        ${!isPremiumUser() && (typeof isDesktopWeb === 'function' && isDesktopWeb()) && !(hasNextPage && (typeof isWebQLimit === 'function' && isWebQLimit())) ? `<a class="secondary-btn" href="remove-ads.html">Unlock Full Access</a>` : ""}
      </div>
      ${replayHtml}
      <div id="marathonRectAd"></div>
      <div class="result-theme-search">
        <p class="result-theme-search-title">Try another theme</p>
        <div class="search-wrap">
          <input id="mashupMarathonSearchInput" class="theme-search-input" type="text" placeholder="Search themes..." autocomplete="off" />
          <div id="mashupMarathonSearchResults" class="search-results" data-reward-gate="1"></div>
        </div>
      </div>
      <div id="mashupMarathonAdSlot"></div>
      <div class="theme-related-quizzes" data-reward-gate="1">
        <h3>Play these themes individually</h3>
        <div class="grid">
          ${selectedThemes.map(t => `<a class="card" href="play.html?theme=${t.slug}"><h3>${t.title}</h3></a>`).join("")}
        </div>
      </div>
    `;
    document.getElementById("mashupMarathonBreakdown").appendChild(renderMashupThemeBreakdown(themeScores, selectedThemes, colorBySlug));
    injectMashupResultAd(document.getElementById("mashupMarathonAdSlot"));
    if (typeof injectRevealMissedButton === 'function') injectRevealMissedButton(wrongQuestions, resultBox.querySelector('.cta-row'));
    if (typeof injectWebFeatureTease === 'function') injectWebFeatureTease(resultBox.querySelector('.cta-row'), 'Reveal Answers', 'Reveal Answers', 'See the correct answer for every question you missed — free in the app, no limits.');
    if (typeof injectAdsterraRect === 'function') injectAdsterraRect(document.getElementById("marathonRectAd"));
    const msInput = document.getElementById("mashupMarathonSearchInput");
    const msResults = document.getElementById("mashupMarathonSearchResults");
    if (msInput && msResults) {
      const renderSearch = items => {
        msResults.innerHTML = items.length ? items.map(t => `<a class="search-item" href="play.html?theme=${t.slug}">${t.title}</a>`).join("") : '<div class="search-item">No results found</div>';
      };
      msInput.addEventListener("focus", () => { renderSearch(allThemeMeta); msResults.style.display = "block"; });
      msInput.addEventListener("input", e => { renderSearch(allThemeMeta.filter(t => t.title.toLowerCase().includes(e.target.value.trim().toLowerCase()))); msResults.style.display = "block"; });
      document.addEventListener("click", e => { if (!msInput.contains(e.target) && !msResults.contains(e.target)) msResults.style.display = "none"; });
    }
    setTimeout(() => { if (typeof showInstallCard === "function") showInstallCard(); }, 800);
  }

  if (!_resume && !isReplay && currentPage === 1 && typeof getSession === "function") {
    const saved = getSession("marathon", mashupKey);
    if (saved && saved.round < totalPages) {
      document.getElementById("quizBox").style.display = "none";
      resultBox.style.display = "block";
      let replayCount = 0;
      try {
        const raw = localStorage.getItem("tg_replay");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.mode === "marathon" && parsed.mashupKey === mashupKey)
            replayCount = (parsed.questions || []).length;
        }
      } catch {}
      const replayHtml = replayCount > 0
        ? `<div class="wrong-replay-row">You have ${replayCount} wrong answer${replayCount !== 1 ? "s" : ""} accumulated &mdash; <a href="play.html?themes=${themesParam}&replay=1" data-rewarded-href="play.html?themes=${themesParam}&replay=1" data-rewarded-label="Replay">Replay them all</a></div>`
        : "";
      // Resuming would bypass the question-limit wall, so gate Continue the same way.
      const resumeWalled = (typeof isWebQLimit === 'function' && isWebQLimit());
      resultBox.innerHTML = `
        <h2>Round ${saved.round} Complete</h2>
        ${cumScoreLine(saved.score, saved.total, _cumSum(_cumLoad('tg_mara_cum', mashupKey)))}
        <div class="cta-row">
          ${resumeWalled ? (typeof webWallHTML === 'function' ? webWallHTML("Yay! You've answered 30 questions") : "") : `<a class="primary-btn" id="mashupMarathonContinueBtn" href="play.html?themes=${themesParam}&page=${saved.round + 1}">Continue to Round ${saved.round + 1}</a>`}
          <button class="secondary-btn" id="mashupMarathonRound1Btn">Start from Round 1</button>
        </div>
        ${replayHtml}`;
      const _mashupMaraContBtn = document.getElementById("mashupMarathonContinueBtn");
      if (_mashupMaraContBtn) _mashupMaraContBtn.addEventListener("click", () => {
        if (typeof gtag === "function") gtag("event", "session_resumed", { theme: mashupKey, round: saved.round + 1 });
      });
      document.getElementById("mashupMarathonRound1Btn").addEventListener("click", () => {
        if (typeof gtag === "function") gtag("event", "session_reset", { theme: mashupKey });
        if (typeof clearSession === "function") clearSession("marathon", mashupKey);
        _cumReset('tg_mara_cum', mashupKey);
        _clearMidQuiz("marathon", mashupKey, safePage);
        localStorage.removeItem("tg_replay");
        resultBox.style.display = "none";
        resultBox.innerHTML = "";
        document.getElementById("quizBox").style.display = "block";
        showQuestion(0);
      });
      return;
    }
  }

  showQuestion(currentIndex);
}

async function renderPlayPage() {
  if (getParam("themes")) { await renderMultiThemeMarathon(); return; }
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
  setCanonical(`${window.location.origin}/themes/${theme.slug}.html`);

  const rawPage = parseInt(getParam("page") || "1", 10);
  const currentPage = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

  let isReplay = getParam("replay") === "1";
  let allQuestions, allPages, totalPages, safePage;

  if (isReplay) {
    try {
      const replayData = JSON.parse(localStorage.getItem("tg_replay") || "null");
      if (replayData && replayData.questions && replayData.questions.length) {
        quizState.questions = replayData.questions.map(q => shuffleQuestionOptions(q));
        allPages = [quizState.questions]; totalPages = 1; safePage = 1;
        if (typeof gtag === "function") gtag("event", "wrong_answers_replayed", { theme: theme.slug, count: replayData.questions.length });
      } else { isReplay = false; }
    } catch { }
  }

  if (!isReplay) {
    allQuestions = await fetchJSON(theme.questionFile);
    allPages = buildBalancedBatches(allQuestions, PAGE_SIZE, 15, 15);
    totalPages = allPages.length;
    safePage = Math.min(currentPage, totalPages);
    quizState.questions = (allPages[safePage - 1] || []).map(q => shuffleQuestionOptions(q));
  }
  quizState.currentIndex = 0;
  quizState.score = 0;
  quizState.selectedAnswer = null;
  const wrongQuestions = [];

  // Resume an in-progress round (reuse the exact saved question set/order).
  let _resume = isReplay ? null : _loadMidQuiz("marathon", theme.slug, safePage);
  if (_resume) {
    quizState.questions = _resume.questions;
    quizState.score = _resume.score || 0;
    quizState.currentIndex = _resume.currentIndex;
    (_resume.wrongQuestions || []).forEach(q => wrongQuestions.push(q));
    scoreText.textContent = `Score: ${quizState.score}`;
  }

  let revealAnswers = false;
  let showContinuePrompt = false;

  if (!_resume && !isReplay && currentPage === 1 && typeof getSession === "function") {
    const saved = getSession("marathon", theme.slug);
    if (saved && saved.round < totalPages) {
      showContinuePrompt = true;
      const quizBoxEl = document.getElementById("quizBox");
      if (quizBoxEl) quizBoxEl.style.display = "none";
      resultBox.style.display = "block";

      let replayCount = 0;
      try {
        const raw = localStorage.getItem("tg_replay");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.mode === "marathon" && parsed.themeSlug === theme.slug)
            replayCount = (parsed.questions || []).length;
        }
      } catch {}

      const replayHtml = replayCount > 0
        ? `<div class="wrong-replay-row">You have ${replayCount} wrong answer${replayCount !== 1 ? "s" : ""} accumulated &mdash; <a href="play.html?theme=${theme.slug}&replay=1" data-rewarded-href="play.html?theme=${theme.slug}&replay=1" data-rewarded-label="Replay">Replay them all</a></div>`
        : "";

      // Resuming would bypass the question-limit wall, so gate Continue the same way.
      const resumeWalled = (typeof isWebQLimit === 'function' && isWebQLimit());
      resultBox.innerHTML = `
        <h2>Round ${saved.round} Complete</h2>
        ${cumScoreLine(saved.score, saved.total, _cumSum(_cumLoad('tg_mara_cum', theme.slug)))}
        <div class="cta-row">
          ${resumeWalled ? (typeof webWallHTML === 'function' ? webWallHTML("Yay! You've answered 30 questions", theme.title) : "") : `<a class="primary-btn" id="continueRoundBtn" href="play.html?theme=${theme.slug}&page=${saved.round + 1}">Continue to Round ${saved.round + 1}</a>`}
          <button class="secondary-btn" id="startRound1Btn">Start from Round 1</button>
        </div>
        ${replayHtml}`;

      const _maraContBtn = document.getElementById("continueRoundBtn");
      if (_maraContBtn) _maraContBtn.addEventListener("click", () => {
        if (typeof gtag === "function") gtag("event", "session_resumed", { theme: theme.slug, round: saved.round + 1 });
      });

      document.getElementById("startRound1Btn").addEventListener("click", () => {
        if (typeof gtag === "function") gtag("event", "session_reset", { theme: theme.slug });
        if (typeof clearSession === "function") clearSession("marathon", theme.slug);
        _cumReset('tg_mara_cum', theme.slug);
        _clearMidQuiz("marathon", theme.slug, safePage);
        localStorage.removeItem("tg_replay");
        resultBox.style.display = "none";
        resultBox.innerHTML = "";
        if (quizBoxEl) quizBoxEl.style.display = "block";
        showQuestion(0);
      });
    }
  }

  if (progressText) progressText.textContent = `Page ${safePage}`;

  if (nextPageLink) {
    if (safePage < totalPages) {
      nextPageLink.style.display = "inline-block";
      nextPageLink.textContent = "Skip to next page";
      nextPageLink.href = `play.html?theme=${theme.slug}&page=${safePage + 1}`;
      nextPageLink.dataset.rewardedHref = `play.html?theme=${theme.slug}&page=${safePage + 1}`;
    } else {
      nextPageLink.style.display = "none";
    }
  }
  // Limited web: only the first page is free — any skip pops the app-download wall.
  if (typeof gateWebSkip === 'function') gateWebSkip(nextPageLink, true);

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
        if (typeof SoundFX !== 'undefined') SoundFX.play('correct');
        feedbackP.textContent = "Correct";
        feedbackP.className = "feedback correct";
        if (selectedBtn) {
          selectedBtn.classList.remove("wrong-anim");
          void selectedBtn.offsetWidth;
          selectedBtn.classList.add("correct-anim");
        }
      } else {
        wrongQuestions.push(q);
        if (typeof SoundFX !== 'undefined') SoundFX.play('wrong');
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
        _saveMidQuiz("marathon", theme.slug, safePage, { questions: quizState.questions, currentIndex: quizState.currentIndex, score: quizState.score, wrongQuestions });
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
  _clearMidQuiz("marathon", theme.slug, safePage);
  document.getElementById("quizBox").style.display = "none";
  resultBox.style.display = "block";
  resultBox.classList.remove("result-anim");
  void resultBox.offsetWidth;
  resultBox.classList.add("result-anim");

  if (typeof webAddQ === 'function') webAddQ(quizState.questions.length);
  const hasNextPage = safePage < totalPages;
  const tierText = getMarathonTier(quizState.score, quizState.questions.length);

  const relatedThemes = getRelatedThemes(themes, theme, 4);

const relatedThemesHtml = `
  <div class="theme-related-quizzes" data-reward-gate="1">
    <h3>Related Quizzes</h3>
    <div class="grid">
      <a class="card card-mix" href="mashup.html?preset=${theme.slug}&mode=marathon">
        <h3>${theme.title} + other themes</h3>
        <span class="card-mix-sub">Play as a mashup</span>
      </a>
      ${relatedThemes.map(item => `
        <a class="card" href="play.html?theme=${item.slug}">
          <h3>${item.title}</h3>
        </a>
      `).join("")}
    </div>
  </div>
`;

  const wrongCount = (typeof recordMarathon === "function")
    ? recordMarathon(theme.slug, quizState.score, quizState.questions.length, wrongQuestions, isReplay, safePage, totalPages)
    : wrongQuestions.length;

  if (!isReplay && typeof saveSession === "function") saveSession("marathon", theme.slug, safePage, quizState.score, quizState.questions.length);
  const cum = isReplay ? null : _cumRecord('tg_mara_cum', theme.slug, safePage, quizState.score, quizState.questions.length);

  const replayHtml = wrongCount > 0
    ? `<div class="wrong-replay-row">You have ${wrongCount} wrong answer${wrongCount !== 1 ? "s" : ""} &mdash; <a href="play.html?theme=${theme.slug}&replay=1" data-rewarded-href="play.html?theme=${theme.slug}&replay=1" data-rewarded-label="Replay">Replay them all</a></div>`
    : "";

  const notifyHtml = (!hasNextPage && !isReplay) ? buildNotifyCard(theme.title, false, "marathon") : "";

  resultBox.innerHTML = `
    <h2>Quiz Complete</h2>
    ${cumScoreLine(quizState.score, quizState.questions.length, cum)}
    <p class="result-tier">${tierText}</p>
    ${typeof webQCounterHTML === 'function' ? webQCounterHTML() : ''}
    <div class="cta-row">
      ${hasNextPage && !(typeof isWebQLimit === 'function' && isWebQLimit()) ? `<a class="primary-btn" href="play.html?theme=${theme.slug}&page=${safePage + 1}" data-rewarded-href="play.html?theme=${theme.slug}&page=${safePage + 1}">Next Round</a>` : ""}
      ${hasNextPage && (typeof isWebQLimit === 'function' && isWebQLimit()) ? (typeof webWallHTML === 'function' ? webWallHTML("Yay! You've answered 30 questions", theme.title) : "") : ""}
      <a class="secondary-btn" href="contact.html">Report a Question</a>
      ${!isPremiumUser() && (typeof isDesktopWeb === 'function' && isDesktopWeb()) && !(hasNextPage && (typeof isWebQLimit === 'function' && isWebQLimit())) ? `<a class="secondary-btn" href="remove-ads.html">Unlock Full Access</a>` : ""}
    </div>
    ${replayHtml}
    <div id="marathonRectAd"></div>
    ${notifyHtml}

      <div class="result-theme-search">
    <p class="result-theme-search-title">Try another theme</p>
    <div class="search-wrap">
      <input id="resultThemeSearchInput" class="theme-search-input" type="text" placeholder="Search themes..." autocomplete="off" />
      <div id="resultThemeSearchResults" class="search-results" data-reward-gate="1"></div>
    </div>
  </div>
  ${relatedThemesHtml}
  `;


  if (typeof injectRevealMissedButton === 'function') injectRevealMissedButton(wrongQuestions, resultBox.querySelector('.cta-row'));
  if (typeof injectWebFeatureTease === 'function') injectWebFeatureTease(resultBox.querySelector('.cta-row'), 'Reveal Answers', 'Reveal Answers', 'See the correct answer for every question you missed — free in the app, no limits.');
  if (typeof injectAdsterraRect === 'function') injectAdsterraRect(document.getElementById("marathonRectAd"));

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

  if (notifyHtml) wireNotifyCard(theme.title, "marathon");

}

  if (!showContinuePrompt) showQuestion(quizState.currentIndex);
}

/* ---------------- NOTIFY CARD (inline, last round / new PB) ---------------- */
function buildNotifyCard(themeName, isPB = false, source = "trivia", opts = {}) {
  if (localStorage.getItem("epDone")) return "";
  const heading = opts.heading || (isPB
    ? `🏆 New personal best for <strong>${themeName}</strong>`
    : `🎉 You've answered every question for <strong>${themeName}</strong>`);
  const sub = opts.sub || "New questions are on the way. Want to know when they drop?";
  return `
    <div class="notify-card" id="notifyCard" data-source="${source}" data-theme="${themeName}">
      <div class="notify-card-heading">${heading}</div>
      <p class="notify-card-sub">${sub}</p>
      <div class="notify-card-form">
        <input class="notify-card-input" type="email" placeholder="you@example.com" autocomplete="email" id="notifyEmailInput" />
        <button class="notify-card-btn" id="notifySubmitBtn">Notify me</button>
      </div>
      <p class="notify-card-status" id="notifyStatus"></p>
    </div>`;
}

function wireNotifyCard(themeName, source = "trivia") {
  const card = document.getElementById("notifyCard");
  if (!card) return;
  const input = document.getElementById("notifyEmailInput");
  const btn = document.getElementById("notifySubmitBtn");
  const status = document.getElementById("notifyStatus");
  btn.addEventListener("click", async () => {
    const email = input.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status.textContent = "Please enter a valid email.";
      status.style.color = "var(--feedback-wrong)";
      return;
    }
    btn.disabled = true;
    status.textContent = "Saving...";
    status.style.color = "";
    const ok = await submitEmailToMailchimp(email, themeName, source);
    if (ok) {
      localStorage.setItem("epDone", "1");
      card.innerHTML = `<p class="notify-card-done">✓ You're in! We'll let you know when new questions drop.</p>`;
    } else {
      btn.disabled = false;
      status.textContent = "Something went wrong. Try again.";
      status.style.color = "var(--feedback-wrong)";
    }
  });
}

async function submitEmailToMailchimp(email, themeName, source = "trivia") {
  try {
    const res = await fetch("https://formspree.io/f/mqewdrkn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, theme: themeName, source, _subject: `New questions notify — ${source} — ${themeName}` })
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
  // (Footer "Unlock Full Access" link is injected site-wide from profile.js.)
});