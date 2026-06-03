async function renderMultiThemeChallenge() {
  const params = new URLSearchParams(window.location.search);
  const slugs = (params.get("themes") || "").split(",").map(s => s.trim()).filter(Boolean);
  if (slugs.length < 2) { window.location.href = "mashup.html"; return; }

  const allThemeMeta = await loadThemes();
  const selectedThemes = slugs.map(slug => allThemeMeta.find(t => t.slug === slug)).filter(Boolean);
  if (selectedThemes.length < 2) { window.location.href = "mashup.html"; return; }

  const themesParam = selectedThemes.map(t => t.slug).join(",");
  const colorBySlug = {};
  selectedThemes.forEach((t, i) => { colorBySlug[t.slug] = MASHUP_BADGE_COLORS[i % MASHUP_BADGE_COLORS.length]; });

  document.title = selectedThemes.map(t => t.title).join(" + ") + " — Challenge | Trivia Gauntlet";
  if (typeof gtag === "function") gtag("event", "page_view", { page_title: document.title, page_location: window.location.href });
  if (typeof addNoIndex === "function") addNoIndex();

  const questionsByTheme = {};
  await Promise.all(selectedThemes.map(async theme => {
    try { questionsByTheme[theme.slug] = (await fetchJSON(theme.questionFile)) || []; }
    catch(e) { questionsByTheme[theme.slug] = []; }
  }));

  const ROUND_SIZE = 10;
  const rawRound = parseInt(params.get("round") || "1", 10);
  const currentRound = isNaN(rawRound) || rawRound < 1 ? 1 : rawRound;

  const sessionKey = slugs.slice().sort().join(",");
  let isReplay = getParam("replay") === "1";

  let pools, totalRounds, safeRound, roundQuestions;
  if (isReplay) {
    try {
      const replayData = JSON.parse(localStorage.getItem("tg_replay") || "null");
      if (replayData && replayData.mashupKey === sessionKey && replayData.questions && replayData.questions.length) {
        roundQuestions = replayData.questions.map(q => shuffleQuestionOptions(q));
        totalRounds = 1; safeRound = 1;
        if (typeof gtag === "function") gtag("event", "wrong_answers_replayed", { theme: sessionKey, count: replayData.questions.length });
      } else { isReplay = false; }
    } catch { isReplay = false; }
  }
  if (!isReplay) {
    pools = buildMashupPools(selectedThemes, questionsByTheme);
    totalRounds = calcMashupTotalBatches(pools, ROUND_SIZE);
    safeRound = Math.min(currentRound, totalRounds);
    roundQuestions = sliceFromMashupPools(pools, ROUND_SIZE, safeRound - 1).map(q => shuffleQuestionOptions(q));
  }

  const themeScores = {};
  selectedThemes.forEach(t => { themeScores[t.slug] = { correct: 0, total: 0 }; });
  roundQuestions.forEach(q => { if (themeScores[q._themeSlug]) themeScores[q._themeSlug].total++; });

  const roundEl = document.getElementById("challengeRoundText");
  const slidesContainer = document.getElementById("challengeSlides");
  const scoreEl = document.getElementById("challengeScoreText");
  const quizBox = document.getElementById("challengeQuizBox");
  const resultBox = document.getElementById("challengeResultBox");
  const nextRoundLink = document.getElementById("challengeNextRoundLink");

  if (roundEl) roundEl.textContent = `Round ${safeRound}`;
  if (nextRoundLink) {
    if (safeRound < totalRounds) {
      nextRoundLink.style.display = "inline-block";
      nextRoundLink.textContent = "Skip to next round";
      nextRoundLink.href = `challenge.html?themes=${themesParam}&round=${safeRound + 1}`;
    } else { nextRoundLink.style.display = "none"; }
  }

  let score = 0, currentIndex = 0, revealAnswers = false;
  const wrongQuestions = [];

  function showQuestion(index) {
    const prev = slidesContainer.querySelector(".question-slide.active");
    if (prev) { prev.classList.remove("active"); prev.classList.add("answered"); prev.style.display = "none"; }
    const slide = slidesContainer.querySelector(`.question-slide[data-index="${index}"]`);
    if (slide) { slide.classList.add("active"); slide.style.display = "block"; slide.scrollIntoView({ behavior: "smooth", block: "start" }); }
    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
  }

  if (isPremiumUser()) {
    const revealBtnMashup = document.createElement("button");
    revealBtnMashup.className = "secondary-btn reveal-answers-toggle";
    revealBtnMashup.textContent = "Reveal Answers: OFF";
    revealBtnMashup.addEventListener("click", () => {
      revealAnswers = !revealAnswers;
      revealBtnMashup.className = revealAnswers ? "primary-btn reveal-answers-toggle" : "secondary-btn reveal-answers-toggle";
      revealBtnMashup.textContent = revealAnswers ? "Reveal Answers: ON" : "Reveal Answers: OFF";
    });
    if (quizBox) quizBox.insertBefore(revealBtnMashup, slidesContainer);
  }

  roundQuestions.forEach((q, index) => {
    const slug = q._themeSlug;
    const themeName = (selectedThemes.find(t => t.slug === slug) || {}).title || slug;
    const slide = document.createElement("div");
    slide.className = "question-slide";
    slide.dataset.index = index;
    const qNum = document.createElement("p");
    qNum.className = "slide-question-num";
    qNum.textContent = `Question ${index + 1} of ${roundQuestions.length}`;
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
      if (scoreEl) scoreEl.textContent = `Score: ${score}`;
      submitBtn.disabled = true; nextBtn.style.display = "inline-block";
    });
    nextBtn.addEventListener("click", () => {
      currentIndex++;
      if (currentIndex >= roundQuestions.length) renderResult();
      else showQuestion(currentIndex);
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
    quizBox.style.display = "none";
    resultBox.style.display = "block";
    resultBox.classList.remove("result-anim"); void resultBox.offsetWidth; resultBox.classList.add("result-anim");
    const hasNextRound = safeRound < totalRounds;
    if (!isReplay && typeof saveSession === "function") saveSession("challenge", sessionKey, safeRound, score, roundQuestions.length);
    if (typeof recordMashupStats === "function") {
      recordMashupStats(sessionKey, "challenge", { correct: score, answered: roundQuestions.length, round: safeRound, totalRounds });
    }
    let wrongCount = 0;
    if (isReplay) {
      localStorage.removeItem("tg_replay");
    } else {
      let bank = [];
      try {
        const raw = localStorage.getItem("tg_replay");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.mode === "challenge" && parsed.mashupKey === sessionKey) bank = parsed.questions || [];
        }
      } catch {}
      if (wrongQuestions.length) {
        const merged = [...bank, ...wrongQuestions].filter((q, i, arr) => arr.findIndex(x => x.question === q.question) === i);
        localStorage.setItem("tg_replay", JSON.stringify({ mode: "challenge", mashupKey: sessionKey, questions: merged }));
        wrongCount = merged.length;
      } else {
        wrongCount = bank.length;
      }
    }
    const replayHtml = wrongCount > 0
      ? `<div class="wrong-replay-row">You have ${wrongCount} wrong answer${wrongCount !== 1 ? "s" : ""} &mdash; <a href="challenge.html?themes=${themesParam}&replay=1">Replay them all</a></div>`
      : "";
    resultBox.innerHTML = `
      <h2>Round ${safeRound} Complete</h2>
      <p>Your score: ${score} / ${roundQuestions.length}</p>
      <div id="mashupChallengeBreakdown"></div>
      <div class="cta-row">
        ${hasNextRound ? `<a class="primary-btn" href="challenge.html?themes=${themesParam}&round=${safeRound + 1}" data-rewarded-href="challenge.html?themes=${themesParam}&round=${safeRound + 1}">Next Round</a>` : ""}
        ${!isPremiumUser() ? `<a class="secondary-btn" href="remove-ads.html">Reveal Answers</a>` : ""}
        <a class="secondary-btn" href="contact.html">Report a Question</a>
      </div>
      ${replayHtml}
      <div class="result-theme-search">
        <p class="result-theme-search-title">Try another theme</p>
        <div class="search-wrap">
          <input id="mashupChallengeSearchInput" class="theme-search-input" type="text" placeholder="Search themes..." autocomplete="off" />
          <div id="mashupChallengeSearchResults" class="search-results"></div>
        </div>
      </div>
      <div id="mashupChallengeAdSlot"></div>
      <div class="theme-related-quizzes">
        <h3>Play these themes individually</h3>
        <div class="grid">
          ${selectedThemes.map(t => `<a class="card" href="challenge.html?theme=${t.slug}&round=1"><h3>${t.title}</h3></a>`).join("")}
        </div>
      </div>
    `;
    document.getElementById("mashupChallengeBreakdown").appendChild(renderMashupThemeBreakdown(themeScores, selectedThemes, colorBySlug));
    injectMashupResultAd(document.getElementById("mashupChallengeAdSlot"));
    const msInput = document.getElementById("mashupChallengeSearchInput");
    const msResults = document.getElementById("mashupChallengeSearchResults");
    if (msInput && msResults) {
      const renderSearch = items => {
        msResults.innerHTML = items.length ? items.map(t => `<a class="search-item" href="challenge.html?theme=${t.slug}&round=1">${t.title}</a>`).join("") : '<div class="search-item">No results found</div>';
      };
      msInput.addEventListener("focus", () => { renderSearch(allThemeMeta); msResults.style.display = "block"; });
      msInput.addEventListener("input", e => { renderSearch(allThemeMeta.filter(t => t.title.toLowerCase().includes(e.target.value.trim().toLowerCase()))); msResults.style.display = "block"; });
      document.addEventListener("click", e => { if (!msInput.contains(e.target) && !msResults.contains(e.target)) msResults.style.display = "none"; });
    }
  }

  if (!isReplay && currentRound === 1 && typeof getSession === "function") {
    const saved = getSession("challenge", sessionKey);
    if (saved && saved.round < totalRounds) {
      quizBox.style.display = "none";
      resultBox.style.display = "block";
      let replayCount = 0;
      try {
        const raw = localStorage.getItem("tg_replay");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.mode === "challenge" && parsed.mashupKey === sessionKey)
            replayCount = (parsed.questions || []).length;
        }
      } catch {}
      const replayHtml = replayCount > 0
        ? `<div class="wrong-replay-row">You have ${replayCount} wrong answer${replayCount !== 1 ? "s" : ""} accumulated &mdash; <a href="challenge.html?themes=${themesParam}&replay=1">Replay them all</a></div>`
        : "";
      resultBox.innerHTML = `
        <h2>Round ${saved.round} Complete</h2>
        <p>Your score: ${saved.score} / ${saved.total}</p>
        <div class="cta-row">
          <a class="primary-btn" id="mashupContinueBtn" href="challenge.html?themes=${themesParam}&round=${saved.round + 1}">Continue to Round ${saved.round + 1}</a>
          <button class="secondary-btn" id="mashupRound1Btn">Start from Round 1</button>
        </div>
        ${replayHtml}`;
      document.getElementById("mashupContinueBtn").addEventListener("click", () => {
        if (typeof gtag === "function") gtag("event", "session_resumed", { theme: sessionKey, round: saved.round + 1 });
      });
      document.getElementById("mashupRound1Btn").addEventListener("click", () => {
        if (typeof gtag === "function") gtag("event", "session_reset", { theme: sessionKey });
        if (typeof clearSession === "function") clearSession("challenge", sessionKey);
        localStorage.removeItem("tg_replay");
        resultBox.style.display = "none";
        resultBox.innerHTML = "";
        quizBox.style.display = "block";
        showQuestion(0);
      });
      return;
    }
  }

  showQuestion(0);
}

