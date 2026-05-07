/* ── Daily Challenge ─────────────────────────────────────────────── */

const DAILY_THEMES = [
  { name: "Spelling",        slug: "spelling",    file: "data/spelling.txt"    },
  { name: "Word Definitions", slug: "definitions", file: "data/definitions.txt" },
  { name: "Animals",         slug: "animals",     file: "data/animals.txt"     },
  { name: "Fun Facts",       slug: "fun",         file: "data/fun.txt"         },
  { name: "Geography",       slug: "geo",         file: "data/geo.txt"         },
  { name: "History",         slug: "history",     file: "data/history.txt"     },
  { name: "Hollywood",       slug: "holly",       file: "data/holly.txt"       },
  { name: "Music",           slug: "musi",        file: "data/musi.txt"        },
  { name: "Odd One Out",     slug: "odd",         file: "data/odd.txt"         },
  { name: "Science",         slug: "science",     file: "data/science.txt"     },
  { name: "True or False",   slug: "tof",         file: "data/tof.txt"         },
  { name: "World Capitals",  slug: "capitals",    file: "data/capitals.txt"    },
  { name: "World Facts",     slug: "world",       file: "data/world.txt"       },
  { name: "Food & Drink",    slug: "food",        file: "data/food.txt"        },
  { name: "Sports",          slug: "sport",       file: "data/sport.txt"       },
  { name: "TV Series",       slug: "tv",          file: "data/tv.txt"          },
  { name: "Video Games",     slug: "games",       file: "data/games.txt"       },
  { name: "True Crime",      slug: "crime",       file: "data/crime.txt"       },
];

const DC_NO_EXPERT = new Set(["sport", "tv", "food", "games"]);

/* ── PRNG ── */
function dcRng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function dcHash(str) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function dcShuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── Date helpers (UTC) ── */
function dcTodayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

function dcYesterdayKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

/* ── Question generation ── */
async function getDailyQuestions() {
  const dateKey = dcTodayKey();
  const cached = localStorage.getItem(`dcQuestions_${dateKey}`);
  if (cached) return JSON.parse(cached);

  const cycle = parseInt(localStorage.getItem("dcCycle") || "0", 10);
  const rng   = dcRng(dcHash(`${dateKey}_c${cycle}`));

  // Pick 10 themes from 18, seeded by date+cycle
  const shuffledThemes = dcShuffle(DAILY_THEMES, rng);
  const todayThemes    = shuffledThemes.slice(0, 10);

  // Difficulty slots: 3 easy, 3 medium, 3 hard, 1 expert
  const baseSlots    = ["easy","easy","easy","medium","medium","medium","hard","hard","hard","expert"];
  const slots        = dcShuffle(baseSlots, rng);

  // Ensure expert slot is assigned to a theme that has expert questions
  const expertSlotIdx   = slots.indexOf("expert");
  const expertThemeIdx  = todayThemes.findIndex((t, i) => !DC_NO_EXPERT.has(t.slug) && i !== expertSlotIdx);
  if (expertThemeIdx !== -1) {
    [todayThemes[expertSlotIdx], todayThemes[expertThemeIdx]] =
    [todayThemes[expertThemeIdx], todayThemes[expertSlotIdx]];
  }

  const questions = [];

  for (let i = 0; i < todayThemes.length; i++) {
    const theme      = todayThemes[i];
    const difficulty = slots[i];

    let allQs;
    try {
      const res = await fetch(theme.file);
      allQs = await res.json();
    } catch {
      continue;
    }

    // Load used IDs for this theme+difficulty
    const usedKey  = `dcUsed_${theme.slug}_${difficulty}`;
    let usedData   = JSON.parse(localStorage.getItem(usedKey) || '{"ids":[],"cycle":0}');
    if (usedData.cycle !== cycle) usedData = { ids: [], cycle };

    const usedSet  = new Set(usedData.ids.map(String));
    let bucket     = allQs.filter(q => q.difficulty === difficulty);
    let available  = bucket.filter(q => !usedSet.has(String(q.id)));

    // Fallback to lower difficulty if bucket exhausted
    if (!available.length) {
      const fallbacks = { expert: ["hard","medium","easy"], hard: ["medium","easy"], medium: ["easy"], easy: [] };
      for (const fb of (fallbacks[difficulty] || [])) {
        const fbUsed = new Set((JSON.parse(localStorage.getItem(`dcUsed_${theme.slug}_${fb}`) || '{"ids":[]}').ids).map(String));
        const candidates = allQs.filter(q => q.difficulty === fb && !fbUsed.has(String(q.id)));
        if (candidates.length) { available = candidates; break; }
      }
    }

    // If still empty, all questions exhausted — reset and bump cycle
    if (!available.length) {
      const newCycle = cycle + 1;
      localStorage.setItem("dcCycle", newCycle);
      usedData = { ids: [], cycle: newCycle };
      available = bucket.length ? bucket : allQs;
    }

    const qRng   = dcRng(dcHash(`${dateKey}_${theme.slug}_${difficulty}_c${cycle}`));
    const picked = dcShuffle(available, qRng)[0];
    if (!picked) continue;

    usedData.ids.push(String(picked.id));
    localStorage.setItem(usedKey, JSON.stringify(usedData));

    questions.push({
      id:         picked.id,
      question:   picked.question,
      options:    picked.options,
      answer:     picked.answer,
      difficulty: picked.difficulty,
      themeName:  theme.name,
      themeSlug:  theme.slug,
    });
  }

  const finalRng = dcRng(dcHash(`${dateKey}_final_c${cycle}`));
  const finalQs  = dcShuffle(questions, finalRng);

  localStorage.setItem(`dcQuestions_${dateKey}`, JSON.stringify(finalQs));
  return finalQs;
}

