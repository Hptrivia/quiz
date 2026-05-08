const WS_GRID_SIZE = 10;
const WS_PAGE_SIZE = 6;

const WS_COLORS = [
  '#4ade80','#60a5fa','#f472b6','#fb923c',
  '#a78bfa','#34d399','#fbbf24','#e879f9',
];

const WS_ALL_DIRS = [
  [0,1],[1,0],[1,1],[1,-1],
  [0,-1],[-1,0],[-1,1],[-1,-1],
];

let wsGrid       = [];
let wsPlacements = [];
let wsWordsFound = 0;
let wsIsRevealed = false;

let wsIsDragging    = false;
let wsDragStartCell = null;
let wsLockedDir     = null;
let wsSelectedCells = [];

// ─── Grid generation ──────────────────────────────────────────────────────────

function wsShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function wsInitGrid() {
  wsGrid = Array.from({ length: WS_GRID_SIZE }, () => Array(WS_GRID_SIZE).fill(''));
}

function wsValidStarts(wordLen, dir) {
  const [dr, dc] = dir;
  const out = [];
  for (let r = 0; r < WS_GRID_SIZE; r++) {
    for (let c = 0; c < WS_GRID_SIZE; c++) {
      const er = r + dr * (wordLen - 1);
      const ec = c + dc * (wordLen - 1);
      if (er >= 0 && er < WS_GRID_SIZE && ec >= 0 && ec < WS_GRID_SIZE) out.push([r, c]);
    }
  }
  return out;
}

function wsTryPlace(word, dir) {
  const [dr, dc] = dir;
  for (const [r, c] of wsShuffle(wsValidStarts(word.length, dir))) {
    let ok = true;
    const cells = [];
    for (let i = 0; i < word.length; i++) {
      const nr = r + dr * i, nc = c + dc * i;
      const ex = wsGrid[nr][nc];
      if (ex !== '' && ex !== word[i]) { ok = false; break; }
      cells.push({ r: nr, c: nc });
    }
    if (ok) {
      cells.forEach((cell, i) => { wsGrid[cell.r][cell.c] = word[i]; });
      return cells;
    }
  }
  return null;
}

function wsBuildGrid(words) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const colors  = wsShuffle([...WS_COLORS]);

  for (let attempt = 0; attempt < 5; attempt++) {
    wsInitGrid();
    wsPlacements = [];
    let allPlaced = true;

    for (const word of wsShuffle([...words])) {
      let placed = false;
      for (const dir of wsShuffle([...WS_ALL_DIRS])) {
        const cells = wsTryPlace(word, dir);
        if (cells) {
          wsPlacements.push({ word, cells, found: false, color: null });
          placed = true;
          break;
        }
      }
      if (!placed) { allPlaced = false; break; }
    }

    if (allPlaced) break;
  }

  for (let r = 0; r < WS_GRID_SIZE; r++)
    for (let c = 0; c < WS_GRID_SIZE; c++)
      if (!wsGrid[r][c]) wsGrid[r][c] = letters[Math.floor(Math.random() * 26)];

  wsPlacements.forEach((p, i) => { p.color = colors[i % colors.length]; });
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function wsRenderGrid() {
  const el = document.getElementById('wsGrid');
  el.innerHTML = '';
  for (let r = 0; r < WS_GRID_SIZE; r++) {
    for (let c = 0; c < WS_GRID_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'ws-cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.textContent = wsGrid[r][c];
      el.appendChild(cell);
    }
  }
}

function wsRenderWordList() {
  const el = document.getElementById('wsWordList');
  el.innerHTML = '';
  wsPlacements.forEach(p => {
    const item = document.createElement('span');
    item.className = 'ws-word-item' + (p.found ? ' found' : '');
    item.dataset.word = p.word;
    item.textContent = p.word;
    if (p.found) item.style.background = p.color;
    el.appendChild(item);
  });
}

function wsUpdateStats() {
  const rem = wsPlacements.length - wsWordsFound;
  document.getElementById('wsWordsLeft').textContent =
    rem === 0 ? 'All found!' : `${rem} word${rem !== 1 ? 's' : ''} left`;
}

// ─── Drag helpers ─────────────────────────────────────────────────────────────

function wsCellEl(r, c) {
  return document.querySelector(`.ws-cell[data-r="${r}"][data-c="${c}"]`);
}

function wsCellFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  return (el && el.classList.contains('ws-cell'))
    ? { r: +el.dataset.r, c: +el.dataset.c } : null;
}

