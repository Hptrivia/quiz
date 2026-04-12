async function renderEpisodePage() {
  const slug = getParam("theme");
  const themes = await loadThemes();
  const theme = themes.find(t => t.slug === slug);

  if (!theme) return;
  if (typeof gtag === "function") {
  gtag("event", "page_view", {
    page_title: `Episode Mode - ${theme.title}`,
    page_location: window.location.href
  });
}

  if (typeof updateRemoveAdsFooter === "function") {
    updateRemoveAdsFooter(theme.slug, "episode");
  }

  let buyPackUrl = "https://ko-fi.com/triviaking/shop";

  try {
    const episodePackLinks = await fetchJSON("data/episode_pack_links.json");
    buyPackUrl = episodePackLinks[theme.title] || buyPackUrl;
  } catch (e) {
    buyPackUrl = "https://ko-fi.com/triviaking/shop";
  }

  const progressEl = document.getElementById("episodeProgressText");
  const nextPageLink = document.getElementById("episodeNextPageLink");
  const contextEl = document.getElementById("episodeContext");
  const questionEl = document.getElementById("episodeQuestionText");
  const optionsEl = document.getElementById("episodeOptionsList");
  const scoreEl = document.getElementById("episodeScoreText");
  const feedbackEl = document.getElementById("episodeFeedbackText");
  const descriptionEl = document.getElementById("episodeDescription");
  const submitBtn = document.getElementById("episodeSubmitButton");
  const nextBtn = document.getElementById("episodeNextButton");
  const resultBox = document.getElementById("episodeResultBox");
  const gameBox = document.getElementById("episodeGameBox");

  const rawEpisode = parseInt(getParam("episode") || "1", 10);
  const currentEpisode = Number.isNaN(rawEpisode) || rawEpisode < 1 ? 1 : rawEpisode;

  const episodeThemes = await fetchJSON("data/episode_themes.json");
  const episodeFile = episodeThemes[slug];

  if (!episodeFile) {
    questionEl.textContent = "Episode Mode not available for this theme.";
    return;
  }

  const allQuestions = await fetchJSON(`data/${episodeFile}`);

  function cleanText(text) {
    return String(text || "").replace(/\*\*/g, "").trim();
  }

  function extractEpisodeMarker(question) {
    const contextText = String(question.context || "");
    const match = contextText.match(/episode\s+(\d+)/i);
    if (!match) return null;
    return parseInt(match[1], 10);
  }

  const episodeMap = new Map();
  let currentMarker = null;
  let foundAnyEpisodeMarkers = false;

  allQuestions.forEach(q => {
    const marker = extractEpisodeMarker(q);

    if (marker !== null) {
      currentMarker = marker;
      foundAnyEpisodeMarkers = true;
    }

    if (currentMarker !== null) {
      if (!episodeMap.has(currentMarker)) episodeMap.set(currentMarker, []);
      episodeMap.get(currentMarker).push(q);
    }
  });

  let episodeQuestions = [];
  let safeEpisode = 1;
  let hasNextEpisode = false;
  let nextEpisodeNumber = null;

  if (foundAnyEpisodeMarkers && episodeMap.size > 0) {
    const availableEpisodes = [...episodeMap.keys()].sort((a, b) => a - b);
    safeEpisode = episodeMap.has(currentEpisode) ? currentEpisode : availableEpisodes[0];
    episodeQuestions = episodeMap.get(safeEpisode) || [];

    const currentEpisodeIndex = availableEpisodes.indexOf(safeEpisode);
    hasNextEpisode = currentEpisodeIndex !== -1 && currentEpisodeIndex < availableEpisodes.length - 1;
    nextEpisodeNumber = hasNextEpisode ? availableEpisodes[currentEpisodeIndex + 1] : null;
  } else {
    episodeQuestions = allQuestions;
    safeEpisode = 1;
    hasNextEpisode = false;
    nextEpisodeNumber = null;
  }

  if (!episodeQuestions.length) {
    questionEl.textContent = "No episode data found.";
    return;
  }

  let currentIndex = 0;
  let score = 0;
  let answered = false;
  let selectedAnswer = null;

  function setFeedback(text, type = "") {
    feedbackEl.textContent = text;
    feedbackEl.className = "feedback";
    if (type) feedbackEl.classList.add(type);
  }

  function renderResult() {
    gameBox.style.display = "none";
    resultBox.style.display = "block";
    resultBox.classList.remove("result-anim");
    void resultBox.offsetWidth;
    resultBox.classList.add("result-anim");

    resultBox.innerHTML = `
      <h2>${foundAnyEpisodeMarkers ? `Episode ${safeEpisode} Complete` : "Episode Mode Complete"}</h2>
      <p>Your score: ${score} / ${episodeQuestions.length}</p>
      <div class="cta-row">
        ${hasNextEpisode ? `<a class="primary-btn" href="episode.html?theme=${theme.slug}&episode=${nextEpisodeNumber}">Next Episode</a>` : ""}
        <a class="secondary-btn" href="${buyPackUrl}" target="_blank" rel="noopener noreferrer">Buy ${theme.title} Episode Pack</a>
      </div>
    `;
  }

  function renderQuestion() {
    const q = episodeQuestions[currentIndex];
    if (!q) {
      renderResult();
      return;
    }

    answered = false;
    selectedAnswer = null;
    optionsEl.innerHTML = "";
    descriptionEl.innerHTML = "";
    setFeedback("");
    nextBtn.style.display = "none";
    submitBtn.style.display = "inline-block";
    submitBtn.disabled = false;

    progressEl.textContent = `Question ${currentIndex + 1} of ${episodeQuestions.length}`;
    scoreEl.textContent = `Score: ${score}`;
    contextEl.textContent = cleanText(q.context);
    questionEl.textContent = q.question || "";

    if (nextPageLink) {
      if (hasNextEpisode) {
        nextPageLink.style.display = "inline-block";
        nextPageLink.textContent = "Skip to next episode";
        nextPageLink.href = `episode.html?theme=${theme.slug}&episode=${nextEpisodeNumber}`;
      } else {
        nextPageLink.style.display = "none";
      }
    }

    q.options.forEach(option => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = option;

btn.addEventListener("click", () => {
  if (answered) return;
  selectedAnswer = option;

  document.querySelectorAll("#episodeOptionsList .option-btn").forEach(b => {
    b.classList.remove("selected", "correct-anim", "wrong-anim");
  });
  btn.classList.add("selected");
});
      optionsEl.appendChild(btn);
    });
  }

  function submitAnswer() {
    if (answered) return;
    if (!selectedAnswer) return;

    const q = episodeQuestions[currentIndex];
    answered = true;

    document.querySelectorAll("#episodeOptionsList .option-btn").forEach(b => {
      b.disabled = true;
      if (b.textContent === q.answer) {
        b.classList.add("selected");
      }
    });

  const selectedBtn = document.querySelector("#episodeOptionsList .option-btn.selected");
  
  if (selectedAnswer === q.answer) {
    score += 1;
    setFeedback(`Correct. The answer is ${q.answer}.`, "correct");
    if (selectedBtn) {
      selectedBtn.classList.remove("wrong-anim");
      void selectedBtn.offsetWidth;
      selectedBtn.classList.add("correct-anim");
    }
  } else {
    setFeedback(`Wrong. The correct answer is ${q.answer}.`, "wrong");
    if (selectedBtn) {
      selectedBtn.classList.remove("correct-anim");
      void selectedBtn.offsetWidth;
      selectedBtn.classList.add("wrong-anim");
    }
  }

    descriptionEl.innerHTML = `
      <div class="episode-description-box">
        <p class="episode-description-label">Explanation</p>
        <p>${cleanText(q.description)}</p>
      </div>
    `;

    scoreEl.textContent = `Score: ${score}`;
    submitBtn.style.display = "none";
    nextBtn.style.display = "inline-block";
  }

  submitBtn.addEventListener("click", submitAnswer);

  nextBtn.addEventListener("click", () => {
    currentIndex += 1;
    if (currentIndex >= episodeQuestions.length) {
      renderResult();
    } else {
      renderQuestion();
    }
  });

  renderQuestion();
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "episode") {
    renderEpisodePage();
  }
});
