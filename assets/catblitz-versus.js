// ── Category Blitz — Versus (local pass-and-play) ───────────────────────────
// Best of 3/5/13 (13 = a full game: 2 players × 13 rounds = all 26 letters).
// Each round both players spin (match-scoped no-repeat letters), 60s each.
// Grading is immediate and non-blocking — no per-word yes/no interrupt.
// Each player's full result (wordlist-matched categories already scored)
// shows right after their own submit; any 'unrecognized' category gets a
// "Contest" toggle instead of a fixed icon — one tap, no confirm dialog, no
// asking who's "right." Custom categories (free text, no wordlist) are
// always contestable the same way, no special-casing. Ad gate: first round
// free, then one rewarded ad per additional round, shared by both players
// (not per-turn, not per-match). Web: 1 free round, SHARED with Solo — using
// either mode once uses up the single allowance and walls both
// (cbGetWebPlayUsed/cbMarkWebPlayUsed in catblitz-engine.js). Tie-break:
// lower total elapsed time wins (no bonus point — keeps scoring clean).
//
// Match state persists in localStorage (cbVersusMatch) so the ad-gated
// "Continue" link can do a real page navigation (required for admob.js's
// rewarded-ad click listener) and resume correctly on reload.

const CB_VERSUS_KEY = "cbVersusMatch";
// Pass-and-play is meant for one sitting — a match older than this is treated
// as abandoned rather than resumed days later (see cbVersusMatchIsStale).
const CB_VERSUS_EXPIRY_MS = 6 * 60 * 60 * 1000; // 6 hours
const CB_VERSUS_DEFAULT_CATEGORIES = [
  { id: "name", label: "Name" },
  { id: "animal", label: "Animal" },
  { id: "place", label: "Place" },
  { id: "thing", label: "Thing" },
  { id: "food", label: "Food" },
];

function cbVersusLoadMatch() {
  try { return JSON.parse(localStorage.getItem(CB_VERSUS_KEY) || "null"); } catch { return null; }
}
function cbVersusSaveMatch(state) {
  state.updatedAt = Date.now();
  localStorage.setItem(CB_VERSUS_KEY, JSON.stringify(state));
}
function cbVersusClearMatch() {
  localStorage.removeItem(CB_VERSUS_KEY);
}
function cbVersusMatchIsStale(state) {
  return !state.updatedAt || (Date.now() - state.updatedAt) > CB_VERSUS_EXPIRY_MS;
}

// ── Setup screen ─────────────────────────────────────────────────────────
function cbRenderVersusSetup() {
  let matchLength = 5;

  const lengthRow = document.getElementById("cbVersusLengthRow");
  lengthRow.querySelectorAll(".cb-versus-length-btn").forEach(btn => {
    if (parseInt(btn.dataset.len, 10) === matchLength) btn.classList.add("selected");
    btn.addEventListener("click", () => {
      matchLength = parseInt(btn.dataset.len, 10);
      lengthRow.querySelectorAll(".cb-versus-length-btn").forEach(b => b.classList.toggle("selected", b === btn));
    });
  });

  // All categories are equally removable, defaults included — no reason to
  // lock them once custom ones are removable too. Guarded to never drop
  // below 1 (nothing left to play otherwise).
  const activeCategories = cbRenderCategoryPicker({
    listEl: document.getElementById("cbVersusCategoryList"),
    inputEl: document.getElementById("cbVersusNewCategory"),
    addBtnEl: document.getElementById("cbVersusAddCategoryBtn"),
    initialCategories: CB_VERSUS_DEFAULT_CATEGORIES,
  });

  document.getElementById("cbVersusStartBtn").addEventListener("click", async () => {
    const p1Name = (document.getElementById("cbVersusP1Name").value.trim() || "Player 1").slice(0, 20);
    const p2Name = (document.getElementById("cbVersusP2Name").value.trim() || "Player 2").slice(0, 20);
    const state = {
      matchLength,
      p1Name, p2Name,
      categories: activeCategories,
      usedLetters: [],
      round: 1,
      scores: { p1: 0, p2: 0 },
      elapsedMs: { p1: 0, p2: 0 },
    };
    cbVersusSaveMatch(state);
    document.getElementById("cbVersusSetup").style.display = "none";
    document.getElementById("cbVersusPlay").style.display = "block";
    if (typeof adMobShowGameStartInterstitial === "function") await adMobShowGameStartInterstitial();
    cbVersusStartRound(state);
  });
}

