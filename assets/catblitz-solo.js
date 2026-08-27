// ── Category Blitz — Solo sub-mode ──────────────────────────────────────────
// Repeatable indefinitely. Every spin's full result is always shown in full —
// the gate only ever blocks *starting another spin*, never hides a result
// you already played (same principle challenge.js uses for rounds).
// Native app: first 2 spins free, then a rewarded ad every 2 spins — same
// modulo pattern challenge.js uses for round gating (spinsUsed % 2 === 0
// gates the NEXT spin), reusing the existing generic data-rewarded-href
// delegated click listener in admob.js, no new ad code. Premium: unlimited,
// no ads. Web (non-native, non-premium): 1 free play SHARED with Versus —
// playing either mode once uses up the single allowance and walls BOTH
// (cbGetWebPlayUsed/cbMarkWebPlayUsed in catblitz-engine.js), not a
// per-mode counter — you can't get a free Solo spin AND a free Versus round.
//
// Native-app spin count is tracked separately in localStorage
// (cbSoloSpinsUsed), NOT the URL — a URL param resets the instant you
// navigate back to the bare page, which would let anyone bypass the gate for
// free. The persisted count is checked both on page load (so a direct
// reload/revisit is caught) and after each round completes.

const CB_SOLO_CATEGORIES = [
  { id: "name", label: "Name" },
  { id: "animal", label: "Animal" },
  { id: "place", label: "Place" },
  { id: "thing", label: "Thing" },
  { id: "food", label: "Food" },
];

// Remembers the last-used category set across spins/page loads so a player
// who customizes it once isn't forced to re-add a custom category every
// time — the setup screen still shows each spin, just pre-filled.
const CB_SOLO_CATEGORIES_KEY = "cbSoloCategories";
function cbGetSavedSoloCategories() {
  try {
    const saved = JSON.parse(localStorage.getItem(CB_SOLO_CATEGORIES_KEY) || "null");
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {}
  return CB_SOLO_CATEGORIES;
}
function cbSaveSoloCategories(categories) {
  try { localStorage.setItem(CB_SOLO_CATEGORIES_KEY, JSON.stringify(categories)); } catch {}
}

function cbGetSoloSpinsUsed() {
  return parseInt(localStorage.getItem("cbSoloSpinsUsed") || "0", 10) || 0;
}
function cbIncrementSoloSpinsUsed() {
  const n = cbGetSoloSpinsUsed() + 1;
  localStorage.setItem("cbSoloSpinsUsed", String(n));
  return n;
}

// Same no-repeat-until-exhausted pattern as Daily Blitz (cbUsedLetters_daily),
// own key so the two cycles run independently.
function cbGetSoloUsedLettersForSpin() {
  const used = JSON.parse(localStorage.getItem("cbUsedLetters_solo") || "[]");
  return used.length >= 26 ? [] : used;
}
function cbRecordSoloUsedLetter(letter) {
  const used = cbGetSoloUsedLettersForSpin();
  if (!used.includes(letter)) used.push(letter);
  localStorage.setItem("cbUsedLetters_solo", JSON.stringify(used));
}

function cbRenderSoloPage() {
  const setupEl = document.getElementById("cbSoloSetup");
  const introEl = document.getElementById("cbDailyIntro");
  const limited = typeof isLimitedWeb === "function" && isLimitedWeb();

  // Catches direct reload/revisit after the shared free play is used up —
  // not just the "Spin Again" click path.
  if (limited && cbGetWebPlayUsed()) {
    if (setupEl) setupEl.style.display = "none";
    if (introEl) {
      introEl.style.display = "block";
      introEl.innerHTML = typeof webWallHTML === "function"
        ? webWallHTML("Come back with the app for unlimited Category Blitz 🎉", null, "spins", 1)
        : "";
    }
    return;
  }

  const activeCategories = cbRenderCategoryPicker({
    listEl: document.getElementById("cbSoloCategoryList"),
    inputEl: document.getElementById("cbSoloNewCategory"),
    addBtnEl: document.getElementById("cbSoloAddCategoryBtn"),
    initialCategories: cbGetSavedSoloCategories(),
  });

  document.getElementById("cbSoloStartBtn").addEventListener("click", async () => {
    cbSaveSoloCategories(activeCategories);
    setupEl.style.display = "none";
    introEl.style.display = "block";
    // Setup is a real step before play now (like Versus) — the automatic
    // page-load interstitial is deferred (data-defer-game-ad="1" on <body>)
    // so it fires here instead, once the player actually starts, not before
    // they've even chosen categories.
    if (typeof adMobShowGameStartInterstitial === "function") await adMobShowGameStartInterstitial();
    cbStartSoloSpin(activeCategories);
  });
}

function cbStartSoloSpin(categories) {
  const introEl = document.getElementById("cbDailyIntro");
  const roundEl = document.getElementById("cbRoundContainer");
  const wheelContainer = document.getElementById("cbWheelContainer");
  cbSpinWheel(wheelContainer, {
    excludeLetters: new Set(cbGetSoloUsedLettersForSpin()),
    onResult: (letter) => {
      cbRecordSoloUsedLetter(letter);
      if (introEl) introEl.style.display = "none";
      if (roundEl) roundEl.style.display = "block";
      cbRenderRound(roundEl, {
        letter,
        categories,
        seconds: 60,
        onSubmit: async ({ answers, elapsedMs }) => {
          const gradeResult = await cbGradeRound({ letter, categories, answers, elapsedMs, mode: "solo" });
          const spinsUsedNow = cbIncrementSoloSpinsUsed();
          const limitedNow = typeof isLimitedWeb === "function" && isLimitedWeb();
          if (limitedNow) cbMarkWebPlayUsed();
          roundEl.style.display = "none";
          cbShowSoloResult(spinsUsedNow, gradeResult, categories, letter);
        },
      });
    },
  });
}

function cbShowSoloResult(spinsUsed, gradeResult, categories, letter) {
  const resultEl = document.getElementById("cbResult");
  if (!resultEl) return;
  resultEl.style.display = "block";

  const containerEl = document.getElementById("cbResultContainer");
  const spinAgainBox = document.getElementById("cbSpinAgainBox");
  if (containerEl) cbRenderResult(containerEl, gradeResult, { categories, contestable: true, letter, mode: "solo" });

  const feedbackWrap = document.getElementById("cbFeedbackBoxWrap");
  if (feedbackWrap) {
    feedbackWrap.innerHTML = cbFeedbackBoxHtml();
    cbBindFeedbackBox();
  }

  if (!spinAgainBox) return;

  const limited = typeof isLimitedWeb === "function" && isLimitedWeb();

  if (limited && cbGetWebPlayUsed()) {
    spinAgainBox.innerHTML = typeof webWallHTML === "function"
      ? webWallHTML("Nice round! 🎉", null, "spins", 1) : "";
    return;
  }

  const isPremium = typeof isPremiumUser === "function" && isPremiumUser();
  const gateThisSpin = !isPremium && !limited && spinsUsed % 2 === 0;
  const href = "category-blitz-solo.html";
  spinAgainBox.innerHTML = `<a class="primary-btn cb-spin-again-btn" href="${href}" style="display:block;text-align:center;text-decoration:none;"${gateThisSpin ? ` data-rewarded-href="${href}"` : ""}>Spin Again</a>`;
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "catblitz-solo") cbRenderSoloPage();
});
