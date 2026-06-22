async function renderEpisodePage() {
  const slug = getParam("theme");
  const themes = await loadThemes();
  const theme = themes.find(t => t.slug === slug);

  if (!theme) return;

  document.title = `${theme.title} Episode Mode - Trivia Gauntlet`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', `Play ${theme.title} Episode Mode on Trivia Gauntlet. Episode-by-episode trivia questions following the series.`);

  if (typeof gtag === "function") {
    gtag("event", "page_view", {
      page_title: `Episode Mode - ${theme.title}`,
      page_location: window.location.href
    });
  }


  const nextPageLink = document.getElementById("episodeNextPageLink");
  const scoreEl = document.getElementById("episodeScoreText");
  const slidesContainer = document.getElementById("episodeSlides");
  const resultBox = document.getElementById("episodeResultBox");
  const gameBox = document.getElementById("episodeGameBox");

  const rawEpisode = parseInt(getParam("episode") || "1", 10);
  const currentEpisode = Number.isNaN(rawEpisode) || rawEpisode < 1 ? 1 : rawEpisode;

  const episodeThemes = await fetchJSON("data/episode_themes.json");
  const episodeFile = episodeThemes[slug];

  if (!episodeFile) {
    slidesContainer.textContent = "Episode Mode not available for this theme.";
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
    slidesContainer.textContent = "No episode data found.";
    return;
  }

  const episodeHeading = document.getElementById("episodeHeading");
  if (episodeHeading) episodeHeading.textContent = `Episode ${safeEpisode}`;

  if (nextPageLink) {
    if (hasNextEpisode) {
      nextPageLink.style.display = "inline-block";
      nextPageLink.textContent = "Skip to next episode";
      nextPageLink.href = `episode.html?theme=${theme.slug}&episode=${nextEpisodeNumber}`;
      nextPageLink.dataset.rewardedHref = `episode.html?theme=${theme.slug}&episode=${nextEpisodeNumber}`;
    } else {
      nextPageLink.style.display = "none";
    }
  }
  // Limited web: one episode is free — any skip pops the app-download wall.
  if (typeof gateWebSkip === 'function') gateWebSkip(nextPageLink, true);

  let currentIndex = 0;
  let score = 0;

  // Resume an in-progress episode (reuse the exact saved question set/order).
  let _resume = (typeof _loadMidQuiz === 'function') ? _loadMidQuiz("episode", theme.slug, safeEpisode) : null;
  const renderQuestions = _resume ? _resume.questions : episodeQuestions.map(q => shuffleQuestionOptions(q));
  if (_resume) { score = _resume.score || 0; currentIndex = _resume.currentIndex; }

  function renderResult() {
    if (typeof _clearMidQuiz === 'function') _clearMidQuiz("episode", theme.slug, safeEpisode);
    if (typeof webAddEp === 'function') webAddEp();
    gameBox.style.display = "none";
    resultBox.style.display = "block";
    resultBox.classList.remove("result-anim");
    void resultBox.offsetWidth;
    resultBox.classList.add("result-anim");

    // Related quizzes: first card is THIS theme's regular (Marathon) trivia, styled
    // like the mashup card so it stands apart as "not an episode". The rest are
    // Episode Mode for other themes in the same category that also have episodes.
    const relatedEpisodes = (typeof shuffleArray === "function"
      ? shuffleArray(themes.filter(t => t.slug !== theme.slug && t.category === theme.category && episodeThemes[t.slug]))
      : themes.filter(t => t.slug !== theme.slug && t.category === theme.category && episodeThemes[t.slug])
    ).slice(0, 4);

    const relatedHtml = `
      <div class="theme-related-quizzes" data-reward-gate="1">
        <h3>Related Quizzes</h3>
        <div class="grid">
          <a class="card card-mix" href="play.html?theme=${theme.slug}">
            <h3>${theme.title} Trivia</h3>
            <span class="card-mix-sub">Regular trivia</span>
          </a>
          ${relatedEpisodes.map(t => `
            <a class="card" href="episode.html?theme=${t.slug}&episode=1">
              <h3>${t.title}</h3>
            </a>
          `).join("")}
        </div>
      </div>
    `;

    // When they've finished the newest available episode, offer to be notified
    // when the next one drops (email + theme via the shared Formspree card).
    const notifyHtml = (!hasNextEpisode && typeof buildNotifyCard === "function")
      ? buildNotifyCard(theme.title, false, "episode", {
          heading: `🎬 You're caught up on <strong>${theme.title}</strong> episodes`,
          sub: "Want to know when the next episode drops?",
        })
      : "";

    resultBox.innerHTML = `
      <h2>${foundAnyEpisodeMarkers ? `Episode ${safeEpisode} Complete` : "Episode Mode Complete"}</h2>
      <p>Your score: ${score} / ${episodeQuestions.length}</p>
      ${webQCounterHTML()}
      <div class="cta-row">
        ${hasNextEpisode && !isWebEpLimit() ? `<a class="primary-btn" href="episode.html?theme=${theme.slug}&episode=${nextEpisodeNumber}" data-rewarded-href="episode.html?theme=${theme.slug}&episode=${nextEpisodeNumber}">Next Episode</a>` : ""}
        ${hasNextEpisode && isWebEpLimit() ? webWallHTML("Yay! You've played an episode", theme.title, "episodes") : ""}
        ${!hasNextEpisode && isWebEpLimit() ? webWallHTML("Want more episodes?", null, "episodes", null, true) : ""}
      </div>
      ${notifyHtml}
      ${relatedHtml}
    `;
    if (notifyHtml && typeof wireNotifyCard === "function") wireNotifyCard(theme.title, "episode");
  }

  function showQuestion(index) {
    const prev = slidesContainer.querySelector(".question-slide.active");
    if (prev) {
      prev.classList.remove("active");
      prev.classList.add("answered");
      if (ONE_PER_PAGE_EPISODE) prev.style.display = "none";
    }
    const slide = slidesContainer.querySelector(`.question-slide[data-index="${index}"]`);
    if (slide) {
      slide.classList.add("active");
      if (ONE_PER_PAGE_EPISODE) slide.style.display = "block";
      slide.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    scoreEl.textContent = `Score: ${score}`;
  }

  // Pre-render all question slides
  renderQuestions.forEach((q, index) => {
    const slide = document.createElement("div");
    slide.className = "question-slide";
    slide.dataset.index = index;

    const qNum = document.createElement("p");
    qNum.className = "slide-question-num";
    qNum.textContent = `Question ${index + 1} of ${episodeQuestions.length}`;

    const contextP = document.createElement("div");
    contextP.className = "episode-context";
    contextP.textContent = cleanText(q.context);

    const qText = document.createElement("h2");
    qText.textContent = q.question || "";

    const optsList = document.createElement("div");
    optsList.className = "options";

    let answered = false;
    let selectedAnswer = null;

    q.options.forEach(option => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = option;
      btn.addEventListener("click", () => {
        if (answered || currentIndex !== index) return;
        selectedAnswer = option;
        optsList.querySelectorAll(".option-btn").forEach(b => {
          b.classList.remove("selected", "correct-anim", "wrong-anim");
        });
        btn.classList.add("selected");
      });
      optsList.appendChild(btn);
    });

    const feedbackP = document.createElement("p");
    feedbackP.className = "feedback";

    const descDiv = document.createElement("div");
    descDiv.className = "episode-description";

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
      if (answered || !selectedAnswer || currentIndex !== index) return;

      answered = true;

      optsList.querySelectorAll(".option-btn").forEach(b => {
        b.disabled = true;
        b.classList.remove("selected");
        if (b.textContent === q.answer) b.classList.add("correct-anim");
      });

      if (selectedAnswer === q.answer) {
        score += 1;
        if (typeof SoundFX !== 'undefined') SoundFX.play('correct');
        feedbackP.textContent = "Correct";
        feedbackP.className = "feedback correct";
      } else {
        if (typeof SoundFX !== 'undefined') SoundFX.play('wrong');
        feedbackP.textContent = "Wrong";
        feedbackP.className = "feedback wrong";
        optsList.querySelectorAll(".option-btn").forEach(b => {
          if (b.textContent === selectedAnswer) b.classList.add("wrong-anim");
        });
      }

      descDiv.innerHTML = `
        <div class="episode-description-box">
          <p class="episode-description-label">Explanation</p>
          <p>${cleanText(q.description)}</p>
        </div>
      `;

      scoreEl.textContent = `Score: ${score}`;
      submitBtn.style.display = "none";
      nextBtn.style.display = "inline-block";
    });

    nextBtn.addEventListener("click", () => {
      currentIndex += 1;
      if (currentIndex >= episodeQuestions.length) {
        renderResult();
      } else {
        if (typeof _saveMidQuiz === 'function') _saveMidQuiz("episode", theme.slug, safeEpisode, { questions: renderQuestions, currentIndex, score });
        showQuestion(currentIndex);
      }
    });

    slide.appendChild(qNum);
    slide.appendChild(contextP);
    slide.appendChild(qText);
    slide.appendChild(optsList);
    slide.appendChild(feedbackP);
    slide.appendChild(descDiv);
    slide.appendChild(ctaRow);
    slidesContainer.appendChild(slide);
  });

  if (ONE_PER_PAGE_EPISODE) {
    slidesContainer.querySelectorAll(".question-slide").forEach(s => {
      s.style.display = "none";
    });
  }

  showQuestion(currentIndex);

  // Small 320×50 banner under the gameplay area (web-only, non-premium).
  if (typeof injectAdsterraBanner === 'function') injectAdsterraBanner(document.getElementById("episodeGameAdSlot"));
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "episode") {
    renderEpisodePage();
  }
});