// ── Play loop ────────────────────────────────────────────────────────────
function cbVersusStartRound(state) {
  const limited = typeof isLimitedWeb === "function" && isLimitedWeb();
  const playEl = document.getElementById("cbVersusPlay");

  if (limited && cbGetWebPlayUsed()) {
    playEl.innerHTML = typeof webWallHTML === "function"
      ? webWallHTML("Come back with the app for unlimited Versus 🎉", null, "rounds", 1) : "";
    return;
  }

  const statusEl = document.getElementById("cbVersusStatus");
  const wheelContainer = document.getElementById("cbWheelContainer");
  const roundEl = document.getElementById("cbRoundContainer");
  wheelContainer.style.display = "block";
  roundEl.style.display = "none";

  if (statusEl) statusEl.textContent = `Round ${state.round} of ${state.matchLength} — ${state.p1Name}'s turn`;

  cbSpinWheel(wheelContainer, {
    excludeLetters: new Set(state.usedLetters),
    onResult: (p1Letter) => {
      state.usedLetters.push(p1Letter);
      wheelContainer.style.display = "none";
      roundEl.style.display = "block";
      cbRenderRound(roundEl, {
        letter: p1Letter, categories: state.categories, seconds: 60,
        onSubmit: async ({ answers, elapsedMs }) => {
          const grade = await cbGradeRound({ letter: p1Letter, categories: state.categories, answers, elapsedMs, mode: "versus" });
          cbVersusShowTurnResult(state, state.p1Name, p1Letter, grade, (finalScore) => {
            cbVersusPlaySecondTurn(state, finalScore, elapsedMs);
          });
        },
      });
    },
  });
}

function cbVersusPlaySecondTurn(state, p1Score, p1ElapsedMs) {
  const statusEl = document.getElementById("cbVersusStatus");
  const wheelContainer = document.getElementById("cbWheelContainer");
  const roundEl = document.getElementById("cbRoundContainer");
  roundEl.style.display = "none";
  wheelContainer.style.display = "block";
  if (statusEl) statusEl.textContent = `Round ${state.round} of ${state.matchLength} — ${state.p2Name}'s turn`;

  cbSpinWheel(wheelContainer, {
    excludeLetters: new Set(state.usedLetters),
    onResult: (p2Letter) => {
      state.usedLetters.push(p2Letter);
      cbVersusSaveMatch(state);
      wheelContainer.style.display = "none";
      roundEl.style.display = "block";
      cbRenderRound(roundEl, {
        letter: p2Letter, categories: state.categories, seconds: 60,
        onSubmit: async ({ answers, elapsedMs }) => {
          const grade = await cbGradeRound({ letter: p2Letter, categories: state.categories, answers, elapsedMs, mode: "versus" });
          cbVersusShowTurnResult(state, state.p2Name, p2Letter, grade, (finalScore) => {
            cbVersusFinishRound(state, p1Score, p1ElapsedMs, finalScore, elapsedMs);
          });
        },
      });
    },
  });
}

// Shows one player's full result immediately (already scored — no waiting on
// anyone), with a "Contest" toggle on any unmatched category instead of a
// blocking prompt. onLockedIn(finalScore) fires when they tap "Lock In".
function cbVersusShowTurnResult(state, playerName, letter, grade, onLockedIn) {
  const statusEl = document.getElementById("cbVersusStatus");
  const roundEl = document.getElementById("cbRoundContainer");
  if (statusEl) statusEl.textContent = `${playerName} — round result`;
  const api = cbRenderResult(roundEl, grade, {
    categories: state.categories,
    contestable: true,
    letter, mode: "versus",
    extra: `<button type="button" class="primary-btn cb-lockin-btn" id="cbLockInBtn" style="width:100%;margin-top:10px;">Lock In Score</button>`,
  });
  document.getElementById("cbLockInBtn").addEventListener("click", () => onLockedIn(api.getScore()));
}

function cbVersusFinishRound(state, p1Score, p1ElapsedMs, p2Score, p2ElapsedMs) {
  state.scores.p1 += p1Score;
  state.scores.p2 += p2Score;
  state.elapsedMs.p1 += p1ElapsedMs;
  state.elapsedMs.p2 += p2ElapsedMs;
  const completedRound = state.round;
  state.round += 1;
  cbVersusSaveMatch(state);
  if (completedRound === 1 && typeof isLimitedWeb === "function" && isLimitedWeb()) cbMarkWebPlayUsed();
  cbVersusShowRoundResult(state, completedRound, p1Score, p2Score);
}

