async function renderEpisodePage() {
  const slug = getParam("theme");
  const themes = await loadThemes();
  const theme = themes.find(t => t.slug === slug);

  if (!theme) return;

  const contextEl = document.getElementById("episodeContext");
  const questionEl = document.getElementById("episodeQuestionText");
  const optionsEl = document.getElementById("episodeOptionsList");
  const scoreEl = document.getElementById("episodeScoreText");
  const feedbackEl = document.getElementById("episodeFeedbackText");
  const descriptionEl = document.getElementById("episodeDescription");
  const nextBtn = document.getElementById("episodeNextButton");
  const resultBox = document.getElementById("episodeResultBox");
  const gameBox = document.getElementById("episodeGameBox");

  const episodeThemes = await fetchJSON("data/episode_themes.json");
  const episodeFile = episodeThemes[slug];

  if (!episodeFile) {
    questionEl.textContent = "Episode Mode not available for this theme.";
    return;
  }

  const questions = await fetchJSON(`data/${episodeFile}`);

  let currentIndex = 0;
  let score = 0;
  let answered = false;

  function setFeedback(text, type = "") {
    feedbackEl.textContent = text;
    feedbackEl.className = "feedback";
    if (type) feedbackEl.classList.add(type);
  }

  function renderResult() {
    gameBox.style.display = "none";
    resultBox.style.display = "block";
    resultBox.innerHTML = `
      <h2>Episode Complete</h2>
      <p>Your score: ${score} / ${questions.length}</p>
      <div class="cta-row">
        <a class="primary-btn" href="episode.html?theme=${theme.slug}">Play Again</a>
        <a class="secondary-btn" href="quiz.html?theme=${theme.slug}">Back to Theme</a>
      </div>
    `;
  }

  function renderQuestion() {
    const q = questions[currentIndex];
    if (!q) {
      renderResult();
      return;
    }

    answered = false;
    optionsEl.innerHTML = "";
    descriptionEl.textContent = "";
    setFeedback("");
    nextBtn.style.display = "none";

    contextEl.textContent = q.context || "";
    questionEl.textContent = q.question || "";
    scoreEl.textContent = `Score: ${score}`;

    q.options.forEach(option => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = option;

      btn.addEventListener("click", () => {
        if (answered) return;
        answered = true;

        document.querySelectorAll("#episodeOptionsList .option-btn").forEach(b => {
          b.disabled = true;
          if (b.textContent === q.answer) {
            b.classList.add("selected");
          }
        });

        if (option === q.answer) {
          score += 1;
          setFeedback(`Correct. Answer: ${q.answer}`, "correct");
        } else {
          setFeedback(`Wrong. Correct answer: ${q.answer}`, "wrong");
        }

        descriptionEl.textContent = q.description || "";
        scoreEl.textContent = `Score: ${score}`;
        nextBtn.style.display = "inline-block";
      });

      optionsEl.appendChild(btn);
    });
  }

  nextBtn.addEventListener("click", () => {
    currentIndex += 1;
    if (currentIndex >= questions.length) {
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
