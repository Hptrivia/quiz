// ─── Mashup Wordle ────────────────────────────────────────────────────────────

const WORDLE_BADGE_COLORS = [
  { bg: "rgba(59,130,246,0.15)", border: "#3b82f6", text: "#93c5fd" },
  { bg: "rgba(34,197,94,0.12)",  border: "#22c55e", text: "#86efac" },
  { bg: "rgba(249,115,22,0.15)", border: "#f97316", text: "#fdba74" },
  { bg: "rgba(168,85,247,0.15)", border: "#a855f7", text: "#d8b4fe" },
  { bg: "rgba(236,72,153,0.15)", border: "#ec4899", text: "#f9a8d4" },
];

async function renderWordleMashupMode(themesParam) {
  const rawPage    = parseInt(getParam("page") || "1", 10);
  const slugs      = themesParam.split(",").map(s => s.trim()).filter(Boolean);
  const sessionKey = slugs.slice().sort().join(",");

  const progressEl = document.getElementById("wordleProgress");
  const boardEl    = document.getElementById("wordleBoard");
  const feedbackEl = document.getElementById("wordleFeedback");
  const keyboardEl = document.getElementById("wordleKeyboard");
  const prevBtn    = document.getElementById("prevWordBtn");
  const nextBtn    = document.getElementById("nextWordBtn");
  const badgeEl    = document.getElementById("wordleThemeBadge");
  const backEl     = document.querySelector(".back-link");

  if (backEl) backEl.href = `mashup-landing.html?themes=${themesParam}`;

  const allThemes      = await loadThemes();
  const selectedThemes = slugs.map(slug => allThemes.find(t => t.slug === slug)).filter(Boolean);

  if (selectedThemes.length < 2) {
    progressEl.textContent = "Invalid theme selection.";
    return;
  }

  const colorBySlug = {};
  selectedThemes.forEach((t, i) => { colorBySlug[t.slug] = WORDLE_BADGE_COLORS[i % WORDLE_BADGE_COLORS.length]; });

  const allWordleData  = await fetchJSON("data/wordle_words.txt");
  const themeWordLists = selectedThemes
    .map(t => ({ slug: t.slug, title: t.title, words: Array.isArray(allWordleData[t.title]) ? allWordleData[t.title] : [] }))
    .filter(t => t.words.length > 0);

  if (!themeWordLists.length) {
    progressEl.textContent = "No Wordle words found for these themes.";
    return;
  }

  // Interleave round-robin: t0[0], t1[0], t2[0], t0[1], t1[1], ...
  const maxLen  = Math.max(...themeWordLists.map(t => t.words.length));
  const allWords = [];
  for (let i = 0; i < maxLen; i++) {
    for (const t of themeWordLists) {
      if (i < t.words.length) allWords.push({ word: String(t.words[i]).toUpperCase(), slug: t.slug, title: t.title });
    }
  }

  const PAGE_SIZE   = 1;
  const currentPage = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  const totalPages  = Math.ceil(allWords.length / PAGE_SIZE);
  const safePage    = Math.min(currentPage, totalPages);
  const pageStart   = (safePage - 1) * PAGE_SIZE;
  const pageWords   = allWords.slice(pageStart, pageStart + PAGE_SIZE);

  let currentWordInPage = 0;
  let targetWord   = "";
  let guesses      = [];
  let currentGuess = "";
  let gameOver     = false;
  let keyStates    = {};

  const keyboardRows = [
    ["Q","W","E","R","T","Y","U","I","O","P"],
    ["A","S","D","F","G","H","J","K","L"],
    ["ENTER","Z","X","C","V","B","N","M","⌫"]
  ];

  function getLetterState(guess, answer) {
    const result = Array(guess.length).fill("absent");
    const answerArr = answer.split("");
    for (let i = 0; i < guess.length; i++) {
      if (guess[i] === answer[i]) { result[i] = "correct"; answerArr[i] = null; }
    }
    for (let i = 0; i < guess.length; i++) {
      if (result[i] === "correct") continue;
      const idx = answerArr.indexOf(guess[i]);
      if (idx !== -1) { result[i] = "present"; answerArr[idx] = null; }
    }
    return result;
  }

  function updateKeyboard(guess, states) {
    const rank = { absent: 1, present: 2, correct: 3 };
    guess.split("").forEach((letter, i) => {
      const ns = states[i], cs = keyStates[letter];
      if (!cs || rank[ns] > rank[cs]) keyStates[letter] = ns;
    });
  }

  function renderBoard() {
    boardEl.innerHTML = "";
    for (let row = 0; row < 6; row++) {
      const rowEl = document.createElement("div");
      rowEl.className = "wordle-row";
      rowEl.style.gridTemplateColumns = `repeat(${targetWord.length}, 1fr)`;
      const sg = guesses[row] ? guesses[row].word   : "";
      const ss = guesses[row] ? guesses[row].states : [];
      for (let col = 0; col < targetWord.length; col++) {
        const tile = document.createElement("div");
        tile.className = "wordle-tile";
        if (sg) {
          tile.textContent = sg[col] || "";
          if (ss[col]) tile.classList.add(ss[col]);
        } else if (row === guesses.length) {
          tile.textContent = currentGuess[col] || "";
          if (currentGuess[col]) tile.classList.add("filled");
        }
        rowEl.appendChild(tile);
      }
      boardEl.appendChild(rowEl);
    }
  }

  function renderKeyboard() {
    keyboardEl.innerHTML = "";
    keyboardRows.forEach(row => {
      const rowEl = document.createElement("div");
      rowEl.className = "wordle-keyboard-row";
      row.forEach(letter => {
        const key = document.createElement("button");
        key.type = "button";
        key.className = "wordle-key";
        key.textContent = letter;
        if (letter === "ENTER" || letter === "⌫") key.classList.add("wide");
        if (keyStates[letter]) key.classList.add(keyStates[letter]);
        key.addEventListener("click", () => handleKey(letter));
        rowEl.appendChild(key);
      });
      keyboardEl.appendChild(rowEl);
    });
  }

  function setFeedback(text, type = "") {
    feedbackEl.textContent = text;
    feedbackEl.className = "feedback";
    if (type) feedbackEl.classList.add(type);
  }

  function updateNavButtons() {
    prevBtn.disabled = currentWordInPage === 0 && safePage === 1;
    nextBtn.disabled = currentWordInPage === pageWords.length - 1 && safePage === totalPages;
    nextBtn.textContent = "Next Word";
  }

  function submitGuess() {
    if (gameOver) return;
    if (currentGuess.length !== targetWord.length) {
      setFeedback(`Guess must be ${targetWord.length} letters.`, "wrong");
      return;
    }
    const guess  = currentGuess.toUpperCase();
    const states = getLetterState(guess, targetWord);
    guesses.push({ word: guess, states });
    updateKeyboard(guess, states);
    currentGuess = "";
    renderBoard();
    renderKeyboard();
    if (guess === targetWord) {
      setFeedback("Correct", "correct"); gameOver = true;
      if (typeof saveSession === "function") saveSession("wordle", sessionKey, safePage, 0, totalPages);
      if (typeof recordMashupStats === "function") recordMashupStats(sessionKey, "wordle", { solved: true });
      maybeInjectWordleCard();
      return;
    }
    if (guesses.length === 6) {
      setFeedback(`Wrong. The word was ${targetWord}.`, "wrong"); gameOver = true;
      if (typeof saveSession === "function") saveSession("wordle", sessionKey, safePage, 0, totalPages);
      if (typeof recordMashupStats === "function") recordMashupStats(sessionKey, "wordle", { solved: false });
      maybeInjectWordleCard();
      return;
    }
    setFeedback(`${6 - guesses.length} guess(es) left.`);
  }

  function maybeInjectWordleCard() {
    if (currentWordInPage !== pageWords.length - 1 || safePage !== totalPages) return;
    if (typeof buildNotifyCard !== "function") return;
    const cont = document.getElementById("wordlePageContent");
    if (!cont || cont.querySelector(".notify-card")) return;
    const html = buildNotifyCard("Wordle", false, "wordle");
    if (!html) return;
    const div = document.createElement("div");
    div.innerHTML = html;
    cont.insertBefore(div.firstElementChild, cont.firstChild);
    wireNotifyCard("Wordle", "wordle");
  }

  function handleKey(key) {
    if (gameOver) return;
    if (key === "ENTER") { submitGuess(); return; }
    if (key === "⌫") { currentGuess = currentGuess.slice(0, -1); renderBoard(); return; }
    if (/^[A-Z]$/.test(key) && currentGuess.length < targetWord.length) { currentGuess += key; renderBoard(); }
  }

  function loadWord(index) {
    currentWordInPage = index;
    const entry  = pageWords[currentWordInPage];
    targetWord   = entry.word;
    guesses      = [];
    currentGuess = "";
    gameOver     = false;
    keyStates    = {};

    progressEl.textContent = `Word ${pageStart + currentWordInPage + 1} of ${allWords.length}`;

    if (badgeEl) {
      const c = colorBySlug[entry.slug] || WORDLE_BADGE_COLORS[0];
      badgeEl.innerHTML = `<span class="mashup-q-badge" style="background:${c.bg};border-color:${c.border};color:${c.text}">${entry.title}</span>`;
    }

    setFeedback("");
    renderBoard();
    renderKeyboard();
    updateNavButtons();
  }

  document.addEventListener("keydown", e => {
    if (document.body.dataset.page !== "wordle") return;
    if (e.key === "Enter")     { e.preventDefault(); handleKey("ENTER"); return; }
    if (e.key === "Backspace") { e.preventDefault(); handleKey("⌫");     return; }
    const letter = e.key.toUpperCase();
    if (/^[A-Z]$/.test(letter)) handleKey(letter);
  });

  prevBtn.addEventListener("click", () => {
    if (currentWordInPage > 0) loadWord(currentWordInPage - 1);
    else if (safePage > 1) window.location.href = `wordle.html?themes=${themesParam}&page=${safePage - 1}`;
  });

  nextBtn.addEventListener("click", () => {
    if (currentWordInPage < pageWords.length - 1) loadWord(currentWordInPage + 1);
    else if (safePage < totalPages) window.location.href = `wordle.html?themes=${themesParam}&page=${safePage + 1}`;
  });

  if (parseInt(getParam("page") || "1", 10) === 1 && typeof getSession === "function") {
    const saved = getSession("wordle", sessionKey);
    if (saved && saved.round < totalPages) {
      const promptDiv = document.createElement("div");
      promptDiv.style.cssText = "text-align:center;padding:16px 0 8px;";
      promptDiv.innerHTML = `
        <p style="margin-bottom:12px;">You've completed <strong>${saved.round}</strong> of <strong>${totalPages}</strong> words.</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <a class="primary-btn" href="wordle.html?themes=${themesParam}&page=${saved.round + 1}">Continue from Word ${saved.round + 1}</a>
          <button class="secondary-btn" id="wordleReset1Btn">Start from Word 1</button>
        </div>`;
      boardEl.parentNode.insertBefore(promptDiv, boardEl);
      boardEl.style.display = "none";
      keyboardEl.style.display = "none";
      prevBtn.closest(".cta-row").style.display = "none";
      document.getElementById("wordleReset1Btn").addEventListener("click", () => {
        if (typeof clearSession === "function") clearSession("wordle", sessionKey);
        promptDiv.remove();
        boardEl.style.display = "";
        keyboardEl.style.display = "";
        prevBtn.closest(".cta-row").style.display = "";
        loadWord(0);
      });
      return;
    }
  }

  loadWord(0);
  if (safePage >= 4 && typeof maybeShowPwaPopup === "function") maybeShowPwaPopup();

}

