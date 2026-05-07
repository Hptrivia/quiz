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
    if (guess === targetWord) { setFeedback("Correct", "correct"); gameOver = true; return; }
    if (guesses.length === 6) { setFeedback(`Wrong. The word was ${targetWord}.`, "wrong"); gameOver = true; return; }
    setFeedback(`${6 - guesses.length} guess(es) left.`);
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
    progressEl.textContent = "Theme not found";
    return;
  }

  if (typeof gtag === "function") {
    gtag("event", "page_view", {
      page_title: `Wordle - ${theme.title}`,
      page_location: window.location.href
    });
  }

  if (typeof updateRemoveAdsFooter === "function") {
    updateRemoveAdsFooter(theme.slug, "normal");
  }

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
      return;
    }

    if (guesses.length === 6) {
      setFeedback(`Wrong. The word was ${targetWord}.`, "wrong");
      gameOver = true;
      return;
    }

    setFeedback(`${6 - guesses.length} guess(es) left.`);
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

  loadWord(0);
  if (safePage >= 4 && typeof maybeShowPwaPopup === "function") maybeShowPwaPopup();
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "wordle") {
    renderWordlePage();
  }
});
