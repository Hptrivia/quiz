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
    } else {
      nextPageLink.style.display = "none";
    }
  }

  let currentIndex = 0;
  let score = 0;

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
  episodeQuestions.forEach((q, index) => {
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
        if (b.textContent === q.answer) b.classList.add("selected");
      });

      const selectedBtn = optsList.querySelector(".option-btn.selected");

      if (selectedAnswer === q.answer) {
        score += 1;
        feedbackP.textContent = `Correct. The answer is ${q.answer}.`;
        feedbackP.className = "feedback correct";
        if (selectedBtn) {
          selectedBtn.classList.remove("wrong-anim");
          void selectedBtn.offsetWidth;
          selectedBtn.classList.add("correct-anim");
        }
      } else {
        feedbackP.textContent = `Wrong. The correct answer is ${q.answer}.`;
        feedbackP.className = "feedback wrong";
        if (selectedBtn) {
          selectedBtn.classList.remove("correct-anim");
          void selectedBtn.offsetWidth;
          selectedBtn.classList.add("wrong-anim");
        }
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

  showQuestion(0);
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "episode") {
    renderEpisodePage();
  }
});