/* ── Streak ── */
function dcGetStreak() {
  return JSON.parse(localStorage.getItem("dcStreak") || '{"current":0,"best":0,"lastCompleted":""}');
}

function dcUpdateStreak() {
  const dateKey = dcTodayKey();
  const streak  = dcGetStreak();
  if (streak.lastCompleted === dateKey) return streak;
  streak.current    = streak.lastCompleted === dcYesterdayKey() ? streak.current + 1 : 1;
  streak.best       = Math.max(streak.best, streak.current);
  streak.lastCompleted = dateKey;
  localStorage.setItem("dcStreak", JSON.stringify(streak));
  return streak;
}

/* ── Score history ── */
function dcSaveHistory(date, score, total) {
  const history = JSON.parse(localStorage.getItem("dcHistory") || "[]");
  if (history.some(e => e.date === date)) return;
  history.push({ date, score, total });
  if (history.length > 30) history.splice(0, history.length - 30);
  localStorage.setItem("dcHistory", JSON.stringify(history));
}

function dcGetHistoryStats(todayDate, todayScore, total) {
  const history = JSON.parse(localStorage.getItem("dcHistory") || "[]");
  const past    = history.filter(e => e.date !== todayDate);
  if (!past.length) return null;
  const scores     = past.map(e => e.score);
  const best       = Math.max(...scores);
  const avg        = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  const beatCount  = scores.filter(s => todayScore > s).length;
  const percentile = Math.round((beatCount / scores.length) * 100);
  return { best, avg, total, attempts: scores.length, percentile };
}

/* ── Save / read result ── */
function saveDailyResult(score, total, missedQuestions) {
  const dateKey = dcTodayKey();
  dcSaveHistory(dateKey, score, total);
  const streak  = dcUpdateStreak();
  const result  = { completed: true, score, total, missedQuestions, streak: streak.current, bestStreak: streak.best };
  localStorage.setItem(`dcState_${dateKey}`, JSON.stringify(result));
  return result;
}

function getDailyState() {
  const dateKey = dcTodayKey();
  const state   = JSON.parse(localStorage.getItem(`dcState_${dateKey}`) || "null");
  const streak  = dcGetStreak();
  if (!state) return { completed: false, streak: streak.current, bestStreak: streak.best };
  return { ...state, streak: streak.current, bestStreak: streak.best };
}

