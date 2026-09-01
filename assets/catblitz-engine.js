// ── Category Blitz — shared round engine ────────────────────────────────────
// DOM-driving but policy-free: wheel spin, timer, category inputs, grading,
// result rendering. Daily/Solo/Versus each call these the same way and only
// differ in what they pass in (excludeLetters, categories, resolver, mode) —
// see assets/catblitz-daily.js / catblitz-solo.js / catblitz-versus.js.

const CB_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// Shared "one free web play" lock between Solo and Versus — playing either
// mode once uses up the single shared allowance and walls BOTH, not just the
// one played (so you can't get a free Solo spin and a free Versus round as
// two separate freebies). Daily Blitz has its own separate once-ever flag
// (cbWebDailyUsed_blitz) — different axis, daily content vs. repeatable play.
function cbGetWebPlayUsed() {
  return localStorage.getItem("cbWebPlayUsed_catblitz") === "true";
}
function cbMarkWebPlayUsed() {
  localStorage.setItem("cbWebPlayUsed_catblitz", "true");
}

function cbSlugify(str) {
  return String(str).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "category";
}

// Timer difficulty, shared by Solo and Versus (Daily always stays 45s — it's
// meant to be a low-friction one-a-day, not tuned for challenge). The last
// choice is remembered across visits so re-picking every round isn't
// required, but the picker still shows (and can be changed) before every
// game, same as the category picker.
const CB_DIFFICULTY_SECONDS = { easy: 60, medium: 45, hard: 30 };
const CB_DIFFICULTY_LABELS = { easy: "Easy · 60s", medium: "Medium · 45s", hard: "Hard · 30s" };
const CB_DIFFICULTY_KEY = "cbDifficulty";

function cbGetSavedDifficulty() {
  try {
    const saved = localStorage.getItem(CB_DIFFICULTY_KEY);
    if (saved && CB_DIFFICULTY_SECONDS[saved]) return saved;
  } catch {}
  return "medium";
}
function cbSaveDifficulty(difficulty) {
  try { localStorage.setItem(CB_DIFFICULTY_KEY, difficulty); } catch {}
}

// Renders the Easy/Medium/Hard picker into rowEl (same look/interaction as
// the Best-of length picker). Returns a getter for the live selection.
function cbRenderDifficultyPicker(rowEl) {
  let selected = cbGetSavedDifficulty();
  const order = ["easy", "medium", "hard"];
  rowEl.innerHTML = order.map(key =>
    `<button type="button" class="secondary-btn cb-difficulty-btn${key === selected ? " selected" : ""}" data-diff="${key}">${CB_DIFFICULTY_LABELS[key]}</button>`
  ).join("");
  rowEl.querySelectorAll(".cb-difficulty-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      selected = btn.dataset.diff;
      cbSaveDifficulty(selected);
      rowEl.querySelectorAll(".cb-difficulty-btn").forEach(b => b.classList.toggle("selected", b === btn));
    });
  });
  return () => selected;
}