function wsSnapDir(dr, dc) {
  if (!dr && !dc) return null;
  const angle = Math.atan2(dr, dc) * 180 / Math.PI;
  const dirs = [
    { dr: 0,  dc: 1,  a: 0   }, { dr: 1,  dc: 1,  a: 45  },
    { dr: 1,  dc: 0,  a: 90  }, { dr: 1,  dc: -1, a: 135 },
    { dr: 0,  dc: -1, a: 180 }, { dr: -1, dc: -1, a: -135 },
    { dr: -1, dc: 0,  a: -90 }, { dr: -1, dc: 1,  a: -45 },
  ];
  let best = dirs[0], bd = Infinity;
  for (const d of dirs) {
    let diff = Math.abs(angle - d.a);
    if (diff > 180) diff = 360 - diff;
    if (diff < bd) { bd = diff; best = d; }
  }
  return best;
}

function wsClearSel() {
  wsSelectedCells.forEach(({ r, c }) => {
    const el = wsCellEl(r, c);
    if (el) el.classList.remove('ws-selected');
  });
  wsSelectedCells = [];
}

function wsUpdateSel(end) {
  if (!wsDragStartCell || !end) return;

  const rawDr = end.r - wsDragStartCell.r;
  const rawDc = end.c - wsDragStartCell.c;

  if (!wsLockedDir) {
    if (rawDr === 0 && rawDc === 0) return;
    wsLockedDir = wsSnapDir(rawDr, rawDc);
  }

  wsClearSel();

  const dirLenSq = wsLockedDir.dr * wsLockedDir.dr + wsLockedDir.dc * wsLockedDir.dc;
  const dot      = rawDr * wsLockedDir.dr + rawDc * wsLockedDir.dc;
  const steps    = Math.max(0, Math.round(dot / dirLenSq));

  wsSelectedCells = [];
  for (let i = 0; i <= steps; i++) {
    const nr = wsDragStartCell.r + wsLockedDir.dr * i;
    const nc = wsDragStartCell.c + wsLockedDir.dc * i;
    if (nr >= 0 && nr < WS_GRID_SIZE && nc >= 0 && nc < WS_GRID_SIZE)
      wsSelectedCells.push({ r: nr, c: nc });
    else break;
  }

  wsSelectedCells.forEach(({ r, c }) => {
    const el = wsCellEl(r, c);
    if (el && !el.classList.contains('ws-found')) el.classList.add('ws-selected');
  });
}

function wsEndDrag() {
  if (!wsIsDragging) return;
  wsIsDragging = false;
  if (wsSelectedCells.length >= 2) wsCheckSel();
  wsClearSel();
  wsDragStartCell = null;
  wsLockedDir     = null;
}

function wsCheckSel() {
  const typed = wsSelectedCells.map(({ r, c }) => wsGrid[r][c]).join('');
  for (const p of wsPlacements) {
    if (!p.found && typed === p.word) { wsMarkFound(p); return; }
  }
}

function wsMarkFound(p) {
  p.found = true;
  wsWordsFound++;

  p.cells.forEach(({ r, c }) => {
    const el = wsCellEl(r, c);
    if (el) {
      el.classList.remove('ws-selected');
      el.classList.add('ws-found');
      el.style.background = p.color;
    }
  });

  if (wsIsRevealed) {
    const item = document.querySelector(`.ws-word-item[data-word="${p.word}"]`);
    if (item) { item.classList.add('found'); item.style.background = p.color; }
  } else {
    const badge = document.createElement('span');
    badge.className = 'ws-found-badge';
    badge.textContent = p.word;
    badge.style.background = p.color;
    document.getElementById('wsFoundList').appendChild(badge);
  }

  wsUpdateStats();
  wsShowToast(`${p.word} found!`);

  if (wsWordsFound === wsPlacements.length) setTimeout(wsShowCompletion, 800);
}

// ─── Toast ────────────────────────────────────────────────────────────────────