/* ── Homepage status ── */
function getDailyChallengeStatus() {
  const dateKey = dcTodayKey();
  const state   = JSON.parse(localStorage.getItem(`dcState_${dateKey}`) || "null");
  const streak  = dcGetStreak();
  return {
    completedToday:  !!(state && state.completed),
    hasPlayedToday:  !!state,
    currentStreak:   streak.current,
  };
}

/* ── Countdown to UTC midnight ── */
function getTimeUntilNextChallenge() {
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
function initDailyHomepageCard() {
  const card = document.querySelector(".daily-challenge-card");
  if (!card) return;

  const status  = getDailyChallengeStatus();
  const streak  = dcGetStreak();
  const ctaEl   = card.querySelector(".daily-card-cta");
  const subEl   = card.querySelector(".daily-card-sub");

  if (ctaEl) {
    ctaEl.textContent = status.completedToday ? "Come back tomorrow" : "Play Today's Challenge";
  }

  if (subEl) {
    const missedDay = streak.lastCompleted &&
                      streak.lastCompleted !== dcTodayKey() &&
                      streak.lastCompleted !== dcYesterdayKey();
    if (missedDay) {
      subEl.textContent = "Streak lost — play today to start a new one";
    } else if (status.currentStreak > 0) {
      subEl.textContent = `🔥 ${status.currentStreak} day streak`;
    }
  }
}

/* ── Daily page renderer ── */
async function renderDailyPage() {
  const loadingEl = document.getElementById("dailyLoading");
  const quizEl    = document.getElementById("dailyQuiz");
  const resultEl  = document.getElementById("dailyResult");

  const state = getDailyState();
  if (state.completed) {
    if (loadingEl) loadingEl.style.display = "none";
    showDailyResult(state);
    return;
  }

  let questions;
  try {
    questions = await getDailyQuestions();
  } catch {
    if (loadingEl) loadingEl.textContent = "Failed to load today's challenge. Please try again.";
    return;
  }

  if (!questions.length) {
    if (loadingEl) loadingEl.textContent = "No questions available. Please try again later.";
    return;
  }

  if (loadingEl) loadingEl.style.display = "none";
  if (quizEl)    quizEl.style.display    = "block";

  // Show today's date
  const dateLabel = document.getElementById("dailyDateLabel");
  if (dateLabel) {
    const now = new Date();
    dateLabel.textContent = now.toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", timeZone: "UTC"
    });
  }

  let currentIdx    = 0;
  let score         = 0;
  const missed      = [];
  let answered      = false;

  const progressEl  = document.getElementById("dailyProgress");
  const badgeEl     = document.getElementById("dailyThemeBadge");
  const questionEl  = document.getElementById("dailyQuestion");
  const optionsEl   = document.getElementById("dailyOptions");
  const feedbackEl  = document.getElementById("dailyFeedback");
  const nextBtn     = document.getElementById("dailyNextBtn");

  function showQuestion(idx) {
    answered = false;
    const q  = questions[idx];

    progressEl.textContent = `Question ${idx + 1} of ${questions.length}`;

    badgeEl.innerHTML = `<span class="daily-theme-badge">${q.themeName}</span>`;

    questionEl.textContent = q.question;

    optionsEl.innerHTML = "";
    q.options.forEach(opt => {
      const btn      = document.createElement("button");
      btn.type       = "button";
      btn.className  = "daily-option-btn";
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

    nextBtn.style.display  = "block";
    nextBtn.textContent    = currentIdx < questions.length - 1 ? "Next →" : "See Results";
  }

  nextBtn.addEventListener("click", () => {
    currentIdx++;
    if (currentIdx < questions.length) {
      showQuestion(currentIdx);
    } else {
      const result = saveDailyResult(score, questions.length, missed);
      if (quizEl) quizEl.style.display = "none";
      showDailyResult(result);
    }
  });

  showQuestion(0);
}

function showDailyResult(state) {
  const loadingEl = document.getElementById("dailyLoading");
  const resultEl  = document.getElementById("dailyResult");
  if (loadingEl) loadingEl.style.display = "none";
  if (!resultEl)  return;
  resultEl.style.display = "block";

  if (typeof maybeShowPwaPopup === "function") {
    setTimeout(() => maybeShowPwaPopup(), 2000);
  }

  const scoreEl    = document.getElementById("dailyScoreText");
  if (scoreEl) scoreEl.textContent = `${state.score} / ${state.total}`;

  const streakEl = document.getElementById("dailyStreakBox");
  if (streakEl) {
    streakEl.innerHTML = `
      <div class="streak-current">🔥 ${state.streak} day streak</div>
      <div class="streak-best">Best: ${state.bestStreak} days</div>
    `;
  }

  const historyEl = document.getElementById("dailyHistoryBox");
  if (historyEl) {
    const stats = dcGetHistoryStats(dcTodayKey(), state.score, state.total);
    if (!stats) {
      historyEl.innerHTML = `<p class="daily-history-first">Play again tomorrow to start tracking your stats</p>`;
    } else {
      let label;
      if      (stats.percentile >= 80) label = "One of your best";
      else if (stats.percentile >= 50) label = "Above your average";
      else if (stats.percentile >= 20) label = "Below your average";
      else                             label = "One of your tougher days";
      historyEl.innerHTML = `
        <div class="daily-history-stats">
          <div class="daily-history-stat"><span class="dhs-label">Personal best</span><span class="dhs-value">${stats.best}/${stats.total}</span></div>
          <div class="daily-history-stat"><span class="dhs-label">Your average</span><span class="dhs-value">${stats.avg}/${stats.total}</span></div>
          <div class="daily-history-stat"><span class="dhs-label">vs your history</span><span class="dhs-value">${label}</span></div>
        </div>`;
    }
  }

  startCountdown();

  // Hide OneSignal prompt if browser permission is already decided or SDK can't request
  const osContainer = document.querySelector('.onesignal-customlink-container');
  if (osContainer) {
    if (typeof Notification !== 'undefined' && Notification.permission !== 'default') {
      osContainer.style.display = 'none';
    } else {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(function(OneSignal) {
        OneSignal.Notifications.canRequestPermission().then(function(can) {
          if (!can) osContainer.style.display = 'none';
        });
      });
    }
  }

  // Related theme cards from today's questions
  const relatedEl = document.getElementById("dailyRelated");
  if (relatedEl) {
    const todayQs = JSON.parse(localStorage.getItem(`dcQuestions_${dcTodayKey()}`) || "[]");
    const seen = new Set();
    const uniqueThemes = todayQs.reduce((acc, q) => {
      if (!seen.has(q.themeSlug)) { seen.add(q.themeSlug); acc.push({ slug: q.themeSlug, name: q.themeName }); }
      return acc;
    }, []).slice(0, 5);

    if (uniqueThemes.length) {
      relatedEl.innerHTML = `
        <div class="theme-related-quizzes">
          <h3>Play These Themes</h3>
          <div class="grid">
            ${uniqueThemes.map(t => `<a class="card" href="play.html?theme=${t.slug}"><h3>${t.name}</h3></a>`).join("")}
          </div>
        </div>`;
    }
  }

  const shareBtn = document.getElementById("dailyShareBtn");
  if (shareBtn) {
    shareBtn.addEventListener("click", () => {
      const url  = window.location.href.split("?")[0];
      const text = `I scored ${state.score}/${state.total} on today's Trivia Gauntlet Daily Challenge!\n${url}`;
      navigator.clipboard.writeText(text).then(() => {
        shareBtn.textContent = "Copied!";
        setTimeout(() => { shareBtn.textContent = "Share Results"; }, 2000);
      });
    });
  }

  const revealBtn = document.getElementById("revealMissedBtn");
  const missedEl  = document.getElementById("dailyMissed");

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

function startCountdown() {
  const el = document.getElementById("dailyCountdown");
  if (!el) return;
  function tick() {
    const { hours, minutes, seconds } = getTimeUntilNextChallenge();
    el.textContent = `Next challenge in ${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  }
  tick();
  setInterval(tick, 1000);
}

/* ── Boot ── */
document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "daily") renderDailyPage();
  if (document.body.dataset.page === "home")  initDailyHomepageCard();
});