// ─── Single-theme Wordle ──────────────────────────────────────────────────────

async function renderWordlePage() {
  if (getParam("themes")) { await renderWordleMashupMode(getParam("themes")); return; }

  const slug = getParam("theme");
  const themes = await loadThemes();
  const theme = themes.find(t => t.slug === slug);

  const progressEl = document.getElementById("wordleProgress");
  const boardEl    = document.getElementById("wordleBoard");
  const feedbackEl = document.getElementById("wordleFeedback");
  const keyboardEl = document.getElementById("wordleKeyboard");
  const prevBtn    = document.getElementById("prevWordBtn");
  const nextBtn    = document.getElementById("nextWordBtn");

  if (!theme) {
    document.title = "Themed Wordle | Trivia Gauntlet";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', 'Play themed Wordle on Trivia Gauntlet. All 151 themes available — guess words from TV shows, games, sports, and more.');

    const gamePanel = document.querySelector('[data-page="wordle"] .panel, body .panel');
    if (gamePanel) gamePanel.style.display = 'none';

    const pageContentEl = document.getElementById("wordlePageContent");
    if (pageContentEl) {
      pageContentEl.innerHTML = `
        <section class="panel">
          <h1>Themed Wordle</h1>
          <p>Pick any theme below to start. Each theme has its own set of words drawn from characters, locations, and key terms. One word per page — guess it letter by letter.</p>
          <div class="grid">
            ${themes.map(t => `<a class="card" href="wordle/${t.slug}.html"><h3>${t.title}</h3><p>Wordle</p></a>`).join("")}
          </div>
        </section>
      `;
    }
    return;
  }

  document.title = `${theme.title} Wordle - Trivia Gauntlet`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', `Play the ${theme.title} Wordle on Trivia Gauntlet. Guess hidden words from the ${theme.title} universe one letter at a time.`);

  if (typeof gtag === "function") {
    gtag("event", "page_view", {
      page_title: `Wordle - ${theme.title}`,
      page_location: window.location.href
    });
  }

  if (typeof updateRemoveAdsFooter === "function") {
    updateRemoveAdsFooter(theme.slug, "normal");
  }

  // Update trivia nav link to point to the theme page
  const _wdBackEls  = document.querySelectorAll('.back-link');
  const _wdTriviaEl = _wdBackEls.length > 1 ? _wdBackEls[_wdBackEls.length - 1] : null;
  if (_wdTriviaEl && slug) _wdTriviaEl.href = `themes/${slug}.html`;

  const allWordleData = await fetchJSON("data/wordle_words.txt");
  const words = allWordleData[theme.title];

  if (!Array.isArray(words) || !words.length) {
    progressEl.textContent = "No Wordle words found for this theme.";
    return;
  }

  const PAGE_SIZE   = 1;
  const rawPage     = parseInt(getParam("page") || "1", 10);
  const currentPage = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  const totalPages  = Math.ceil(words.length / PAGE_SIZE);
  const safePage    = Math.min(currentPage, totalPages);
  const pageStart   = (safePage - 1) * PAGE_SIZE;
  const pageWords   = words.slice(pageStart, pageStart + PAGE_SIZE);

  let currentWordInPage = 0;
  let targetWord   = "";
  let guesses      = [];
  let currentGuess = "";
  let gameOver     = false;
  let keyStates    = {};

  const keyboardRows = [
    ["Q","W","E","R","T","Y","U","I","O","P"],
    ["A","S","D","F","G","H","J","K","L"],
    ["ENTER","Z","X","C","V","B","N","M","⌫"]
  ];

  function getLetterState(guess, answer) {
    const result = Array(guess.length).fill("absent");
    const answerArr = answer.split("");

    for (let i = 0; i < guess.length; i++) {
      if (guess[i] === answer[i]) {
        result[i] = "correct";
        answerArr[i] = null;
      }
    }

    for (let i = 0; i < guess.length; i++) {
      if (result[i] === "correct") continue;
      const foundIndex = answerArr.indexOf(guess[i]);
      if (foundIndex !== -1) {
        result[i] = "present";
        answerArr[foundIndex] = null;
      }
    }

    return result;
  }

  function updateKeyboard(guess, states) {
    const rank = { absent: 1, present: 2, correct: 3 };
    guess.split("").forEach((letter, i) => {
      const nextState = states[i];
      const currentState = keyStates[letter];
      if (!currentState || rank[nextState] > rank[currentState]) {
        keyStates[letter] = nextState;
      }
    });
  }

  function renderBoard() {
    boardEl.innerHTML = "";

    for (let row = 0; row < 6; row++) {
      const rowEl = document.createElement("div");
      rowEl.className = "wordle-row";
      rowEl.style.gridTemplateColumns = `repeat(${targetWord.length}, 1fr)`;

      const submittedGuess  = guesses[row] ? guesses[row].word   : "";
      const submittedStates = guesses[row] ? guesses[row].states : [];

      for (let col = 0; col < targetWord.length; col++) {
        const tile = document.createElement("div");
        tile.className = "wordle-tile";

        if (submittedGuess) {
          tile.textContent = submittedGuess[col] || "";
          if (submittedStates[col]) tile.classList.add(submittedStates[col]);
        } else if (row === guesses.length) {
          tile.textContent = currentGuess[col] || "";
          if (currentGuess[col]) tile.classList.add("filled");
        }

        rowEl.appendChild(tile);
      }

      boardEl.appendChild(rowEl);
    }
  }

  function renderKeyboard() {
    keyboardEl.innerHTML = "";

    keyboardRows.forEach(row => {
      const rowEl = document.createElement("div");
      rowEl.className = "wordle-keyboard-row";

      row.forEach(letter => {
        const key = document.createElement("button");
        key.type = "button";
        key.className = "wordle-key";
        key.textContent = letter;

        if (letter === "ENTER" || letter === "⌫") key.classList.add("wide");
        if (keyStates[letter]) key.classList.add(keyStates[letter]);

        key.addEventListener("click", () => handleKey(letter));
        rowEl.appendChild(key);
      });

      keyboardEl.appendChild(rowEl);
    });
  }

  function setFeedback(text, type = "") {
    feedbackEl.textContent = text;
    feedbackEl.className = "feedback";
    if (type) feedbackEl.classList.add(type);
  }

  function updateNavButtons() {
    prevBtn.disabled = currentWordInPage === 0 && safePage === 1;
    nextBtn.disabled = currentWordInPage === pageWords.length - 1 && safePage === totalPages;
    nextBtn.textContent = "Next Word";
  }

  function submitGuess() {
    if (gameOver) return;

    if (currentGuess.length !== targetWord.length) {
      setFeedback(`Guess must be ${targetWord.length} letters.`, "wrong");
      return;
    }

    const guess  = currentGuess.toUpperCase();
    const states = getLetterState(guess, targetWord);

    guesses.push({ word: guess, states });
    updateKeyboard(guess, states);
    currentGuess = "";

    renderBoard();
    renderKeyboard();

    if (guess === targetWord) {
      setFeedback("Correct", "correct");
      gameOver = true;
      if (typeof recordWordle === "function") recordWordle(theme.slug, true);
      if (typeof saveSession === "function") saveSession("wordle", theme.slug, safePage, 0, totalPages);
      maybeInjectWordleCard();
      return;
    }

    if (guesses.length === 6) {
      setFeedback(`Wrong. The word was ${targetWord}.`, "wrong");
      gameOver = true;
      if (typeof recordWordle === "function") recordWordle(theme.slug, false);
      if (typeof saveSession === "function") saveSession("wordle", theme.slug, safePage, 0, totalPages);
      maybeInjectWordleCard();
      return;
    }

    setFeedback(`${6 - guesses.length} guess(es) left.`);
  }

  function maybeInjectWordleCard() {
    if (currentWordInPage !== pageWords.length - 1 || safePage !== totalPages) return;
    if (typeof buildNotifyCard !== "function") return;
    const cont = document.getElementById("wordlePageContent");
    if (!cont || cont.querySelector(".notify-card")) return;
    const html = buildNotifyCard(theme.title, false, "wordle");
    if (!html) return;
    const div = document.createElement("div");
    div.innerHTML = html;
    cont.insertBefore(div.firstElementChild, cont.firstChild);
    wireNotifyCard(theme.title, "wordle");
  }

  function handleKey(key) {
    if (gameOver) return;

    if (key === "ENTER") { submitGuess(); return; }
    if (key === "⌫") { currentGuess = currentGuess.slice(0, -1); renderBoard(); return; }
    if (/^[A-Z]$/.test(key) && currentGuess.length < targetWord.length) {
      currentGuess += key;
      renderBoard();
    }
  }

  function loadWord(index) {
    currentWordInPage = index;
    targetWord   = String(pageWords[currentWordInPage]).toUpperCase();
    guesses      = [];
    currentGuess = "";
    gameOver     = false;
    keyStates    = {};

    const globalIndex = pageStart + currentWordInPage;
    progressEl.textContent = `Word ${globalIndex + 1} of ${words.length}`;
    setFeedback("");
    renderBoard();
    renderKeyboard();
    updateNavButtons();
  }

  document.addEventListener("keydown", e => {
    if (document.body.dataset.page !== "wordle") return;

    if (e.key === "Enter")     { e.preventDefault(); handleKey("ENTER"); return; }
    if (e.key === "Backspace") { e.preventDefault(); handleKey("⌫");     return; }

    const letter = e.key.toUpperCase();
    if (/^[A-Z]$/.test(letter)) handleKey(letter);
  });

  prevBtn.addEventListener("click", () => {
    if (currentWordInPage > 0) {
      loadWord(currentWordInPage - 1);
    } else if (safePage > 1) {
      window.location.href = `wordle.html?theme=${theme.slug}&page=${safePage - 1}`;
    }
  });

  nextBtn.addEventListener("click", () => {
    if (currentWordInPage < pageWords.length - 1) {
      loadWord(currentWordInPage + 1);
    } else if (safePage < totalPages) {
      window.location.href = `wordle.html?theme=${theme.slug}&page=${safePage + 1}`;
    }
  });

  renderWordlePageContent(theme, themes, safePage, words);

  if (currentPage === 1 && typeof getSession === "function") {
    const saved = getSession("wordle", theme.slug);
    if (saved && saved.round < totalPages) {
      const promptDiv = document.createElement("div");
      promptDiv.style.cssText = "text-align:center;padding:16px 0 8px;";
      promptDiv.innerHTML = `
        <p style="margin-bottom:12px;">You've completed <strong>${saved.round}</strong> of <strong>${totalPages}</strong> words.</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <a class="primary-btn" href="wordle.html?theme=${theme.slug}&page=${saved.round + 1}">Continue from Word ${saved.round + 1}</a>
          <button class="secondary-btn" id="wordleReset1Btn">Start from Word 1</button>
        </div>`;
      boardEl.parentNode.insertBefore(promptDiv, boardEl);
      boardEl.style.display = "none";
      keyboardEl.style.display = "none";
      prevBtn.closest(".cta-row").style.display = "none";
      document.getElementById("wordleReset1Btn").addEventListener("click", () => {
        if (typeof clearSession === "function") clearSession("wordle", theme.slug);
        promptDiv.remove();
        boardEl.style.display = "";
        keyboardEl.style.display = "";
        prevBtn.closest(".cta-row").style.display = "";
        loadWord(0);
      });
      if (safePage >= 4 && typeof maybeShowPwaPopup === "function") maybeShowPwaPopup();
      return;
    }
  }

  loadWord(0);
  if (safePage >= 4 && typeof maybeShowPwaPopup === "function") maybeShowPwaPopup();
}

