/* ── Missed-days archive (Daily Trivia / Wordle / Mashup) ──────────── */
// The last 30 days, each missed day playable once from a calendar. Archive
// plays are kept completely separate from the real daily: their own
// <prefix>Archive_<date> result, never history / streak / lifetime score /
// leaderboard. Unlock: each day costs a rewarded ad in-app, free for
// premium; plain web gets the app wall instead. Each app player also gets
// ONE free catch-up for life, shared across all modes.
//
// Each mode passes a cfg:
//   prefix       storage prefix ("dc", "dw", "dm")
//   name         "Daily Trivia"
//   page         "daily.html"
//   resultId     id of the empty container the "played late" screen renders into
//   playedOnDay  dateKey → score label ("7/10") if played on the day, else null
//   seedPlayed   dateKey → fakes an on-the-day play, for ?testmissed=1
// Needs srDaysAgoKey / srIsTest / srIsPremium from admob.js.
const DA_DAYS = 30;
const DA_FREE_USED_KEY = "daFreeCatchUpUsed";

function daDates() {
  return Array.from({ length: DA_DAYS }, (_, i) => srDaysAgoKey(i + 1));
}

function daFormatDay(dateKey, opts) {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

function daLateResult(cfg, dateKey) {
  return JSON.parse(localStorage.getItem(`${cfg.prefix}Archive_${dateKey}`) || "null");
}

function daStatus(cfg, dateKey) {
  const late = daLateResult(cfg, dateKey);
  if (late) return { status: "late", label: late.label };
  const label = cfg.playedOnDay(dateKey);
  if (label) return { status: "played", label };
  return { status: "missed" };
}

function daMissedCount(cfg) {
  return daDates().filter(d => daStatus(cfg, d).status === "missed").length;
}

function daHasFreeCatchUp() {
  if (!isInApp() && !srIsTest()) return false;
  return localStorage.getItem(DA_FREE_USED_KEY) !== "1";
}

// Playable without an ad: premium, already unlocked (e.g. ad watched, then
// the app was closed mid-game), or the one free catch-up is still unused.
function daIsFree(cfg, dateKey) {
  return srIsPremium() || daHasFreeCatchUp() ||
         localStorage.getItem(`${cfg.prefix}ArchiveUnlocked_${dateKey}`) === "1";
}

function daButtonLabel(cfg) {
  const n = daMissedCount(cfg);
  return n ? `📅 Play missed days (${n})` : "📅 Your calendar";
}

function daSaveLate(cfg, dateKey, result) {
  localStorage.setItem(`${cfg.prefix}Archive_${dateKey}`, JSON.stringify(result));
  localStorage.removeItem(`${cfg.prefix}ArchiveUnlocked_${dateKey}`);
  return result;
}

// ?testmissed=1: played days 2-13 ago (matches the fake 12-day streak),
// everything else missed, no late plays or unlocks left over.
function daSeedTest(cfg) {
  if (new URLSearchParams(window.location.search).get("testmissed") !== "1") return;
  for (let i = 2; i <= 13; i++) cfg.seedPlayed(srDaysAgoKey(i), i);
  localStorage.removeItem(DA_FREE_USED_KEY);
  daDates().forEach(d => {
    localStorage.removeItem(`${cfg.prefix}Archive_${d}`);
    localStorage.removeItem(`${cfg.prefix}ArchiveUnlocked_${d}`);
  });
}

// Returns the ?date= day to play, or null for today's daily. Also handles the
// cases that shouldn't start a game: already played (late → its result; on
// the day → calendar) or not unlocked (typed the URL → calendar). Returns
// false when it has taken over the page.
function daResolveDateParam(cfg) {
  const params = new URLSearchParams(window.location.search);
  if (params.get("calendar") === "1") daOpenCalendar(cfg);
  const d = params.get("date");
  if (!d || !daDates().includes(d)) return null;
  const st = daStatus(cfg, d);
  if (st.status === "late") { daShowLateResult(cfg, d, daLateResult(cfg, d)); return false; }
  if (st.status === "played" || !daIsFree(cfg, d)) {
    window.location.replace(`${cfg.page}?calendar=1`);
    return false;
  }
  return d;
}

function daPlayDay(cfg, dateKey) {
  const go = () => {
    localStorage.setItem(`${cfg.prefix}ArchiveUnlocked_${dateKey}`, "1");
    window.location.href = `${cfg.page}?date=${dateKey}`;
  };
  if (daIsFree(cfg, dateKey)) {
    const usesFreeOne = !srIsPremium() && localStorage.getItem(`${cfg.prefix}ArchiveUnlocked_${dateKey}`) !== "1";
    if (usesFreeOne) localStorage.setItem(DA_FREE_USED_KEY, "1");
    return go();
  }

  if ((isInApp() && ADMOB_ADS_ENABLED) || srIsTest()) {
    _offerRewardedLifeline("Play", () => {
      if (typeof gtag === "function" && !srIsTest()) gtag("event", "missed_day_ad", { mode: cfg.name.replace(/^Daily /, "").toLowerCase() });
      go();
    },
      `Watch a short ad to play <strong>${daFormatDay(dateKey, { weekday: "long", month: "short", day: "numeric" })}</strong>?`);
    return;
  }

  // Plain web: missed days are an app feature.
  const body = document.querySelector("#daCalendarModal .da-cal-body");
  if (body && typeof webWallHTML === "function") {
    body.innerHTML = webWallHTML("Catch up on missed days 📅", null, "daily games", 1, true,
      `Every ${cfg.name} from the last 30 days is playable in the free app.`);
  }
}

function daOpenCalendar(cfg) {
  document.getElementById("daCalendarModal")?.remove();
  const today = srDaysAgoKey(0);
  const dates = daDates();
  const start = new Date(`${dates[dates.length - 1]}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay()); // back to Sunday

  const cells = [];
  for (let d = new Date(start); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const num = d.getUTCDate();
    if (key === today) {
      cells.push(`<a class="da-cal-day da-cal-today" href="${cfg.page}"><span>${num}</span><small>Today</small></a>`);
      break;
    }
    if (!dates.includes(key)) { cells.push(`<div class="da-cal-day da-cal-out"><span>${num}</span></div>`); continue; }
    const st = daStatus(cfg, key);
    if (st.status === "played") {
      cells.push(`<div class="da-cal-day da-cal-played"><span>${num}</span><small>✅ ${st.label}</small></div>`);
    } else if (st.status === "late") {
      cells.push(`<div class="da-cal-day da-cal-late"><span>${num}</span><small>🕓 ${st.label}</small></div>`);
    } else {
      const icon = daIsFree(cfg, key) ? "🎁" : "🔒";
      cells.push(`<button type="button" class="da-cal-day da-cal-missed" data-date="${key}"><span>${num}</span><small>${icon}</small></button>`);
    }
  }

  const missed = daMissedCount(cfg);
  const freeNote = !srIsPremium() && daHasFreeCatchUp() ? " Your first one's free! 🎁" : "";
  const range  = `${daFormatDay(dates[dates.length - 1], { month: "short", day: "numeric" })} – ${daFormatDay(today, { month: "short", day: "numeric" })}`;
  const overlay = document.createElement("div");
  overlay.id = "daCalendarModal";
  overlay.className = "lb-modal-overlay";
  overlay.innerHTML = `
    <div class="lb-modal">
      <div class="lb-modal-header">
        <h3>📅 Missed Days · ${range}</h3>
        <button type="button" class="lb-modal-close" aria-label="Close">✕</button>
      </div>
      <div class="da-cal-body">
        <p class="da-cal-sub">${missed ? `You missed <strong>${missed}</strong> day${missed === 1 ? "" : "s"} — tap one to play it.${freeNote}` : "You haven't missed a day. 🎉"}</p>
        <div class="da-cal-grid">
          ${["S","M","T","W","T","F","S"].map(d => `<div class="da-cal-dow">${d}</div>`).join("")}
          ${cells.join("")}
        </div>
        <div class="da-cal-legend">
          <span>✅ Played</span><span>🕓 Played late</span>${freeNote ? "<span>🎁 Free</span>" : ""}<span>🔒 Watch ad</span>
        </div>
        <p class="da-cal-note">Missed days don't count toward your streak or the leaderboard.</p>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", e => {
    if (e.target === overlay || e.target.closest(".lb-modal-close")) { overlay.remove(); return; }
    const day = e.target.closest(".da-cal-missed");
    if (day) daPlayDay(cfg, day.dataset.date);
  });
}

