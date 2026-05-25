// ── Leaderboard — Supabase REST integration ───────────────────────────────────

const LB_URL = "https://avasbapxzgmpcosixgio.supabase.co";
const LB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YXNiYXB4emdtcGNvc2l4Z2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjM4MzUsImV4cCI6MjA5NTIzOTgzNX0.DLNnasmaQ1hdKXb2xqXrTBnBjISo0RxOiwy7TrlN9bg";
const LB_READY = LB_URL !== "REPLACE_WITH_SUPABASE_URL";

// ── Helpers ───────────────────────────────────────────────────────────────────

function lbPlayerId() {
  let id = localStorage.getItem("tg_player_id");
  if (!id) {
    id = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
        });
    localStorage.setItem("tg_player_id", id);
  }
  return id;
}

function lbEscapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function _lbGet(path) {
  const res = await fetch(`${LB_URL}/rest/v1/${path}`, {
    headers: { apikey: LB_KEY, Authorization: `Bearer ${LB_KEY}` }
  });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

async function _lbPost(path, body, prefer) {
  const res = await fetch(`${LB_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: LB_KEY,
      Authorization: `Bearer ${LB_KEY}`,
      "Content-Type": "application/json",
      Prefer: prefer || "return=representation"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

// ── Data functions ─────────────────────────────────────────────────────────────

// Top score for a theme — used in game HUD
async function lbTopScore(slug) {
  if (!LB_READY) return null;
  try {
    const rows = await _lbGet(
      `leaderboard?theme_slug=eq.${encodeURIComponent(slug)}&order=score.desc&limit=1&select=score`
    );
    return rows.length ? rows[0].score : null;
  } catch { return null; }
}

// Top 20 for leaderboard modal
async function lbTop20(slug) {
  if (!LB_READY) return [];
  try {
    return await _lbGet(
      `leaderboard?theme_slug=eq.${encodeURIComponent(slug)}&order=score.desc&limit=20&select=player_id,player_name,score,updated_at`
    );
  } catch { return []; }
}

// Count of players with a strictly higher score (rank = this + 1)
async function lbRank(slug, score) {
  if (!LB_READY) return null;
  try {
    const rows = await _lbGet(
      `leaderboard?theme_slug=eq.${encodeURIComponent(slug)}&score=gt.${score}&select=id`
    );
    return rows.length + 1;
  } catch { return null; }
}

// Total number of entries for a theme
async function lbTotal(slug) {
  if (!LB_READY) return null;
  try {
    const res = await fetch(
      `${LB_URL}/rest/v1/leaderboard?theme_slug=eq.${encodeURIComponent(slug)}`,
      {
        method: "HEAD",
        headers: { apikey: LB_KEY, Authorization: `Bearer ${LB_KEY}`, Prefer: "count=exact" }
      }
    );
    const range = res.headers.get("Content-Range");
    if (!range) return null;
    const total = parseInt(range.split("/")[1], 10);
    return isNaN(total) ? null : total;
  } catch { return null; }
}

// Upsert best score — only called when it's confirmed a new PB
async function lbSubmit(slug, playerName, score) {
  if (!LB_READY) throw new Error("Leaderboard not configured");
  return _lbPost(
    "leaderboard",
    {
      theme_slug: slug,
      player_id: lbPlayerId(),
      player_name: playerName.trim().slice(0, 30),
      score,
      updated_at: new Date().toISOString()
    },
    "resolution=merge-duplicates,return=representation"
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function lbOpenModal(slug, title) {
  let modal = document.getElementById("lbModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "lbModal";
    modal.className = "lb-modal-overlay";
    modal.innerHTML = `
      <div class="lb-modal">
        <div class="lb-modal-header">
          <h3 id="lbModalTitle"></h3>
          <button class="lb-modal-close" id="lbModalCloseBtn">✕</button>
        </div>
        <div id="lbModalBody"></div>
      </div>`;
    modal.addEventListener("click", e => { if (e.target === modal) lbCloseModal(); });
    document.getElementById("lbModalCloseBtn", modal);
    document.body.appendChild(modal);
  }

  document.getElementById("lbModalTitle").textContent = `${title} — Top 20`;
  document.getElementById("lbModalBody").innerHTML = `<p class="lb-loading">Loading…</p>`;
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";

  // Wire close button each time (modal may have been re-created)
  modal.querySelector("#lbModalCloseBtn").onclick = lbCloseModal;

  lbTop20(slug).then(rows => {
    const myId = lbPlayerId();
    const body = document.getElementById("lbModalBody");
    if (!body) return;

    if (!rows.length) {
      body.innerHTML = `<p class="lb-empty">No scores yet — be the first!</p>`;
      return;
    }

    const rowsHtml = rows.map((r, i) => {
      const mine = r.player_id === myId;
      const date = new Date(r.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const medalClass = i === 0 ? " lb-rank--gold" : i === 1 ? " lb-rank--silver" : i === 2 ? " lb-rank--bronze" : "";
      return `<div class="lb-row${mine ? " lb-row--me" : ""}">
        <span class="lb-rank${medalClass}">${i + 1}</span>
        <span class="lb-name">${lbEscapeHtml(r.player_name)}${mine ? " 👤" : ""}</span>
        <span class="lb-score">${r.score}</span>
        <span class="lb-date">${date}</span>
      </div>`;
    }).join("");

    body.innerHTML = `
      <div class="lb-header-row">
        <span>#</span><span>Player</span><span>Score</span><span>Date</span>
      </div>
      ${rowsHtml}`;
  });
}

function lbCloseModal() {
  const modal = document.getElementById("lbModal");
  if (modal) modal.style.display = "none";
  document.body.style.overflow = "";
}

// ── Submit section (injected into result box on new PB) ───────────────────────

function lbShowSubmit(slug, themeTitle, score, container) {
  if (!LB_READY) return;

  const profileName = (typeof getProfile === "function") ? getProfile().name : "";
  const section = document.createElement("div");
  section.className = "lb-submit-section";
  section.innerHTML = `
    <p class="lb-submit-title">🏆 Submit to Leaderboard</p>
    <div class="lb-submit-row">
      <input id="lbNameInput" class="form-input" type="text" maxlength="30"
        placeholder="Your name" value="${lbEscapeHtml(profileName)}" autocomplete="off" />
      <button id="lbSubmitBtn" class="primary-btn">Submit</button>
    </div>
    <p id="lbSubmitMsg" class="lb-submit-msg"></p>
    <button class="lb-skip-link" id="lbSkipBtn">Skip</button>
  `;
  container.appendChild(section);

  section.querySelector("#lbSkipBtn").onclick = () => section.remove();

  section.querySelector("#lbSubmitBtn").onclick = async () => {
    const nameInput = section.querySelector("#lbNameInput");
    const msgEl     = section.querySelector("#lbSubmitMsg");
    const btn       = section.querySelector("#lbSubmitBtn");
    const name = nameInput.value.trim();

    if (!name) { nameInput.focus(); return; }

    btn.disabled = true;
    btn.textContent = "Submitting…";
    msgEl.textContent = "";

    try {
      await lbSubmit(slug, name, score);

      // Save name to profile if they didn't have one
      if (typeof getProfile === "function" && !getProfile().name) {
        const p = getProfile(); p.name = name; saveProfile(p);
      }

      const [rank, total] = await Promise.all([lbRank(slug, score), lbTotal(slug)]);

      section.innerHTML = `
        <p class="lb-submitted-rank">
          You're <strong>#${rank !== null ? rank : "?"}</strong>${total ? ` of ${total}` : ""} on this theme!
        </p>
        <button class="secondary-btn lb-view-board-btn" style="margin-top:8px;">View Leaderboard</button>
      `;
      section.querySelector(".lb-view-board-btn").onclick = () => lbOpenModal(slug, themeTitle);
    } catch {
      btn.disabled = false;
      btn.textContent = "Submit";
      msgEl.textContent = "Couldn't submit — check your connection and try again.";
    }
  };
}
