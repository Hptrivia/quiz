async function renderSurvivalPage() {
  const slug = getParam("theme");
  const themes = await loadThemes();
  const theme = themes.find(t => t.slug === slug);

  const titleEl = document.getElementById("survivalTitle");
  const difficultyBox = document.getElementById("difficultyBox");
  const gameBox = document.getElementById("survivalGameBox");
  const resultBox = document.getElementById("survivalResultBox");

  const scoreEl = document.getElementById("survivalScoreText");
  const streakEl = document.getElementById("survivalStreakText");
  const questionEl = document.getElementById("survivalQuestionText");
  const optionsEl = document.getElementById("survivalOptionsList");
  const feedbackEl = document.getElementById("survivalFeedbackText");

  const submitBtn = document.getElementById("survivalSubmitButton");
  const nextBtn = document.getElementById("survivalNextButton");
  const fiftyBtn = document.getElementById("fiftyBtn");
  const friendBtn = document.getElementById("friendBtn");

  if (!theme) {
    titleEl.textContent = "Theme not found";
    return;
  }

  titleEl.textContent = `${theme.title} Survival`;

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
    bothSpent: false,
    recoveryStage: 0, // 0 none, 1 first regained, 2 both regained
    recoveryPoints: 0,
    answerLocked: false
  };

  function normalizeDifficulty(value) {
    return String(value || "").trim().toLowerCase();
  }

  function shuffle(array) {
    return [...array].sort(() => Math.random() - 0.5);
  }

  function getCurrentQuestion() {
    return state.questions[state.currentIndex];
  }

  function updateTopbar() {
    scoreEl.textContent = `Score: ${state.score}`;
    streakEl.textContent = `Recovery Streak: ${state.recoveryPoints}`;
  
    fiftyBtn.disabled = !state.fiftyAvailable || state.answerLocked || state.gameOver;
    friendBtn.disabled = !state.friendAvailable || state.answerLocked || state.gameOver;
  
    fiftyBtn.textContent = state.fiftyAvailable ? "50-50" : "50-50 Used";
    friendBtn.textContent = state.friendAvailable ? "Call a Friend" : "Friend Used";
  }

  function setFeedback(text, type = "") {
    feedbackEl.textContent = text;
    feedbackEl.className = "feedback";
    if (type) feedbackEl.classList.add(type);
  }

  function markOptionSelected(buttonEl) {
    document.querySelectorAll("#survivalOptionsList .option-btn").forEach(btn => {
      btn.classList.remove("selected");
    });
    buttonEl.classList.add("selected");
  }

  function renderQuestion() {
    const q = getCurrentQuestion();
    if (!q) {
      renderResult();
      return;
    }
  
    state.selectedAnswer = null;
    state.answerLocked = false;
    optionsEl.innerHTML = "";
    setFeedback("");
    submitBtn.disabled = false;
    nextBtn.style.display = "none";
  
    questionEl.textContent = q.question;
  
    q.options.forEach(option => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = option;
  
      btn.addEventListener("click", () => {
        if (state.answerLocked || state.gameOver) return;
        state.selectedAnswer = option;
        document.querySelectorAll("#survivalOptionsList .option-btn").forEach(b => {
          b.classList.remove("selected");
        });
        btn.classList.add("selected");
      });
  
      optionsEl.appendChild(btn);
    });
  
    updateTopbar();
  }
  function maybeStartRecovery() {
    if (!state.bothSpent && !state.fiftyAvailable && !state.friendAvailable) {
      state.bothSpent = true;
      state.recoveryStage = 0;
      state.recoveryPoints = 0;
    }
  }

  function handleRecoveryOnCorrect(questionDifficulty) {
    const points = pointsMap[questionDifficulty] || 1;

    if (!state.bothSpent) return;

    state.recoveryPoints += points;

    if (state.recoveryStage === 0 && state.recoveryPoints >= 25) {
      state.fiftyAvailable = true;
      state.recoveryStage = 1;
      setFeedback("Correct. You regained 50-50.", "correct");
      return;
    }

    if (state.recoveryStage === 1 && state.recoveryPoints >= 50) {
      state.friendAvailable = true;
      state.recoveryStage = 2;
      setFeedback("Correct. You regained Call a Friend.", "correct");
    }
  }

  function useFiftyFifty() {
    if (!state.fiftyAvailable || state.answerLocked || state.gameOver) return;

    const q = getCurrentQuestion();
    const buttons = [...optionsEl.querySelectorAll(".option-btn")];

    const wrongButtons = buttons.filter(btn => btn.textContent !== q.answer);
    const toHide = shuffle(wrongButtons).slice(0, 2);

    toHide.forEach(btn => {
      btn.disabled = true;
      btn.classList.add("disabled-option");
    });

    state.fiftyAvailable = false;

    if (state.bothSpent && state.recoveryStage === 1) {
      state.recoveryPoints = 0;
      state.recoveryStage = 0;
    }

    maybeStartRecovery();
    updateTopbar();
  }

  function useCallFriend() {
    if (!state.friendAvailable || state.answerLocked || state.gameOver) return;

    const q = getCurrentQuestion();
    state.friendAvailable = false;
    setFeedback(`Call a Friend: ${q.answer}`, "correct");

    maybeStartRecovery();
    updateTopbar();
  }

  function handleWrongAnswer() {
    state.gameOver = true;
    state.answerLocked = true;
    submitBtn.disabled = true;
    nextBtn.style.display = "inline-block";
    setFeedback("Wrong. Run over.", "wrong");
    updateTopbar();
  }

  function handleCorrectAnswer() {
    const q = getCurrentQuestion();
    const difficulty = normalizeDifficulty(q.difficulty);
    const points = pointsMap[difficulty] || 1;

    state.score += points;
    state.answerLocked = true;
    submitBtn.disabled = true;
    nextBtn.style.display = "inline-block";

    setFeedback(`Correct. +${points} point(s).`, "correct");
    handleRecoveryOnCorrect(difficulty);
    updateTopbar();
  }

  function renderResult() {
    gameBox.style.display = "none";
    resultBox.style.display = "block";
    resultBox.innerHTML = `
      <h2>Survival Over</h2>
      <p>Your score: ${state.score}</p>
      <div class="cta-row">
        <a class="primary-btn" href="survival.html?theme=${theme.slug}">Play Again</a>
        <a class="secondary-btn" href="quiz.html?theme=${theme.slug}">Back to Theme</a>
      </div>
      <p class="survival-coming-soon">Leaderboard submission can be added later here.</p>
    `;
  }

  submitBtn.addEventListener("click", () => {
    if (state.gameOver || state.answerLocked) return;
    if (!state.selectedAnswer) return;

    const q = getCurrentQuestion();

    if (state.selectedAnswer === q.answer) {
      handleCorrectAnswer();
    } else {
      handleWrongAnswer();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (state.gameOver) {
      renderResult();
      return;
    }

    state.currentIndex += 1;

    if (state.currentIndex >= state.questions.length) {
      renderResult();
    } else {
      renderQuestion();
    }
  });

  fiftyBtn.addEventListener("click", useFiftyFifty);
  friendBtn.addEventListener("click", useCallFriend);

  document.querySelectorAll(".difficulty-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      state.difficulty = btn.dataset.difficulty;

      const allQuestions = await fetchJSON(theme.questionFile);
      const allowedDifficulties = difficultyMap[state.difficulty];

      state.questions = shuffle(
        allQuestions.filter(q =>
          allowedDifficulties.includes(normalizeDifficulty(q.difficulty))
        )
      );

      state.currentIndex = 0;
      state.selectedAnswer = null;
      state.score = 0;
      state.gameOver = false;
      state.fiftyAvailable = true;
      state.friendAvailable = true;
      state.bothSpent = false;
      state.recoveryStage = 0;
      state.recoveryPoints = 0;
      state.answerLocked = false;

      difficultyBox.style.display = "none";
      gameBox.style.display = "block";
      resultBox.style.display = "none";

      renderQuestion();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "survival") {
    renderSurvivalPage();
  }
});