async function renderChallengePage() {
  if (getParam("themes")) { await renderMultiThemeChallenge(); return; }
  const slug = getParam("theme");
  const themes = await loadThemes();
  const theme = themes.find(t => t.slug === slug);

  const roundEl = document.getElementById("challengeRoundText");
  const progressEl = document.getElementById("challengeProgressText");
  const slidesContainer = document.getElementById("challengeSlides");
  const scoreEl = document.getElementById("challengeScoreText");
  const quizBox = document.getElementById("challengeQuizBox");
  const resultBox = document.getElementById("challengeResultBox");
  const nextRoundLink = document.getElementById("challengeNextRoundLink");

  if (!theme) {
    slidesContainer.textContent = "Theme not found";
    return;
  }

  document.title = `${theme.title} Challenge Mode - Trivia Gauntlet`;
  if (typeof setCanonical === "function") setCanonical(`${window.location.origin}/themes/${theme.slug}.html`);
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', `Play ${theme.title} trivia in Challenge Mode on Trivia Gauntlet. 30 questions per round across multiple rounds.`);

  if (typeof gtag === "function") {
    gtag("event", "page_view", {
      page_title: `Challenge Mode - ${theme.title}`,
      page_location: window.location.href
    });
  }

  if (typeof updateRemoveAdsFooter === "function") {
    updateRemoveAdsFooter(theme.slug, "normal");
  }

  let buyPackUrl = "https://ko-fi.com/triviaking/shop";

  try {
    const normalPackLinks = await fetchJSON("data/normal_pack_links.json");
    buyPackUrl = normalPackLinks[theme.title] || buyPackUrl;
  } catch (e) {
    buyPackUrl = "https://ko-fi.com/triviaking/shop";
  }

  let affiliateProducts = null;

  try {
    const affiliateLinks = await fetchJSON("data/affiliate_links.json");
    const raw = affiliateLinks[theme.title];
    if (raw) {
      affiliateProducts = Array.isArray(raw) ? raw : [raw];
    }
  } catch (e) {
    affiliateProducts = null;
  }

  const ROUND_SIZE = 10;
  const rawRound = parseInt(getParam("round") || "1", 10);
  const currentRound = Number.isNaN(rawRound) || rawRound < 1 ? 1 : rawRound;

  let isReplay = getParam("replay") === "1";
  let totalRounds, safeRound, shuffledQuestions;

  if (isReplay) {
    try {
      const rd = JSON.parse(localStorage.getItem("tg_replay") || "null");
      if (rd && rd.questions && rd.questions.length) {
        shuffledQuestions = rd.questions.map(q => shuffleQuestionOptions(q));
        totalRounds = 1;
        safeRound = 1;
        if (typeof gtag === "function") gtag("event", "wrong_answers_replayed", { theme: theme.slug, count: rd.questions.length });
      } else { isReplay = false; }
    } catch { isReplay = false; }
  }

  if (!isReplay) {
    const allQuestions = await fetchJSON(theme.questionFile);
    const allRounds = buildBalancedBatches(allQuestions, ROUND_SIZE, 5, 5);

    const challengeSeen = new Set();
    let challengeHasDuplicates = false;
    allRounds.forEach((rq, ri) => {
      rq.forEach((q, qi) => {
        const key = `${q.question}||${q.answer}`;
        if (challengeSeen.has(key)) {
          challengeHasDuplicates = true;
          console.warn(`Duplicate found in challenge: round ${ri + 1}, question ${qi + 1}`, q);
        }
        challengeSeen.add(key);
      });
    });
    console.log("Challenge duplicate check:", challengeHasDuplicates ? "DUPLICATES FOUND" : "NO DUPLICATES");

    totalRounds = allRounds.length;
    safeRound = Math.min(currentRound, totalRounds);
    shuffledQuestions = (allRounds[safeRound - 1] || []).map(q => shuffleQuestionOptions(q));
  }

  if (nextRoundLink) {
    if (!isReplay && safeRound < totalRounds) {
      nextRoundLink.style.display = "inline-block";
      nextRoundLink.textContent = "Skip to next round";
      nextRoundLink.href = `challenge.html?theme=${theme.slug}&round=${safeRound + 1}`;
    } else {
      nextRoundLink.style.display = "none";
    }
  }

  let showContinuePrompt = false;

  if (!isReplay && currentRound === 1 && typeof getSession === "function") {
    const saved = getSession("challenge", theme.slug);
    if (saved && saved.round < totalRounds) {
      showContinuePrompt = true;
      quizBox.style.display = "none";
      resultBox.style.display = "block";

      let replayCount = 0;
      try {
        const raw = localStorage.getItem("tg_replay");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.mode === "challenge" && parsed.themeSlug === theme.slug)
            replayCount = (parsed.questions || []).length;
        }
      } catch {}

      const replayHtml = replayCount > 0
        ? `<div class="wrong-replay-row">You have ${replayCount} wrong answer${replayCount !== 1 ? "s" : ""} accumulated &mdash; <a href="challenge.html?theme=${theme.slug}&replay=1">Replay them all</a></div>`
        : "";

      resultBox.innerHTML = `
        <h2>Round ${saved.round} Complete</h2>
        <p>Your score: ${saved.score} / ${saved.total}</p>
        <div class="cta-row">
          <a class="primary-btn" id="continueRoundBtn" href="challenge.html?theme=${theme.slug}&round=${saved.round + 1}">Continue to Round ${saved.round + 1}</a>
          <button class="secondary-btn" id="startRound1Btn">Start from Round 1</button>
        </div>
        ${replayHtml}`;

      document.getElementById("continueRoundBtn").addEventListener("click", () => {
        if (typeof gtag === "function") gtag("event", "session_resumed", { theme: theme.slug, round: saved.round + 1 });
      });

      document.getElementById("startRound1Btn").addEventListener("click", () => {
        if (typeof gtag === "function") gtag("event", "session_reset", { theme: theme.slug });
        if (typeof clearSession === "function") clearSession("challenge", theme.slug);
        localStorage.removeItem("tg_replay");
        resultBox.style.display = "none";
        resultBox.innerHTML = "";
        quizBox.style.display = "block";
        showQuestion(0);
      });
    }
  }

  const state = {
    questions: shuffledQuestions,
    currentIndex: 0,
    score: 0,
    selectedAnswer: null
  };
  const wrongQuestions = [];

  let revealAnswers = false;

  roundEl.textContent = `Round ${safeRound}`;

  function applyDisplayMode() {
    const slides = slidesContainer.querySelectorAll(".question-slide");
    if (ONE_PER_PAGE_CHALLENGE) {
      slides.forEach(s => {
        s.style.display = parseInt(s.dataset.index, 10) === state.currentIndex ? "block" : "none";
      });
    } else {
      slides.forEach(s => {
        s.style.display = "";
      });
      const activeSlide = slidesContainer.querySelector(".question-slide.active");
      if (activeSlide) {
        activeSlide.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  function showQuestion(index) {
    const prev = slidesContainer.querySelector(".question-slide.active");
    if (prev) {
      prev.classList.remove("active");
      prev.classList.add("answered");
      if (ONE_PER_PAGE_CHALLENGE) prev.style.display = "none";
    }
    const slide = slidesContainer.querySelector(`.question-slide[data-index="${index}"]`);
    if (slide) {
      slide.classList.add("active");
      if (ONE_PER_PAGE_CHALLENGE) slide.style.display = "block";
      slide.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    scoreEl.textContent = `Score: ${state.score}`;
    state.selectedAnswer = null;
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
    quizBox.insertBefore(revealToggleBtn, slidesContainer);
  }

  // Render all question slides with their own Submit/Next buttons
  shuffledQuestions.forEach((q, index) => {
    const slide = document.createElement("div");
    slide.className = "question-slide";
    slide.dataset.index = index;

    const qNum = document.createElement("p");
    qNum.className = "slide-question-num";
    qNum.textContent = `Question ${index + 1} of ${shuffledQuestions.length}`;

    const qText = document.createElement("h2");
    qText.textContent = q.question;

    const optsList = document.createElement("div");
    optsList.className = "options";

    q.options.forEach(option => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = option;
      btn.addEventListener("click", () => {
        if (state.currentIndex !== index) return;
        state.selectedAnswer = option;
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
      if (state.currentIndex !== index || !state.selectedAnswer) return;

      const selectedBtn = optsList.querySelector(".option-btn.selected");

      if (state.selectedAnswer === q.answer) {
        state.score += 1;
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

      scoreEl.textContent = `Score: ${state.score}`;
      submitBtn.disabled = true;
      nextBtn.style.display = "inline-block";
    });

    nextBtn.addEventListener("click", () => {
      state.currentIndex += 1;
      if (state.currentIndex >= state.questions.length) {
        renderResult();
      } else {
        showQuestion(state.currentIndex);
      }
    });

    slide.appendChild(qNum);
    slide.appendChild(qText);
    slide.appendChild(optsList);
    slide.appendChild(feedbackP);
    slide.appendChild(ctaRow);
    slidesContainer.appendChild(slide);
  });

  // Hide all slides upfront in one-per-page mode; showQuestion(0) will reveal the first
  if (ONE_PER_PAGE_CHALLENGE) {
    slidesContainer.querySelectorAll(".question-slide").forEach(s => {
      s.style.display = "none";
    });
  }

  function renderResult() {
    quizBox.style.display = "none";
    resultBox.style.display = "block";
    resultBox.classList.remove("result-anim");
    void resultBox.offsetWidth;
    resultBox.classList.add("result-anim");

    const hasNextRound = safeRound < totalRounds;
    const roundLink = `${window.location.origin}${window.location.pathname}?theme=${encodeURIComponent(theme.slug)}&round=${safeRound}`;

    const affiliateHtml = affiliateProducts && affiliateProducts.length ? `
      <div class="affiliate-box">
        <p class="affiliate-label">Recommended for Fans</p>
        ${affiliateProducts.map(item => `
          <a class="affiliate-card" href="${item.url}" target="_blank" rel="noopener noreferrer sponsored">
            <strong>${item.title}</strong>
          </a>
        `).join("")}
        <p class="affiliate-disclaimer">
          Affiliate link — I may earn a commission from qualifying purchases.
        </p>
      </div>
    ` : "";

    const relatedThemes = getRelatedThemes(themes, theme, 4);

    const relatedThemesHtml = `
      <div class="theme-related-quizzes">
        <h3>Related Quizzes</h3>
        <div class="grid">
          <a class="card card-mix" href="mashup.html?preset=${theme.slug}&mode=challenge">
            <h3>${theme.title} + other themes</h3>
            <span class="card-mix-sub">Play as a mashup</span>
          </a>
          ${relatedThemes.map(item => `
            <a class="card" href="challenge.html?theme=${item.slug}&round=1">
              <h3>${item.title}</h3>
            </a>
          `).join("")}
        </div>
      </div>
    `;

    const wrongCount = (typeof recordChallenge === "function")
      ? recordChallenge(theme.slug, state.score, state.questions.length, wrongQuestions, isReplay, safeRound, totalRounds)
      : wrongQuestions.length;

    if (!isReplay && typeof saveSession === "function") saveSession("challenge", theme.slug, safeRound, state.score, state.questions.length);

    const replayHtml = wrongCount > 0
      ? `<div class="wrong-replay-row">You have ${wrongCount} wrong answer${wrongCount !== 1 ? "s" : ""} &mdash; <a href="challenge.html?theme=${theme.slug}&replay=1">Replay them all</a></div>`
      : "";

    const notifyHtml = (!hasNextRound && !isReplay) ? buildNotifyCard(theme.title, false, "challenge") : "";

    resultBox.innerHTML = `
      <h2>Round ${safeRound} Complete</h2>
      <p>Your score: ${state.score} / ${state.questions.length}</p>
      <p class="challenge-share-text">Send this round link to a friend to play the same 10 questions.</p>
      <div class="challenge-link-box">${roundLink}</div>
      <div class="cta-row">
        ${hasNextRound ? `<a class="primary-btn" href="challenge.html?theme=${theme.slug}&round=${safeRound + 1}" data-rewarded-href="challenge.html?theme=${theme.slug}&round=${safeRound + 1}">Next Round</a>` : ""}
        ${!isPremiumUser() ? `<a class="secondary-btn" href="remove-ads.html?theme=${theme.slug}">Reveal Answers</a>` : ""}
        <a class="secondary-btn" href="contact.html">Report a Question</a>
      </div>
      ${replayHtml}
      ${notifyHtml}
    </div>
      ${affiliateHtml}
      <div class="result-theme-search">
        <p class="result-theme-search-title">Try another theme</p>
        <div class="search-wrap">
          <input id="challengeResultThemeSearchInput" class="theme-search-input" type="text" placeholder="Search themes..." autocomplete="off" />
          <div id="challengeResultThemeSearchResults" class="search-results"></div>
        </div>
        ${relatedThemesHtml}
    `;


    const resultSearchInput = document.getElementById("challengeResultThemeSearchInput");
    const resultSearchResults = document.getElementById("challengeResultThemeSearchResults");

    if (resultSearchInput && resultSearchResults) {
      const renderThemeResults = (items) => {
        if (!items.length) {
          resultSearchResults.innerHTML = '<div class="search-item">No results found</div>';
          return;
        }
        resultSearchResults.innerHTML = items.map(item => `
          <a class="search-item" href="challenge.html?theme=${item.slug}&round=1">${item.title}</a>
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

    if (notifyHtml) wireNotifyCard(theme.title, "challenge");
    if (typeof maybeShowPwaPopup === "function" && maybeShowPwaPopup()) return;
  }

  if (!showContinuePrompt) showQuestion(0);
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "challenge") {
    renderChallengePage();
  }
});
