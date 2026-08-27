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
  const next = APP_ANNOUNCEMENTS.find(a => {
    if (a.appOnly && !isApp) return false;
    return !seen.includes(_cbAnnouncementHash(a.text));
  });
  if (!next) return;

  seen.push(_cbAnnouncementHash(next.text));
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch {}

  const toast = document.createElement("div");
  toast.className = "app-toast";
  toast.innerHTML = `
    <div class="app-toast-body">
      <div class="app-toast-icon" style="font-size:28px;">${next.icon || "📣"}</div>
      <div class="app-toast-text">
        <strong>${next.title || ""}</strong>
        <span>${next.text}</span>
      </div>
    </div>
    <div class="app-toast-actions">
      ${next.cta ? `<a href="${_cbAnnouncementHrefFor(next.cta.href)}" class="app-toast-btn">${next.cta.label}</a>` : ""}
      <button class="app-toast-dismiss" aria-label="Dismiss">&#10005;</button>
    </div>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add("app-toast--in")));

  function dismiss() {
    toast.classList.remove("app-toast--in");
    setTimeout(() => toast.remove(), 350);
  }
  toast.querySelector(".app-toast-dismiss").addEventListener("click", dismiss);
  if (next.cta) toast.querySelector(".app-toast-btn").addEventListener("click", dismiss);
}

document.addEventListener("DOMContentLoaded", () => setTimeout(initAppAnnouncementPopup, 1200));
