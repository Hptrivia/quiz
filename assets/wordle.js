async function renderWordlePage() {
  const slug = getParam("theme");
  const themes = await loadThemes();
  const theme = themes.find(t => t.slug === slug);

  const titleEl = document.getElementById("wordleTitle");
  const progressEl = document.getElementById("wordleProgress");
  const boardEl = document.getElementById("wordleBoard");
  const inputEl = document.getElementById("wordleGuessInput");
  const submitBtn = document.getElementById("wordleSubmitBtn");
  const feedbackEl = document.getElementById("wordleFeedback");
  const keyboardEl = document.getElementById("wordleKeyboard");
  const prevBtn = document.getElementById("prevWordBtn");
  const nextBtn = document.getElementById("nextWordBtn");

  if (!theme) {
    titleEl.textContent = "Theme not found";
    return;
  }

  titleEl.textContent = `${theme.title} Wordle`;

  const allWordleData = await fetchJSON("data/wordle_words.json");
  const words = allWordleData[theme.title];

  if (!Array.isArray(words) || !words.length) {
    progressEl.textContent = "No Wordle words found for this theme.";
    return;
  }

  const storageKey = `wordle_index_${theme.slug}`;
  let currentWordIndex = parseInt(localStorage.getItem(storageKey) || "0", 10);
  if (currentWordIndex >= words.length) currentWordIndex = 0;

  let targetWord = "";
  let guesses = [];
  let gameOver = false;
  let keyStates = {};

  const keyboardRows = [
    "QWERTYUIOP",
    "ASDFGHJKL",
    "ZXCVBNM"
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

  function renderKeyboard() {
    keyboardEl.innerHTML = "";

    keyboardRows.forEach(row => {
      const rowEl = document.createElement("div");
      rowEl.className = "wordle-keyboard-row";

      row.split("").forEach(letter => {
        const key = document.createElement("button");
        key.type = "button";
        key.className = "wordle-key";
        if (keyStates[letter]) key.classList.add(keyStates[letter]);
        key.textContent = letter;

        key.addEventListener("click", () => {
          if (gameOver) return;
          if (inputEl.value.length < targetWord.length) {
            inputEl.value += letter;
          }
        });

        rowEl.appendChild(key);
      });

      keyboardEl.appendChild(rowEl);
    });
  }

  function renderBoard() {
    boardEl.innerHTML = "";

    for (let row = 0; row < 6; row++) {
      const rowEl = document.createElement("div");
      rowEl.className = "wordle-row";

      const guess = guesses[row] ? guesses[row].word : "";
      const states = guesses[row] ? guesses[row].states : [];

      for (let col = 0; col < targetWord.length; col++) {
        const tile = document.createElement("div");
        tile.className = "wordle-tile";
        tile.textContent = guess[col] || "";

        if (states[col]) tile.classList.add(states[col]);

        rowEl.appendChild(tile);
      }

      boardEl.appendChild(rowEl);
    }
  }

  function loadWord(index) {
    currentWordIndex = index;
    localStorage.setItem(storageKey, String(currentWordIndex));

    targetWord = words[currentWordIndex].toUpperCase();
    guesses = [];
    gameOver = false;
    keyStates = {};

    progressEl.textContent = `Word ${currentWordIndex + 1} of ${words.length}`;
    inputEl.value = "";
    inputEl.maxLength = targetWord.length;
    inputEl.placeholder = `Enter ${targetWord.length}-letter guess`;
    feedbackEl.textContent = "";
    feedbackEl.className = "feedback";

    renderBoard();
    renderKeyboard();
  }

  function submitGuess() {
    if (gameOver) return;

    const guess = inputEl.value.trim().toUpperCase();

    if (guess.length !== targetWord.length) {
      feedbackEl.textContent = `Guess must be ${targetWord.length} letters.`;
      feedbackEl.className = "feedback wrong";
      return;
    }

    if (guesses.length >= 6) return;

    const states = getLetterState(guess, targetWord);
    guesses.push({ word: guess, states });
    updateKeyboard(guess, states);

    renderBoard();
    renderKeyboard();
    inputEl.value = "";

    if (guess === targetWord) {
      feedbackEl.textContent = "Correct";
      feedbackEl.className = "feedback correct";
      gameOver = true;
      return;
    }

    if (guesses.length === 6) {
      feedbackEl.textContent = `Wrong. The word was ${targetWord}.`;
      feedbackEl.className = "feedback wrong";
      gameOver = true;
      return;
    }

    feedbackEl.textContent = `${6 - guesses.length} guess(es) left.`;
    feedbackEl.className = "feedback";
  }

  submitBtn.addEventListener("click", submitGuess);

  inputEl.addEventListener("keydown", e => {
    if (e.key === "Enter") submitGuess();
  });

  prevBtn.addEventListener("click", () => {
    if (currentWordIndex > 0) {
      loadWord(currentWordIndex - 1);
    }
  });

  nextBtn.addEventListener("click", () => {
    if (currentWordIndex < words.length - 1) {
      loadWord(currentWordIndex + 1);
    }
  });

  loadWord(currentWordIndex);
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "wordle") {
    renderWordlePage();
  }
});