let wsToastTimer;
function wsShowToast(msg) {
  const t = document.getElementById('wsToast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(wsToastTimer);
  wsToastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function wsCloseModal(id) {
  document.getElementById(id).classList.remove('ws-modal-show');
}

function wsShowCompletion() {
  document.getElementById('wsDoneModal').classList.add('ws-modal-show');
}

// ─── Event wiring ─────────────────────────────────────────────────────────────

function wsWireEvents() {
  const gridEl = document.getElementById('wsGrid');

  document.getElementById('wsHowToBtn').addEventListener('click', () =>
    document.getElementById('wsHowToModal').classList.add('ws-modal-show'));

  document.getElementById('wsRevealBtn').addEventListener('click', () => {
    wsIsRevealed = !wsIsRevealed;
    const btn = document.getElementById('wsRevealBtn');
    const wl  = document.getElementById('wsWordList');
    const fl  = document.getElementById('wsFoundList');

    btn.textContent = wsIsRevealed ? '🙈 Hide Words' : '👁 Reveal Words';
    btn.classList.toggle('ws-btn-active', wsIsRevealed);

    if (wsIsRevealed) {
      wsRenderWordList();
      wl.classList.add('ws-visible');
      fl.style.display = 'none';
    } else {
      wl.classList.remove('ws-visible');
      fl.style.display = '';
    }
  });

  gridEl.addEventListener('mousedown', e => {
    const cell = wsCellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    wsIsDragging = true; wsDragStartCell = cell; wsLockedDir = null;
    wsUpdateSel(cell);
  });

  window.addEventListener('mousemove', e => {
    if (!wsIsDragging) return;
    const cell = wsCellFromPoint(e.clientX, e.clientY);
    if (cell) wsUpdateSel(cell);
  });

  window.addEventListener('mouseup', wsEndDrag);

  gridEl.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    const cell = wsCellFromPoint(t.clientX, t.clientY);
    if (!cell) return;
    wsIsDragging = true; wsDragStartCell = cell; wsLockedDir = null;
    wsUpdateSel(cell);
  }, { passive: false });

  gridEl.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!wsIsDragging) return;
    const cell = wsCellFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    if (cell) wsUpdateSel(cell);
  }, { passive: false });

  gridEl.addEventListener('touchend', e => {
    e.preventDefault();
    wsEndDrag();
  }, { passive: false });
}

// ─── Mashup Word Search ───────────────────────────────────────────────────────

