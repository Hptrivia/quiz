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
  if (/TriviaGauntletPremium/.test(navigator.userAgent || '')) return true;
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

// Themes eligible for an "Episode Mode coming soon" lead-gen card: narrative shows
// only (episodes make no sense for Games/Sports/etc). Shown on web + app (it's email
// capture, not a gated free-play). Used by the theme page (episode button) and the
// episode.html coming-soon landing.
const EPISODE_SOON_CATEGORIES = ["TV", "Sitcoms"];
function isEpisodeSoonTheme(theme, episodeMap) {
  return !!theme && !!episodeMap && !episodeMap[theme.slug]
    && EPISODE_SOON_CATEGORIES.includes(theme.category);
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
      "Movies",
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
  "Movies": "movies",
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
      item.href = `challenge.html?theme=${theme.slug}&round=1`;
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
  "Movies":  ["This category includes trivia quizzes based on major film franchises covering superhero universes, fantasy epics, sci-fi sagas, and the characters, actors, and story moments fans remember."],
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
  } else if (isEpisodeSoonTheme(theme, episodeThemes)) {
    // No episode yet, but it's a show — offer a "coming soon · notify me" card that
    // links to the episode.html coming-soon landing.
    episodeBtn.style.display = "block";
    episodeBtn.href = `episode.html?theme=${theme.slug}`;
    const sub = episodeBtn.querySelector("p");
    if (sub) sub.textContent = "🎬 Coming soon · Get notified";
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

// ── Hard Mode (typed answers) ───────────────────────────────────────────────
// Shared by Challenge (challenge.js) and Marathon (this file): one place for
// answer-control rendering and normalize/compare so no mode duplicates it.
// Rule-based only, no AI/API calls (an LLM-graded answer would need a
// per-question backend call, adding real cost/latency vs. this). Currently
// wired into Challenge and Marathon only -- Survival/Episode/Daily/Trivia
// Rush/Versus still all-multiple-choice.
// Master kill switch for the whole Hard Mode feature -- flip to false to
// pull it from the site entirely (no ask prompt, no typed input regardless
// of a player's saved preference, no settings row, no result-screen hint).
// Same flag name duplicated in profile.html (no shared module system
// between pages) -- keep both in sync if this ever changes.
const HM_FEATURE_ENABLED = true;

const HM_KEY = 'tg_hard_mode';
const HM_ASKED_KEY = 'tg_hard_mode_asked';
const HM_SEEN_KEY = 'tg_hard_mode_seen';
const HM_HINT_KEY = 'tg_hard_mode_hint_shown';
const HM_HINT_MAX = 3;
const HM_ROUNDS_KEY = 'tg_hard_mode_rounds_completed';
const HM_FEEDBACK_ASKED_KEY = 'tg_hard_mode_feedback_asked';
const HM_FEEDBACK_ROUNDS_THRESHOLD = 1;
const HM_FEEDBACK_FORMSPREE = 'https://formspree.io/f/mpqybwea';

function hmIsEnabled() {
  if (!HM_FEATURE_ENABLED) return false;
  try { return localStorage.getItem(HM_KEY) === 'true'; } catch { return false; }
}
function hmAsked() {
  try { return localStorage.getItem(HM_ASKED_KEY) === 'true'; } catch { return false; }
}
function hmSetChoice(on) {
  try {
    localStorage.setItem(HM_KEY, on ? 'true' : 'false');
    localStorage.setItem(HM_ASKED_KEY, 'true');
  } catch {}
}

// Lowercase/trim/collapse whitespace; curly quotes, non-breaking hyphens and
// narrow no-break spaces fold to plain ASCII; trailing punctuation stripped.
// Mid-word apostrophes/hyphens are kept (O'Malley, best-selling).
// Spelled-out numbers <-> digits (one <-> 1) so either form matches -- a
// player is just as likely to type "7" as "Seven".
const HM_NUMBER_WORDS = {
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7',
  eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12', thirteen: '13',
  fourteen: '14', fifteen: '15', sixteen: '16', seventeen: '17', eighteen: '18',
  nineteen: '19', twenty: '20', thirty: '30', forty: '40', fifty: '50',
  sixty: '60', seventy: '70', eighty: '80', ninety: '90', hundred: '100',
};

function hmNormalize(str) {
  const base = String(str || '')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, '-')
    .replace(/[  ]/g, ' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(w => HM_NUMBER_WORDS[w] || w)
    .join(' ');
  // Trailing-punctuation strip must never wipe an answer that's ENTIRELY
  // punctuation (e.g. the literal answer "?") down to an empty, unmatchable
  // string -- fall back to the un-stripped form in that case.
  const stripped = base.replace(/["'.,!?;:]+$/g, '');
  return stripped || base;
}

function hmWordCount(answer) {
  return String(answer || '').trim().split(/\s+/).filter(Boolean).length;
}

// Hard Mode only offers a text box for answers with one predictable "right"
// way to type them: a single word, or a name/title-shaped answer (2-4 words,
// e.g. "Tom Riddle") where the existing partial-match forgiveness already
// covers real variation. A short (<=3-word) but generic descriptive phrase
// ("A giant gorilla", "Under the floorboards") does NOT qualify even though
// it's short -- there's no single correct way to phrase it, so it always
// falls back to multiple choice, same as an outright long answer does.
function hmShouldOfferTyped(answer) {
  const wc = hmWordCount(answer);
  if (wc > 3) return false;
  return wc === 1 || hmIsNameOrTitleShaped(answer);
}

const HM_LEAD_STOPWORDS = new Set(['the', 'a', 'an']);

// Title prefixes dropped the same way as a leading article -- "Dr. Siebert"
// typed as just "Siebert" should count, same as "The Addams Family" typed
// as "Addams Family".
const HM_TITLE_PREFIXES = new Set([
  'dr', 'mr', 'mrs', 'ms', 'sir', 'lord', 'lady', 'captain', 'president',
  'king', 'queen',
]);

// "The Addams Family" -> ["addams","family"] -- words with a leading article
// or title stripped. Shared by the first-word and first+last-word shortcuts
// below, and by the exact-after-stripping check in hmIsCorrect.
function hmContentWords(answer) {
  const words = hmNormalize(answer).split(' ').filter(Boolean);
  if (words.length <= 1) return words;
  const first = words[0].replace(/\.$/, '');
  return (HM_LEAD_STOPWORDS.has(first) || HM_TITLE_PREFIXES.has(first)) ? words.slice(1) : words;
}

function hmFirstContentWord(answer) {
  return hmContentWords(answer)[0] || '';
}

// 2-4 capitalized words, no punctuation beyond spaces/apostrophes/hyphens.
// Covers real names ("Jaime Lannister") and title-shaped answers ("The Addams
// Family") alike -- either way the first word is what a player who
// half-remembers an answer actually types.
// Common English title-case connectors that stay lowercase mid-title
// ("Game of Thrones", "Back to the Future") without disqualifying the whole
// answer from being name/title-shaped -- only checked for a MIDDLE word; the
// first and last word must always be a real capitalized content word.
const HM_TITLE_CONNECTORS = new Set(['of', 'the', 'a', 'an', 'and', 'in', 'to', 'on', 'for', 'with', 'at', 'by', 'from', 'or', 'as']);

function hmIsNameOrTitleShaped(answer) {
  const raw = String(answer || '').trim();
  if (!raw || /[^A-Za-z0-9' -]/.test(raw)) return false;
  const words = raw.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((w, i) => {
    if (i === 0 || i === words.length - 1) return /^[A-Z]/.test(w);
    return /^[A-Z]/.test(w) || HM_TITLE_CONNECTORS.has(w.toLowerCase());
  });
}

// Optimal string alignment distance: plain Levenshtein plus a swapped-pair
// case costing 1 instead of 2, so a transposed-letter typo ("Akr" for "Ark")
// gets the same tolerance as a substitution typo -- transposition is one of
// the most common real typing mistakes.
function hmEditDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = [];
  for (let i = 0; i <= m; i++) { dp.push(new Array(n + 1).fill(0)); dp[i][0] = i; }
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[m][n];
}

// Starting numbers only -- needs tuning against real questions once this is
// actually played against.
function hmTypoThreshold(len) {
  if (len <= 4) return 0;
  if (len <= 7) return 1;
  return 2;
}

// First AND last character must match exactly; typo tolerance only applies
// in between. Typos happen mid-word (Cello -> Celo); a wrong first OR last
// letter usually means a different real word (Cello -> Hello, Lumos ->
// Lumon), so neither is ever forgiven -- except when the mismatched last
// letter is explained by an adjacent-transposition of the final two
// characters (Ark -> Akr), which is still a legitimate typo.
function hmFuzzyMatch(typed, target) {
  if (!typed || !target) return false;
  if (typed === target) return true;
  if (typed[0] !== target[0]) return false;
  const lastTyped = typed[typed.length - 1];
  const lastTarget = target[target.length - 1];
  if (lastTyped !== lastTarget) {
    const isEndTransposition = typed.length === target.length && typed.length >= 2 &&
      typed[typed.length - 2] === lastTarget && lastTyped === target[target.length - 2] &&
      typed.slice(0, -2) === target.slice(0, -2);
    if (!isEndTransposition) return false;
  }
  return hmEditDistance(typed, target) <= hmTypoThreshold(target.length);
}

// Two answers count as the same underlying name at different lengths (not a
// real ambiguity) when they share both their first AND last content word --
// e.g. "Tom Riddle" / "Tom Marvolo Riddle" (same person, a middle name
// dropped). Two truly different answers that happen to share a surname
// ("John Smith" / "Jane Smith") only share the LAST word, so they still
// count as a real collision below.
function hmAreNameVariants(wordsA, wordsB) {
  if (!wordsA.length || !wordsB.length) return false;
  return wordsA[0] === wordsB[0] && wordsA[wordsA.length - 1] === wordsB[wordsB.length - 1];
}

// Per theme, once at load: first/last content words shared by two or more
// distinct, genuinely different-entity answers in that theme's question
// file, so the shortcut below never accepts a word that could mean more
// than one thing -- checked against BOTH the first and last content word,
// since a lone typed word can match either position (see hmIsCorrect).
// Answers that are just longer/shorter forms of the same name (see
// hmAreNameVariants) don't collide with each other. Mashup: computed per
// theme in questionsByTheme, not per combined round.
function hmBuildWordCollisions(questions) {
  const distinctAnswers = Array.from(new Set((questions || []).map(q => q && q.answer).filter(Boolean)));
  const shapedWords = distinctAnswers.filter(hmIsNameOrTitleShaped).map(hmContentWords);
  const contributors = {};
  shapedWords.forEach(words => {
    const candidates = new Set([words[0], words[words.length - 1]]);
    candidates.forEach(w => {
      if (!w) return;
      (contributors[w] || (contributors[w] = [])).push(words);
    });
  });
  const collisions = new Set();
  Object.keys(contributors).forEach(w => {
    const lists = contributors[w];
    for (let i = 0; i < lists.length && !collisions.has(w); i++) {
      for (let j = i + 1; j < lists.length; j++) {
        if (!hmAreNameVariants(lists[i], lists[j])) { collisions.add(w); break; }
      }
    }
  });
  return collisions;
}

// Generic trailing words that never count as a standalone answer even when
// they're the last word of a name/title-shaped answer -- "Family" shouldn't
// pass for "The Addams Family", "Medicine" shouldn't pass for "Emergency
// Medicine". Small, hand-picked, low-maintenance; extend if a new one shows
// up in testing.
const HM_GENERIC_LAST_WORDS = new Set([
  'family', 'medicine', 'academy', 'house', 'team', 'department', 'agency',
  'service', 'club', 'group', 'company', 'squad', 'crew', 'gang', 'league',
  'force', 'unit', 'division', 'hospital', 'school',
]);

// Full compare for the typed-answer path: exact match, then the name/title
// shortcuts (name/title-shaped answers only) -- a single word (first OR last
// content word, unless ambiguous in the theme or a generic trailing word
// like "Family"/"Medicine" -- see HM_GENERIC_LAST_WORDS) or, for 3+ word
// answers, first+last word together with any middle word(s) dropped ("Tom
// Riddle" for "Tom Marvolo Riddle") -- then whole-phrase typo tolerance.
// Quote/title/phrase answers that aren't name/title-shaped only get the
// exact + typo-tolerance layers.
function hmIsCorrect(typedRaw, question, wordCollisions) {
  const typed = hmNormalize(typedRaw);
  if (!typed) return false;
  const answer = hmNormalize(question.answer);
  if (typed === answer) return true;

  // Dropped a leading article/title ("Dr. Siebert" -> "Siebert", "The O.C."
  // -> "O.C.") -- exact match on the remainder only, no fuzzy tolerance
  // stacked on top, so this stays safe for every answer shape, not just
  // name/title-shaped ones.
  const strippedAnswer = hmContentWords(question.answer).join(' ');
  if (strippedAnswer && strippedAnswer !== answer && typed === strippedAnswer) return true;

  // Singular/plural swap ("Grounder" for "Grounders") -- exact match on the
  // trailing "s" difference only, no fuzzy tolerance stacked on top, so it's
  // safe regardless of word length even though the first/last-letter rule
  // above would otherwise block it (skip if the answer already ends in a
  // double "s", e.g. "Chess", where dropping one "s" isn't a plural).
  if (!answer.endsWith('ss')) {
    if (typed === answer + 's' || answer === typed + 's') return true;
  }

  if (hmIsNameOrTitleShaped(question.answer)) {
    const contentWords = hmContentWords(question.answer);
    const typedWords = typed.split(' ').filter(Boolean);

    if (typedWords.length === 1) {
      const lastWord = contentWords[contentWords.length - 1];
      // Try the first word, then (if it's not a generic trailing word like
      // "Family"/"Medicine") the last word -- "Minerva" and "McGonagall"
      // should both work for "Minerva McGonagall".
      const candidates = contentWords.length > 1 && !HM_GENERIC_LAST_WORDS.has(lastWord)
        ? [contentWords[0], lastWord]
        : [contentWords[0]];
      const matched = candidates.find(w => w && !(wordCollisions && wordCollisions.has(w)) && hmFuzzyMatch(typedWords[0], w));
      if (matched) return true;
    } else if (typedWords.length === 2 && contentWords.length >= 2) {
      // Two words together are specific enough that this doesn't need the
      // same ambiguity check as the lone-word shortcut above.
      if (hmFuzzyMatch(typedWords[0], contentWords[0]) &&
          hmFuzzyMatch(typedWords[1], contentWords[contentWords.length - 1])) {
        return true;
      }
    }
  }

  return hmFuzzyMatch(typed, answer);
}

// Builds the multiple-choice buttons (Hard Mode off, or a long/phrase answer)
// or a text input (Hard Mode on + short answer). Returns a handle so each
// caller's submit logic stays in charge of scoring/feedback/animations, same
// as before -- this only owns rendering the control and reading it back.
function hmRenderAnswerControl(q, useTyped) {
  if (useTyped) {
    const wrap = document.createElement('div');
    wrap.className = 'hm-answer-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-input hm-answer-input';
    input.placeholder = 'Type your answer...';
    input.autocomplete = 'off';
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.spellcheck = false;
    wrap.appendChild(input);
    return {
      el: wrap,
      isTyped: true,
      getSelection: () => (input.value || '').trim() || null,
      markCorrect: () => { input.classList.remove('wrong'); input.classList.add('correct'); },
      markWrong: () => { input.classList.remove('correct'); input.classList.add('wrong'); },
      disable: () => { input.disabled = true; },
      onEnter: (fn) => input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fn(); } })
    };
  }
  const optsList = document.createElement('div');
  optsList.className = 'options';
  q.options.forEach(option => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = option;
    btn.addEventListener('click', () => {
      optsList.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected', 'correct-anim', 'wrong-anim'));
      btn.classList.add('selected');
    });
    optsList.appendChild(btn);
  });
  return {
    el: optsList,
    isTyped: false,
    getSelection: () => { const b = optsList.querySelector('.option-btn.selected'); return b ? b.textContent : null; },
    markCorrect: () => { const b = optsList.querySelector('.option-btn.selected'); if (b) { b.classList.remove('wrong-anim'); void b.offsetWidth; b.classList.add('correct-anim'); } },
    markWrong: () => { const b = optsList.querySelector('.option-btn.selected'); if (b) { b.classList.remove('correct-anim'); void b.offsetWidth; b.classList.add('wrong-anim'); } },
    disable: () => {},
    onEnter: () => {}
  };
}

