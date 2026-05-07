async function renderSurvivalPage() {
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
    answerLocked: false
  };

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

    fiftyBtn.disabled = !state.fiftyAvailable || state.answerLocked || state.gameOver;
    friendBtn.disabled = !state.friendAvailable || state.answerLocked || state.gameOver;

    fiftyBtn.textContent = state.fiftyAvailable ? "50-50" : "50-50 Used";
    friendBtn.textContent = state.friendAvailable ? "Call a Friend" : "Friend Used";

    fiftyBtn.classList.toggle("used-lifeline", !state.fiftyAvailable);
    friendBtn.classList.toggle("used-lifeline", !state.friendAvailable);
  }

  function renderResult() {
    gameBox.style.display = "none";
    resultBox.style.display = "block";
    resultBox.classList.remove("result-anim");
    void resultBox.offsetWidth;
    resultBox.classList.add("result-anim");

    const relatedThemes = getRelatedThemes(themes, theme, 5);

    const relatedThemesHtml = relatedThemes.length ? `
      <div class="theme-related-quizzes">
        <h3>Related Quizzes</h3>
        <div class="grid">
          ${relatedThemes.map(item => `
            <a class="card" href="survival.html?theme=${item.slug}">
              <h3>${item.title}</h3>
            </a>
          `).join("")}
        </div>
      </div>
    ` : "";

    resultBox.innerHTML = `
      <h2>Survival Over</h2>
      <p>Your score: ${state.score}</p>
      <div class="cta-row">
        <a class="primary-btn" href="survival.html?theme=${theme.slug}">Play Again</a>
        ${isPremiumUser() ? '' : `<a class="secondary-btn" href="remove-ads.html?theme=${theme.slug}">Unlimited Lifelines</a>`}
        <a class="secondary-btn" href="contact.html">Report a Question</a>
      </div>
      <div class="result-theme-search">
        <p class="result-theme-search-title">Try another theme</p>
        <div class="search-wrap">
          <input id="survivalResultThemeSearchInput" class="theme-search-input" type="text" placeholder="Search themes..." autocomplete="off" />
          <div id="survivalResultThemeSearchResults" class="search-results"></div>
        </div>
        ${relatedThemesHtml}
      </div>
    `;

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

    if (typeof maybeShowPwaPopup === "function" && maybeShowPwaPopup()) return;
    maybeShowEmailPopup(theme.slug, theme.title, state.score);
  }

  function maybeShowEmailPopup(themeSlug, themeName, currentScore) {
    if (!emailPopupDismissAllowed()) return;
    const key = `epSurvivalBest_${themeSlug}`;
    const prevBest = parseInt(localStorage.getItem(key) || "0", 10);
    if (currentScore <= prevBest) return;
    localStorage.setItem(key, currentScore);
    showEmailPopupUI(themeName);
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
    if (!state.fiftyAvailable || state.answerLocked || state.gameOver) return;

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
    if (!state.friendAvailable || state.answerLocked || state.gameOver) return;

    const q = getCurrentQuestion();
    state.friendAvailable = false;
    setFeedback(`Call a Friend: The answer is ${q.answer}`, "correct");

    maybeStartRecovery();
    updateTopbar();
  }

  document.querySelectorAll(".difficulty-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      state.difficulty = btn.dataset.difficulty;

      const allQuestions = await fetchJSON(theme.questionFile);
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
        const streakP = document.createElement("p");
        streakP.innerHTML = "<strong>Recovery Streak:</strong> <span class='slide-streak-text'>Not started</span>";
        metaRow.appendChild(scoreP);
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
