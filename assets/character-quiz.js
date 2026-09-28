// "Which Character Are You?" quiz runtime.
// Page = character-quiz/<slug>.html (built by scripts/generate-character-pages.js),
// which inlines the quiz JSON in <script id="cqData">. Scoring lives in
// character-quiz-score.js so the balance validator uses the exact same maths.
//
// Web gating: ONE free test on the web. Once a limited-web visitor has a result
// for any show, starting another test — a different show OR a retake — shows
// the app wall. Viewing a saved result stays free.
(function () {
  const data = JSON.parse(document.getElementById('cqData').textContent);
  const stats = data.stats || {};
  const chars = Object.fromEntries(data.characters.map(c => [c.id, c]));
  const root = document.getElementById('cqApp');
  const STORE_KEY = 'tgCharResults';
  const SKIP_AD_KEY = 'cqSkipStartAd';

  let answers = [];
  let order = [];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function loadResults() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveResult(res) {
    try {
      const all = loadResults();
      all[data.slug] = { character: res.primary, secondary: res.secondary, breakdown: res.breakdown, show: data.show, date: new Date().toISOString().slice(0, 10) };
      localStorage.setItem(STORE_KEY, JSON.stringify(all));
    } catch (e) { /* storage blocked: result still shows, just isn't remembered */ }
  }
  function track(name, params) {
    if (typeof gtag === 'function') gtag('event', name, Object.assign({ quiz: data.slug }, params || {}));
  }
  function isGated() {
    if (typeof isLimitedWeb !== 'function' || !isLimitedWeb()) return false;
    return Object.keys(loadResults()).length > 0;
  }
  function shuffle(a) {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    return b;
  }

  // ── Screens ─────────────────────────────────────────────────────────────
  // Intro + everything below the quiz (more links, FAQ) only show on the start
  // screen — once the quiz starts, the page is just the quiz.
  function setIntro(show) {
    const el = document.getElementById('cqIntro');
    if (el) el.hidden = !show;
    document.querySelectorAll('.cq-extra').forEach(sec => { sec.hidden = !show; });
  }

  function showStart() {
    setIntro(true);
    const saved = loadResults()[data.slug];
    const savedLine = saved && chars[saved.character]
      ? `<p class="cq-saved">Last time you got <strong>${esc(chars[saved.character].name)}</strong>. <button type="button" class="cq-link-btn" id="cqViewSaved">See your result</button></p>`
      : '';
    root.innerHTML = `
      <div class="cq-start">
        <div class="cq-cast">${data.characters.map(c => `<span class="cq-cast-dot" style="--cq:${c.color}" title="${esc(c.name)}">${c.emoji}</span>`).join('')}</div>
        <p class="cq-start-meta">${data.questions.length} questions · about 2 minutes · ${data.characters.length} possible characters</p>
        <button type="button" class="primary-btn cq-start-btn" id="cqStart">Start the test</button>
        ${savedLine}
      </div>`;
    document.getElementById('cqStart').onclick = start;
    const v = document.getElementById('cqViewSaved');
    if (v) v.onclick = () => showResult(savedToResult(saved), false);
  }

  function savedToResult(saved) {
    return { primary: saved.character, secondary: saved.secondary, breakdown: saved.breakdown,
      clash: saved.breakdown[saved.breakdown.length - 1].id };
  }

  // App: interstitial when a test starts (admob.js applies the usual once-per-
  // session / 3-min cooldown / first-ever-game rules). Skipped once if the
  // visitor just watched a rewarded ad to unlock this test — no double ads.
  async function startAd() {
    if (typeof adMobShowGameStartInterstitial !== 'function') return;
    let skip = false;
    try { skip = sessionStorage.getItem(SKIP_AD_KEY) === '1'; sessionStorage.removeItem(SKIP_AD_KEY); } catch (e) {}
    if (!skip) { try { await adMobShowGameStartInterstitial(); } catch (e) {} }
  }

  async function start() {
    if (isGated()) { showWall(); return; }
    await startAd();
    setIntro(false);
    answers = [];
    order = data.questions.map(q => shuffle(q.options.map((_, i) => i)));
    track('character_quiz_start');
    showQuestion(0);
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showWall() {
    track('character_quiz_wall');
    root.innerHTML = typeof webWallHTML === 'function'
      ? webWallHTML(null, null, 'character tests', null, true)
      : '';
  }

  function showQuestion(i) {
    const q = data.questions[i];
    const n = data.questions.length;
    root.innerHTML = `
      <div class="cq-q">
        <div class="cq-progress"><div class="cq-progress-bar" style="width:${(i / n) * 100}%"></div></div>
        <p class="cq-q-count">Question ${i + 1} of ${n}</p>
        ${q.whatIf ? '<p class="cq-whatif">🎬 What if… <span>Imagine yourself in this situation</span></p>' : ''}
        <h2 class="cq-q-text">${esc(q.text)}</h2>
        <div class="options">
          ${order[i].map(oi => `<button type="button" class="option-btn cq-opt" data-oi="${oi}">${esc(q.options[oi].text)}</button>`).join('')}
        </div>
        ${i > 0 ? '<button type="button" class="cq-link-btn" id="cqBack">← Previous question</button>' : ''}
      </div>`;
    root.querySelectorAll('.cq-opt').forEach(btn => {
      btn.onclick = () => {
        btn.classList.add('selected');
        answers[i] = Number(btn.dataset.oi);
        setTimeout(() => (i + 1 < n ? showQuestion(i + 1) : finish()), 180);
      };
    });
    const back = document.getElementById('cqBack');
    if (back) back.onclick = () => showQuestion(i - 1);
  }

  function finish() {
    const res = CharacterQuizScore.scoreAnswers(data, answers);
    saveResult(res);
    track('character_quiz_complete', { character: res.primary });
    showResult(res, true);
  }

  function showResult(res, fresh) {
    const c = chars[res.primary];
    const second = chars[res.secondary];
    const clash = chars[res.clash];
    const share = stats.share && stats.share[c.id];
    const rarity = share ? `<p class="cq-rarity">Only about <strong>${Math.round(share * 100)}%</strong> of answer combinations lead to ${esc(c.name)}.</p>` : '';
    setIntro(false);
    root.innerHTML = `
      <div class="cq-result" style="--cq:${c.color}">
        <div class="cq-result-head">
          <div class="cq-result-emoji">${c.emoji}</div>
          <p class="cq-result-kicker">You are</p>
          <h2 class="cq-result-name">${esc(c.name)}</h2>
          <p class="cq-result-title">${esc(c.title)}</p>
        </div>
        <p class="cq-result-summary">${esc(c.summary)}</p>
        <p class="cq-mix">Mostly <strong>${esc(c.name)}</strong>, with a bit of <strong>${esc(second.name)}</strong>. You'd clash with <strong>${esc(clash.name)}</strong>, because ${esc(clash.clashReason)}.</p>
        <div class="cq-bars">
          ${res.breakdown.map(b => `
            <div class="cq-bar-row">
              <span class="cq-bar-label">${chars[b.id].emoji} ${esc(chars[b.id].name)}</span>
              <span class="cq-bar-track"><span class="cq-bar-fill" style="width:${b.pct}%;background:${chars[b.id].color}"></span></span>
              <span class="cq-bar-pct">${b.pct}%</span>
            </div>`).join('')}
        </div>
        ${rarity}
        <div class="cq-actions">
          <button type="button" class="primary-btn" id="cqShare">📸 Share my result</button>
          <button type="button" class="secondary-btn" id="cqRetake">Retake</button>
        </div>
        <a class="cq-prove" href="../challenge.html?theme=${esc(data.slug)}&round=1" data-promo-theme="${esc(data.slug)}">
          <strong>You got ${esc(c.name)}. Now prove you know ${esc(data.show)} →</strong>
          <span>Play the ${esc(data.show.replace(/^The /, ''))} trivia quiz</span>
        </a>
        ${otherTestsSearchHtml()}
        <details class="cq-why">
          <summary>Why you're ${esc(c.name)}</summary>
          ${c.description.map(p => `<p>${esc(p)}</p>`).join('')}
          <div class="cq-chips">${c.strengths.map(s => `<span class="cq-chip">${esc(s)}</span>`).join('')}</div>
          <p><strong>Your flaw:</strong> ${esc(c.flaw)}</p>
          <p><strong>Signature look:</strong> ${esc(c.signature)}</p>
        </details>
        <a href="../contact.html" class="secondary-btn" style="display:block;margin-top:14px;text-align:center;text-decoration:none;font-size:0.85rem;padding:8px 18px;">Leave Feedback</a>
      </div>`;
    wireOtherTestsSearch();
    document.getElementById('cqShare').onclick = () => shareCard(res);
    document.getElementById('cqRetake').onclick = start;
    const prove = root.querySelector('.cq-prove');
    prove.addEventListener('click', () => track('character_quiz_trivia_click', { character: c.id }));
    if (fresh) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Result screen: search every other character test ───────────────────
  function otherTests() {
    return (data.allTests || []).filter(t => t.slug !== data.slug);
  }
  function otherTestsSearchHtml() {
    if (!otherTests().length) return '';
    return `
        <div class="cq-search">
          <h3 class="cq-h3">Try another show</h3>
          <input type="search" id="cqSearch" class="theme-search-input" placeholder="Search for a show..." autocomplete="off" />
          <div id="cqSearchList" class="cq-search-list"></div>
        </div>`;
  }
  function wireOtherTestsSearch() {
    const input = document.getElementById('cqSearch');
    const list = document.getElementById('cqSearchList');
    if (!input || !list) return;
    const render = () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { list.innerHTML = ''; return; }
      const items = otherTests().filter(t => t.show.toLowerCase().includes(q)).slice(0, 5);
      list.innerHTML = items.length
        ? items.map(t => `<a class="cq-search-item" href="${esc(t.slug)}.html" data-slug="${esc(t.slug)}" data-show="${esc(t.show)}">🎭 ${esc(t.show)}</a>`).join('')
        : '<p class="cq-search-empty">No character test for that show yet.</p>';
    };
    input.addEventListener('input', render);
    render();
    list.addEventListener('click', e => {
      const a = e.target.closest('.cq-search-item');
      if (!a) return;
      e.preventDefault();
      openOtherTest(a.getAttribute('href'), a.dataset.show, a.dataset.slug);
    });
  }
  // App (with ads): opt-in rewarded ad to unlock the next test. Web and the
  // premium app just navigate — web visitors meet the one-free-test wall there.
  function openOtherTest(href, show, slug) {
    track('character_quiz_other_click', { to: slug });
    const go = () => { location.href = href; };
    const adsOn = typeof isInApp === 'function' && isInApp()
      && typeof ADMOB_ADS_ENABLED !== 'undefined' && ADMOB_ADS_ENABLED
      && typeof _offerRewardedLifeline === 'function';
    if (!adsOn) { go(); return; }
    _offerRewardedLifeline(show, () => {
      try { sessionStorage.setItem(SKIP_AD_KEY, '1'); } catch (e) {}
      track('character_quiz_rewarded_unlock', { to: slug });
      go();
    }, `Watch a short ad to unlock the <strong>${esc(show)}</strong> test?`);
  }

  // ── Shareable image card ───────────────────────────────────────────────
  function drawCard(res) {
    const c = chars[res.primary];
    const W = 1080, H = 1350;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    x.fillStyle = '#111'; x.fillRect(0, 0, W, H);
    x.fillStyle = c.color; x.fillRect(0, 0, W, 16);
    x.textAlign = 'center';
    x.fillStyle = '#cfcfcf'; x.font = '600 40px system-ui, -apple-system, sans-serif';
    x.fillText(`${data.show.toUpperCase()} TEST`, W / 2, 120);
    x.font = '170px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    x.fillText(c.emoji, W / 2, 330);
    x.fillStyle = '#cfcfcf'; x.font = '500 48px system-ui, -apple-system, sans-serif';
    x.fillText("I'm", W / 2, 430);
    // Shrink the font until long names/titles fit, rather than squashing letters.
    const fit = (text, weight, size, min) => {
      let s = size;
      do { x.font = `${weight} ${s}px system-ui, -apple-system, sans-serif`; } while (x.measureText(text).width > W - 120 && (s -= 4) >= min);
    };
    x.fillStyle = '#fff'; fit(c.name, 800, 92, 56);
    x.fillText(c.name, W / 2, 530, W - 120);
    x.fillStyle = c.color; fit(c.title, 600, 46, 32);
    x.fillText(c.title, W / 2, 600, W - 120);
    // Top 4 bars
    x.textAlign = 'left';
    res.breakdown.slice(0, 4).forEach((b, k) => {
      const ch = chars[b.id], y = 720 + k * 110;
      x.fillStyle = '#f5f5f5'; x.font = '600 40px system-ui, -apple-system, sans-serif';
      x.fillText(ch.name, 110, y);
      x.textAlign = 'right'; x.fillText(`${b.pct}%`, W - 110, y); x.textAlign = 'left';
      x.fillStyle = '#2d2d2d'; x.fillRect(110, y + 22, W - 220, 26);
      x.fillStyle = ch.color; x.fillRect(110, y + 22, (W - 220) * b.pct / 100, 26);
    });
    x.textAlign = 'center';
    x.fillStyle = '#93c5fd'; x.font = '600 42px system-ui, -apple-system, sans-serif';
    x.fillText('Which character are you? triviagauntlet.app', W / 2, H - 80);
    return cv;
  }

  function shareCard(res) {
    track('character_quiz_share', { character: res.primary });
    const cv = drawCard(res);
    const name = chars[res.primary].name;
    const text = `I got ${name} on the ${data.show.replace(/^The /, '')} test! Which character are you?`;
    const url = location.origin + location.pathname;
    cv.toBlob(async blob => {
      const file = blob && new File([blob], `${data.slug}-${res.primary}.png`, { type: 'image/png' });
      try {
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: `${text} ${url}` });
          return;
        }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      // Fallback: download the image.
      const a = document.createElement('a');
      a.href = cv.toDataURL('image/png');
      a.download = `${data.slug}-${res.primary}.png`;
      document.body.appendChild(a); a.click(); a.remove();
    }, 'image/png');
  }

  showStart();
})();