// One-time opt-in prompt: only ever called by a caller at round/page 1 (the
// actual start of a playthrough) -- never between rounds/pages of the same
// session, even though those are separate page loads too. Skipped on a
// player's very first-ever playthrough (any of the four entry points --
// Challenge single theme, Challenge mashup, Marathon single theme, Marathon
// mashup), then fires at the start of every NEW playthrough from the second
// one onward until answered -- shared localStorage state, so it's never
// asked twice regardless of which entry point triggers it. Resolves
// immediately once already asked. A page step (matching Survival's
// difficulty picker), not an overlay -- this is a real gameplay choice, not
// a nag. Each page (challenge.html, play.html) carries its own #hardModeAsk
// markup since it renders in place of that page's own quiz box.
function hmMaybeAskFirstTime(quizBox) {
  return new Promise(resolve => {
    if (!HM_FEATURE_ENABLED) { resolve(); return; }
    const askBox = document.getElementById('hardModeAsk');
    if (!askBox || hmAsked()) { resolve(); return; }
    // Returning players (anyone with existing play history, in ANY mode --
    // 'tg_profile' only gets saved once a round has actually been completed)
    // skip the delay below and see the prompt right away on their first
    // visit after this shipped -- they already know what Challenge/Marathon
    // is, unlike a truly first-time player.
    let hasPriorProfile = false;
    try { hasPriorProfile = !!localStorage.getItem('tg_profile'); } catch {}
    if (!hasPriorProfile) {
      // Skip the ask on a player's very first-ever Challenge/Marathon entry --
      // let them play one round before asking them to judge a difficulty
      // tradeoff they haven't experienced yet. Fires at the start of every
      // entry from the second one onward, same as before.
      let seenBefore = false;
      try { seenBefore = localStorage.getItem(HM_SEEN_KEY) === 'true'; } catch {}
      if (!seenBefore) {
        try { localStorage.setItem(HM_SEEN_KEY, 'true'); } catch {}
        resolve();
        return;
      }
    }
    if (quizBox) quizBox.style.display = 'none';
    askBox.style.display = 'block';
    const btnRow = askBox.querySelector('.hm-ask-buttons');
    const savedMsg = askBox.querySelector('.hm-ask-saved');
    const choose = (on) => {
      hmSetChoice(on);
      if (typeof gtag === 'function') gtag('event', 'hard_mode_prompt', { choice: on ? 'yes' : 'no' });
      if (btnRow) btnRow.style.display = 'none';
      if (savedMsg) savedMsg.style.display = 'block';
      setTimeout(() => {
        askBox.style.display = 'none';
        if (quizBox) quizBox.style.display = 'block';
        resolve();
      }, 900);
    };
    const yesBtn = askBox.querySelector('.hm-ask-yes');
    const noBtn = askBox.querySelector('.hm-ask-no');
    if (yesBtn) yesBtn.addEventListener('click', () => choose(true));
    if (noBtn) noBtn.addEventListener('click', () => choose(false));
  });
}