function injectWordleHead(theme, page) {
  const SITE = "https://triviagauntlet.app";
  const canonicalUrl = `${SITE}/wordle.html?theme=${theme.slug}&page=1`;

  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
  canonical.href = canonicalUrl;

  let ogUrl = document.querySelector('meta[property="og:url"]');
  if (!ogUrl) { ogUrl = document.createElement('meta'); ogUrl.setAttribute('property', 'og:url'); document.head.appendChild(ogUrl); }
  ogUrl.setAttribute('content', `${SITE}/wordle.html?theme=${theme.slug}&page=${page}`);

  let ogTitle = document.querySelector('meta[property="og:title"]');
  if (!ogTitle) { ogTitle = document.createElement('meta'); ogTitle.setAttribute('property', 'og:title'); document.head.appendChild(ogTitle); }
  ogTitle.setAttribute('content', `${theme.title} Wordle | Trivia Gauntlet`);

  let ogDesc = document.querySelector('meta[property="og:description"]');
  if (!ogDesc) { ogDesc = document.createElement('meta'); ogDesc.setAttribute('property', 'og:description'); document.head.appendChild(ogDesc); }
  ogDesc.setAttribute('content', `Guess ${theme.title} words one letter at a time on Trivia Gauntlet.`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": `${SITE}/` },
          { "@type": "ListItem", "position": 2, "name": `${theme.title} Trivia`, "item": `${SITE}/themes/${theme.slug}.html` },
          { "@type": "ListItem", "position": 3, "name": `${theme.title} Wordle`, "item": canonicalUrl }
        ]
      }
    ]
  };
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(jsonLd);
  document.head.appendChild(script);
}

