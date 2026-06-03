async function renderMultiThemeSurvival() {
  const params = new URLSearchParams(window.location.search);
  const slugs = (params.get("themes") || "").split(",").map(s => s.trim()).filter(Boolean);
  if (slugs.length < 2) { window.location.href = "mashup.html"; return; }

  const allThemeMeta = await loadThemes();
  const selectedThemes = slugs.map(slug => allThemeMeta.find(t => t.slug === slug)).filter(Boolean);
  if (selectedThemes.length < 2) { window.location.href = "mashup.html"; return; }

  const themesParam = selectedThemes.map(t => t.slug).join(",");
  const colorBySlug = {};
  selectedThemes.forEach((t, i) => { colorBySlug[t.slug] = MASHUP_BADGE_COLORS[i % MASHUP_BADGE_COLORS.length]; });

  document.title = selectedThemes.map(t => t.title).join(" + ") + " — Survival | Trivia Gauntlet";
  if (typeof gtag === "function") gtag("event", "page_view", { page_title: document.title, page_location: window.location.href });
  if (typeof addNoIndex === "function") addNoIndex();

  const difficultyBox = document.getElementById("difficultyBox");
  const gameBox = document.getElementById("survivalGameBox");
  const resultBox = document.getElementById("survivalResultBox");
  const slidesContainer = document.getElementById("survivalSlides");

  const difficultyMap = {
    easy: ["easy", "medium"],
    hard: ["hard", "expert"],
    mixed: ["easy", "medium", "hard", "expert"]
  };

  const pointsMap = { easy: 1, medium: 2, hard: 3, expert: 4 };

  const state = {
    difficulty: null, questions: [], currentIndex: 0, selectedAnswer: null,
    score: 0, gameOver: false, fiftyAvailable: true, friendAvailable: true,
    recoveryStage: 0, recoveryPoints: 0, recoveryStarted: false,
    pendingRecoveryStart: false, answerLocked: false
  };

  const themeScores = {};
  selectedThemes.forEach(t => { themeScores[t.slug] = { correct: 0, total: 0 }; });

  let currentSubmitBtn = null, currentNextBtn = null;
  let scoreEl = null, streakEl = null, sharedFeedbackEl = null, fiftyBtn = null, friendBtn = null;

  function normalizeDiff(value) { return String(value || "").trim().toLowerCase(); }
  function shuffle(array) { return [...array].sort(() => Math.random() - 0.5); }
  function getCurrentQuestion() { return state.questions[state.currentIndex]; }
  function getCurrentSlide() { return slidesContainer.querySelector(`.question-slide[data-index="${state.currentIndex}"]`); }
  function setFeedback(text, type = "") {
    sharedFeedbackEl.textContent = text;
    sharedFeedbackEl.className = "feedback";
    if (type) sharedFeedbackEl.classList.add(type);
  }
  function updateTopbar() {
    scoreEl.textContent = state.score;
    streakEl.textContent = (state.recoveryStarted || state.pendingRecoveryStart) ? `Started (${state.recoveryPoints})` : "Not started";
    const inApp = typeof isInApp === 'function' && isInApp();
    fiftyBtn.disabled = (inApp ? false : !state.fiftyAvailable) || state.answerLocked || state.gameOver;
    friendBtn.disabled = (inApp ? false : !state.friendAvailable) || state.answerLocked || state.gameOver;
    fiftyBtn.textContent = state.fiftyAvailable ? "50-50" : "50-50 Used";
    friendBtn.textContent = state.friendAvailable ? "Call a Friend" : "Friend Used";
    fiftyBtn.classList.toggle("used-lifeline", !state.fiftyAvailable);
    friendBtn.classList.toggle("used-lifeline", !state.friendAvailable);
  }
  function maybeStartRecovery() {
    if (!state.fiftyAvailable && !state.friendAvailable && !state.recoveryStarted && !state.pendingRecoveryStart) {
      state.pendingRecoveryStart = true; state.recoveryStage = 0; state.recoveryPoints = 0;
    }
  }
  function handleRecoveryOnCorrect(questionDifficulty) {
    const points = pointsMap[questionDifficulty] || 1;
    if (!state.recoveryStarted) return null;
    state.recoveryPoints += points;
    if (state.recoveryStage === 0 && state.recoveryPoints >= 25) { state.fiftyAvailable = true; state.recoveryStage = 1; return "50-50 regained."; }
    if (state.recoveryStage === 1 && state.recoveryPoints >= 50) { state.friendAvailable = true; state.recoveryStage = 2; return "Call a Friend regained."; }
    return null;
  }
  function showQuestion(index) {
    const prev = slidesContainer.querySelector(".question-slide.active");
    if (prev) { prev.classList.remove("active"); prev.classList.add("answered"); prev.style.display = "none"; }
    const slide = slidesContainer.querySelector(`.question-slide[data-index="${index}"]`);
    if (slide) {
      slide.classList.add("active"); slide.style.display = "block";
      slide.scrollIntoView({ behavior: "smooth", block: "start" });
      currentSubmitBtn = slide.querySelector(".slide-submit-btn");
      currentNextBtn = slide.querySelector(".slide-next-btn");
      scoreEl = slide.querySelector(".slide-score-text");
      streakEl = slide.querySelector(".slide-streak-text");
      sharedFeedbackEl = slide.querySelector(".slide-feedback");
      fiftyBtn = slide.querySelector(".slide-fifty-btn");
      friendBtn = slide.querySelector(".slide-friend-btn");
      fiftyBtn.onclick = useFiftyFifty;
      friendBtn.onclick = useCallFriend;
    }
    state.selectedAnswer = null; state.answerLocked = false;
    if (currentSubmitBtn) currentSubmitBtn.disabled = false;
    if (currentNextBtn) currentNextBtn.style.display = "none";
    setFeedback("");
    if (state.pendingRecoveryStart) { state.pendingRecoveryStart = false; state.recoveryStarted = true; state.recoveryPoints = 0; }
    if (isPremiumUser()) { state.fiftyAvailable = true; state.friendAvailable = true; }
    updateTopbar();
  }
  function handleWrongAnswer() {
    const slide = getCurrentSlide();
    const selectedBtn = slide ? slide.querySelector(".option-btn.selected") : null;
    state.gameOver = true; state.answerLocked = true;
    if (currentSubmitBtn) currentSubmitBtn.disabled = true;
    if (typeof SoundFX !== 'undefined') SoundFX.play('wrong');
    if (selectedBtn) { selectedBtn.classList.remove("correct-anim"); void selectedBtn.offsetWidth; selectedBtn.classList.add("wrong-anim"); }
    setFeedback("Wrong. Run over.", "wrong");
    updateTopbar();
    setTimeout(() => renderResult(), 500);
  }
  function handleCorrectAnswer() {
    const q = getCurrentQuestion();
    const difficulty = normalizeDiff(q.difficulty);
    const points = pointsMap[difficulty] || 1;
    const slide = getCurrentSlide();
    const selectedBtn = slide ? slide.querySelector(".option-btn.selected") : null;
    const slug = q._themeSlug;
    state.score += points;
    if (themeScores[slug]) themeScores[slug].correct++;
    state.answerLocked = true;
    if (currentSubmitBtn) currentSubmitBtn.disabled = true;
    if (currentNextBtn) currentNextBtn.style.display = "inline-block";
    if (typeof SoundFX !== 'undefined') SoundFX.play('correct');
    if (selectedBtn) { selectedBtn.classList.remove("wrong-anim"); void selectedBtn.offsetWidth; selectedBtn.classList.add("correct-anim"); }
    const recoveryMessage = handleRecoveryOnCorrect(difficulty);
    setFeedback(recoveryMessage ? `Correct. +${points} point(s). ${recoveryMessage}` : `Correct. +${points} point(s).`, "correct");
    updateTopbar();
  }
  function useFiftyFifty() {
    if (state.answerLocked || state.gameOver) return;
    if (!state.fiftyAvailable) {
      if (typeof isInApp === 'function' && isInApp()) _offerRewardedLifeline('50/50', () => { state.fiftyAvailable = true; useFiftyFifty(); });
      return;
    }
    const q = getCurrentQuestion();
    const slide = getCurrentSlide();
    const buttons = slide ? [...slide.querySelectorAll(".option-btn")] : [];
    const wrongButtons = buttons.filter(btn => btn.textContent !== q.answer && btn.style.display !== "none");
    shuffle(wrongButtons).slice(0, 2).forEach(btn => { btn.style.display = "none"; });
    state.fiftyAvailable = false;
    if (state.recoveryStarted && state.recoveryStage === 1) {
      state.recoveryStarted = false; state.recoveryPoints = 0; state.recoveryStage = 0;
      state.pendingRecoveryStart = true;
      setFeedback("Recovery streak broken. It will restart on the next question.", "wrong");
    }
    maybeStartRecovery(); updateTopbar();
  }
  function useCallFriend() {
    if (state.answerLocked || state.gameOver) return;
    if (!state.friendAvailable) {
      if (typeof isInApp === 'function' && isInApp()) _offerRewardedLifeline('Call a Friend', () => { state.friendAvailable = true; useCallFriend(); });
      return;
    }
    const q = getCurrentQuestion();
    state.friendAvailable = false;
    setFeedback(`Call a Friend: The answer is ${q.answer}`, "correct");
    maybeStartRecovery(); updateTopbar();
  }
  function renderResult() {
    adMobShowInterstitial();
    gameBox.style.display = "none";
    resultBox.style.display = "block";
    resultBox.classList.remove("result-anim"); void resultBox.offsetWidth; resultBox.classList.add("result-anim");
    if (typeof recordMashupStats === "function") {
      const mashupKey = slugs.slice().sort().join(",");
      recordMashupStats(mashupKey, "survival", { score: state.score });
    }
    resultBox.innerHTML = `
      <h2>Survival Over</h2>
      <p>Your score: ${state.score}</p>
      <div id="mashupSurvivalBreakdown"></div>
      <div class="cta-row">
        <a class="primary-btn" href="survival.html?themes=${themesParam}">Play Again</a>
        ${!isPremiumUser() ? `<a class="secondary-btn" href="remove-ads.html">Unlimited Lifelines</a>` : ""}
        <a class="secondary-btn" href="contact.html">Report a Question</a>
      </div>
      <div class="result-theme-search">
        <p class="result-theme-search-title">Try another theme</p>
        <div class="search-wrap">
          <input id="mashupSurvivalSearchInput" class="theme-search-input" type="text" placeholder="Search themes..." autocomplete="off" />
          <div id="mashupSurvivalSearchResults" class="search-results"></div>
        </div>
      </div>
      <div id="mashupSurvivalAdSlot"></div>
      <div class="theme-related-quizzes">
        <h3>Play these themes individually</h3>
        <div class="grid">
          ${selectedThemes.map(t => `<a class="card" href="survival.html?theme=${t.slug}"><h3>${t.title}</h3></a>`).join("")}
        </div>
      </div>
    `;
    document.getElementById("mashupSurvivalBreakdown").appendChild(renderMashupThemeBreakdown(themeScores, selectedThemes, colorBySlug));
    injectMashupResultAd(document.getElementById("mashupSurvivalAdSlot"));
    const msInput = document.getElementById("mashupSurvivalSearchInput");
    const msResults = document.getElementById("mashupSurvivalSearchResults");
    if (msInput && msResults) {
      const renderSearch = items => {
        msResults.innerHTML = items.length ? items.map(t => `<a class="search-item" href="survival.html?theme=${t.slug}">${t.title}</a>`).join("") : '<div class="search-item">No results found</div>';
      };
      msInput.addEventListener("focus", () => { renderSearch(allThemeMeta); msResults.style.display = "block"; });
      msInput.addEventListener("input", e => { renderSearch(allThemeMeta.filter(t => t.title.toLowerCase().includes(e.target.value.trim().toLowerCase()))); msResults.style.display = "block"; });
      document.addEventListener("click", e => { if (!msInput.contains(e.target) && !msResults.contains(e.target)) msResults.style.display = "none"; });
    }
    setTimeout(() => { if (typeof showInstallCard === "function") showInstallCard(); }, 800);
  }

  document.querySelectorAll(".difficulty-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      state.difficulty = btn.dataset.difficulty;

      const questionsByTheme = {};
      await Promise.all(selectedThemes.map(async theme => {
        try { questionsByTheme[theme.slug] = (await fetchJSON(theme.questionFile)) || []; }
        catch(e) { questionsByTheme[theme.slug] = []; }
      }));

      const allowedDifficulties = difficultyMap[state.difficulty];
      const nd = v => String(v || "").trim().toLowerCase();

      const allQs = [];
      selectedThemes.forEach(theme => {
        const qs = (questionsByTheme[theme.slug] || [])
          .filter(q => allowedDifficulties.includes(nd(q.difficulty)))
          .map(q => Object.assign({}, q, { _themeSlug: theme.slug }));
        allQs.push(...qs);
      });

      state.questions = shuffle(allQs).map(q => shuffleQuestionOptions(q));
      state.currentIndex = 0; state.selectedAnswer = null; state.score = 0; state.gameOver = false;
      state.fiftyAvailable = true; state.friendAvailable = true;
      state.recoveryStage = 0; state.recoveryPoints = 0; state.recoveryStarted = false;
      state.pendingRecoveryStart = false; state.answerLocked = false;

      selectedThemes.forEach(t => { themeScores[t.slug] = { correct: 0, total: 0 }; });
      state.questions.forEach(q => { if (themeScores[q._themeSlug]) themeScores[q._themeSlug].total++; });

      slidesContainer.innerHTML = "";

      state.questions.forEach((q, index) => {
        const slug = q._themeSlug;
        const themeName = (selectedThemes.find(t => t.slug === slug) || {}).title || slug;
        const slide = document.createElement("div");
        slide.className = "question-slide"; slide.dataset.index = index;
        const qNum = document.createElement("p"); qNum.className = "slide-question-num"; qNum.textContent = `Question ${index + 1}`;
        const qText = document.createElement("h2"); qText.textContent = q.question;
        const optsList = document.createElement("div"); optsList.className = "options";
        q.options.forEach(option => {
          const optBtn = document.createElement("button"); optBtn.className = "option-btn"; optBtn.textContent = option;
          optBtn.addEventListener("click", () => {
            if (state.answerLocked || state.gameOver) return;
            if (state.currentIndex !== index) return;
            state.selectedAnswer = option;
            optsList.querySelectorAll(".option-btn").forEach(b => b.classList.remove("selected", "correct-anim", "wrong-anim"));
            optBtn.classList.add("selected");
          });
          optsList.appendChild(optBtn);
        });
        const submitBtn = document.createElement("button"); submitBtn.className = "slide-submit-btn secondary-btn"; submitBtn.textContent = "Submit";
        const nextBtn = document.createElement("button"); nextBtn.className = "slide-next-btn secondary-btn"; nextBtn.textContent = "Next"; nextBtn.style.display = "none";
        submitBtn.addEventListener("click", () => {
          if (state.gameOver || state.answerLocked || !state.selectedAnswer || state.currentIndex !== index) return;
          if (state.selectedAnswer === getCurrentQuestion().answer) handleCorrectAnswer();
          else handleWrongAnswer();
        });
        nextBtn.addEventListener("click", () => {
          if (state.gameOver) { renderResult(); return; }
          state.currentIndex += 1;
          if (state.currentIndex >= state.questions.length) renderResult();
          else showQuestion(state.currentIndex);
        });
        const lifelinesDiv = document.createElement("div"); lifelinesDiv.className = "survival-lifelines";
        const slideFFBtn = document.createElement("button"); slideFFBtn.className = "secondary-btn slide-fifty-btn"; slideFFBtn.textContent = "50-50";
        const slideFriendBtn = document.createElement("button"); slideFriendBtn.className = "secondary-btn slide-friend-btn"; slideFriendBtn.textContent = "Call a Friend";
        lifelinesDiv.appendChild(slideFFBtn); lifelinesDiv.appendChild(slideFriendBtn);
        const metaRow = document.createElement("div"); metaRow.className = "episode-context survival-meta-row";
        const scoreP = document.createElement("p"); scoreP.innerHTML = "<strong>Score:</strong> <span class='slide-score-text'>0</span>";
        const streakP = document.createElement("p"); streakP.innerHTML = "<strong>Recovery Streak:</strong> <span class='slide-streak-text'>Not started</span>";
        metaRow.appendChild(scoreP); metaRow.appendChild(streakP);
        const slideFeedback = document.createElement("p"); slideFeedback.className = "feedback slide-feedback";
        const ctaRow = document.createElement("div"); ctaRow.className = "cta-row"; ctaRow.style.marginTop = "1.5rem";
        ctaRow.appendChild(submitBtn); ctaRow.appendChild(nextBtn);
        slide.appendChild(qNum);
        slide.appendChild(makeMashupBadge(slug, colorBySlug, themeName));
        slide.appendChild(qText); slide.appendChild(optsList); slide.appendChild(lifelinesDiv);
        slide.appendChild(metaRow); slide.appendChild(slideFeedback); slide.appendChild(ctaRow);
        slidesContainer.appendChild(slide);
      });

      difficultyBox.style.display = "none"; gameBox.style.display = "block"; resultBox.style.display = "none";
      slidesContainer.querySelectorAll(".question-slide").forEach(s => { s.style.display = "none"; });
      showQuestion(0);
    });
  });
}