// Low-key nudge on the result screen reminding a player how to change their
// Hard Mode setting -- shown a few times total, then it stops. Works both
// directions: players who said "No" get reminded they can turn it on,
// players who currently have it ON get reminded they can turn it back off
// (the whole point being it should always be obvious/easy to reverse).
// Never re-prompts with the full ask screen.
function hmResultHintHtml() {
  if (!HM_FEATURE_ENABLED || !hmAsked()) return '';
  let count = 0;
  try { count = parseInt(localStorage.getItem(HM_HINT_KEY) || '0', 10) || 0; } catch {}
  if (count >= HM_HINT_MAX) return '';
  const enabled = hmIsEnabled();
  // Don't stack with the feedback box below -- if it's about to render on
  // this same result screen, let it own the message this one time instead
  // of showing both.
  if (enabled) {
    let feedbackAsked = false;
    try { feedbackAsked = localStorage.getItem(HM_FEEDBACK_ASKED_KEY) === 'true'; } catch {}
    let rounds = 0;
    try { rounds = parseInt(localStorage.getItem(HM_ROUNDS_KEY) || '0', 10) || 0; } catch {}
    if (!feedbackAsked && (rounds + 1) >= HM_FEEDBACK_ROUNDS_THRESHOLD) return '';
  }
  try { localStorage.setItem(HM_HINT_KEY, String(count + 1)); } catch {}
  return enabled
    ? `<p class="hm-hint-row">Not loving typed answers? Turn Hard Mode back off anytime in <a href="profile.html?tab=settings">Settings</a>.</p>`
    : `<p class="hm-hint-row">Prefer typing your own answers? Turn on Hard Mode in <a href="profile.html?tab=settings">Settings</a>.</p>`;
}