// Today's result screen: the "📅 Play missed days (N)" button.
function daInitButton(cfg, btn) {
  if (!btn) return;
  btn.textContent = daButtonLabel(cfg);
  btn.addEventListener("click", () => daOpenCalendar(cfg));
}

// Small "📅 Missed days (N)" pill floated beside the game's title, so the
// calendar is reachable before today's game is played. Removed on the first
// answer/guess (daRemoveHeaderButton) — nothing extra on screen during play.
function daAddHeaderButton(cfg, titleEl) {
  if (!titleEl || document.getElementById("daHeaderBtn")) return;
  const n = daMissedCount(cfg);
  const btn = document.createElement("button");
  btn.id = "daHeaderBtn";
  btn.type = "button";
  btn.className = "secondary-btn";
  btn.style.cssText = "float:right;font-size:0.78rem;padding:4px 10px;margin:2px 0 0 8px;white-space:nowrap;";
  btn.textContent = n ? `📅 Missed days (${n})` : "📅 Calendar";
  btn.addEventListener("click", () => daOpenCalendar(cfg));
  titleEl.parentNode.insertBefore(btn, titleEl);
}

function daRemoveHeaderButton() {
  document.getElementById("daHeaderBtn")?.remove();
}

// The "played late" result screen. result: { label, scoreHtml, detailsLabel, detailsHtml }.
function daShowLateResult(cfg, dateKey, result) {
  document.querySelectorAll("[data-da-hide]").forEach(el => { el.style.display = "none"; });
  const el = document.getElementById(cfg.resultId);
  el.style.display = "block";
  el.innerHTML = `
    <h2 style="margin-bottom:2px">Missed Day Complete</h2>
    <p class="daily-date">${daFormatDay(dateKey, { weekday: "long", month: "long", day: "numeric" })}</p>
    ${result.scoreHtml}
    <p class="daily-streak-note">🕓 Played late — doesn't count toward your streak or the leaderboard.</p>
    <button type="button" class="primary-btn da-late-cal" style="width:100%;margin-top:6px">${daButtonLabel(cfg)}</button>
    <a href="${cfg.page}" class="secondary-btn" style="display:block;margin-top:8px;text-align:center;text-decoration:none">Today's ${cfg.name.replace(/^Daily /, "")} →</a>
    ${result.detailsHtml ? `
      <button type="button" class="secondary-btn da-late-reveal" style="margin-top:8px;width:100%">${result.detailsLabel}</button>
      <div class="da-late-details" style="display:none;margin-top:14px">${result.detailsHtml}</div>` : ""}`;
  el.querySelector(".da-late-cal").addEventListener("click", () => daOpenCalendar(cfg));
  el.querySelector(".da-late-reveal")?.addEventListener("click", e => {
    e.target.style.display = "none";
    el.querySelector(".da-late-details").style.display = "block";
  });
}

// Shared by Daily Trivia and Daily Mashup's late results.
function daMissedAnswersHtml(missedQuestions) {
  if (!missedQuestions || !missedQuestions.length) return `<p class="daily-perfect">Perfect score — all correct!</p>`;
  return missedQuestions.map(q => `
    <div class="daily-missed-item">
      <p class="daily-missed-q">${q.question}</p>
      <p class="daily-missed-a">&#10003; ${q.answer} <span class="daily-missed-theme">${q.themeName}</span></p>
    </div>`).join("");
}
