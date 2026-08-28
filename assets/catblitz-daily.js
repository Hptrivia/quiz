// ── Daily Blitz — Category Blitz's daily sub-mode ───────────────────────────
// Thin wrapper around catblitz-engine.js / catblitz-check.js: one spin/day,
// excludes previously-used letters (cycles all 26 before repeating), streak
// on participation (not perfect score), history includes elapsed time. No
// resolver passed to cbGradeRound — unmatched words are just wrong, no
// prompt, silently logged by cbLogCandidate for later review.

const CB_DAILY_CATEGORIES = [
  { id: "name", label: "Name" },
  { id: "animal", label: "Animal" },
  { id: "place", label: "Place" },
  { id: "thing", label: "Thing" },
  { id: "food", label: "Food" },
];

function cbTodayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function cbYesterdayKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// If the stored list already covers all 26, treat it as exhausted → the next
// spin starts a fresh cycle rather than having nothing left to pick from.
function cbGetUsedLettersForSpin() {
  const used = JSON.parse(localStorage.getItem("cbUsedLetters_daily") || "[]");
  return used.length >= 26 ? [] : used;
}
function cbRecordUsedLetter(letter) {
  const used = cbGetUsedLettersForSpin();
  if (!used.includes(letter)) used.push(letter);
  localStorage.setItem("cbUsedLetters_daily", JSON.stringify(used));
}

// Own streak/history keys — deliberately NOT shared with Daily Trivia's
// dcStreak/dcHistory, since this is a distinct daily habit.
function cbGetStreak() {
  return JSON.parse(localStorage.getItem("cbStreak_daily") || '{"current":0,"best":0,"lastCompleted":""}');
}
function cbUpdateStreak() {
  const dateKey = cbTodayKey();
  const streak = cbGetStreak();
  if (streak.lastCompleted === dateKey) return streak;
  streak.current = streak.lastCompleted === cbYesterdayKey() ? streak.current + 1 : 1;
  streak.best = Math.max(streak.best, streak.current);
  streak.lastCompleted = dateKey;
  localStorage.setItem("cbStreak_daily", JSON.stringify(streak));
  return streak;
}

function cbSaveHistory(date, score, total, elapsedMs) {
  const history = JSON.parse(localStorage.getItem("cbHistory_daily") || "[]");
  if (history.some(e => e.date === date)) return;
  history.push({ date, score, total, elapsedMs });
  if (history.length > 30) history.splice(0, history.length - 30);
  localStorage.setItem("cbHistory_daily", JSON.stringify(history));
}

function cbGetHistoryStats(todayDate, todayScore, todayElapsedMs, total) {
  const history = JSON.parse(localStorage.getItem("cbHistory_daily") || "[]");
  const past = history.filter(e => e.date !== todayDate);
  if (!past.length) return null;

  const scores = past.map(e => e.score);
  const best = Math.max(...scores);
  const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  const beatCount = scores.filter(s => todayScore > s).length;
  const percentile = Math.round((beatCount / scores.length) * 100);

  const times = past.filter(e => typeof e.elapsedMs === "number").map(e => e.elapsedMs);
  let speedLabel = null;
  if (times.length && typeof todayElapsedMs === "number") {
    const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
    const diffSec = Math.round((avgMs - todayElapsedMs) / 1000);
    speedLabel = diffSec > 2 ? `${diffSec}s faster than usual`
      : diffSec < -2 ? `${Math.abs(diffSec)}s slower than usual`
      : "About your usual pace";
  }

  return { best, avg, total, attempts: scores.length, percentile, speedLabel };
}

function cbSaveDailyResult(letter, gradeResult) {
  const dateKey = cbTodayKey();
  cbSaveHistory(dateKey, gradeResult.score, CB_DAILY_CATEGORIES.length, gradeResult.elapsedMs);
  const streak = cbUpdateStreak(); // participation counts, regardless of score
  cbRecordUsedLetter(letter);
  const result = {
    completed: true,
    letter,
    score: gradeResult.score,
    total: CB_DAILY_CATEGORIES.length,
    elapsedMs: gradeResult.elapsedMs,
    perCategory: gradeResult.perCategory,
    streak: streak.current,
    bestStreak: streak.best,
  };
  localStorage.setItem(`cbState_daily_${dateKey}`, JSON.stringify(result));
  if (typeof isLimitedWeb === "function" && isLimitedWeb()) {
    localStorage.setItem("cbWebDailyUsed_blitz", "true");
  }
  return result;
}

function cbGetDailyState() {
  const dateKey = cbTodayKey();
  const state = JSON.parse(localStorage.getItem(`cbState_daily_${dateKey}`) || "null");
  const streak = cbGetStreak();
  if (!state) return { completed: false, streak: streak.current, bestStreak: streak.best };
  return { ...state, streak: streak.current, bestStreak: streak.best };
}