// Beta feedback prompt: only for players who currently have Hard Mode ON
// (never shown on the normal multiple-choice path). Counts completed
// rounds played with it on and shows once, after HM_FEEDBACK_ROUNDS_THRESHOLD
// rounds, on that round's result screen. Call this once per finished round
// (it does the counting itself); it returns the HTML to splice into the
// result screen template, or '' if not eligible yet/already shown. Pair
// with hmBindFeedbackBox() called right after the result HTML is in the DOM.
function hmFeedbackBoxHtml() {
  if (!HM_FEATURE_ENABLED || !hmIsEnabled()) return '';
  let asked = false;
  try { asked = localStorage.getItem(HM_FEEDBACK_ASKED_KEY) === 'true'; } catch {}
  if (asked) return '';
  let rounds = 0;
  try { rounds = parseInt(localStorage.getItem(HM_ROUNDS_KEY) || '0', 10) || 0; } catch {}
  rounds += 1;
  try { localStorage.setItem(HM_ROUNDS_KEY, String(rounds)); } catch {}
  if (rounds < HM_FEEDBACK_ROUNDS_THRESHOLD) return '';
  // Intentionally NOT marked as shown/asked here -- it stays eligible and
  // re-renders on every result screen from here on (see hmBindFeedbackBox)
  // until the player actually dismisses it or sends feedback, so it can't be
  // missed by someone who just clicks past a single round without noticing.
  return `
    <div class="hm-feedback-box" id="hmFeedbackBox">
      <p class="hm-feedback-title">Enjoying typing your own answers instead of picking?</p>
      <div class="hm-feedback-vote-row">
        <button type="button" class="secondary-btn hm-feedback-vote" data-vote="keep">Keep it</button>
        <button type="button" class="secondary-btn hm-feedback-vote" data-vote="not_for_me">Not for me</button>
        <button type="button" class="hm-feedback-dismiss" id="hmFeedbackDismiss">No thanks</button>
      </div>
      <div id="hmFeedbackDetail" style="display:none;">
        <textarea id="hmFeedbackText" class="form-input" placeholder="Anything else? (optional)"></textarea>
        <button type="button" class="primary-btn" id="hmFeedbackSend">Send feedback</button>
      </div>
      <p class="hm-feedback-sent" id="hmFeedbackSent" style="display:none;">Thanks for the feedback!</p>
    </div>
  `;
}