// Suggested categories offered in the picker's dropdown — the 5
// wordlist-graded defaults (so they can be re-added after being removed)
// plus a broader set of common pick-list categories. None past the
// original 5 have a wordlist file, so they're graded manually via the
// "Mark as Correct" toggle after the round, same as any typed-in category.
const CB_SUGGESTED_CATEGORIES = [
  { id: "name", label: "Name" },
  { id: "animal", label: "Animal" },
  { id: "place", label: "Place" },
  { id: "thing", label: "Thing" },
  { id: "food", label: "Food" },
  { id: "colors", label: "Colors" },
  { id: "male-names", label: "Male Names" },
  { id: "female-names", label: "Female Names" },
  { id: "celebrities", label: "Celebrities" },
  { id: "footballers", label: "Footballers" },
  { id: "athletes", label: "Athletes" },
  { id: "sports", label: "Sports" },
  { id: "musical-instruments", label: "Musical Instruments" },
  { id: "movie-stars", label: "Movie Stars" },
  { id: "musicians", label: "Musicians" },
  { id: "professions", label: "Professions" },
  { id: "school-subjects", label: "School Subjects" },
  { id: "human-body-parts", label: "Human Body Parts" },
  { id: "famous-brands", label: "Famous Brands" },
  { id: "video-games", label: "Video Games" },
  { id: "languages", label: "Languages" },
  { id: "countries", label: "Countries" },
  { id: "cities", label: "Cities" },
  { id: "movies-tv-shows", label: "Movies / TV Shows" },
  { id: "things-in-the-house", label: "Things in the House" },
  { id: "emotions-feelings", label: "Emotions / Feelings" },
  { id: "superheroes-villains", label: "Superheroes / Villains" },
  { id: "diseases", label: "Diseases" },
  { id: "drinks", label: "Drinks" },
  { id: "sports-teams", label: "Sports Teams" },
  { id: "mobile-web-apps", label: "Mobile / Web Apps" },
  { id: "books", label: "Books" },
  { id: "songs", label: "Songs" },
];

// Draws `count` categories at random from the suggestion pool — used by the
// optional "Randomize Categories" control on the letter-spin screen (see
// cbRenderRandomizeCategoriesBox) and by online Versus's setup-screen
// equivalent. A fresh shuffle every call, so re-rolling gives a different set.
function cbRandomCategories(count = 5) {
  const shuffled = [...CB_SUGGESTED_CATEGORIES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(c => ({ ...c }));
}

// Shared add/remove category picker used by both Solo and Versus setup
// screens. Renders removable pills into listEl (guarded to never drop below
// 1 category) and wires the free-text add row, plus a click-to-browse
// suggestion dropdown (CB_SUGGESTED_CATEGORIES, filtered as you type and
// re-filtered after every add so already-picked ones drop out). Returns the
// live array — read it whenever the caller's Start button fires, after
// editing is done.
function cbRenderCategoryPicker({ listEl, inputEl, addBtnEl, initialCategories }) {
  const activeCategories = initialCategories.map(c => ({ ...c }));

  function render() {
    listEl.innerHTML = activeCategories.map((c, i) =>
      `<span class="cb-versus-category-pill">${_cbEscapeHtml(c.label)} <button type="button" class="cb-versus-remove-category" data-idx="${i}"${activeCategories.length <= 1 ? " disabled" : ""}>✕</button></span>`
    ).join("");
    listEl.querySelectorAll(".cb-versus-remove-category").forEach(btn => {
      btn.addEventListener("click", () => {
        if (activeCategories.length <= 1) return;
        activeCategories.splice(parseInt(btn.dataset.idx, 10), 1);
        render();
        renderSuggestions();
      });
    });
  }
  render();

  function addCategory(rawLabel) {
    const label = String(rawLabel).trim();
    if (!label) return;
    const usedIds = new Set(activeCategories.map(c => c.id));
    let id = cbSlugify(label);
    let n = 2;
    while (usedIds.has(id)) { id = `${cbSlugify(label)}-${n++}`; }
    activeCategories.push({ id, label });
    inputEl.value = "";
    render();
    renderSuggestions();
  }

  addBtnEl.addEventListener("click", () => addCategory(inputEl.value));
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCategory(inputEl.value);
    }
  });

  // Dropdown lives right below the add row, absolutely positioned (see
  // .cb-versus-suggest-dropdown) so opening it doesn't shove the rest of
  // the setup screen down. It's appended inside addRow (which is the
  // positioned ancestor) rather than after it, so top:100% resolves
  // against the add row's own bottom edge instead of the whole setup
  // row's bottom edge (which would land it below the hint text underneath).
  const dropdownEl = document.createElement("div");
  dropdownEl.className = "cb-versus-suggest-dropdown";
  dropdownEl.style.display = "none";
  const addRow = addBtnEl.closest(".cb-versus-add-category-row") || inputEl.parentElement;
  addRow.appendChild(dropdownEl);

  function renderSuggestions() {
    const usedIds = new Set(activeCategories.map(c => c.id));
    const query = inputEl.value.trim().toLowerCase();
    const matches = CB_SUGGESTED_CATEGORIES.filter(s =>
      !usedIds.has(s.id) && (!query || s.label.toLowerCase().includes(query))
    );
    if (!matches.length) {
      dropdownEl.style.display = "none";
      dropdownEl.innerHTML = "";
      return;
    }
    dropdownEl.innerHTML = matches.map(s =>
      `<button type="button" class="cb-versus-suggest-item" data-label="${_cbEscapeHtml(s.label)}">${_cbEscapeHtml(s.label)}</button>`
    ).join("");
    dropdownEl.querySelectorAll(".cb-versus-suggest-item").forEach(btn => {
      // mousedown+preventDefault (not click) so the input never loses focus
      // to the tap — a plain click would fire after blur already hid the
      // dropdown, especially on mobile.
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        addCategory(btn.dataset.label);
      });
    });
    dropdownEl.style.display = "block";
  }

  inputEl.addEventListener("focus", renderSuggestions);
  inputEl.addEventListener("input", renderSuggestions);
  inputEl.addEventListener("blur", () => {
    setTimeout(() => { dropdownEl.style.display = "none"; }, 150);
  });

  // Attached to the array itself (not a separate return shape) so every
  // existing caller that treats the return value as a plain array of
  // categories keeps working unchanged — only a caller that wants the
  // "Randomize Categories" swap needs to know this exists.
  activeCategories.replaceAll = (newList) => {
    activeCategories.length = 0;
    newList.forEach(c => activeCategories.push({ ...c }));
    render();
    renderSuggestions();
  };

  return activeCategories;
}