async function renderSurvivalPage() {
  if (getParam("themes")) { await renderMultiThemeSurvival(); return; }
  const slug = getParam("theme");
  const themes = await loadThemes();
  const theme = themes.find(t => t.slug === slug);

  const difficultyBox = document.getElementById("difficultyBox");
  const gameBox = document.getElementById("survivalGameBox");
  const resultBox = document.getElementById("survivalResultBox");
  const slidesContainer = document.getElementById("survivalSlides");

  let scoreEl = null;
  let streakEl = null;
  let sharedFeedbackEl = null;
  let fiftyBtn = null;
  let friendBtn = null;

  if (!theme) return;

  document.title = `${theme.title} Survival Mode - Trivia Gauntlet`;
  if (typeof setCanonical === "function") setCanonical(`${window.location.origin}/themes/${theme.slug}.html`);
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', `Play ${theme.title} Survival Mode on Trivia Gauntlet. Answer correctly to keep your streak alive — one wrong answer ends the run.`);

  if (typeof gtag === "function") {
    gtag("event", "page_view", {
      page_title: `Survival Mode - ${theme.title}`,
      page_location: window.location.href
    });
  }

  if (typeof updateRemoveAdsFooter === "function") {
    updateRemoveAdsFooter(theme.slug, "normal");
  }

  const difficultyMap = {
    easy: ["easy", "medium"],
    hard: ["hard", "expert"],
    mixed: ["easy", "medium", "hard", "expert"]
  };

  const pointsMap = {
    easy: 1,
    medium: 2,
    hard: 3,
    expert: 4
  };

  const state = {
    difficulty: null,
    questions: [],
    currentIndex: 0,
    selectedAnswer: null,
    score: 0,
    gameOver: false,
    fiftyAvailable: true,
    friendAvailable: true,
    recoveryStage: 0,
    recoveryPoints: 0,
    recoveryStarted: false,
    pendingRecoveryStart: false,
    answerLocked: false,
    topScore: null
  };

  // Inject leaderboard button into difficulty screen
  if (typeof lbOpenModal === "function") {
    const lbBtn = document.createElement("button");
    lbBtn.className = "secondary-btn";
    lbBtn.style.cssText = "margin-top:14px;width:100%;";
    lbBtn.textContent = "🏆 Leaderboard";
    lbBtn.addEventListener("click", () => lbOpenModal(theme.slug, theme.title));
    difficultyBox.appendChild(lbBtn);
  }

  // Tracks the active slide's submit/next buttons
  let currentSubmitBtn = null;
  let currentNextBtn = null;

  function normalizeDiff(value) {
    return String(value || "").trim().toLowerCase();
  }

  function shuffle(array) {
    return [...array].sort(() => Math.random() - 0.5);
  }

  function getCurrentQuestion() {
    return state.questions[state.currentIndex];
  }

  function getCurrentSlide() {
    return slidesContainer.querySelector(`.question-slide[data-index="${state.currentIndex}"]`);
  }

  function setFeedback(text, type = "") {
    sharedFeedbackEl.textContent = text;
    sharedFeedbackEl.className = "feedback";
    if (type) sharedFeedbackEl.classList.add(type);
  }

  function updateTopbar() {
    scoreEl.textContent = state.score;

    if (state.recoveryStarted || state.pendingRecoveryStart) {
      streakEl.textContent = `Started (${state.recoveryPoints})`;
    } else {
      streakEl.textContent = "Not started";
    }

    const inApp = typeof isInApp === 'function' && isInApp();
    fiftyBtn.disabled = (inApp ? false : !state.fiftyAvailable) || state.answerLocked || state.gameOver;
    friendBtn.disabled = (inApp ? false : !state.friendAvailable) || state.answerLocked || state.gameOver;

    fiftyBtn.textContent = state.fiftyAvailable ? "50-50" : "50-50 Used";
    friendBtn.textContent = state.friendAvailable ? "Call a Friend" : "Friend Used";

    fiftyBtn.classList.toggle("used-lifeline", !state.fiftyAvailable);
    friendBtn.classList.toggle("used-lifeline", !state.friendAvailable);

    const slide = getCurrentSlide();
    const topEl = slide ? slide.querySelector(".slide-top-text") : null;
    if (topEl) topEl.textContent = state.topScore !== null ? state.topScore : "—";
  }

  function renderResult() {
    adMobShowInterstitial();
    gameBox.style.display = "none";
    resultBox.style.display = "block";
    resultBox.classList.remove("result-anim");
    void resultBox.offsetWidth;
    resultBox.classList.add("result-anim");

    const relatedThemes = getRelatedThemes(themes, theme, 4);

    const relatedThemesHtml = `
      <div class="theme-related-quizzes">
        <h3>Related Quizzes</h3>
        <div class="grid">
          <a class="card card-mix" href="mashup.html?preset=${theme.slug}&mode=survival">
            <h3>${theme.title} + other themes</h3>
            <span class="card-mix-sub">Play as a mashup</span>
          </a>
          ${relatedThemes.map(item => `
            <a class="card" href="survival.html?theme=${item.slug}">
              <h3>${item.title}</h3>
            </a>
          `).join("")}
        </div>
      </div>
    `;

    if (typeof recordSurvival === "function") recordSurvival(theme.slug, state.score);

    const pbKey = `epSurvivalBest_${theme.slug}`;
    const prevBest = parseInt(localStorage.getItem(pbKey) || "0", 10);
    const isNewPB = state.score > prevBest;
    if (isNewPB) localStorage.setItem(pbKey, state.score);
    const nearEnd    = state.currentIndex >= Math.ceil(state.questions.length * 0.75);
    const notifyHtml = (isNewPB && nearEnd) ? buildNotifyCard(theme.title, true, "survival") : "";

    resultBox.innerHTML = `
      <h2>Survival Over</h2>
      <p>${isNewPB ? "🏆 New personal best! " : ""}Your score: <strong>${state.score}</strong></p>
      <div id="lbSubmitPlaceholder"></div>
      <div class="cta-row">
        <a class="primary-btn" href="survival.html?theme=${theme.slug}">Play Again</a>
        ${!isPremiumUser() ? `<a class="secondary-btn" href="remove-ads.html?theme=${theme.slug}">Unlimited Lifelines</a>` : ""}
        <a class="secondary-btn" href="contact.html">Report a Question</a>
      </div>
      ${notifyHtml}
      <div class="result-theme-search">
        <p class="result-theme-search-title">Try another theme</p>
        <div class="search-wrap">
          <input id="survivalResultThemeSearchInput" class="theme-search-input" type="text" placeholder="Search themes..." autocomplete="off" />
          <div id="survivalResultThemeSearchResults" class="search-results"></div>
        </div>
        ${relatedThemesHtml}
      </div>
    `;


    // Leaderboard submit section (new PB only, score > 0)
    if (isNewPB && state.score > 0 && typeof lbShowSubmit === "function") {
      const placeholder = document.getElementById("lbSubmitPlaceholder");
      if (placeholder) lbShowSubmit(theme.slug, theme.title, state.score, placeholder);
    }

    const resultSearchInput = document.getElementById("survivalResultThemeSearchInput");
    const resultSearchResults = document.getElementById("survivalResultThemeSearchResults");

    if (resultSearchInput && resultSearchResults) {
      const renderThemeResults = (items) => {
        if (!items.length) {
          resultSearchResults.innerHTML = '<div class="search-item">No results found</div>';
          return;
        }
        resultSearchResults.innerHTML = items.map(item => `
          <a class="search-item" href="survival.html?theme=${item.slug}">${item.title}</a>
        `).join("");
      };

      resultSearchInput.addEventListener("focus", () => {
        renderThemeResults(themes);
        resultSearchResults.style.display = "block";
      });

      resultSearchInput.addEventListener("input", (e) => {
        const value = e.target.value.trim().toLowerCase();
        const filtered = themes.filter(item => item.title.toLowerCase().includes(value));
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
      if (typeof showInstallCard === "function") showInstallCard();
    }, 800);

    if (notifyHtml) wireNotifyCard(theme.title, "survival");
    if (typeof maybeShowPwaPopup === "function" && maybeShowPwaPopup()) return;
  }

  function maybeStartRecovery() {
    if (!state.fiftyAvailable && !state.friendAvailable && !state.recoveryStarted && !state.pendingRecoveryStart) {
      state.pendingRecoveryStart = true;
      state.recoveryStage = 0;
      state.recoveryPoints = 0;
    }
  }

  function handleRecoveryOnCorrect(questionDifficulty) {
    const points = pointsMap[questionDifficulty] || 1;
    if (!state.recoveryStarted) return null;

    state.recoveryPoints += points;

    if (state.recoveryStage === 0 && state.recoveryPoints >= 25) {
      state.fiftyAvailable = true;
      state.recoveryStage = 1;
      return "50-50 regained.";
    }

    if (state.recoveryStage === 1 && state.recoveryPoints >= 50) {
      state.friendAvailable = true;
      state.recoveryStage = 2;
      return "Call a Friend regained.";
    }

    return null;
  }

  function showQuestion(index) {
    const prev = slidesContainer.querySelector(".question-slide.active");
    if (prev) {
      prev.classList.remove("active");
      prev.classList.add("answered");
      if (ONE_PER_PAGE_SURVIVAL) prev.style.display = "none";
    }
    const slide = slidesContainer.querySelector(`.question-slide[data-index="${index}"]`);
    if (slide) {
      slide.classList.add("active");
      if (ONE_PER_PAGE_SURVIVAL) slide.style.display = "block";
      slide.scrollIntoView({ behavior: "smooth", block: "start" });
      currentSubmitBtn = slide.querySelector(".slide-submit-btn");
      currentNextBtn = slide.querySelector(".slide-next-btn");
      scoreEl = slide.querySelector(".slide-score-text");
      streakEl = slide.querySelector(".slide-streak-text");
      sharedFeedbackEl = slide.querySelector(".slide-feedback");
      fiftyBtn = slide.querySelector(".slide-fifty-btn");
      friendBtn = slide.querySelector(".slide-friend-btn");
      fiftyBtn.onclick = useFiftyFifty;
      friendBtn.onclick = useCallFriend;
    }

    state.selectedAnswer = null;
    state.answerLocked = false;
    if (currentSubmitBtn) currentSubmitBtn.disabled = false;
    if (currentNextBtn) currentNextBtn.style.display = "none";
    setFeedback("");

    if (state.pendingRecoveryStart) {
      state.pendingRecoveryStart = false;
      state.recoveryStarted = true;
      state.recoveryPoints = 0;
    }

    if (isPremiumUser()) {
      state.fiftyAvailable = true;
      state.friendAvailable = true;
    }

    updateTopbar();
  }

  function handleWrongAnswer() {
    const slide = getCurrentSlide();
    const selectedBtn = slide ? slide.querySelector(".option-btn.selected") : null;

    state.gameOver = true;
    state.answerLocked = true;
    if (currentSubmitBtn) currentSubmitBtn.disabled = true;
    if (typeof SoundFX !== 'undefined') SoundFX.play('wrong');

    if (selectedBtn) {
      selectedBtn.classList.remove("correct-anim");
      void selectedBtn.offsetWidth;
      selectedBtn.classList.add("wrong-anim");
    }

    setFeedback("Wrong. Run over.", "wrong");
    updateTopbar();

    setTimeout(() => renderResult(), 500);
  }

  function handleCorrectAnswer() {
    const q = getCurrentQuestion();
    const difficulty = normalizeDiff(q.difficulty);
    const points = pointsMap[difficulty] || 1;
    const slide = getCurrentSlide();
    const selectedBtn = slide ? slide.querySelector(".option-btn.selected") : null;

    state.score += points;
    state.answerLocked = true;
    if (currentSubmitBtn) currentSubmitBtn.disabled = true;
    if (currentNextBtn) currentNextBtn.style.display = "inline-block";
    if (typeof SoundFX !== 'undefined') SoundFX.play('correct');

    if (selectedBtn) {
      selectedBtn.classList.remove("wrong-anim");
      void selectedBtn.offsetWidth;
      selectedBtn.classList.add("correct-anim");
    }

    const recoveryMessage = handleRecoveryOnCorrect(difficulty);
    setFeedback(
      recoveryMessage
        ? `Correct. +${points} point(s). ${recoveryMessage}`
        : `Correct. +${points} point(s).`,
      "correct"
    );

    updateTopbar();
  }

  function useFiftyFifty() {
    if (state.answerLocked || state.gameOver) return;
    if (!state.fiftyAvailable) {
      if (typeof isInApp === 'function' && isInApp()) _offerRewardedLifeline('50/50', () => { state.fiftyAvailable = true; useFiftyFifty(); });
      return;
    }

    const q = getCurrentQuestion();
    const slide = getCurrentSlide();
    const buttons = slide ? [...slide.querySelectorAll(".option-btn")] : [];
    const wrongButtons = buttons.filter(btn => btn.textContent !== q.answer && btn.style.display !== "none");
    shuffle(wrongButtons).slice(0, 2).forEach(btn => { btn.style.display = "none"; });

    state.fiftyAvailable = false;

    if (state.recoveryStarted && state.recoveryStage === 1) {
      state.recoveryStarted = false;
      state.recoveryPoints = 0;
      state.recoveryStage = 0;
      state.pendingRecoveryStart = true;
      setFeedback("Recovery streak broken. It will restart on the next question.", "wrong");
    }

    maybeStartRecovery();
    updateTopbar();
  }

  function useCallFriend() {
    if (state.answerLocked || state.gameOver) return;
    if (!state.friendAvailable) {
      if (typeof isInApp === 'function' && isInApp()) _offerRewardedLifeline('Call a Friend', () => { state.friendAvailable = true; useCallFriend(); });
      return;
    }

    const q = getCurrentQuestion();
    state.friendAvailable = false;
    setFeedback(`Call a Friend: The answer is ${q.answer}`, "correct");

    maybeStartRecovery();
    updateTopbar();
  }

  document.querySelectorAll(".difficulty-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      state.difficulty = btn.dataset.difficulty;

      const [allQuestions, fetchedTopScore] = await Promise.all([
        fetchJSON(theme.questionFile),
        (typeof lbTopScore === "function") ? lbTopScore(theme.slug) : Promise.resolve(null)
      ]);
      const allowedDifficulties = difficultyMap[state.difficulty];

      state.questions = shuffle(
        allQuestions.filter(q => allowedDifficulties.includes(normalizeDiff(q.difficulty)))
      ).map(q => shuffleQuestionOptions(q));

      state.currentIndex = 0;
      state.selectedAnswer = null;
      state.score = 0;
      state.gameOver = false;
      state.fiftyAvailable = true;
      state.friendAvailable = true;
      state.recoveryStage = 0;
      state.recoveryPoints = 0;
      state.recoveryStarted = false;
      state.pendingRecoveryStart = false;
      state.answerLocked = false;
      state.topScore = fetchedTopScore;

      slidesContainer.innerHTML = "";

      state.questions.forEach((q, index) => {
        const slide = document.createElement("div");
        slide.className = "question-slide";
        slide.dataset.index = index;

        const qNum = document.createElement("p");
        qNum.className = "slide-question-num";
        qNum.textContent = `Question ${index + 1}`;

        const qText = document.createElement("h2");
        qText.textContent = q.question;

        const optsList = document.createElement("div");
        optsList.className = "options";

        q.options.forEach(option => {
          const optBtn = document.createElement("button");
          optBtn.className = "option-btn";
          optBtn.textContent = option;
          optBtn.addEventListener("click", () => {
            if (state.answerLocked || state.gameOver) return;
            if (state.currentIndex !== index) return;
            state.selectedAnswer = option;
            optsList.querySelectorAll(".option-btn").forEach(b => {
              b.classList.remove("selected", "correct-anim", "wrong-anim");
            });
            optBtn.classList.add("selected");
          });
          optsList.appendChild(optBtn);
        });

        const submitBtn = document.createElement("button");
        submitBtn.className = "slide-submit-btn secondary-btn";
        submitBtn.textContent = "Submit";

        const nextBtn = document.createElement("button");
        nextBtn.className = "slide-next-btn secondary-btn";
        nextBtn.textContent = "Next";
        nextBtn.style.display = "none";

        submitBtn.addEventListener("click", () => {
          if (state.gameOver || state.answerLocked) return;
          if (!state.selectedAnswer) return;
          if (state.currentIndex !== index) return;

          const q = getCurrentQuestion();
          if (state.selectedAnswer === q.answer) {
            handleCorrectAnswer();
          } else {
            handleWrongAnswer();
          }
        });

        nextBtn.addEventListener("click", () => {
          if (state.gameOver) { renderResult(); return; }
          state.currentIndex += 1;
          if (state.currentIndex >= state.questions.length) {
            renderResult();
          } else {
            showQuestion(state.currentIndex);
          }
        });

        const lifelinesDiv = document.createElement("div");
        lifelinesDiv.className = "survival-lifelines";

        const slideFFBtn = document.createElement("button");
        slideFFBtn.className = "secondary-btn slide-fifty-btn";
        slideFFBtn.textContent = "50-50";

        const slideFriendBtn = document.createElement("button");
        slideFriendBtn.className = "secondary-btn slide-friend-btn";
        slideFriendBtn.textContent = "Call a Friend";

        lifelinesDiv.appendChild(slideFFBtn);
        lifelinesDiv.appendChild(slideFriendBtn);

        const metaRow = document.createElement("div");
        metaRow.className = "episode-context survival-meta-row";
        const scoreP = document.createElement("p");
        scoreP.innerHTML = "<strong>Score:</strong> <span class='slide-score-text'>0</span>";
        const topP = document.createElement("p");
        topP.innerHTML = `<strong>Best:</strong> <span class='slide-top-text'>${state.topScore !== null ? state.topScore : "—"}</span>`;
        const streakP = document.createElement("p");
        streakP.innerHTML = "<strong>Recovery Streak:</strong> <span class='slide-streak-text'>Not started</span>";
        metaRow.appendChild(scoreP);
        metaRow.appendChild(topP);
        metaRow.appendChild(streakP);

        const slideFeedback = document.createElement("p");
        slideFeedback.className = "feedback slide-feedback";

        const ctaRow = document.createElement("div");
        ctaRow.className = "cta-row";
        ctaRow.style.marginTop = "1.5rem";
        ctaRow.appendChild(submitBtn);
        ctaRow.appendChild(nextBtn);

        slide.appendChild(qNum);
        slide.appendChild(qText);
        slide.appendChild(optsList);
        slide.appendChild(lifelinesDiv);
        slide.appendChild(metaRow);
        slide.appendChild(slideFeedback);
        slide.appendChild(ctaRow);
        slidesContainer.appendChild(slide);
      });

      difficultyBox.style.display = "none";
      gameBox.style.display = "block";
      resultBox.style.display = "none";

      if (ONE_PER_PAGE_SURVIVAL) {
        slidesContainer.querySelectorAll(".question-slide").forEach(s => {
          s.style.display = "none";
        });
      }

      showQuestion(0);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "survival") {
    renderSurvivalPage();
  }
});