async function renderWordSearchMashupMode(themesParam) {
  const rawPage = parseInt(getParam("page") || "1", 10);
  const slugs   = themesParam.split(",").map(s => s.trim()).filter(Boolean);

  const titleEl = document.getElementById('wsTitle');
  const backEl  = document.querySelector('.back-link');
  if (backEl) backEl.href = `mashup-landing.html?themes=${themesParam}`;

  const allThemeMeta   = await fetchJSON("data/themes.json");
  const selectedThemes = slugs.map(slug => allThemeMeta.find(t => t.slug === slug)).filter(Boolean);

  if (selectedThemes.length < 2) {
    titleEl.textContent = "Invalid theme selection.";
    return;
  }

  titleEl.textContent = "Mashup Word Search";

  const allWords       = await fetchJSON("data/wordsearch_words.json");
  const themeWordLists = selectedThemes
    .map(t => ({ slug: t.slug, title: t.title, words: Array.isArray(allWords[t.title]) ? allWords[t.title] : [] }))
    .filter(t => t.words.length > 0);

  if (!themeWordLists.length) {
    document.getElementById('wsWordsLeft').textContent = "No words found for these themes.";
    document.getElementById('wsHowToBtn').style.display = 'none';
    document.getElementById('wsRevealBtn').style.display = 'none';
    return;
  }

  // Round-robin interleave for even distribution across themes
  const maxLen       = Math.max(...themeWordLists.map(t => t.words.length));
  const combinedWords = [];
  for (let i = 0; i < maxLen; i++) {
    for (const t of themeWordLists) {
      if (i < t.words.length) combinedWords.push(String(t.words[i]).toUpperCase());
    }
  }

  const currentPage = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  const totalPages  = Math.ceil(combinedWords.length / WS_PAGE_SIZE);
  const safePage    = Math.min(currentPage, totalPages);
  const pageStart   = (safePage - 1) * WS_PAGE_SIZE;
  const words       = combinedWords.slice(pageStart, pageStart + WS_PAGE_SIZE);

  const howToThemeEl = document.getElementById('wsHowToTheme');
  if (howToThemeEl) howToThemeEl.textContent = "these themes";

  const nextBtn = document.getElementById('wsNextBtn');
  if (safePage < totalPages) {
    nextBtn.href = `wordsearch.html?themes=${themesParam}&page=${safePage + 1}`;
    nextBtn.style.display = 'block';
  }

  wsBuildGrid(words);
  wsRenderGrid();
  wsUpdateStats();
  wsWireEvents();

  if (safePage >= 2 && typeof maybeShowPwaPopup === "function") maybeShowPwaPopup();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function renderWordSearchPage() {
  if (getParam("themes")) { await renderWordSearchMashupMode(getParam("themes")); return; }

  const slug    = getParam("theme");
  const rawPage = parseInt(getParam("page") || "1", 10);
  const themes  = await loadThemes();
  const theme   = themes.find(t => t.slug === slug);

  const titleEl  = document.getElementById('wsTitle');
  const backEl   = document.querySelector('.back-link');

  if (backEl && slug) backEl.href = `quiz.html?theme=${slug}`;

  if (!theme) {
    titleEl.textContent = "Theme not found";
    return;
  }

  titleEl.textContent = `${theme.title} Word Search`;
  document.title = `${theme.title} Word Search - Trivia Gauntlet`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', `Play the ${theme.title} Word Search on Trivia Gauntlet. Find hidden words from the ${theme.title} universe across multiple pages.`);

  if (typeof gtag === "function") {
    gtag("event", "page_view", {
      page_title: `Word Search - ${theme.title}`,
      page_location: window.location.href
    });
  }

  if (typeof updateRemoveAdsFooter === "function") {
    updateRemoveAdsFooter(theme.slug, "normal");
  }

  const allWords   = await fetchJSON("data/wordsearch_words.json");
  const themeWords = allWords[theme.title];

  if (!Array.isArray(themeWords) || !themeWords.length) {
    document.getElementById('wsWordsLeft').textContent = "No words found for this theme.";
    document.getElementById('wsHowToBtn').style.display = 'none';
    document.getElementById('wsRevealBtn').style.display = 'none';
    return;
  }

  const currentPage = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  const totalPages  = Math.ceil(themeWords.length / WS_PAGE_SIZE);
  const safePage    = Math.min(currentPage, totalPages);
  const pageStart   = (safePage - 1) * WS_PAGE_SIZE;
  const words       = themeWords.slice(pageStart, pageStart + WS_PAGE_SIZE).map(w => String(w).toUpperCase());

  // Set How to Play theme name
  const howToThemeEl = document.getElementById('wsHowToTheme');
  if (howToThemeEl) howToThemeEl.textContent = theme.title;

  // Next Grid button — only shown if more pages exist
  const nextBtn = document.getElementById('wsNextBtn');
  if (safePage < totalPages) {
    nextBtn.href = `wordsearch.html?theme=${slug}&page=${safePage + 1}`;
    nextBtn.style.display = 'block';
  }

  wsBuildGrid(words);
  wsRenderGrid();
  wsUpdateStats();
  wsWireEvents();

  renderWsPageContent(theme, themes, safePage, themeWords);
  if (safePage >= 2 && typeof maybeShowPwaPopup === "function") maybeShowPwaPopup();
}

function renderWsPageContent(theme, themes, page, allWords = []) {
  const container = document.getElementById("wsPageContent");
  if (!container) return;

  const ctx = getThemeContext(theme.category);
  const relatedThemes = getRelatedThemes(themes, theme, 5);
  const toTitleCase = s => String(s).toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const sample = allWords.slice(0, 6).map(toTitleCase);
  const wordLine = sample.length >= 2
    ? `Find words like ${sample.slice(0, -1).join(", ")}, and ${sample[sample.length - 1]} alongside other characters, locations, and key terms associated with ${theme.title}.`
    : `The words are drawn from the characters, locations, and key terms associated with ${theme.title}.`;

  const relatedHtml = relatedThemes.length ? `
    <div class="theme-related-quizzes">
      <h3>Related themes</h3>
      <div class="grid">
        ${relatedThemes.map(t => `<a class="card" href="wordsearch.html?theme=${t.slug}&page=1"><h3>${t.title}</h3></a>`).join("")}
      </div>
    </div>` : "";

  const descHtml = page === 1 ? `
    <h2>About the ${theme.title} Word Search</h2>
    <p>The ${theme.title} Word Search hides words from ${ctx} inside a grid of letters — you won't know what you're looking for until you find it. ${wordLine} Words run horizontally, vertically, or diagonally, and each one reveals itself as you drag across the right letters. Each page works through a different set of words, so there is always more to find.</p>
    <hr style="border:none;border-top:1px solid var(--panel-border);margin:20px 0;">` : "";

  container.innerHTML = `
    <section class="panel" style="margin-top:16px;">
      ${descHtml}
      <div class="result-theme-search">
        <p class="result-theme-search-title">Try another Word Search theme</p>
        <div class="search-wrap">
          <input id="wsThemeSearchInput" class="theme-search-input" type="text" placeholder="Search themes..." autocomplete="off" />
          <div id="wsThemeSearchResults" class="search-results"></div>
        </div>
        ${relatedHtml}
      </div>
    </section>`;

  const input = document.getElementById("wsThemeSearchInput");
  const results = document.getElementById("wsThemeSearchResults");
  if (!input || !results) return;

  const renderResults = (items) => {
    results.innerHTML = items.length
      ? items.map(t => `<a class="search-item" href="wordsearch.html?theme=${t.slug}&page=1">${t.title}</a>`).join("")
      : '<div class="search-item">No results found</div>';
  };

  input.addEventListener("focus", () => { renderResults(themes); results.style.display = "block"; });
  input.addEventListener("input", e => {
    const v = e.target.value.trim().toLowerCase();
    renderResults(themes.filter(t => t.title.toLowerCase().includes(v)));
    results.style.display = "block";
  });
  document.addEventListener("click", e => {
    if (!input.contains(e.target) && !results.contains(e.target)) results.style.display = "none";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "wordsearch") {
    renderWordSearchPage();
  }
});