function _cbEscapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Optional "Randomize Categories" control shown next to the letter wheel —
// re-rolls a fresh 5-category set from CB_SUGGESTED_CATEGORIES as many times
// as the player likes before they spin their letter. Never auto-applies: if
// the player leaves it alone, whatever they picked on setup is used
// unchanged — onRandomize only fires on an actual click. getCurrent() lets
// the caller read back whichever set (setup's or a randomized one) is
// active right now, at the moment the letter spin locks it in.
function cbRenderRandomizeCategoriesBox(container, { onRandomize } = {}) {
  let current = null;

  function render() {
    const previewText = current
      ? `Using: ${current.map(c => c.label).join(", ")}`
      : "Optional — leave as-is to keep the categories you picked, or roll a random set.";
    container.innerHTML = `
      <div class="cb-randomize-box">
        <button type="button" class="secondary-btn" id="cbRandomizeCategoriesBtn">🎲 Randomize Categories (optional)</button>
        <p class="cb-versus-hint">${_cbEscapeHtml(previewText)}</p>
      </div>`;
    container.querySelector("#cbRandomizeCategoriesBtn").addEventListener("click", () => {
      current = cbRandomCategories(5);
      if (typeof onRandomize === "function") onRandomize(current);
      render();
    });
  }
  render();

  return { getCurrent: () => current };
}

function cbPickLetter(excludeLetters) {
  const pool = CB_ALPHABET.filter(l => !excludeLetters || !excludeLetters.has(l));
  const choices = pool.length ? pool : CB_ALPHABET; // excludeLetters covers all 26 → caller should reset first, but never hang
  return choices[Math.floor(Math.random() * choices.length)];
}

