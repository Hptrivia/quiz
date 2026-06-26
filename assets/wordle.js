// ─── Mashup Wordle ────────────────────────────────────────────────────────────

const WORDLE_BADGE_COLORS = [
  { bg: "rgba(59,130,246,0.15)", border: "#3b82f6", text: "#93c5fd" },
  { bg: "rgba(34,197,94,0.12)",  border: "#22c55e", text: "#86efac" },
  { bg: "rgba(249,115,22,0.15)", border: "#f97316", text: "#fdba74" },
  { bg: "rgba(168,85,247,0.15)", border: "#a855f7", text: "#d8b4fe" },
  { bg: "rgba(236,72,153,0.15)", border: "#ec4899", text: "#f9a8d4" },
];

async function renderWordleMashupMode(themesParam) {
  if (typeof addNoIndex === "function") addNoIndex();
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

  if (selectedThemes.length < 2) { progressEl.textContent = "Invalid theme selection."; return; }

  const colorBySlug = {};
  selectedThemes.forEach((t, i) => { colorBySlug[t.slug] = WORDLE_BADGE_COLORS[i % WORDLE_BADGE_COLORS.length]; });

  const allWordleData  = await fetchJSON("data/wordle_words.txt");
  const themeWordLists = selectedThemes
    .map(t => ({ slug: t.slug, title: t.title, words: Array.isArray(allWordleData[t.title]) ? allWordleData[t.title] : [] }))
    .filter(t => t.words.length > 0);

  if (!themeWordLists.length) { progressEl.textContent = "No Wordle words found for these themes."; return; }

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
  let targetWord        = "";
  let guesses           = [];
  let currentGuess      = []; // array of chars, null = empty
  let gameOver          = false;
  let keyStates         = {};
  let _animatingRow     = -1;
  let revealsUsed       = 0;
  let revealedPositions = {};
  let revealedAtRow     = {};
  let revealUsedThisRow = false;

  function initCurrentGuess() {
    const arr = Array(targetWord.length).fill(null);
    for (const [i, letter] of Object.entries(revealedPositions)) {
      if (revealedAtRow[parseInt(i)] === guesses.length) arr[parseInt(i)] = letter;
    }
    return arr;
  }

  // ── Mid-game persistence ──────────────────────────────────────────────────
  const MID_KEY_M = `tg_wordle_mid_${sessionKey}_p${safePage}`;
  function saveMidGame() {
    try { localStorage.setItem(MID_KEY_M, JSON.stringify({ guesses, revealedPositions, revealedAtRow, revealsUsed })); } catch(e) {}
  }
  function clearMidGame() {
    try { localStorage.removeItem(MID_KEY_M); } catch(e) {}
  }
  function restoreMidGame() {
    try {
      const saved = JSON.parse(localStorage.getItem(MID_KEY_M) || "null");
      if (!saved || !Array.isArray(saved.guesses) || !saved.guesses.length) return;
      if (saved.guesses[0].word.length !== targetWord.length) return;
      guesses           = saved.guesses;
      revealedPositions = saved.revealedPositions || {};
      revealedAtRow     = saved.revealedAtRow     || {};
      revealsUsed       = saved.revealsUsed       || 0;
      for (const g of guesses) updateKeyboard(g.word, g.states);
      for (const letter of Object.values(revealedPositions)) keyStates[letter] = "correct";
      revealUsedThisRow = Object.values(revealedAtRow).some(r => r === guesses.length);
      currentGuess      = (Array.isArray(saved.currentGuess) && saved.currentGuess.length === targetWord.length)
        ? saved.currentGuess
        : initCurrentGuess();
    } catch(e) {}
  }

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
          if (row !== _animatingRow && ss[col]) tile.classList.add(ss[col]);
        } else if (row === guesses.length) {
          if (revealedPositions[col] && revealedAtRow[col] === guesses.length) {
            tile.textContent = revealedPositions[col];
            tile.classList.add("correct", "wordle-tile-locked");
          } else if (currentGuess[col]) {
            tile.textContent = currentGuess[col];
            tile.classList.add("filled");
          }
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

  // ── Animations ──────────────────────────────────────────────────────────
  function animateRow(rowIndex, states, onComplete) {
    const rows = boardEl.querySelectorAll(".wordle-row");
    const row  = rows[rowIndex];
    if (!row) { if (onComplete) onComplete(); return; }
    const tiles = row.querySelectorAll(".wordle-tile");
    const FOLD = 150, STAGGER = 110;
    tiles.forEach((tile, i) => {
      setTimeout(() => {
        tile.style.transition = `transform ${FOLD}ms ease`;
        tile.style.transform  = "scaleY(0)";
        setTimeout(() => {
          tile.classList.add(states[i]);
          tile.style.transform = "scaleY(1)";
          if (i === tiles.length - 1 && onComplete) setTimeout(onComplete, FOLD);
        }, FOLD);
      }, i * STAGGER);
    });
  }

  function shakeCurrentRow() {
    const rows = boardEl.querySelectorAll(".wordle-row");
    const row  = rows[guesses.length];
    if (!row) return;
    row.classList.remove("wordle-row-shake");
    void row.offsetWidth;
    row.classList.add("wordle-row-shake");
    setTimeout(() => row.classList.remove("wordle-row-shake"), 400);
  }

  function bounceWinRow(rowIndex) {
    const rows = boardEl.querySelectorAll(".wordle-row");
    const row  = rows[rowIndex];
    if (!row) return;
    row.querySelectorAll(".wordle-tile").forEach((tile, i) => {
      setTimeout(() => {
        tile.classList.add("wordle-tile-bounce");
        setTimeout(() => tile.classList.remove("wordle-tile-bounce"), 600);
      }, i * 80);
    });
  }

  // ── Reveals ──────────────────────────────────────────────────────────────
  function updateRevealBtn() {
    let btn = document.getElementById("wordleRevealBtn");
    if (!btn) {
      btn = document.createElement("button");
      btn.id        = "wordleRevealBtn";
      btn.type      = "button";
      btn.className = "secondary-btn wordle-reveal-btn";
      progressEl.appendChild(btn);
      progressEl.style.position = "relative";
      btn.addEventListener("click", useReveal);
    }
    const left = 2 - revealsUsed;
    if (left <= 0 || gameOver) {
      btn.disabled = true; btn.style.opacity = "0.4";
      btn.textContent = "💡 No reveals left";
    } else if (revealUsedThisRow) {
      btn.disabled = true; btn.style.opacity = "0.4";
      btn.textContent = "💡 Reveal (guess first)";
    } else {
      btn.disabled = false; btn.style.opacity = "";
      btn.textContent = `💡 Reveal · ${left} left`;
    }
  }

  function useReveal() {
    if (revealsUsed >= 2 || revealUsedThisRow || gameOver) return;
    const alreadyKnown = new Set();
    for (const g of guesses) g.states.forEach((s, i) => { if (s === "correct") alreadyKnown.add(i); });
    const available = [];
    for (let i = 0; i < targetWord.length; i++) {
      if (!revealedPositions[i] && !alreadyKnown.has(i)) available.push(i);
    }
    if (!available.length) return;
    const idx = available[Math.floor(Math.random() * available.length)];
    revealedPositions[idx] = targetWord[idx];
    revealedAtRow[idx]     = guesses.length;
    revealsUsed++;
    revealUsedThisRow = true;
    keyStates[targetWord[idx]] = "correct";
    currentGuess[idx] = targetWord[idx];
    updateRevealBtn();
    renderBoard();
    renderKeyboard();
    saveMidGame();
  }

  // ── Result panel ─────────────────────────────────────────────────────────
  function showResultPanel(solved, entry) {
    const existing = document.getElementById("wordleResultPanel");
    if (existing) existing.remove();
    adMobShowInterstitial();
    if (typeof webAddWordle === 'function') webAddWordle();
    const isLast   = currentWordInPage === pageWords.length - 1 && safePage === totalPages;
    const emoji    = solved ? (guesses.length <= 2 ? "🎯" : guesses.length <= 4 ? "🎉" : "😅") : "😔";
    const msg      = solved
      ? `<strong>${targetWord}</strong> — solved in ${guesses.length}/6 ${emoji}`
      : `<strong>${targetWord}</strong> — not solved ${emoji}`;
    const emojiGrid = guesses.map(g =>
      g.states.map(s => s === "correct" ? "🟩" : s === "present" ? "🟨" : "⬛").join("")
    ).join("\n");
    const wordNum     = pageStart + currentWordInPage + 1;
    const nextPageHref = !isLast && currentWordInPage >= pageWords.length - 1 && safePage < totalPages
      ? `wordle.html?themes=${themesParam}&page=${safePage + 1}` : null;
    const useReward   = isInApp() && wordNum % 2 === 0 && !!nextPageHref;

    const panel = document.createElement("div");
    panel.id        = "wordleResultPanel";
    panel.className = "wordle-result-panel";
    panel.innerHTML = `
      <p class="wordle-result-text">${msg}</p>
      <pre class="wordle-result-grid">${emojiGrid}</pre>
      <div class="cta-row" style="margin-top:10px;justify-content:center;">
        ${!isLast && !(typeof isWebWordleLimit === 'function' && isWebWordleLimit()) ? `<button class="primary-btn" id="wordleNextFromPanel">Next Word →</button>` : ""}
        ${!isLast && (typeof isWebWordleLimit === 'function' && isWebWordleLimit()) ? (typeof webWallHTML === 'function' ? webWallHTML("Yay! You've played 2 Wordle words", null, "Wordles") : "") : ""}
      </div>`;

    feedbackEl.textContent   = "";
    boardEl.style.display    = "none";
    keyboardEl.style.display = "none";
    const revealBtn = document.getElementById("wordleRevealBtn");
    if (revealBtn) revealBtn.style.display = "none";
    feedbackEl.after(panel);

    const nextFromPanel = document.getElementById("wordleNextFromPanel");
    if (nextFromPanel) {
      nextFromPanel.addEventListener("click", () => {
        const advance = () => {
          if (currentWordInPage < pageWords.length - 1) loadWord(currentWordInPage + 1);
          else if (nextPageHref) window.location.href = nextPageHref;
        };
        if (useReward) { adMobShowBanner(); _offerRewardedLifeline('Next Word', advance); }
        else advance();
      });
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  function submitGuess() {
    if (gameOver) return;
    if (currentGuess.includes(null)) {
      setFeedback(`Guess must be ${targetWord.length} letters.`, "wrong");
      shakeCurrentRow();
      return;
    }
    const guess    = currentGuess.join("");
    const states   = getLetterState(guess, targetWord);
    const rowIndex = guesses.length;
    guesses.push({ word: guess, states });
    updateKeyboard(guess, states);
    currentGuess      = Array(targetWord.length).fill(null);
    revealUsedThisRow = false;
    updateRevealBtn();
    saveMidGame();

    _animatingRow = rowIndex;
    renderBoard();
    _animatingRow = -1;
    renderKeyboard();

    const entry = pageWords[currentWordInPage];
    animateRow(rowIndex, states, () => {
      if (guess === targetWord) {
        bounceWinRow(rowIndex);
        gameOver = true;
        clearMidGame();
        updateRevealBtn();
        if (typeof saveSession === "function") saveSession("wordle", sessionKey, safePage, 0, totalPages);
        if (typeof recordMashupStats === "function") recordMashupStats(sessionKey, "wordle", { solved: true });
        setTimeout(() => { showResultPanel(true, entry); maybeInjectWordleCard(); }, 350);
        return;
      }
      if (guesses.length === 6) {
        gameOver = true;
        clearMidGame();
        updateRevealBtn();
        if (typeof saveSession === "function") saveSession("wordle", sessionKey, safePage, 0, totalPages);
        if (typeof recordMashupStats === "function") recordMashupStats(sessionKey, "wordle", { solved: false });
        setTimeout(() => { showResultPanel(false, entry); maybeInjectWordleCard(); }, 200);
        return;
      }
      setFeedback(`${6 - guesses.length} guess${guesses.length === 5 ? "" : "es"} left.`);
    });
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
    if (key === "⌫") {
      for (let i = currentGuess.length - 1; i >= 0; i--) {
        const lockedThisRow = revealedPositions[i] && revealedAtRow[i] === guesses.length;
        if (currentGuess[i] !== null && !lockedThisRow) {
          currentGuess[i] = null; renderBoard(); return;
        }
      }
      return;
    }
    if (/^[A-Z]$/.test(key)) {
      const nextEmpty = currentGuess.indexOf(null);
      if (nextEmpty !== -1) { currentGuess[nextEmpty] = key; renderBoard(); }
    }
  }

  function loadWord(index) {
    currentWordInPage = index;
    const entry       = pageWords[currentWordInPage];
    targetWord        = entry.word;
    guesses           = [];
    gameOver          = false;
    keyStates         = {};
    revealsUsed       = 0;
    revealedPositions = {};
    revealedAtRow     = {};
    revealUsedThisRow = false;
    currentGuess      = initCurrentGuess();
    restoreMidGame();

    const resultPanel = document.getElementById("wordleResultPanel");
    if (resultPanel) resultPanel.remove();
    boardEl.style.display    = "";
    keyboardEl.style.display = "";
    const revealBtn = document.getElementById("wordleRevealBtn");
    if (revealBtn) revealBtn.style.display = "";

    progressEl.textContent = `Word ${pageStart + currentWordInPage + 1} of ${allWords.length}`;

    if (badgeEl) {
      const c = colorBySlug[entry.slug] || WORDLE_BADGE_COLORS[0];
      badgeEl.innerHTML = `<span class="mashup-q-badge" style="background:${c.bg};border-color:${c.border};color:${c.text}">${entry.title}</span>`;
    }

    setFeedback(guesses.length ? `${6 - guesses.length} guess${guesses.length === 5 ? "" : "es"} left.` : "");
    renderBoard();
    renderKeyboard();
    updateNavButtons();
    updateRevealBtn();
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
    // Web question limit: the persistent nav must respect it too, not just the
    // in-panel "Next Word" button — otherwise the nav arrow walks past the wall.
    // Shown inline (not as an overlay) so the mobile auto-redirect still arms.
    const wordNum = pageStart + currentWordInPage + 1;
    // Two reasons to wall here: (1) the lifetime word count is spent, or (2) on
    // mobile web the player is skipping PAST the 2-word free allowance with the
    // nav arrow. Skipping an unfinished word never bumps the count, so without
    // this positional check the arrow would walk straight past the wall.
    const _mobileWeb = (typeof isIosWeb === 'function' && isIosWeb()) || (typeof isAndroidWeb === 'function' && isAndroidWeb());
    const _skipPastFree = _mobileWeb && typeof isLimitedWeb === 'function' && isLimitedWeb() && wordNum >= 2;
    if ((typeof isWebWordleLimit === 'function' && isWebWordleLimit()) || _skipPastFree) {
      const old = document.getElementById("wordleResultPanel");
      if (old) old.remove();
      const wall = document.createElement("div");
      wall.id = "wordleResultPanel";
      wall.className = "wordle-result-panel";
      wall.innerHTML = `<div class="cta-row" style="justify-content:center;">${typeof webWallHTML === 'function' ? webWallHTML("Yay! You've played 2 Wordle words", null, "Wordles") : ""}</div>`;
      boardEl.style.display = "none";
      keyboardEl.style.display = "none";
      feedbackEl.after(wall);
      return;
    }
    const hasNext = currentWordInPage < pageWords.length - 1 || safePage < totalPages;
    const advance = () => {
      if (currentWordInPage < pageWords.length - 1) loadWord(currentWordInPage + 1);
      else if (safePage < totalPages) window.location.href = `wordle.html?themes=${themesParam}&page=${safePage + 1}`;
    };
    if (isInApp() && wordNum % 2 === 0 && hasNext) { adMobShowBanner(); _offerRewardedLifeline('Next Word', advance); }
    else advance();
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
  let currentGuess = []; // array of chars (null = empty), length = targetWord.length
  let gameOver     = false;
  let keyStates    = {};
  let _animatingRow = -1;
  let revealsUsed       = 0;
  let revealedPositions = {}; // index → letter
  let revealedAtRow     = {}; // index → guesses.length when revealed
  let revealUsedThisRow = false;

  // Build a fresh currentGuess array, pre-filling any revealed positions
  function initCurrentGuess() {
    const arr = Array(targetWord.length).fill(null);
    for (const [i, letter] of Object.entries(revealedPositions)) {
      if (revealedAtRow[parseInt(i)] === guesses.length) arr[parseInt(i)] = letter;
    }
    return arr;
  }

  // ── Mid-game persistence ──────────────────────────────────────────────────
  const MID_KEY_S = `tg_wordle_mid_${slug}_p${safePage}`;
  function saveMidGame() {
    try { localStorage.setItem(MID_KEY_S, JSON.stringify({ guesses, revealedPositions, revealedAtRow, revealsUsed })); } catch(e) {}
  }
  function clearMidGame() {
    try { localStorage.removeItem(MID_KEY_S); } catch(e) {}
  }
  function restoreMidGame() {
    try {
      const saved = JSON.parse(localStorage.getItem(MID_KEY_S) || "null");
      if (!saved || !Array.isArray(saved.guesses) || !saved.guesses.length) return;
      if (saved.guesses[0].word.length !== targetWord.length) return;
      guesses           = saved.guesses;
      revealedPositions = saved.revealedPositions || {};
      revealedAtRow     = saved.revealedAtRow     || {};
      revealsUsed       = saved.revealsUsed       || 0;
      for (const g of guesses) updateKeyboard(g.word, g.states);
      for (const letter of Object.values(revealedPositions)) keyStates[letter] = "correct";
      revealUsedThisRow = Object.values(revealedAtRow).some(r => r === guesses.length);
      currentGuess      = initCurrentGuess();
    } catch(e) {}
  }

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
          // Skip state class for row currently being flip-animated
          if (row !== _animatingRow && submittedStates[col]) {
            tile.classList.add(submittedStates[col]);
          }
        } else if (row === guesses.length) {
          // Active row: only show revealed tile if it was revealed on THIS row
          if (revealedPositions[col] && revealedAtRow[col] === guesses.length) {
            tile.textContent = revealedPositions[col];
            tile.classList.add("correct", "wordle-tile-locked");
          } else if (currentGuess[col]) {
            tile.textContent = currentGuess[col];
            tile.classList.add("filled");
          }
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

  // ── Tile flip animation ───────────────────────────────────────────────────
  function animateRow(rowIndex, states, onComplete) {
    const rows = boardEl.querySelectorAll(".wordle-row");
    const row  = rows[rowIndex];
    if (!row) { if (onComplete) onComplete(); return; }
    const tiles = row.querySelectorAll(".wordle-tile");
    const FOLD  = 150; // ms per half
    const STAGGER = 110; // ms between tiles

    tiles.forEach((tile, i) => {
      setTimeout(() => {
        tile.style.transition = `transform ${FOLD}ms ease`;
        tile.style.transform  = "scaleY(0)";
        setTimeout(() => {
          tile.classList.add(states[i]);
          tile.style.transform = "scaleY(1)";
          if (i === tiles.length - 1 && onComplete) setTimeout(onComplete, FOLD);
        }, FOLD);
      }, i * STAGGER);
    });
  }

  function shakeCurrentRow() {
    const rows = boardEl.querySelectorAll(".wordle-row");
    const row  = rows[guesses.length];
    if (!row) return;
    row.classList.remove("wordle-row-shake");
    void row.offsetWidth;
    row.classList.add("wordle-row-shake");
    setTimeout(() => row.classList.remove("wordle-row-shake"), 400);
  }

  function bounceWinRow(rowIndex) {
    const rows = boardEl.querySelectorAll(".wordle-row");
    const row  = rows[rowIndex];
    if (!row) return;
    row.querySelectorAll(".wordle-tile").forEach((tile, i) => {
      setTimeout(() => {
        tile.classList.add("wordle-tile-bounce");
        setTimeout(() => tile.classList.remove("wordle-tile-bounce"), 600);
      }, i * 80);
    });
  }

  // ── Share ─────────────────────────────────────────────────────────────────
  function buildShareText(solved) {
    const wordNum  = pageStart + currentWordInPage + 1;
    const result   = solved ? `${guesses.length}/6` : "X/6";
    const grid     = guesses.map(g =>
      g.states.map(s => s === "correct" ? "🟩" : s === "present" ? "🟨" : "⬛").join("")
    ).join("\n");
    return `${theme.title} Wordle — Word ${wordNum}/${words.length} ${result}\n\n${grid}\n\ntriviagauntlet.app/wordle/${theme.slug}.html`;
  }

  function copyShare(solved) {
    const text = buildShareText(solved);
    const fb   = document.getElementById("wordleShareFeedback");
    const doFeedback = () => { if (fb) { fb.textContent = "Copied!"; setTimeout(() => { if (fb) fb.textContent = ""; }, 2000); } };

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(doFeedback).catch(() => {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.cssText = "position:fixed;opacity:0;";
        document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); ta.remove(); doFeedback();
      });
    } else {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;opacity:0;";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove(); doFeedback();
    }
  }

  // ── Save last result ──────────────────────────────────────────────────────
  function saveLastResult(solved) {
    const grid = guesses.map(g =>
      g.states.map(s => s === "correct" ? "🟩" : s === "present" ? "🟨" : "⬛").join("")
    ).join("\n");
    const data = {
      word:    targetWord,
      solved,
      wordNum: pageStart + currentWordInPage + 1,
      total:   words.length,
      result:  solved ? `${guesses.length}/6` : "X/6",
      grid
    };
    try { localStorage.setItem(`tg_wordle_last_${theme.slug}`, JSON.stringify(data)); } catch(e) {}
  }

  // ── Result panel ──────────────────────────────────────────────────────────
  function showResultPanel(solved) {
    saveLastResult(solved);
    const existing = document.getElementById("wordleResultPanel");
    if (existing) existing.remove();
    adMobShowInterstitial();
    if (typeof webAddWordle === 'function') webAddWordle();
    const isLast = currentWordInPage === pageWords.length - 1 && safePage === totalPages;
    const emoji  = solved ? (guesses.length <= 2 ? "🎯" : guesses.length <= 4 ? "🎉" : "😅") : "😔";
    const msg    = solved
      ? `<strong>${targetWord}</strong> — solved in ${guesses.length}/6 ${emoji}`
      : `<strong>${targetWord}</strong> — not solved ${emoji}`;

    const emojiGrid = guesses.map(g =>
      g.states.map(s => s === "correct" ? "🟩" : s === "present" ? "🟨" : "⬛").join("")
    ).join("\n");
    const wordNum      = pageStart + currentWordInPage + 1;
    const nextPageHref = !isLast && currentWordInPage >= pageWords.length - 1 && safePage < totalPages
      ? `wordle.html?theme=${theme.slug}&page=${safePage + 1}` : null;
    const useReward    = isInApp() && wordNum % 2 === 0 && !!nextPageHref;

    const panel = document.createElement("div");
    panel.id        = "wordleResultPanel";
    panel.className = "wordle-result-panel";
    panel.innerHTML = `
      <p class="wordle-result-text">${msg}</p>
      <pre class="wordle-result-grid">${emojiGrid}</pre>
      <div class="cta-row" style="margin-top:10px;justify-content:center;">
        <button class="secondary-btn" id="wordleShareBtn">📋 Share</button>
        ${!isLast && !(typeof isWebWordleLimit === 'function' && isWebWordleLimit()) ? `<button class="primary-btn" id="wordleNextFromPanel">Next Word →</button>` : ""}
        ${!isLast && (typeof isWebWordleLimit === 'function' && isWebWordleLimit()) ? (typeof webWallHTML === 'function' ? webWallHTML("Yay! You've played 2 Wordle words", null, "Wordles") : "") : ""}
      </div>
      <p class="wordle-share-feedback" id="wordleShareFeedback"></p>`;

    feedbackEl.textContent   = "";
    boardEl.style.display    = "none";
    keyboardEl.style.display = "none";
    const revealBtn = document.getElementById("wordleRevealBtn");
    if (revealBtn) revealBtn.style.display = "none";
    feedbackEl.after(panel);

    document.getElementById("wordleShareBtn").addEventListener("click", () => copyShare(solved));

    const nextFromPanel = document.getElementById("wordleNextFromPanel");
    if (nextFromPanel) {
      nextFromPanel.addEventListener("click", () => {
        const advance = () => {
          if (currentWordInPage < pageWords.length - 1) loadWord(currentWordInPage + 1);
          else if (nextPageHref) window.location.href = nextPageHref;
        };
        if (useReward) { adMobShowBanner(); _offerRewardedLifeline('Next Word', advance); }
        else advance();
      });
    }
  }

  // ── Letter Reveals ────────────────────────────────────────────────────────
  function updateRevealBtn() {
    let btn = document.getElementById("wordleRevealBtn");
    if (!btn) {
      btn = document.createElement("button");
      btn.id        = "wordleRevealBtn";
      btn.type      = "button";
      btn.className = "secondary-btn wordle-reveal-btn";
      progressEl.appendChild(btn);
      progressEl.style.position = "relative";
      btn.addEventListener("click", useReveal);
    }
    const left = 2 - revealsUsed;
    if (left <= 0 || gameOver) {
      btn.disabled      = true;
      btn.style.opacity = "0.4";
      btn.textContent   = "💡 No reveals left";
    } else if (revealUsedThisRow) {
      btn.disabled      = true;
      btn.style.opacity = "0.4";
      btn.textContent   = `💡 Reveal (guess first)`;
    } else {
      btn.disabled      = false;
      btn.style.opacity = "";
      btn.textContent   = `💡 Reveal · ${left} left`;
    }
  }

  function useReveal() {
    if (revealsUsed >= 2 || revealUsedThisRow || gameOver) return;

    // Skip positions the player already got correct themselves
    const alreadyKnown = new Set();
    for (const g of guesses) {
      g.states.forEach((s, i) => { if (s === "correct") alreadyKnown.add(i); });
    }

    // Available = not yet revealed AND not already correctly guessed
    const available = [];
    for (let i = 0; i < targetWord.length; i++) {
      if (!revealedPositions[i] && !alreadyKnown.has(i)) available.push(i);
    }
    if (!available.length) return;

    const idx = available[Math.floor(Math.random() * available.length)];
    revealedPositions[idx] = targetWord[idx];
    revealedAtRow[idx]     = guesses.length;
    revealsUsed++;
    revealUsedThisRow = true;

    keyStates[targetWord[idx]] = "correct";
    currentGuess[idx] = targetWord[idx]; // lock only this revealed letter into active row

    updateRevealBtn();
    renderBoard();
    renderKeyboard();
    saveMidGame();
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  function submitGuess() {
    if (gameOver) return;

    if (currentGuess.includes(null)) {
      setFeedback(`Guess must be ${targetWord.length} letters.`, "wrong");
      shakeCurrentRow();
      return;
    }

    const guess    = currentGuess.join("");
    const states   = getLetterState(guess, targetWord);
    const rowIndex = guesses.length;

    guesses.push({ word: guess, states });
    updateKeyboard(guess, states);
    currentGuess      = Array(targetWord.length).fill(null); // fresh row, reveal was a one-time hint
    revealUsedThisRow = false;
    updateRevealBtn();
    saveMidGame();

    _animatingRow = rowIndex;
    renderBoard();
    _animatingRow = -1;
    renderKeyboard();

    animateRow(rowIndex, states, () => {
      const alreadyRecorded = typeof getSession === "function" && (s => s && s.round >= safePage)(getSession("wordle", theme.slug));
      if (guess === targetWord) {
        bounceWinRow(rowIndex);
        gameOver = true;
        clearMidGame();
        updateRevealBtn();
        if (!alreadyRecorded && typeof recordWordle === "function") recordWordle(theme.slug, true);
        if (typeof saveSession === "function") saveSession("wordle", theme.slug, safePage, 0, totalPages);
        setTimeout(() => { showResultPanel(true); maybeInjectWordleCard(); }, 350);
        return;
      }
      if (guesses.length === 6) {
        gameOver = true;
        clearMidGame();
        updateRevealBtn();
        if (!alreadyRecorded && typeof recordWordle === "function") recordWordle(theme.slug, false);
        if (typeof saveSession === "function") saveSession("wordle", theme.slug, safePage, 0, totalPages);
        setTimeout(() => { showResultPanel(false); maybeInjectWordleCard(); }, 200);
        return;
      }
      setFeedback(`${6 - guesses.length} guess${guesses.length === 5 ? "" : "es"} left.`);
    });
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

    if (key === "⌫") {
      // Remove last typed letter — only lock reveals on the row they were shown
      for (let i = currentGuess.length - 1; i >= 0; i--) {
        const lockedThisRow = revealedPositions[i] && revealedAtRow[i] === guesses.length;
        if (currentGuess[i] !== null && !lockedThisRow) {
          currentGuess[i] = null;
          renderBoard();
          return;
        }
      }
      return;
    }

    if (/^[A-Z]$/.test(key)) {
      // Type into the next empty (non-revealed) position
      const nextEmpty = currentGuess.indexOf(null);
      if (nextEmpty !== -1) {
        currentGuess[nextEmpty] = key;
        renderBoard();
      }
    }
  }

  function loadWord(index) {
    currentWordInPage = index;
    targetWord        = String(pageWords[currentWordInPage]).toUpperCase();
    guesses           = [];
    gameOver          = false;
    keyStates         = {};
    revealsUsed       = 0;
    revealedPositions = {};
    revealedAtRow     = {};
    revealUsedThisRow = false;
    currentGuess      = initCurrentGuess(); // fresh array, no reveals yet
    restoreMidGame();

    // Clear result panel and restore board + keyboard for new word
    const resultPanel = document.getElementById("wordleResultPanel");
    if (resultPanel) resultPanel.remove();
    boardEl.style.display    = "";
    keyboardEl.style.display = "";
    const revealBtn = document.getElementById("wordleRevealBtn");
    if (revealBtn) revealBtn.style.display = "";

    const globalIndex = pageStart + currentWordInPage;
    progressEl.textContent = `Word ${globalIndex + 1} of ${words.length}`;
    setFeedback(guesses.length ? `${6 - guesses.length} guess${guesses.length === 5 ? "" : "es"} left.` : "");
    renderBoard();
    renderKeyboard();
    updateNavButtons();
    updateRevealBtn();
    // Related cards + "try another theme" links live in persistent page content,
    // not a per-word result screen — so toggle their rewarded gate to match the
    // Next-button cadence (every 2nd word). In-app gating happens in admob.js.
    const _gateOn = ((globalIndex + 1) % 2 === 0);
    const _relWrap = document.querySelector('#wordlePageContent .theme-related-quizzes');
    const _searchRes = document.getElementById('wordleThemeSearchResults');
    [_relWrap, _searchRes].forEach(el => {
      if (!el) return;
      if (_gateOn) el.setAttribute('data-reward-gate', '1');
      else el.removeAttribute('data-reward-gate');
    });
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
    // Web question limit: the persistent nav must respect it too, not just the
    // in-panel "Next Word" button — otherwise the nav arrow walks past the wall.
    // Shown inline (not as an overlay) so the mobile auto-redirect still arms.
    const wordNum = pageStart + currentWordInPage + 1;
    // Two reasons to wall here: (1) the lifetime word count is spent, or (2) on
    // mobile web the player is skipping PAST the 2-word free allowance with the
    // nav arrow. Skipping an unfinished word never bumps the count, so without
    // this positional check the arrow would walk straight past the wall.
    const _mobileWeb = (typeof isIosWeb === 'function' && isIosWeb()) || (typeof isAndroidWeb === 'function' && isAndroidWeb());
    const _skipPastFree = _mobileWeb && typeof isLimitedWeb === 'function' && isLimitedWeb() && wordNum >= 2;
    if ((typeof isWebWordleLimit === 'function' && isWebWordleLimit()) || _skipPastFree) {
      const old = document.getElementById("wordleResultPanel");
      if (old) old.remove();
      const wall = document.createElement("div");
      wall.id = "wordleResultPanel";
      wall.className = "wordle-result-panel";
      wall.innerHTML = `<div class="cta-row" style="justify-content:center;">${typeof webWallHTML === 'function' ? webWallHTML("Yay! You've played 2 Wordle words", null, "Wordles") : ""}</div>`;
      boardEl.style.display = "none";
      keyboardEl.style.display = "none";
      feedbackEl.after(wall);
      return;
    }
    const hasNext = currentWordInPage < pageWords.length - 1 || safePage < totalPages;
    const advance = () => {
      if (currentWordInPage < pageWords.length - 1) {
        loadWord(currentWordInPage + 1);
      } else if (safePage < totalPages) {
        window.location.href = `wordle.html?theme=${theme.slug}&page=${safePage + 1}`;
      }
    };
    if (isInApp() && wordNum % 2 === 0 && hasNext) { adMobShowBanner(); _offerRewardedLifeline('Next Word', advance); }
    else advance();
  });

  renderWordlePageContent(theme, themes, safePage, words);

  if (currentPage === 1 && typeof getSession === "function") {
    const saved = getSession("wordle", theme.slug);
    if (saved && saved.round < totalPages) {
      // Load last result from localStorage if available
      let lastHtml = "";
      try {
        const last = JSON.parse(localStorage.getItem(`tg_wordle_last_${theme.slug}`) || "null");
        if (last) {
          const emoji = last.solved ? (last.result === "1/6" ? "🎯" : last.result <= "4/6" ? "🎉" : "😅") : "😔";
          const msg   = last.solved
            ? `Word ${last.wordNum}: <strong>${last.word}</strong> — solved in ${last.result} ${emoji}`
            : `Word ${last.wordNum}: <strong>${last.word}</strong> — not solved ${emoji}`;
          lastHtml = `
            <div class="wordle-last-result">
              <p>${msg}</p>
              <pre class="wordle-last-grid">${last.grid}</pre>
            </div>`;
        } else {
          // Fallback: we know the last word from the words array
          const lastWord = String(words[saved.round - 1] || "").toUpperCase();
          if (lastWord) lastHtml = `
            <div class="wordle-last-result">
              <p>Last word: <strong>${lastWord}</strong></p>
            </div>`;
        }
      } catch(e) {}

      const promptDiv = document.createElement("div");
      promptDiv.style.cssText = "text-align:center;padding:16px 0 8px;";
      promptDiv.innerHTML = `
        ${lastHtml}
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
      return;
    }
  }

  loadWord(0);
}

function injectWordleHead(theme, page) {
  const SITE = "https://triviagauntlet.app";
  const canonicalUrl = `${SITE}/wordle/${theme.slug}.html`;

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