function renderWordlePageContent(theme, themes, page, allWords = []) {
  const container = document.getElementById("wordlePageContent");
  if (!container) return;

  injectWordleHead(theme, page);

  const relatedThemes = getRelatedThemes(themes, theme, 4);

  const relatedHtml = `
    <div class="theme-related-quizzes">
      <h3>Related themes</h3>
      <div class="grid">
        <a class="card card-mix" href="mashup.html?preset=${theme.slug}&mode=wordle">
          <h3>${theme.title} + other themes</h3>
          <span class="card-mix-sub">Play as a mashup</span>
        </a>
        ${relatedThemes.map(t => `<a class="card" href="wordle/${t.slug}.html"><h3>${t.title}</h3></a>`).join("")}
      </div>
    </div>`;

  container.innerHTML = `
    <section class="panel" style="margin-top:16px;">
      <div class="result-theme-search">
        <p class="result-theme-search-title">Try another Wordle theme</p>
        <div class="search-wrap">
          <input id="wordleThemeSearchInput" class="theme-search-input" type="text" placeholder="Search themes..." autocomplete="off" />
          <div id="wordleThemeSearchResults" class="search-results"></div>
        </div>
        ${relatedHtml}
      </div>
    </section>`;

  const input = document.getElementById("wordleThemeSearchInput");
  const results = document.getElementById("wordleThemeSearchResults");
  if (!input || !results) return;

  const renderResults = (items) => {
    results.innerHTML = items.length
      ? items.map(t => `<a class="search-item" href="wordle/${t.slug}.html">${t.title}</a>`).join("")
      : '<div class="search-item">No results found</div>';
  };

  input.addEventListener("focus", () => { renderResults(themes); results.style.display = "block"; });
  input.addEventListener("input", e => {
    const v = e.target.value.trim().toLowerCase();
    renderResults(themes.filter(t => t.title.toLowerCase().includes(v)));
    results.style.display = "block";
  });
  document.addEventListener("click", e => {
    if (!input.contains(e.target) && !results.contains(e.target)) results.style.display = "none";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "wordle") {
    renderWordlePage();
  }
});