// onResult(letter) fires after the spin animation settles.
function cbSpinWheel(container, { onResult, excludeLetters, spinMs = 1400 } = {}) {
  const letter = cbPickLetter(excludeLetters);
  container.innerHTML = `
    <div class="cb-wheel">
      <div class="cb-wheel-letter" id="cbWheelLetter">?</div>
      <button class="primary-btn cb-spin-btn" id="cbSpinBtn">Spin</button>
    </div>`;
  const letterEl = container.querySelector("#cbWheelLetter");
  const btn = container.querySelector("#cbSpinBtn");
  btn.onclick = () => {
    btn.disabled = true;
    const tickMs = 60;
    const maxTicks = Math.round(spinMs / tickMs);
    let ticks = 0;
    const interval = setInterval(() => {
      letterEl.textContent = CB_ALPHABET[Math.floor(Math.random() * CB_ALPHABET.length)];
      ticks++;
      if (ticks >= maxTicks) {
        clearInterval(interval);
        letterEl.textContent = letter;
        letterEl.classList.add("cb-wheel-letter--landed");
        setTimeout(() => { if (typeof onResult === "function") onResult(letter); }, 400);
      }
    }, tickMs);
  };
}

// categories: [{id, label}]. onSubmit({answers, elapsedMs}) fires on manual
// submit or timer expiry — grading is NOT done here, see cbGradeRound.
function cbRenderRound(container, { letter, categories, seconds = 60, onSubmit } = {}) {
  const startedAt = Date.now();
  const inputsHtml = categories.map(c => `
    <div class="cb-input-row">
      <label class="cb-input-label" for="cbInput_${_cbEscapeHtml(c.id)}">${_cbEscapeHtml(c.label)}</label>
      <input class="cb-input" id="cbInput_${_cbEscapeHtml(c.id)}" type="text" autocomplete="off" maxlength="40" placeholder="${_cbEscapeHtml(letter)}…" />
    </div>`).join("");

  container.innerHTML = `
    <div class="cb-round">
      <div class="cb-round-header">
        <div class="cb-round-letter">${_cbEscapeHtml(letter)}</div>
        <div class="cb-round-timer" id="cbTimer">${seconds}</div>
      </div>
      <div class="cb-inputs">${inputsHtml}</div>
      <p class="cb-round-error" id="cbRoundError" style="display:none"></p>
      <button class="primary-btn cb-submit-btn" id="cbSubmitBtn">Submit</button>
    </div>`;

  const headerEl = container.querySelector(".cb-round-header");
  const timerEl = container.querySelector("#cbTimer");
  const submitBtn = container.querySelector("#cbSubmitBtn");
  const errorEl = container.querySelector("#cbRoundError");
  let remaining = seconds;
  let done = false;

  // CSS `position: sticky` alone doesn't reliably track the on-screen
  // keyboard on mobile — the browser scrolls the page to keep the focused
  // input visible, but some mobile browsers don't recompute the sticky
  // header's position against that keyboard-driven scroll. The
  // VisualViewport API reports the actual visible area, so nudge the
  // header down to match whenever it changes (keyboard open/close/resize).
  let vvCleanup = null;
  if (headerEl && window.visualViewport) {
    const vv = window.visualViewport;
    const syncHeaderOffset = () => { headerEl.style.top = `${Math.max(0, vv.offsetTop)}px`; };
    vv.addEventListener("resize", syncHeaderOffset);
    vv.addEventListener("scroll", syncHeaderOffset);
    syncHeaderOffset();
    vvCleanup = () => {
      vv.removeEventListener("resize", syncHeaderOffset);
      vv.removeEventListener("scroll", syncHeaderOffset);
    };
  }

  function inputEl(id) { return container.querySelector(`#cbInput_${CSS.escape(id)}`); }

  function collect() {
    const answers = {};
    categories.forEach(c => { const el = inputEl(c.id); answers[c.id] = el ? el.value : ""; });
    return answers;
  }

  // A non-blank answer that doesn't start with the round's letter can never
  // score — catching it before submit (rather than after, in cbGradeRound)
  // saves the player from silently losing a category to a typo.
  function findMismatch() {
    for (const c of categories) {
      const el = inputEl(c.id);
      const val = el ? el.value.trim() : "";
      if (val && val[0].toUpperCase() !== String(letter).toUpperCase()) return c;
    }
    return null;
  }

  // Every category needs a word before a manual submit — only the timer
  // expiry path (force=true) may submit blanks, same as it already bypasses
  // the mismatch check above.
  function findBlank() {
    for (const c of categories) {
      const el = inputEl(c.id);
      if (!el || !el.value.trim()) return c;
    }
    return null;
  }

  categories.forEach(c => {
    const el = inputEl(c.id);
    if (el) el.addEventListener("input", () => {
      const val = el.value.trim();
      const mismatched = val && val[0].toUpperCase() !== String(letter).toUpperCase();
      el.classList.toggle("cb-input--invalid", !!mismatched);
      if (errorEl.style.display !== "none" && !findMismatch() && !findBlank()) errorEl.style.display = "none";
    });
  });

  // force=true skips validation — used by the timer expiry path, which must
  // always submit whatever's there rather than get stuck waiting on a fix.
  function finish(force) {
    if (done) return;
    if (!force) {
      const mismatch = findMismatch();
      if (mismatch) {
        errorEl.textContent = `"${mismatch.label}" needs to start with ${letter} — fix it or clear it to submit.`;
        errorEl.style.display = "block";
        return;
      }
      const blank = findBlank();
      if (blank) {
        errorEl.textContent = `Fill in "${blank.label}" before submitting — every category needs a word.`;
        errorEl.style.display = "block";
        return;
      }
    }
    done = true;
    clearInterval(tickInterval);
    if (vvCleanup) vvCleanup();
    submitBtn.disabled = true;
    const elapsedMs = Date.now() - startedAt;
    if (typeof onSubmit === "function") onSubmit({ answers: collect(), elapsedMs });
  }

  const tickInterval = setInterval(() => {
    remaining--;
    timerEl.textContent = String(Math.max(remaining, 0));
    if (remaining <= 0) finish(true);
  }, 1000);

  submitBtn.onclick = () => finish(false);

  // Lets a caller end the round early from the outside — e.g. Category
  // Blitz Versus Online force-submits your in-progress answers (blanks and
  // all, same as a timeout) the moment your opponent submits theirs, so the
  // round ends for both of you together instead of you finishing at your
  // own pace while they wait.
  return { forceSubmit: () => finish(true) };
}

