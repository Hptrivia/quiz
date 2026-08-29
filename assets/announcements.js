// ── App announcements ────────────────────────────────────────────────────
// Reusable one-time toast for site-wide announcements — reuses the exact
// design/placement of the old one-off "Your stats are now live!" onboarding
// toast (removed from profile.js 2026-08-26; see .app-toast* in style.css),
// generalized so any future announcement can use the same component instead
// of hand-rolling a new one-off banner each time.
//
// Shows on the homepage and theme pages only (not mid-game pages — landing/
// browsing pages are where people arrive from outside the app, which is
// when an app-download-style push makes sense; interrupting an in-progress
// quiz would be a worse tradeoff). Shows on web AND in the app by default —
// set appOnly:true on an entry to restrict it.
//
// Seen-tracking is by a HASH OF THE TEXT, not a manually-set id — editing an
// entry's wording automatically makes it reappear for everyone who already
// saw the old wording, nothing extra to remember.
const APP_ANNOUNCEMENTS = [
  {
    icon: "✓",
    title: "Feedback form fixed!",
    text: "Sending feedback works properly now — thanks for your patience.",
    appOnly: true,
  },
  {
    icon: "🆕",
    title: "New game mode: Category Blitz!",
    text: "Spin a letter, race the clock — Daily Blitz, Solo, and Versus.",
    cta: { label: "Play Now", href: "category-blitz.html" },
  },
  {
    icon: "🎬",
    title: "16 new themes added!",
    text: "Cobra Kai, Loki, Hannibal, Scream, K-Dramas, Belgium, Spain, and more.",
    cta: { label: "See What's New", href: "recent.html" },
  },
  {
    icon: "🌐",
    title: "Play online with a friend!",
    text: "Trivia Versus and Category Blitz Versus now support real-time online multiplayer — create a room, share the code, and play live.",
    cta: { label: "Play Now", href: "versus.html" },
  },
  {
    icon: "🎲",
    title: "New: Random Trivia!",
    text: "No picking required — jump straight into a quiz mixing all our general-knowledge topics.",
    cta: { label: "Play Now", href: "random-trivia.html" },
  },
];

function _cbAnnouncementHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
  return String(h);
}

function _cbAnnouncementEligiblePage() {
  return document.body.dataset.page === "home" || /\/themes\//.test(window.location.pathname);
}

function _cbAnnouncementHrefFor(href) {
  // Theme pages live one directory down (themes/<slug>.html) and link back
  // to root-relative pages with "../" — the homepage doesn't need that.
  const depth = (window.location.pathname.match(/\/themes\//)) ? 1 : 0;
  return "../".repeat(depth) + href;
}

function initAppAnnouncementPopup() {
  if (!_cbAnnouncementEligiblePage()) return;
  const SEEN_KEY = "_appAnnouncementsSeen";
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); } catch {}

  const isApp = typeof isInApp === "function" && isInApp();
  const unseen = APP_ANNOUNCEMENTS.filter(a => {
    if (a.appOnly && !isApp) return false;
    return !seen.includes(_cbAnnouncementHash(a.text));
  });
  if (!unseen.length) return;

  unseen.forEach(a => seen.push(_cbAnnouncementHash(a.text)));
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch {}

  // Number entries only when several are catching someone up at once — a
  // lone new announcement doesn't need a "3." nobody has context for.
  const showNumbers = unseen.length > 1;
  const itemsHtml = unseen.map((a, i) => `
    <div class="app-toast-item">
      <div class="app-toast-icon" style="font-size:28px;">${a.icon || "📣"}</div>
      <div class="app-toast-text">
        <strong>${showNumbers ? `${i + 1}. ` : ""}${a.title || ""}</strong>
        <span>${a.text}</span>
        ${a.cta ? `<a href="${_cbAnnouncementHrefFor(a.cta.href)}" class="app-toast-btn">${a.cta.label}</a>` : ""}
      </div>
    </div>
  `).join("");

  const toast = document.createElement("div");
  toast.className = "app-toast";
  toast.innerHTML = `
    <button class="app-toast-dismiss" aria-label="Dismiss">&#10005;</button>
    <div class="app-toast-list">${itemsHtml}</div>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add("app-toast--in")));

  function dismiss() {
    toast.classList.remove("app-toast--in");
    setTimeout(() => toast.remove(), 350);
  }
  toast.querySelector(".app-toast-dismiss").addEventListener("click", dismiss);
  toast.querySelectorAll(".app-toast-btn").forEach(btn => btn.addEventListener("click", dismiss));
}

document.addEventListener("DOMContentLoaded", () => setTimeout(initAppAnnouncementPopup, 1200));
