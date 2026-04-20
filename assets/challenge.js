async function renderChallengePage() {
  const slug = getParam("theme");
  const themes = await loadThemes();
  const theme = themes.find(t => t.slug === slug);

  const roundEl = document.getElementById("challengeRoundText");
  const progressEl = document.getElementById("challengeProgressText");
  const questionEl = document.getElementById("challengeQuestionText");
  const optionsEl = document.getElementById("challengeOptionsList");
  const scoreEl = document.getElementById("challengeScoreText");
  const feedbackEl = document.getElementById("challengeFeedbackText");
  const submitBtn = document.getElementById("challengeSubmitButton");
  const nextBtn = document.getElementById("challengeNextButton");
  const quizBox = document.getElementById("challengeQuizBox");
  const resultBox = document.getElementById("challengeResultBox");
  const nextRoundLink = document.getElementById("challengeNextRoundLink");
  
  if (!theme) {
    questionEl.textContent = "Theme not found";
    return;
  }

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

  let affiliateProduct = null;

try {
  const affiliateLinks = await fetchJSON("data/affiliate_links.json");
  affiliateProduct = affiliateLinks[theme.title] || null;
} catch (e) {
  affiliateProduct = null;
}

  const ROUND_SIZE = 10;
  const rawRound = parseInt(getParam("round") || "1", 10);
  const currentRound = Number.isNaN(rawRound) || rawRound < 1 ? 1 : rawRound;

  const allQuestions = await fetchJSON(theme.questionFile);
  const allRounds = buildBalancedBatches(allQuestions, ROUND_SIZE, 5, 5);
  console.log("CHALLENGE ROUNDS DEBUG");
allRounds.forEach((roundQuestions, roundIndex) => {
  console.log(
    `Round ${roundIndex + 1}`,
    roundQuestions.map(q => ({
      question: q.question,
      difficulty: q.difficulty
    }))
  );
});

const challengeSeen = new Set();
let challengeHasDuplicates = false;

allRounds.forEach((roundQuestions, roundIndex) => {
  roundQuestions.forEach((q, questionIndex) => {
    const key = `${q.question}||${q.answer}`;
    if (challengeSeen.has(key)) {
      challengeHasDuplicates = true;
      console.warn(`Duplicate found in challenge: round ${roundIndex + 1}, question ${questionIndex + 1}`, q);
    }
    challengeSeen.add(key);
  });
});

console.log("Challenge duplicate check:", challengeHasDuplicates ? "DUPLICATES FOUND" : "NO DUPLICATES");
  const totalRounds = allRounds.length;
  const safeRound = Math.min(currentRound, totalRounds);

if (nextRoundLink) {
  if (safeRound < totalRounds) {
    nextRoundLink.style.display = "inline-block";
    nextRoundLink.textContent = "Skip to next round";
    nextRoundLink.href = `challenge.html?theme=${theme.slug}&round=${safeRound + 1}`;
  } else {
    nextRoundLink.style.display = "none";
  }
}

  const roundQuestions = allRounds[safeRound - 1] || [];

  const state = {
    questions: roundQuestions,
    currentIndex: 0,
    score: 0,
    selectedAnswer: null
  };

  roundEl.textContent = `Round ${safeRound}`;

  function setFeedback(text, type = "") {
    feedbackEl.textContent = text;
    feedbackEl.className = "feedback";
    if (type) feedbackEl.classList.add(type);
  }

  function renderQuestion() {
    const q = shuffleQuestionOptions(state.questions[state.currentIndex]);

    feedbackEl.textContent = "";
    feedbackEl.className = "feedback";
    optionsEl.innerHTML = "";
    submitBtn.disabled = false;
    nextBtn.style.display = "none";
    state.selectedAnswer = null;

    progressEl.textContent = `Question ${state.currentIndex + 1} of ${state.questions.length}`;
    scoreEl.textContent = `Score: ${state.score}`;
    questionEl.textContent = q.question;

    q.options.forEach(option => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = option;

btn.addEventListener("click", () => {
  state.selectedAnswer = option;
  document.querySelectorAll("#challengeOptionsList .option-btn").forEach(b => {
    b.classList.remove("selected", "correct-anim", "wrong-anim");
  });
  btn.classList.add("selected");
});

      optionsEl.appendChild(btn);
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

  const affiliateHtml = affiliateProduct ? `
    <div class="affiliate-box">
      <p class="affiliate-label">${affiliateProduct.label || "Recommended for Fans"}</p>
      <a class="affiliate-card" href="${affiliateProduct.url}" target="_blank" rel="noopener noreferrer sponsored">
        <strong>${affiliateProduct.title}</strong>
      </a>
      <p class="affiliate-disclaimer">
        Affiliate link — I may earn a commission from qualifying purchases.
      </p>
    </div>
  ` : "";
  const relatedThemes = getRelatedThemes(themes, theme, 5);

const relatedThemesHtml = relatedThemes.length ? `
  <div class="theme-related-quizzes">
    <h3>Related Quizzes</h3>
    <div class="grid">
      ${relatedThemes.map(item => `
        <a class="card" href="challenge.html?theme=${item.slug}&round=1">
          <h3>${item.title}</h3>
        </a>
      `).join("")}
    </div>
  </div>
` : "";

  resultBox.innerHTML = `
    <h2>Round ${safeRound} Complete</h2>
    <p>Your score: ${state.score} / ${state.questions.length}</p>
    <p class="challenge-share-text">Send this round link to a friend to play the same 10 questions.</p>
    <div class="challenge-link-box">${roundLink}</div>
    <div class="cta-row">
      ${hasNextRound ? `<a class="primary-btn" href="challenge.html?theme=${theme.slug}&round=${safeRound + 1}">Next Round</a>` : ""}
     <a class="secondary-btn" href="contact.html">Report a Question</a>
    </div>
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
}

submitBtn.addEventListener("click", () => {
  if (!state.selectedAnswer) return;

  const q = state.questions[state.currentIndex];
  const selectedBtn = document.querySelector("#challengeOptionsList .option-btn.selected");

  if (state.selectedAnswer === q.answer) {
    state.score += 1;
    setFeedback("Correct", "correct");
    if (selectedBtn) {
      selectedBtn.classList.remove("wrong-anim");
      void selectedBtn.offsetWidth;
      selectedBtn.classList.add("correct-anim");
    }
  } else {
    setFeedback("Wrong", "wrong");
    if (selectedBtn) {
      selectedBtn.classList.remove("correct-anim");
      void selectedBtn.offsetWidth;
      selectedBtn.classList.add("wrong-anim");
    }
  }

  submitBtn.disabled = true;
  nextBtn.style.display = "inline-block";
});

  nextBtn.addEventListener("click", () => {
    state.currentIndex += 1;

    if (state.currentIndex >= state.questions.length) {
      renderResult();
    } else {
      renderQuestion();
    }
  });

  renderQuestion();
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "challenge") {
    renderChallengePage();
  }
});