// Pure, synchronous-feeling grading — no human-in-the-loop step, no blocking
// per-word prompts. An unmatched word (right letter, non-blank, just not in
// the wordlist) scores 0 by default and is logged as a candidate; Versus
// lets a player upgrade it afterward via the "Correct" toggle in
// cbRenderResult (contestable: true), never during grading itself.
// mode: 'daily' | 'solo' | 'versus', for candidate logging only.
async function cbGradeRound({ letter, categories, answers, elapsedMs, mode } = {}) {
  const perCategory = {};
  let score = 0;
  for (const c of categories) {
    const raw = answers[c.id] || "";
    const result = await cbCheckAnswer(c.id, letter, raw);
    // Only log real wordlist misses as review candidates — a free-text
    // custom category has no wordlist file to ever fix, so logging it would
    // just fill catblitz_candidates with one-off, unreviewable noise.
    if (result.status === "unrecognized" && !result.noWordlist) cbLogCandidate(c.id, letter, result.word, mode, null);
    perCategory[c.id] = { status: result.status, answer: raw.trim(), noWordlist: !!result.noWordlist };
    if (result.status === "correct") score++;
  }
  return { perCategory, score, elapsedMs: elapsedMs || 0 };
}

// extra: optional HTML string or DOM Node appended into the result box, for
// each mode's own bolt-on (streak line, spin-again CTA, versus scoreboard).
// contestable: Solo and Versus both pass true — every row the wordlist
// wasn't 100% sure about gets its own icon PLUS a separate "Mark as
// Correct" / "Mark as Incorrect" toggle button next to it (not merged into
// the icon or the answer text, so it reads as its own control, not part of
// the answer): 'unrecognized' rows (right letter, non-blank, just not in
// the wordlist) can be upgraded via "Mark as Correct"; 'correct' rows (the
// wordlist matched) can be downgraded via "Mark as Incorrect", in case the
// auto-match was wrong. Plain 'incorrect' rows (blank / wrong letter) are
// never ambiguous, so they get no toggle. letter/mode are only used to log
// a confirmed:true candidate when a row is upgraded to correct. Returns
// { getScore, getContested } so the caller can read the live, post-toggle
// score when ready to lock it in.
function cbRenderResult(container, gradeResult, { extra, categories, contestable, letter, mode } = {}) {
  const cats = categories || [];
  const contested = {};

  function isAccepted(c) {
    const entry = gradeResult.perCategory[c.id];
    if (!entry) return false;
    const toggled = !!contested[c.id];
    if (entry.status === "correct") return !toggled;
    if (entry.status === "unrecognized") return toggled;
    return false;
  }
  function computeScore() {
    return cats.reduce((sum, c) => sum + (isAccepted(c) ? 1 : 0), 0);
  }

  function render() {
    const rows = cats.map(c => {
      const entry = gradeResult.perCategory[c.id] || { status: "incorrect", answer: "" };
      const accepted = isAccepted(c);
      const toggleable = contestable && (entry.status === "unrecognized" || entry.status === "correct");
      const toggled = !!contested[c.id];
      const rowStatus = accepted ? "correct" : (toggleable ? "unrecognized" : "incorrect");
      const answerHtml = entry.answer ? _cbEscapeHtml(entry.answer) : `<span class="cb-result-blank">(blank)</span>`;
      const icon = `<span class="cb-result-icon">${accepted ? "✓" : "✗"}</span>`;
      const toggleLabel = entry.status === "correct" ? "Mark as Incorrect" : "Mark as Correct";
      const toggleBtn = toggleable
        ? `<button type="button" class="cb-contest-btn" data-cat="${_cbEscapeHtml(c.id)}">${toggled ? "Undo" : toggleLabel}</button>`
        : "";
      return `<div class="cb-result-row cb-result-row--${rowStatus}">
        <span class="cb-result-label">${_cbEscapeHtml(c.label)}</span>
        <span class="cb-result-answer">${answerHtml}</span>
        ${icon}${toggleBtn}
      </div>`;
    }).join("");
    scoreEl.textContent = `${computeScore()} / ${cats.length}`;
    breakdownEl.innerHTML = rows;
    if (contestable) {
      breakdownEl.querySelectorAll(".cb-contest-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const cid = btn.dataset.cat;
          contested[cid] = !contested[cid];
          const entry = gradeResult.perCategory[cid];
          // Only log an upgrade (unrecognized -> correct) as a review
          // candidate — a downgrade flags a bad auto-match, not a wordlist
          // gap, so there's nothing for the candidate table to review.
          if (contested[cid] && entry && entry.status === "unrecognized") {
            cbLogCandidate(cid, letter, entry.answer.toLowerCase(), mode, true);
          }
          render();
        });
      });
    }
  }

  container.innerHTML = `
    <div class="cb-result">
      <div class="cb-result-score"></div>
      <div class="cb-result-breakdown"></div>
      <div class="cb-result-extra" id="cbResultExtra"></div>
    </div>`;
  const scoreEl = container.querySelector(".cb-result-score");
  const breakdownEl = container.querySelector(".cb-result-breakdown");
  render();

  const extraEl = container.querySelector("#cbResultExtra");
  if (extra && extraEl) {
    if (typeof extra === "string") extraEl.innerHTML = extra;
    else if (extra instanceof Node) extraEl.appendChild(extra);
  }

  return { getScore: computeScore, getContested: () => ({ ...contested }) };
}

