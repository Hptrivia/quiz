async function renderWordlePage() {
  const slug = getParam("theme");
  const themes = await loadThemes();
  const theme = themes.find(t => t.slug === slug);

  const progressEl = document.getElementById("wordleProgress");
  const boardEl = document.getElementById("wordleBoard");
  const feedbackEl = document.getElementById("wordleFeedback");
  const keyboardEl = document.getElementById("wordleKeyboard");
  const prevBtn = document.getElementById("prevWordBtn");
  const nextBtn = document.getElementById("nextWordBtn");

  if (!theme) {
    titleEl.textContent = "Theme not found";
    return;
  }

  const allWordleData = await fetchJSON("data/wordle_words.txt");
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
  let currentGuess = "";
  let gameOver = false;
  let keyStates = {};

  const keyboardRows = [
    ["Q","W","E","R","T","Y","U","I","O","P"],
    ["A","S","D","F","G","H","J","K","L"],
    ["ENTER","Z","X","C","V","B","N","M","⌫"]
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

  function renderBoard() {
    boardEl.innerHTML = "";

    for (let row = 0; row < 6; row++) {
      const rowEl = document.createElement("div");
      rowEl.className = "wordle-row";
      rowEl.style.gridTemplateColumns = `repeat(${targetWord.length}, 1fr)`;

      const submittedGuess = guesses[row] ? guesses[row].word : "";
      const submittedStates = guesses[row] ? guesses[row].states : [];

      for (let col = 0; col < targetWord.length; col++) {
        const tile = document.createElement("div");
        tile.className = "wordle-tile";

        if (submittedGuess) {
          tile.textContent = submittedGuess[col] || "";
          if (submittedStates[col]) tile.classList.add(submittedStates[col]);
        } else if (row === guesses.length) {
          tile.textContent = currentGuess[col] || "";
          if (currentGuess[col]) tile.classList.add("filled");
        }

        rowEl.appendChild(tile);
      }

      boardEl.appendChild(rowEl);
    }
  }

  function renderKeyboard() {
    keyboardEl.innerHTML = "";

    keyboardRows.forEach(row => {
      const rowEl = document.createElement("div");
      rowEl.className = "wordle-keyboard-row";

      row.forEach(letter => {
        const key = document.createElement("button");
        key.type = "button";
        key.className = "wordle-key";
        key.textContent = letter;

        if (letter === "ENTER" || letter === "⌫") {
          key.classList.add("wide");
        }

        if (keyStates[letter]) {
          key.classList.add(keyStates[letter]);
        }

        key.addEventListener("click", () => handleKey(letter));
        rowEl.appendChild(key);
      });

      keyboardEl.appendChild(rowEl);
    });
  }

  function setFeedback(text, type = "") {
    feedbackEl.textContent = text;
    feedbackEl.className = "feedback";
    if (type) feedbackEl.classList.add(type);
  }

  function submitGuess() {
    if (gameOver) return;

    if (currentGuess.length !== targetWord.length) {
      setFeedback(`Guess must be ${targetWord.length} letters.`, "wrong");
      return;
    }

    const guess = currentGuess.toUpperCase();
    const states = getLetterState(guess, targetWord);

    guesses.push({ word: guess, states });
    updateKeyboard(guess, states);
    currentGuess = "";

    renderBoard();
    renderKeyboard();

    if (guess === targetWord) {
      setFeedback("Correct", "correct");
      gameOver = true;
      return;
    }

    if (guesses.length === 6) {
      setFeedback(`Wrong. The word was ${targetWord}.`, "wrong");
      gameOver = true;
      return;
    }

    setFeedback(`${6 - guesses.length} guess(es) left.`);
  }

  function handleKey(key) {
    if (gameOver) return;

    if (key === "ENTER") {
      submitGuess();
      return;
    }

    if (key === "⌫") {
      currentGuess = currentGuess.slice(0, -1);
      renderBoard();
      return;
    }

    if (/^[A-Z]$/.test(key) && currentGuess.length < targetWord.length) {
      currentGuess += key;
      renderBoard();
    }
  }

  function loadWord(index) {
    currentWordIndex = index;
    localStorage.setItem(storageKey, String(currentWordIndex));

    targetWord = String(words[currentWordIndex]).toUpperCase();
    guesses = [];
    currentGuess = "";
    gameOver = false;
    keyStates = {};

    progressEl.textContent = `Word ${currentWordIndex + 1} of ${words.length}`;
    setFeedback("");

    renderBoard();
    renderKeyboard();
  }

  document.addEventListener("keydown", e => {
    if (document.body.dataset.page !== "wordle") return;

    if (e.key === "Enter") {
      e.preventDefault();
      handleKey("ENTER");
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      handleKey("⌫");
      return;
    }

    const letter = e.key.toUpperCase();
    if (/^[A-Z]$/.test(letter)) {
      handleKey(letter);
    }
  });

  prevBtn.addEventListener("click", () => {
    if (currentWordIndex > 0) loadWord(currentWordIndex - 1);
  });

  nextBtn.addEventListener("click", () => {
    if (currentWordIndex < words.length - 1) loadWord(currentWordIndex + 1);
  });

  loadWord(currentWordIndex);
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "wordle") {
    renderWordlePage();
  }
});