async function cbRenderDailyPage() {
  const loadingEl = document.getElementById("cbLoading");
  const introEl = document.getElementById("cbDailyIntro");
  const roundEl = document.getElementById("cbRoundContainer");

  const state = cbGetDailyState();
  if (loadingEl) loadingEl.style.display = "none";
  if (state.completed) {
    cbShowDailyResult(state);
    return;
  }

  // Web (non-native, non-premium): one free Daily Blitz ever, not a daily
  // reset — every visit after that first completed play shows the app wall
  // instead of a new letter. Doesn't affect native app or premium.
  if (typeof isLimitedWeb === "function" && isLimitedWeb() && localStorage.getItem("cbWebDailyUsed_blitz") === "true") {
    if (introEl) {
      introEl.style.display = "block";
      introEl.innerHTML = typeof webWallHTML === "function"
        ? webWallHTML("You've played your free Daily Blitz 🎉", null, "daily games", 1) : "";
    }
    return;
  }

  if (introEl) introEl.style.display = "block";
  const wheelContainer = document.getElementById("cbWheelContainer");
  cbSpinWheel(wheelContainer, {
    excludeLetters: new Set(cbGetUsedLettersForSpin()),
    onResult: (letter) => {
      if (introEl) introEl.style.display = "none";
      if (roundEl) roundEl.style.display = "block";
      cbRenderRound(roundEl, {
        letter,
        categories: CB_DAILY_CATEGORIES,
        seconds: 45,
        onSubmit: async ({ answers, elapsedMs }) => {
          const gradeResult = await cbGradeRound({
            letter, categories: CB_DAILY_CATEGORIES, answers, elapsedMs, mode: "daily",
          });
          const savedState = cbSaveDailyResult(letter, gradeResult);
          roundEl.style.display = "none";
          cbShowDailyResult(savedState);
        },
      });
    },
  });
}

// Daily is one play per day on every platform (native, web, premium alike) —
// there's nothing repeatable to gate here, so the full result always shows,
// same as Daily Trivia/Wordle (see PLATFORM-BEHAVIOR.md's "never walled").
function cbShowDailyResult(state) {
  const resultEl = document.getElementById("cbResult");
  if (!resultEl) return;
  resultEl.style.display = "block";

  const containerEl = document.getElementById("cbResultContainer");
  if (containerEl) cbRenderResult(containerEl, state, { categories: CB_DAILY_CATEGORIES });

  const streakEl = document.getElementById("cbStreakBox");
  if (streakEl) {
    streakEl.innerHTML = `
      <div class="streak-current">🔥 ${state.streak} day streak</div>
      <div class="streak-best">Best: ${state.bestStreak} days</div>
    `;
  }

  const historyEl = document.getElementById("cbHistoryBox");
  if (historyEl) {
    const stats = cbGetHistoryStats(cbTodayKey(), state.score, state.elapsedMs, state.total);
    if (!stats) {
      historyEl.innerHTML = `<p class="daily-history-first">Play again tomorrow to start tracking your stats</p>`;
    } else {
      let label;
      if (stats.percentile >= 80) label = "One of your best";
      else if (stats.percentile >= 50) label = "Above your average";
      else if (stats.percentile >= 20) label = "Below your average";
      else label = "One of your tougher days";
      historyEl.innerHTML = `
        <div class="daily-history-stats">
          <div class="daily-history-stat"><span class="dhs-label">Personal best</span><span class="dhs-value">${stats.best}/${stats.total}</span></div>
          <div class="daily-history-stat"><span class="dhs-label">Your average</span><span class="dhs-value">${stats.avg}/${stats.total}</span></div>
          <div class="daily-history-stat"><span class="dhs-label">vs your history</span><span class="dhs-value">${label}</span></div>
          ${stats.speedLabel ? `<div class="daily-history-stat"><span class="dhs-label">Speed</span><span class="dhs-value">${stats.speedLabel}</span></div>` : ""}
        </div>`;
    }
  }

  cbStartCountdown();
}

function cbGetTimeUntilNextChallenge() {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const ms = Math.max(0, midnight - now);
  return { hours: Math.floor(ms / 3600000), minutes: Math.floor((ms % 3600000) / 60000), seconds: Math.floor((ms % 60000) / 1000) };
}
function cbStartCountdown() {
  const el = document.getElementById("cbCountdown");
  if (!el) return;
  function tick() {
    const { hours, minutes, seconds } = cbGetTimeUntilNextChallenge();
    el.textContent = `Next Daily Blitz in ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  tick();
  setInterval(tick, 1000);
}

// Homepage card status (index.html — see the catblitz-daily-card wiring).
function cbInitDailyHomepageCard() {
  const card = document.querySelector(".catblitz-daily-card");
  if (!card) return;
  const state = cbGetDailyState();
  const streak = cbGetStreak();
  const ctaEl = card.querySelector(".daily-card-cta");
  const subEl = card.querySelector(".daily-card-sub");
  if (ctaEl) ctaEl.textContent = state.completed ? "Come back tomorrow" : "Play today's letter";
  if (subEl) {
    const missedDay = streak.lastCompleted && streak.lastCompleted !== cbTodayKey() && streak.lastCompleted !== cbYesterdayKey();
    if (missedDay) subEl.textContent = "Streak lost — play today to start a new one";
    else if (streak.current > 0) subEl.textContent = `🔥 ${streak.current} day streak`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "daily-catblitz") cbRenderDailyPage();
  if (document.body.dataset.page === "home") cbInitDailyHomepageCard();
});
