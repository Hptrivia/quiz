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

// Shared add/remove category picker used by both Solo and Versus setup
// screens. Renders removable pills into listEl (guarded to never drop below
// 1 category) and wires the free-text add row. Returns the live array —
// read it whenever the caller's Start button fires, after editing is done.
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
      });
    });
  }
  render();

  addBtnEl.addEventListener("click", () => {
    const label = inputEl.value.trim();
    if (!label) return;
    const usedIds = new Set(activeCategories.map(c => c.id));
    let id = cbSlugify(label);
    let n = 2;
    while (usedIds.has(id)) { id = `${cbSlugify(label)}-${n++}`; }
    activeCategories.push({ id, label });
    inputEl.value = "";
    render();
  });

  return activeCategories;
}

function _cbEscapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

  const timerEl = container.querySelector("#cbTimer");
  const submitBtn = container.querySelector("#cbSubmitBtn");
  const errorEl = container.querySelector("#cbRoundError");
  let remaining = seconds;
  let done = false;

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

  categories.forEach(c => {
    const el = inputEl(c.id);
    if (el) el.addEventListener("input", () => {
      const val = el.value.trim();
      const mismatched = val && val[0].toUpperCase() !== String(letter).toUpperCase();
      el.classList.toggle("cb-input--invalid", !!mismatched);
      if (errorEl.style.display !== "none" && !findMismatch()) errorEl.style.display = "none";
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
    }
    done = true;
    clearInterval(tickInterval);
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
// contestable: Solo and Versus both pass true — 'unrecognized' rows get a
// "Correct" toggle button instead of a fixed icon; tapping it flips that
// category between counted/not-counted, no confirmation dialog. Applies to
// ANY unrecognized word, not just wordlist-less custom categories — a real
// miss against an existing wordlist is contestable too, same as Versus.
// letter/mode are only used to log a confirmed:true candidate when a
// contest is accepted. Returns { getScore, getContested } so the caller can
// read the live, post-contest score when ready to lock it in.
function cbRenderResult(container, gradeResult, { extra, categories, contestable, letter, mode } = {}) {
  const cats = categories || [];
  const contested = {};

  function isAccepted(c) {
    const entry = gradeResult.perCategory[c.id];
    return entry && (entry.status === "correct" || contested[c.id]);
  }
  function computeScore() {
    return cats.reduce((sum, c) => sum + (isAccepted(c) ? 1 : 0), 0);
  }

  function render() {
    const rows = cats.map(c => {
      const entry = gradeResult.perCategory[c.id] || { status: "incorrect", answer: "" };
      const accepted = isAccepted(c);
      const showContest = contestable && entry.status === "unrecognized";
      const rowStatus = accepted ? "correct" : (showContest ? "unrecognized" : "incorrect");
      const answerHtml = entry.answer ? _cbEscapeHtml(entry.answer) : `<span class="cb-result-blank">(blank)</span>`;
      const rightCell = showContest
        ? `<button type="button" class="cb-contest-btn${accepted ? " cb-contest-btn--accepted" : ""}" data-cat="${_cbEscapeHtml(c.id)}">${accepted ? "Accepted ✓" : "Correct"}</button>`
        : `<span class="cb-result-icon">${accepted ? "✓" : "✗"}</span>`;
      return `<div class="cb-result-row cb-result-row--${rowStatus}">
        <span class="cb-result-label">${_cbEscapeHtml(c.label)}</span>
        <span class="cb-result-answer">${answerHtml}</span>
        ${rightCell}
      </div>`;
    }).join("");
    scoreEl.textContent = `${computeScore()} / ${cats.length}`;
    breakdownEl.innerHTML = rows;
    if (contestable) {
      breakdownEl.querySelectorAll(".cb-contest-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const cid = btn.dataset.cat;
          contested[cid] = !contested[cid];
          if (contested[cid]) {
            const entry = gradeResult.perCategory[cid];
            if (entry) cbLogCandidate(cid, letter, entry.answer.toLowerCase(), mode, true);
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