function cbVersusShowRoundResult(state, completedRound, p1Score, p2Score) {
  document.getElementById("cbVersusPlay").style.display = "none";
  const resultEl = document.getElementById("cbVersusRoundResult");
  resultEl.style.display = "block";
  const aheadLine = state.scores.p1 === state.scores.p2
    ? "Tied so far"
    : `${_cbEscapeHtml(state.scores.p1 > state.scores.p2 ? state.p1Name : state.p2Name)} is ahead`;
  document.getElementById("cbVersusRoundResultBox").innerHTML = `
    <p class="daily-date">Round ${completedRound} of ${state.matchLength}</p>
    <div class="cb-versus-final-score">
      <div><strong>${_cbEscapeHtml(state.p1Name)}</strong>: +${p1Score} this round — ${state.scores.p1} total</div>
      <div><strong>${_cbEscapeHtml(state.p2Name)}</strong>: +${p2Score} this round — ${state.scores.p2} total</div>
    </div>
    <p class="daily-date" style="margin-top:8px;">${aheadLine}</p>
  `;

  const continueBox = document.getElementById("cbVersusContinueBox");
  if (state.round > state.matchLength) {
    continueBox.innerHTML = `<button type="button" class="primary-btn" id="cbVersusSeeFinalBtn" style="width:100%">See Final Result</button>`;
    document.getElementById("cbVersusSeeFinalBtn").addEventListener("click", () => cbVersusShowFinal(state));
    return;
  }

  const limited = typeof isLimitedWeb === "function" && isLimitedWeb();
  if (limited && cbGetWebPlayUsed()) {
    continueBox.innerHTML = typeof webWallHTML === "function"
      ? webWallHTML("Nice round! 🎉", null, "rounds", 1) : "";
    return;
  }

  const isPremium = typeof isPremiumUser === "function" && isPremiumUser();
  const gateThisRound = !isPremium && !limited; // first round free, every round after costs an ad
  const href = "category-blitz-versus.html";
  continueBox.innerHTML = `<a class="primary-btn cb-versus-continue-btn" href="${href}" style="display:block;text-align:center;text-decoration:none;"${gateThisRound ? ` data-rewarded-href="${href}"` : ""}>Continue to Round ${state.round}</a>`;
}

function cbVersusShowFinal(state) {
  document.getElementById("cbVersusRoundResult").style.display = "none";
  const finalEl = document.getElementById("cbVersusFinal");
  finalEl.style.display = "block";

  let winner;
  if (state.scores.p1 > state.scores.p2) winner = state.p1Name;
  else if (state.scores.p2 > state.scores.p1) winner = state.p2Name;
  else winner = state.elapsedMs.p1 <= state.elapsedMs.p2 ? state.p1Name : state.p2Name;

  const tieNote = state.scores.p1 === state.scores.p2
    ? `<p class="daily-date">Tied on score — decided by total time (faster wins)</p>` : "";

  document.getElementById("cbVersusFinalBox").innerHTML = `
    <div class="cb-versus-final-score">
      <div><strong>${_cbEscapeHtml(state.p1Name)}</strong>: ${state.scores.p1}</div>
      <div><strong>${_cbEscapeHtml(state.p2Name)}</strong>: ${state.scores.p2}</div>
    </div>
    ${tieNote}
    <p class="cb-versus-winner">🏆 ${_cbEscapeHtml(winner)} wins!</p>
  `;

  const feedbackWrap = document.getElementById("cbFeedbackBoxWrap");
  if (feedbackWrap) {
    feedbackWrap.innerHTML = cbFeedbackBoxHtml();
    cbBindFeedbackBox();
  }

  cbVersusClearMatch();
}

// Offered instead of auto-resuming so a match from earlier the same sitting
// doesn't force itself back on you — you can still bail into a fresh match.
function cbRenderVersusResumeChoice(state) {
  document.getElementById("cbVersusSetup").style.display = "none";
  document.getElementById("cbVersusResumeChoice").style.display = "block";
  document.getElementById("cbVersusResumeSummary").textContent =
    `Round ${state.round} of ${state.matchLength} — ${state.p1Name} ${state.scores.p1}, ${state.p2Name} ${state.scores.p2}`;
  document.getElementById("cbVersusResumeBtn").addEventListener("click", async () => {
    document.getElementById("cbVersusResumeChoice").style.display = "none";
    document.getElementById("cbVersusPlay").style.display = "block";
    if (typeof adMobShowGameStartInterstitial === "function") await adMobShowGameStartInterstitial();
    cbVersusStartRound(state);
  });
  document.getElementById("cbVersusNewMatchBtn").addEventListener("click", () => {
    cbVersusClearMatch();
    document.getElementById("cbVersusResumeChoice").style.display = "none";
    document.getElementById("cbVersusSetup").style.display = "block";
    cbRenderVersusSetup();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "catblitz-versus") return;
  const existing = cbVersusLoadMatch();
  if (existing && cbVersusMatchIsStale(existing)) {
    cbVersusClearMatch();
    cbRenderVersusSetup();
  } else if (existing && existing.round <= existing.matchLength) {
    cbRenderVersusResumeChoice(existing);
  } else {
    if (existing) cbVersusClearMatch();
    cbRenderVersusSetup();
  }
});