// ── Category Blitz feedback banner ──────────────────────────────────────────
// Same shape as Hard Mode's beta feedback box (see hmFeedbackBoxHtml/
// hmBindFeedbackBox in app.js), reused for Category Blitz instead of building
// a second copy. Shared across Solo and Versus -- a "rounds completed"
// counter that either mode can bump, one asked flag so a player who tries
// both isn't asked twice. Call cbFeedbackBoxHtml() once per completed
// round/match (it does its own counting) to get the HTML to splice in right
// before each page's "Leave Feedback" link, then call cbBindFeedbackBox()
// once that HTML is actually in the DOM.
const CB_FEEDBACK_ASKED_KEY = "cbFeedbackAsked";
const CB_FEEDBACK_ROUNDS_KEY = "cbFeedbackRoundsCompleted";
const CB_FEEDBACK_ROUNDS_THRESHOLD = 2;

function cbFeedbackBoxHtml() {
  let asked = false;
  try { asked = localStorage.getItem(CB_FEEDBACK_ASKED_KEY) === "true"; } catch {}
  if (asked) return "";
  let rounds = 0;
  try { rounds = parseInt(localStorage.getItem(CB_FEEDBACK_ROUNDS_KEY) || "0", 10) || 0; } catch {}
  rounds += 1;
  try { localStorage.setItem(CB_FEEDBACK_ROUNDS_KEY, String(rounds)); } catch {}
  if (rounds < CB_FEEDBACK_ROUNDS_THRESHOLD) return "";
  return `
    <div class="hm-feedback-box" id="cbFeedbackBox">
      <p class="hm-feedback-title">Enjoying Category Blitz?</p>
      <div class="hm-feedback-vote-row">
        <button type="button" class="secondary-btn hm-feedback-vote" data-vote="keep">Keep it</button>
        <button type="button" class="secondary-btn hm-feedback-vote" data-vote="not_for_me">Not for me</button>
        <button type="button" class="hm-feedback-dismiss" id="cbFeedbackDismiss">No thanks</button>
      </div>
      <div id="cbFeedbackDetail" style="display:none;">
        <textarea id="cbFeedbackText" class="form-input" placeholder="Anything else? (optional)"></textarea>
        <button type="button" class="primary-btn" id="cbFeedbackSend">Send feedback</button>
      </div>
      <p class="hm-feedback-sent" id="cbFeedbackSent" style="display:none;">Thanks for the feedback!</p>
    </div>
  `;
}

