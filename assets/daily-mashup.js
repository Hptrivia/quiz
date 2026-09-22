/* ── Daily Mashup ─────────────────────────────────────────────────── */
// Same "same questions all day, new set tomorrow" trick as Daily Trivia
// (assets/daily.js), but built from whichever 2-5 shows the player picked
// for themselves instead of a fixed pool — see PLATFORM-BEHAVIOR notes /
// project memory for the full design discussion.

const DM_SELECTED_KEY = "dmSelectedThemes";

/* ── PRNG (same algo as daily.js / daily-wordle.js) ── */
function dmRng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function dmHash(str) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function dmShuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── Date helpers (UTC) ── */
function dmTodayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

function dmYesterdayKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

/* ── Selected shows (picked once via the Mashup picker, remembered after) ── */
function dmGetSelectedThemes() {
  try { return JSON.parse(localStorage.getItem(DM_SELECTED_KEY) || "null"); }
  catch { return null; }
}

function dmSaveSelectedThemes(slugs) {
  localStorage.setItem(DM_SELECTED_KEY, JSON.stringify(slugs));
}

/* ── Question generation ── */
async function getDailyMashupQuestions(selectedSlugs) {
  const dateKey = dmTodayKey();
  const cacheKey = `dmQuestions_${dateKey}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);

  const allThemes = await fetchJSON("data/themes.json");
  const themesMeta = selectedSlugs
    .map(slug => allThemes.find(t => t.slug === slug))
    .filter(Boolean);
  if (!themesMeta.length) return [];

  const comboKey = [...selectedSlugs].sort().join(",");
  const rng = dmRng(dmHash(`${dateKey}_${comboKey}`));

  // 10 questions spread evenly across whichever shows they picked (2-5) —
  // repeat the theme list enough times to fill 10 slots, then shuffle so
  // it's not always the same order.
  const themeSequence = dmShuffle(
    Array.from({ length: 10 }, (_, i) => themesMeta[i % themesMeta.length]),
    rng
  );

  // Same difficulty spread as Daily Trivia.
  const baseSlots = ["easy","easy","easy","medium","medium","medium","hard","hard","hard","expert"];
  const slots     = dmShuffle(baseSlots, rng);

  const questions = [];

  for (let i = 0; i < themeSequence.length; i++) {
    const theme      = themeSequence[i];
    const difficulty = slots[i];

    let allQs;
    try { allQs = await fetchJSON(theme.questionFile); }
    catch { continue; }

    const usedKey = `dmUsed_${theme.slug}_${difficulty}`;
    let usedData  = JSON.parse(localStorage.getItem(usedKey) || '{"ids":[]}');
    const usedSet = new Set(usedData.ids.map(String));

    let bucket    = allQs.filter(q => q.difficulty === difficulty);
    let available = bucket.filter(q => !usedSet.has(String(q.id)));

    // Fallback to an easier tier if this bucket is exhausted, or the theme
    // simply doesn't have this difficulty at all (some themes have no
    // "expert" questions).
    if (!available.length) {
      const fallbacks = { expert: ["hard","medium","easy"], hard: ["medium","easy"], medium: ["easy"], easy: [] };
      for (const fb of (fallbacks[difficulty] || [])) {
        const fbUsed = new Set((JSON.parse(localStorage.getItem(`dmUsed_${theme.slug}_${fb}`) || '{"ids":[]}').ids).map(String));
        const candidates = allQs.filter(q => q.difficulty === fb && !fbUsed.has(String(q.id)));
        if (candidates.length) { available = candidates; break; }
      }
    }

    if (!available.length) {
      usedData = { ids: [] };
      available = bucket.length ? bucket : allQs;
    }

    const qRng   = dmRng(dmHash(`${dateKey}_${comboKey}_${theme.slug}_${difficulty}_${i}`));
    const picked = dmShuffle(available, qRng)[0];
    if (!picked) continue;

    usedData.ids.push(String(picked.id));
    localStorage.setItem(usedKey, JSON.stringify(usedData));

    questions.push({
      id:         picked.id,
      question:   picked.question,
      options:    dmShuffle(picked.options, qRng),
      answer:     picked.answer,
      difficulty: picked.difficulty,
      themeName:  theme.title,
      themeSlug:  theme.slug,
    });
  }

  const finalRng = dmRng(dmHash(`${dateKey}_${comboKey}_final`));
  const finalQs  = dmShuffle(questions, finalRng);

  localStorage.setItem(cacheKey, JSON.stringify(finalQs));
  return finalQs;
}

/* ── Streak (personal, local — no public leaderboard for Mashup) ── */
function dmGetStreak() {
  return JSON.parse(localStorage.getItem("dmStreak") || '{"current":0,"best":0,"lastCompleted":""}');
}

function dmUpdateStreak() {
  const dateKey = dmTodayKey();
  const streak  = dmGetStreak();
  if (streak.lastCompleted === dateKey) return streak;
  streak.current    = streak.lastCompleted === dmYesterdayKey() ? streak.current + 1 : 1;
  streak.best       = Math.max(streak.best, streak.current);
  streak.lastCompleted = dateKey;
  localStorage.setItem("dmStreak", JSON.stringify(streak));
  return streak;
}

/* ── Save / read result ── */
function saveDailyMashupResult(score, total, missedQuestions) {
  const dateKey = dmTodayKey();
  const streak  = dmUpdateStreak();
  const result  = { completed: true, score, total, missedQuestions, streak: streak.current, bestStreak: streak.best };
  localStorage.setItem(`dmState_${dateKey}`, JSON.stringify(result));
  if (typeof isLimitedWeb === "function" && isLimitedWeb()) {
    localStorage.setItem("cbWebDailyUsed_mashup", "true");
  }
  return result;
}

function getDailyMashupState() {
  const dateKey = dmTodayKey();
  const state   = JSON.parse(localStorage.getItem(`dmState_${dateKey}`) || "null");
  const streak  = dmGetStreak();
  if (!state) return { completed: false, streak: streak.current, bestStreak: streak.best };
  return { ...state, streak: streak.current, bestStreak: streak.best };
}

/* ── Homepage status ── */
function getDailyMashupStatus() {
  const dateKey = dmTodayKey();
  const state   = JSON.parse(localStorage.getItem(`dmState_${dateKey}`) || "null");
  const streak  = dmGetStreak();
  return {
    completedToday: !!(state && state.completed),
    hasPlayedToday: !!state,
    currentStreak:  streak.current,
    hasPicked:      !!dmGetSelectedThemes(),
  };
}

/* ── Countdown to UTC midnight ── */
function getTimeUntilNextMashup() {
  const now      = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const ms       = Math.max(0, midnight - now);
  return {
    hours:   Math.floor(ms / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    seconds: Math.floor((ms % 60000) / 1000),
  };
}

/* ── Homepage card update ── */
function initDailyMashupHomepageCard() {
  const card = document.querySelector(".daily-mashup-card");
  if (!card) return;

  const status = getDailyMashupStatus();
  const streak = dmGetStreak();
  const ctaEl  = card.querySelector(".daily-card-cta");
  const subEl  = card.querySelector(".daily-card-sub");

  if (ctaEl) {
    ctaEl.textContent = !status.hasPicked
      ? "Pick Your Shows"
      : status.completedToday ? "Come back tomorrow" : "Play Today's Mashup";
  }

  if (subEl && status.hasPicked) {
    const missedDay = streak.lastCompleted &&
                      streak.lastCompleted !== dmTodayKey() &&
                      streak.lastCompleted !== dmYesterdayKey();
    if (missedDay) {
      subEl.textContent = "Streak lost — play today to start a new one";
    } else if (status.currentStreak > 0) {
      subEl.textContent = `🔥 ${status.currentStreak} day streak`;
    }
  }
}

/* ── First-ever-open ad grace, specific to Daily Mashup: covers both the
   one-time show picker AND their first quiz — the ad only starts showing
   from the second time they open Daily Mashup onward. Page also carries
   data-defer-game-ad="1" so admob.js's automatic page-load interstitial
   never fires here; this is the only place that shows one. ── */
function dmMaybeShowGameStartAd() {
  const key = "_iadDailyMashupFirstOpenDone";
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, "1");
    return;
  }
  if (typeof adMobShowGameStartInterstitial === "function") adMobShowGameStartInterstitial();
}

/* ── Daily Mashup page renderer ── */
async function renderDailyMashupPage() {
  const loadingEl = document.getElementById("dmLoading");
  const quizEl    = document.getElementById("dmQuiz");
  const resultEl  = document.getElementById("dmResult");

  // Coming back from the show picker with a fresh (or changed) selection —
  // save it and clean the URL, this becomes their standing pick from now on.
  const params    = new URLSearchParams(window.location.search);
  const themesParam = params.get("themes");
  if (themesParam) {
    dmSaveSelectedThemes(themesParam.split(",").filter(Boolean));
    history.replaceState(null, "", "daily-mashup.html");
  }

  let selectedSlugs = dmGetSelectedThemes();
  if (!selectedSlugs || !selectedSlugs.length) {
    window.location.href = "mashup.html?mode=daily-mashup";
    return;
  }

  const state = getDailyMashupState();
  if (state.completed) {
    if (loadingEl) loadingEl.style.display = "none";
    showDmResult(state);
    return;
  }

  // Web (non-native, non-premium): one free Daily Mashup ever, same limit
  // Daily Trivia uses — doesn't affect native app or premium.
  if (typeof isLimitedWeb === "function" && isLimitedWeb() && localStorage.getItem("cbWebDailyUsed_mashup") === "true") {
    if (loadingEl) loadingEl.style.display = "none";
    if (quizEl) {
      quizEl.style.display = "block";
      quizEl.innerHTML = typeof webWallHTML === "function"
        ? webWallHTML("You've played your free Daily Mashup 🎉", null, "daily games", 1) : "";
    }
    return;
  }

  let questions;
  try {
    questions = await getDailyMashupQuestions(selectedSlugs);
  } catch {
    if (loadingEl) loadingEl.textContent = "Failed to load today's mashup. Please try again.";
    return;
  }

  if (!questions.length) {
    if (loadingEl) loadingEl.textContent = "No questions available. Please try again later.";
    return;
  }

  if (loadingEl) loadingEl.style.display = "none";
  if (quizEl)    quizEl.style.display    = "block";

  dmMaybeShowGameStartAd();

  const dateLabel = document.getElementById("dmDateLabel");
  if (dateLabel) {
    const now = new Date();
    dateLabel.textContent = now.toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", timeZone: "UTC"
    });
  }

  let currentIdx = 0;
  let score      = 0;
  const missed   = [];
  let answered   = false;

  const progressEl = document.getElementById("dmProgress");
  const badgeEl    = document.getElementById("dmThemeBadge");
  const questionEl = document.getElementById("dmQuestion");
  const optionsEl  = document.getElementById("dmOptions");
  const feedbackEl = document.getElementById("dmFeedback");
  const nextBtn    = document.getElementById("dmNextBtn");

  function showQuestion(idx) {
    answered = false;
    const q  = questions[idx];

    progressEl.textContent = `Question ${idx + 1} of ${questions.length}`;
    badgeEl.innerHTML = `<span class="daily-theme-badge">${q.themeName}</span>`;
    questionEl.textContent = q.question;

    optionsEl.innerHTML = "";
    q.options.forEach(opt => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "daily-option-btn";
      btn.textContent = opt;
      btn.addEventListener("click", () => handleAnswer(btn, opt, q));
      optionsEl.appendChild(btn);
    });

    feedbackEl.textContent = "";
    feedbackEl.className   = "feedback";
    nextBtn.style.display  = "none";
  }

  function handleAnswer(btn, selected, q) {
    if (answered) return;
    answered = true;

    const correct = selected === q.answer;
    if (typeof SoundFX !== "undefined") SoundFX.play(correct ? "correct" : "wrong");

    document.querySelectorAll(".daily-option-btn").forEach(b => { b.disabled = true; });
    btn.classList.add(correct ? "correct" : "wrong");

    if (correct) {
      score++;
      feedbackEl.textContent = "Correct!";
      feedbackEl.className   = "feedback correct";
    } else {
      feedbackEl.textContent = "Wrong!";
      feedbackEl.className   = "feedback wrong";
      missed.push({ question: q.question, answer: q.answer, themeName: q.themeName });
    }

    nextBtn.style.display = "block";
    nextBtn.textContent   = currentIdx < questions.length - 1 ? "Next →" : "See Results";
  }

  nextBtn.addEventListener("click", () => {
    currentIdx++;
    if (currentIdx < questions.length) {
      showQuestion(currentIdx);
    } else {
      const result = saveDailyMashupResult(score, questions.length, missed);
      if (quizEl) quizEl.style.display = "none";
      showDmResult(result);
    }
  });

  showQuestion(0);
}

function showDmResult(state) {
  const loadingEl = document.getElementById("dmLoading");
  const resultEl  = document.getElementById("dmResult");
  if (loadingEl) loadingEl.style.display = "none";
  if (!resultEl)  return;
  resultEl.style.display = "block";

  const scoreEl = document.getElementById("dmScoreText");
  if (scoreEl) scoreEl.textContent = `${state.score} / ${state.total}`;

  const streakEl = document.getElementById("dmStreakBox");
  if (streakEl) {
    streakEl.innerHTML = `
      <div class="streak-current">🔥 ${state.streak} day streak</div>
      <div class="streak-best">Best: ${state.bestStreak} days</div>
    `;
  }

  startDmCountdown();

  const shareBtn = document.getElementById("dmShareBtn");
  if (shareBtn) {
    shareBtn.addEventListener("click", () => {
      const url  = window.location.href.split("?")[0];
      const text = `I scored ${state.score}/${state.total} on today's Trivia Gauntlet Daily Mashup!\n${url}`;
      navigator.clipboard.writeText(text).then(() => {
        shareBtn.textContent = "Copied!";
        setTimeout(() => { shareBtn.textContent = "Share Results"; }, 2000);
      });
    });
  }

  const revealBtn = document.getElementById("revealDmMissedBtn");
  const missedEl  = document.getElementById("dmMissed");

  if (!state.missedQuestions || !state.missedQuestions.length) {
    if (revealBtn) revealBtn.style.display = "none";
    if (missedEl) {
      missedEl.innerHTML     = `<p class="daily-perfect">Perfect score — all correct!</p>`;
      missedEl.style.display = "block";
    }
  } else if (revealBtn && missedEl) {
    revealBtn.addEventListener("click", () => {
      revealBtn.style.display = "none";
      missedEl.style.display  = "block";
      missedEl.innerHTML = state.missedQuestions.map(q => `
        <div class="daily-missed-item">
          <p class="daily-missed-q">${q.question}</p>
          <p class="daily-missed-a">&#10003; ${q.answer} <span class="daily-missed-theme">${q.themeName}</span></p>
        </div>
      `).join("");
    });
  }
}

function startDmCountdown() {
  const el = document.getElementById("dmCountdown");
  if (!el) return;
  function tick() {
    const { hours, minutes, seconds } = getTimeUntilNextMashup();
    el.textContent = `Next mashup in ${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  }
  tick();
  setInterval(tick, 1000);
}

/* ── Boot ── */
document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "daily-mashup") renderDailyMashupPage();
  if (document.body.dataset.page === "home" || document.body.dataset.page === "daily-challenges") initDailyMashupHomepageCard();
});