// Wires up the interactive bits of hmFeedbackBoxHtml() -- must be called
// after that HTML is actually in the DOM (it's a plain string spliced into
// a result-screen template, so it has no listeners of its own yet). No-ops
// safely if the box wasn't rendered this time.
function hmBindFeedbackBox() {
  const box = document.getElementById('hmFeedbackBox');
  if (!box) return;
  let vote = '';
  const detail = document.getElementById('hmFeedbackDetail');
  const sendBtn = document.getElementById('hmFeedbackSend');
  const dismissBtn = document.getElementById('hmFeedbackDismiss');
  const sentMsg = document.getElementById('hmFeedbackSent');
  const textArea = document.getElementById('hmFeedbackText');
  const finish = () => { try { localStorage.setItem(HM_FEEDBACK_ASKED_KEY, 'true'); } catch {} };
  box.querySelectorAll('.hm-feedback-vote').forEach(btn => {
    btn.addEventListener('click', () => {
      vote = btn.dataset.vote;
      box.querySelectorAll('.hm-feedback-vote').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (detail) detail.style.display = 'block';
      if (typeof gtag === 'function') gtag('event', 'hard_mode_feedback_vote', { vote });
    });
  });
  if (dismissBtn) dismissBtn.addEventListener('click', () => { finish(); box.style.display = 'none'; });
  if (sendBtn) sendBtn.addEventListener('click', async () => {
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';
    try {
      await fetch(HM_FEEDBACK_FORMSPREE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          type: 'hard_mode_feedback',
          vote: vote || 'no_vote',
          message: textArea ? textArea.value.trim() : '',
          _subject: 'Trivia Gauntlet Hard Mode Feedback',
        }),
      });
    } catch {}
    finish();
    if (detail) detail.style.display = 'none';
    box.querySelectorAll('.hm-feedback-vote, .hm-feedback-dismiss').forEach(el => el.style.display = 'none');
    if (sentMsg) sentMsg.style.display = 'block';
    if (typeof gtag === 'function') gtag('event', 'hard_mode_feedback_sent', { vote: vote || 'no_vote' });
  });
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

  // Hard Mode name/title-shortcut collisions, checked once per theme (not per
  // combined round).
  const wordCollisionsByTheme = {};
  selectedThemes.forEach(t => {
    wordCollisionsByTheme[t.slug] = hmBuildWordCollisions(questionsByTheme[t.slug] || []);
  });

  const PAGE_SIZE = 30;
  const slidesContainer = document.getElementById("playSlides");
  const resultBox = document.getElementById("resultBox");
  const nextPageLink = document.getElementById("nextPageLink");
  const progressText = document.getElementById("progressText");
  const scoreText = document.createElement("p");
  scoreText.className = "play-score-text";
  scoreText.textContent = "Score: 0";
  const quizBox = document.getElementById("quizBox");

  // Only the actual start of a playthrough (page 1) can trigger the ask --
  // never between pages of the same session, even on a fresh page load.
  if ((params.get("page") || "1") === "1") await hmMaybeAskFirstTime(quizBox);

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
    if (window.TGPromo) TGPromo.render(slidesContainer, pageQuestions[index] && pageQuestions[index]._themeSlug);
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
    const useTyped = hmIsEnabled() && hmShouldOfferTyped(q.answer);
    const control = hmRenderAnswerControl(q, useTyped);
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
      const selected = control.getSelection();
      if (!selected) return;
      const correct = control.isTyped
        ? hmIsCorrect(selected, q, wordCollisionsByTheme[slug])
        : selected === q.answer;
      if (correct) {
        score++; themeScores[slug].correct++;
        feedbackP.textContent = "Correct"; feedbackP.className = "feedback correct";
        control.markCorrect();
        if (typeof SoundFX !== 'undefined') SoundFX.play('correct');
      } else {
        feedbackP.textContent = revealAnswers ? `Wrong. The correct answer is ${q.answer}.` : "Wrong";
        feedbackP.className = "feedback wrong";
        control.markWrong();
        if (typeof SoundFX !== 'undefined') SoundFX.play('wrong');
        wrongQuestions.push(q);
      }
      if (scoreText) scoreText.textContent = `Score: ${score}`;
      submitBtn.disabled = true; control.disable(); nextBtn.style.display = "inline-block";
    });
    control.onEnter(() => submitBtn.click());
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
    slide.appendChild(control.el);
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
      ${hmResultHintHtml()}
      ${hmFeedbackBoxHtml()}
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
      <div class="result-theme-search">
        <p class="result-theme-search-title">Try another theme</p>
        <div class="search-wrap">
          <input id="mashupMarathonSearchInput" class="theme-search-input" type="text" placeholder="Search themes..." autocomplete="off" />
          <div id="mashupMarathonSearchResults" class="search-results" data-reward-gate="1"></div>
        </div>
      </div>
      <div class="theme-related-quizzes" data-reward-gate="1">
        <h3>Play these themes individually</h3>
        <div class="grid">
          ${selectedThemes.map(t => `<a class="card" href="play.html?theme=${t.slug}"><h3>${t.title}</h3></a>`).join("")}
        </div>
      </div>
    `;
    document.getElementById("mashupMarathonBreakdown").appendChild(renderMashupThemeBreakdown(themeScores, selectedThemes, colorBySlug));
    hmBindFeedbackBox();
    if (typeof injectRevealMissedButton === 'function') injectRevealMissedButton(wrongQuestions, resultBox.querySelector('.cta-row'));
    if (typeof injectWebFeatureTease === 'function') injectWebFeatureTease(resultBox.querySelector('.cta-row'), 'Reveal Answers', 'Reveal Answers', 'See the correct answer for every question you missed — free in the app, no limits.');
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

  const quizBox = document.getElementById("quizBox");
  // Only the actual start of a playthrough (page 1) can trigger the ask --
  // never between pages of the same session, even on a fresh page load.
  if ((getParam("page") || "1") === "1") await hmMaybeAskFirstTime(quizBox);

  // Map of which themes have Episode Mode, so the result screen can offer this
  // theme's own Episode Mode as the first related card when available.
  let episodeThemesMap = {};
  try { episodeThemesMap = await fetchJSON("data/episode_themes.json"); } catch (e) { episodeThemesMap = {}; }

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

  // Hard Mode name/title-shortcut collisions, checked once per theme. On
  // replay, computed from the replay bank itself rather than re-fetching the
  // whole theme file (replay already skips that fetch on purpose).
  const wordCollisions = hmBuildWordCollisions(isReplay ? quizState.questions : allQuestions);

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
    if (window.TGPromo) TGPromo.render(slidesContainer, theme && theme.slug);
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

    const useTyped = hmIsEnabled() && hmShouldOfferTyped(q.answer);
    const control = hmRenderAnswerControl(q, useTyped);

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
      if (quizState.currentIndex !== index) return;
      const selected = control.getSelection();
      if (!selected) return;

      const correct = control.isTyped
        ? hmIsCorrect(selected, q, wordCollisions)
        : selected === q.answer;

      if (correct) {
        quizState.score += 1;
        if (typeof SoundFX !== 'undefined') SoundFX.play('correct');
        feedbackP.textContent = "Correct";
        feedbackP.className = "feedback correct";
        control.markCorrect();
      } else {
        wrongQuestions.push(q);
        if (typeof SoundFX !== 'undefined') SoundFX.play('wrong');
        feedbackP.textContent = revealAnswers ? `Wrong. The correct answer is ${q.answer}.` : "Wrong";
        feedbackP.className = "feedback wrong";
        control.markWrong();
      }

      if (scoreText) scoreText.textContent = `Score: ${quizState.score}`;
      submitBtn.disabled = true;
      control.disable();
      nextBtn.style.display = "inline-block";
    });
    control.onEnter(() => submitBtn.click());

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
    slide.appendChild(control.el);
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

  // If this theme has Episode Mode, show it as the FIRST related card (then the
  // mashup, then the other themes). This adds one card to the total.
  // Cross-mode promo is APP-ONLY (and unlocked-web): free web visitors shouldn't
  // discover Episode Mode from the regular-trivia result screen — the related
  // card is the main way they'd find the alternate mode after using their free
  // allowance. Hidden here + in challenge.js (Episode) and episode.js (Regular).
  const hasEpisode = !!episodeThemesMap[theme.slug]
    && ((typeof isLimitedWeb !== 'function') || !isLimitedWeb());
  const episodeCardHtml = hasEpisode ? `
      <a class="card card-mix" href="episode.html?theme=${theme.slug}&episode=1">
        <h3>${theme.title} Episode Mode</h3>
        <span class="card-mix-sub">Play episode by episode</span>
      </a>` : "";

const relatedThemesHtml = `
  <div class="theme-related-quizzes" data-reward-gate="1">
    <h3>Related Quizzes</h3>
    <div class="grid">
      ${episodeCardHtml}
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
    ${hmResultHintHtml()}
    ${hmFeedbackBoxHtml()}
    <p class="result-tier">${tierText}</p>
    ${typeof webQCounterHTML === 'function' ? webQCounterHTML() : ''}
    <div class="cta-row">
      ${hasNextPage && !(typeof isWebQLimit === 'function' && isWebQLimit()) ? `<a class="primary-btn" href="play.html?theme=${theme.slug}&page=${safePage + 1}" data-rewarded-href="play.html?theme=${theme.slug}&page=${safePage + 1}">Next Round</a>` : ""}
      ${hasNextPage && (typeof isWebQLimit === 'function' && isWebQLimit()) ? (typeof webWallHTML === 'function' ? webWallHTML("Yay! You've answered 30 questions", theme.title) : "") : ""}
      ${(typeof packPurchaseHTML === 'function' && packPurchaseHTML(theme.slug)) || `<a class="secondary-btn" href="contact.html">Report a Question</a>`}
      ${!isPremiumUser() && (typeof isDesktopWeb === 'function' && isDesktopWeb()) && !(hasNextPage && (typeof isWebQLimit === 'function' && isWebQLimit())) ? `<a class="secondary-btn" href="remove-ads.html">Unlock Full Access</a>` : ""}
    </div>
    ${replayHtml}
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
  hmBindFeedbackBox();

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

// One-time in-app-only announcement banner on the homepage. Shows once ever
// (per device) then never again, even if never manually dismissed — the
// localStorage flag is set the moment it's rendered, not on close.
const FEEDBACK_FIXED_NOTICE_KEY = "_feedbackFixedNoticeSeen_v2";
function initFeedbackFixedBanner() {
  const banner = document.getElementById("feedbackFixedBanner");
  if (!banner) return;
  if (typeof isInApp !== "function" || !isInApp()) return;
  if (localStorage.getItem(FEEDBACK_FIXED_NOTICE_KEY)) return;
  localStorage.setItem(FEEDBACK_FIXED_NOTICE_KEY, "1");
  banner.style.display = "flex";
  document.getElementById("feedbackFixedBannerClose")?.addEventListener("click", () => {
    banner.style.display = "none";
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

  if (page === "home") { renderHomePage(); initFeedbackFixedBanner(); }
  if (page === "category") renderCategoryPage();
  if (page === "quiz") renderQuizPage();
  if (page === "play") renderPlayPage();
  // (Footer "Unlock Full Access" link is injected site-wide from profile.js.)
});