function cbBindFeedbackBox() {
  const box = document.getElementById("cbFeedbackBox");
  if (!box) return;
  let vote = "";
  const detail = document.getElementById("cbFeedbackDetail");
  const sendBtn = document.getElementById("cbFeedbackSend");
  const dismissBtn = document.getElementById("cbFeedbackDismiss");
  const sentMsg = document.getElementById("cbFeedbackSent");
  const textArea = document.getElementById("cbFeedbackText");
  const finish = () => { try { localStorage.setItem(CB_FEEDBACK_ASKED_KEY, "true"); } catch {} };
  box.querySelectorAll(".hm-feedback-vote").forEach(btn => {
    btn.addEventListener("click", () => {
      vote = btn.dataset.vote;
      box.querySelectorAll(".hm-feedback-vote").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      if (detail) detail.style.display = "block";
      if (typeof gtag === "function") gtag("event", "catblitz_feedback_vote_" + vote);
    });
  });
  if (dismissBtn) dismissBtn.addEventListener("click", () => {
    finish();
    box.style.display = "none";
    if (typeof gtag === "function") gtag("event", "catblitz_feedback_dismissed", {});
  });
  if (sendBtn) sendBtn.addEventListener("click", async () => {
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending...";
    try {
      await fetch(HM_FEEDBACK_FORMSPREE, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          type: "catblitz_feedback",
          vote: vote || "no_vote",
          message: textArea ? textArea.value.trim() : "",
          page: location.pathname + location.search,
          _subject: "Trivia Gauntlet Category Blitz Feedback",
        }),
      });
    } catch {}
    finish();
    if (detail) detail.style.display = "none";
    box.querySelectorAll(".hm-feedback-vote, .hm-feedback-dismiss").forEach(el => el.style.display = "none");
    if (sentMsg) sentMsg.style.display = "block";
    if (typeof gtag === "function") gtag("event", "catblitz_feedback_sent_" + (vote || "no_vote"));
  });
}
