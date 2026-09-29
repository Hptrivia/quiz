async function renderEpisodePage() {
  const slug = getParam("theme");
  const themes = await loadThemes();
  const theme = themes.find(t => t.slug === slug);

  if (!theme) return;

  document.title = `${theme.title} Episode Mode - Trivia Gauntlet`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', `Play ${theme.title} Episode Mode on Trivia Gauntlet. Episode-by-episode trivia questions following the series.`);

  if (typeof gtag === "function") {
    gtag("event", "page_view", {
      page_title: `Episode Mode - ${theme.title}`,
      page_location: window.location.href
    });
  }


  const nextPageLink = document.getElementById("episodeNextPageLink");
  const scoreEl = document.getElementById("episodeScoreText");
  const slidesContainer = document.getElementById("episodeSlides");
  const resultBox = document.getElementById("episodeResultBox");
  const gameBox = document.getElementById("episodeGameBox");

  const rawEpisode = parseInt(getParam("episode") || "1", 10);
  const currentEpisode = Number.isNaN(rawEpisode) || rawEpisode < 1 ? 1 : rawEpisode;

  const episodeThemes = await fetchJSON("data/episode_themes.json");
  const episodeFile = episodeThemes[slug];

  // Coming-soon landing for themes that don't have Episode Mode yet (see below).
  function renderEpisodeComingSoon(soonTheme, allThemes, episodeMap) {
    const eligible = (typeof isEpisodeSoonTheme === "function")
      ? isEpisodeSoonTheme(soonTheme, episodeMap)
      : false;

    // Related cards: same-category themes that DO have Episode Mode (cross-sell).
    const related = (typeof shuffleArray === "function"
      ? shuffleArray(allThemes.filter(t => t.slug !== soonTheme.slug && t.category === soonTheme.category && episodeMap[t.slug]))
      : allThemes.filter(t => t.slug !== soonTheme.slug && t.category === soonTheme.category && episodeMap[t.slug])
    ).slice(0, 4);
    const relatedHtml = related.length ? `
      <div class="theme-related-quizzes">
        <h3>Play Episode Mode now</h3>
        <div class="grid">
          ${related.map(t => `
            <a class="card" href="episode.html?theme=${t.slug}&episode=1">
              <h3>${t.title}</h3>
            </a>`).join("")}
        </div>
      </div>` : "";

    // What Episode Mode is (for people who've never seen it). Theme-agnostic.
    const explainer = "Episode Mode walks you through a show one episode at a time — a set of trivia questions that follow the story of each episode in order, starting from the very first.";

    const notifyHtml = eligible ? `
        <div class="notify-card" id="epSoonCard">
          <a class="notify-card-btn" style="display:inline-block;text-decoration:none;" href="custom-requests.html">Request Custom Trivia →</a>
        </div>` : "";

    if (gameBox) gameBox.style.display = "none";
    resultBox.style.display = "block";
    resultBox.classList.remove("result-anim");
    void resultBox.offsetWidth;
    resultBox.classList.add("result-anim");
    resultBox.innerHTML = `
      <div class="episode-soon">
        <h2>🎬 ${soonTheme.title} Episode Mode</h2>
        <p class="episode-soon-badge">${eligible ? "Available by request" : "Not available"}</p>
        <p class="episode-soon-explainer">${explainer}</p>
        ${eligible ? "" : `<p class="episode-soon-sub">Episode Mode isn't available for <strong>${soonTheme.title}</strong>.</p>`}
        ${notifyHtml}
      </div>
      ${relatedHtml}
    `;
  }

  if (!episodeFile) {
    // No episode for this theme yet. For narrative shows, render a "Coming Soon"
    // landing: what-is-Episode-Mode explainer + a link to request it as a paid
    // custom job + related cards for same-category themes that DO have Episode
    // Mode (cross-sell). Shown on web + app.
    renderEpisodeComingSoon(theme, themes, episodeThemes);
    return;
  }

  const allQuestions = await fetchJSON(`data/${episodeFile}`);

  let affiliateProducts = null;
  try {
    const affiliateLinks = await fetchJSON("data/affiliate_links.json");
    const raw = affiliateLinks[theme.title];
    if (raw) {
      const list = (Array.isArray(raw) ? raw : [raw]).filter(item => item && item.url && item.url.trim());
      affiliateProducts = list.length ? list : null;
    }
  } catch (e) {
    affiliateProducts = null;
  }

  function cleanText(text) {
    return String(text || "").replace(/\*\*/g, "").trim();
  }

  function extractEpisodeMarker(question) {
    const contextText = String(question.context || "");
    const match = contextText.match(/episode\s+(\d+)/i);
    if (!match) return null;
    return parseInt(match[1], 10);
  }

  const episodeMap = new Map();
  // Questions before the first "EPISODE N" marker belong to episode 1 — most
  // single-episode files were written without a marker, and without this they'd
  // be dropped as soon as a marked episode 2 block is appended after them.
  let currentMarker = 1;
  let foundAnyEpisodeMarkers = false;

  allQuestions.forEach(q => {
    const marker = extractEpisodeMarker(q);
    if (marker !== null) {
      currentMarker = marker;
      foundAnyEpisodeMarkers = true;
    }
    if (currentMarker !== null) {
      if (!episodeMap.has(currentMarker)) episodeMap.set(currentMarker, []);
      episodeMap.get(currentMarker).push(q);
    }
  });

  let episodeQuestions = [];
  let safeEpisode = 1;
  let hasNextEpisode = false;
  let nextEpisodeNumber = null;

  if (foundAnyEpisodeMarkers && episodeMap.size > 0) {
    const availableEpisodes = [...episodeMap.keys()].sort((a, b) => a - b);
    safeEpisode = episodeMap.has(currentEpisode) ? currentEpisode : availableEpisodes[0];
    episodeQuestions = episodeMap.get(safeEpisode) || [];

    const currentEpisodeIndex = availableEpisodes.indexOf(safeEpisode);
    hasNextEpisode = currentEpisodeIndex !== -1 && currentEpisodeIndex < availableEpisodes.length - 1;
    nextEpisodeNumber = hasNextEpisode ? availableEpisodes[currentEpisodeIndex + 1] : null;
  } else {
    episodeQuestions = allQuestions;
    safeEpisode = 1;
    hasNextEpisode = false;
    nextEpisodeNumber = null;
  }

  if (!episodeQuestions.length) {
    slidesContainer.textContent = "No episode data found.";
    return;
  }

  const episodeHeading = document.getElementById("episodeHeading");
  if (episodeHeading) episodeHeading.textContent = `Episode ${safeEpisode}`;

  if (nextPageLink) {
    if (hasNextEpisode) {
      nextPageLink.style.display = "inline-block";
      nextPageLink.textContent = "Skip to next episode";
      nextPageLink.href = `episode.html?theme=${theme.slug}&episode=${nextEpisodeNumber}`;
      nextPageLink.dataset.rewardedHref = `episode.html?theme=${theme.slug}&episode=${nextEpisodeNumber}`;
      nextPageLink.dataset.rewardedLabel = "next episode"; // ad prompt: "…continue to the next episode?"
    } else {
      nextPageLink.style.display = "none";
    }
  }
  // Limited web: skipping ahead always pops the app-download wall (mobile
  // web only — see gateWebSkip) rather than farming the free-question
  // allowance a batch at a time without answering anything.
  if (typeof gateWebSkip === 'function') gateWebSkip(nextPageLink, true);

  let currentIndex = 0;
  let score = 0;

  // Resume an in-progress episode (reuse the exact saved question set/order).
  let _resume = (typeof _loadMidQuiz === 'function') ? _loadMidQuiz("episode", theme.slug, safeEpisode) : null;
  const renderQuestions = _resume ? _resume.questions : episodeQuestions.map(q => shuffleQuestionOptions(q));
  if (_resume) { score = _resume.score || 0; currentIndex = _resume.currentIndex; }

  // Per-question correct/wrong, indexed by question, for the shareable result grid
  // (🟩/🟥). Restored on resume so a mid-episode continue still builds a full grid.
  const qResults = (_resume && Array.isArray(_resume.qResults))
    ? _resume.qResults.slice()
    : new Array(renderQuestions.length).fill(null);

  function renderResult() {
    if (typeof _clearMidQuiz === 'function') _clearMidQuiz("episode", theme.slug, safeEpisode);
    if (typeof webAddEp === 'function') webAddEp();
    gameBox.style.display = "none";
    resultBox.style.display = "block";
    resultBox.classList.remove("result-anim");
    void resultBox.offsetWidth;
    resultBox.classList.add("result-anim");

    // Related quizzes: first card is THIS theme's regular (Marathon) trivia, styled
    // like the mashup card so it stands apart as "not an episode". The rest are
    // Episode Mode for other themes in the same category that also have episodes.
    const relatedEpisodes = (typeof shuffleArray === "function"
      ? shuffleArray(themes.filter(t => t.slug !== theme.slug && t.category === theme.category && episodeThemes[t.slug]))
      : themes.filter(t => t.slug !== theme.slug && t.category === theme.category && episodeThemes[t.slug])
    ).slice(0, 4);

    // App-only (and unlocked-web): free web visitors shouldn't discover regular /
    // challenge trivia from the Episode result screen. Mirrors the Episode-card
    // hides in app.js and challenge.js so cross-mode promo is blocked BOTH ways.
    const showRegularCard = (typeof isLimitedWeb !== 'function') || !isLimitedWeb();
    const regularCardHtml = showRegularCard ? `
          <a class="card card-mix" href="challenge.html?theme=${theme.slug}&round=1">
            <h3>${theme.title}</h3>
            <span class="card-mix-sub">Regular trivia</span>
          </a>` : "";

    const relatedHtml = `
      <div class="theme-related-quizzes" data-reward-gate="1">
        <h3>Related Trivia</h3>
        <div class="grid">
          ${regularCardHtml}
          ${relatedEpisodes.map(t => `
            <a class="card" href="episode.html?theme=${t.slug}&episode=1">
              <h3>${t.title}</h3>
            </a>
          `).join("")}
        </div>
      </div>
    `;

    // When they've finished the newest available episode, offer to be emailed
    // when the next one drops — sent to the same Formspree form as contact.html,
    // tagged type "episode-notify" + theme slug. Remembers a signup per show on this device
    // so the card shows "you're on the list" instead of the form next time.
    const _notifyDone = (() => { try { return localStorage.getItem(`tg_ep_notify_${theme.slug}`) === "1"; } catch (e) { return false; } })();
    const notifyHtml = !hasNextEpisode ? `
      <div class="notify-card" id="epNotifyCard">
        <div class="notify-card-heading">🎬 You're caught up on <strong>${theme.title}</strong> episodes</div>
        ${_notifyDone
          ? `<div class="notify-card-done">✅ You're on the list — we'll email you when the next episode drops.</div>`
          : `<p class="notify-card-sub">Want to know when the next episode drops? Leave your email and we'll let you know.</p>
        <form class="notify-card-form" id="epNotifyForm" novalidate>
          <input class="notify-card-input" id="epNotifyEmail" type="email" inputmode="email" autocomplete="email" placeholder="you@email.com" required />
          <button class="notify-card-btn" id="epNotifyBtn" type="submit">Notify me</button>
        </form>
        <div class="notify-card-status" id="epNotifyStatus" aria-live="polite"></div>`}
      </div>` : "";

    const affiliateHtml = affiliateProducts && affiliateProducts.length ? `
      <div class="affiliate-box">
        <p class="affiliate-label">Recommended for Fans</p>
        ${affiliateProducts.map(item => `
          <a class="affiliate-card" href="${item.url}" target="_blank" rel="noopener noreferrer sponsored">
            <strong>${item.title}</strong>
          </a>
        `).join("")}
        <p class="affiliate-disclaimer">
          Affiliate link — I may earn a commission from qualifying purchases.
        </p>
      </div>
    ` : "";

    // ── Shareable challenge card (v1: text + emoji grid, no spoilers) ──────────
    // Episode Mode is the hardest mode, so a good run is worth flexing. Card is a
    // Wordle-style copy/share: theme, episode, score, 🟩/🟥 grid, and a link back
    // that drops the recipient into their free episode (the discovery funnel).
    // Every score gets a short adjective badge (not just a perfect run).
    const _pct = episodeQuestions.length ? (score / episodeQuestions.length) * 100 : 0;
    // Gold pill + card glow for the top tier (95%+), not just a flawless run.
    const _perfect = _pct >= 95;
    // Same wording/thresholds as Marathon's getMarathonTier() so a player sees
    // one consistent set of tiers across modes.
    const _badgeText = _pct >= 95 ? "🏆 SUPERFAN"
                     : _pct >= 60 ? "🎬 TRUE FAN"
                     : _pct >= 40 ? "📺 CASUAL VIEWER"
                     :              "👀 REWATCH TIME";
    // includeLink: Reddit share omits it (the link is already in the post they're
    // commenting on); "Challenge a friend" includes it so a friend can play.
    function _episodeShareText(includeLink) {
      const total = episodeQuestions.length;
      const cells = qResults.map(r => r === true ? "🟩" : r === false ? "🟥" : "⬜");
      const rows = [];
      for (let i = 0; i < cells.length; i += 5) rows.push(cells.slice(i, i + 5).join(""));
      const epLabel = foundAnyEpisodeMarkers ? `Episode ${safeEpisode}` : "Episode Mode";
      // Reddit share (no link) drops the theme name too — the post is already about
      // this theme. Friend share keeps the theme name (they need the context) + link.
      const header = includeLink ? `🎬 ${theme.title} — ${epLabel}` : `🎬 ${epLabel}`;
      let out = `${header}\nScore: ${score}/${total} ${_badgeText}\n\n${rows.join("\n")}`;
      if (includeLink) out += `\n\ntriviagauntlet.app/episode.html?theme=${theme.slug}&episode=${safeEpisode}`;
      return out;
    }
    function _legacyCopy(text) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
        document.body.appendChild(ta); ta.focus(); ta.select();
        const ok = document.execCommand("copy"); ta.remove(); return ok;
      } catch (e) { return false; }
    }
    function _copyText(text) {
      // navigator.clipboard only works in a secure context; fall back to execCommand.
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text).then(() => true).catch(() => _legacyCopy(text));
      }
      return Promise.resolve(_legacyCopy(text));
    }
    // Dead simple: copy the card text to the clipboard. Nothing opens. They paste
    // it into their Reddit post/comment, or send it to a friend.
    function _episodeShare(includeLink) {
      const text = _episodeShareText(includeLink);
      const fb = document.getElementById("episodeShareFeedback");
      const doFeedback = (msg) => { if (fb) { fb.textContent = msg; setTimeout(() => { if (fb) fb.textContent = ""; }, 3000); } };
      _copyText(text).then(ok => doFeedback(ok ? "Copied — now paste it!" : "Press Ctrl/Cmd+C to copy"));
    }
    // Classic vertical grid: 5 per row, full-size emoji (user prefers the look).
    // It's tall, so the install wall is rendered ABOVE this card (see the resultBox
    // order below) to keep the wall high. Copied text keeps its own 5-per-row grid.
    const _gridCells = qResults.map(r => r === true ? "🟩" : r === false ? "🟥" : "⬜");
    const _gridRows = [];
    for (let i = 0; i < _gridCells.length; i += 5) _gridRows.push(_gridCells.slice(i, i + 5).join(""));
    const _gridHtml = `<div class="episode-share-grid">${_gridRows.map(r => `<div>${r}</div>`).join("")}</div>`;
    const _epLabel = foundAnyEpisodeMarkers ? `Episode ${safeEpisode}` : "Episode Mode";
    const shareHtml = `
      <div class="episode-share-card${_perfect ? " is-flawless" : ""}">
        <p class="episode-share-title">🎬 ${theme.title} — ${_epLabel}</p>
        <p class="episode-share-score">${score}<span class="episode-share-total">/${episodeQuestions.length}</span> <span class="flawless-badge${_perfect ? "" : " tier-plain"}">${_badgeText}</span></p>
        ${_gridHtml}
        <div class="episode-share-row">
          <button id="episodeShareRedditBtn" class="primary-btn">📢 Share to Reddit</button>
          <button id="episodeShareFriendBtn" class="secondary-btn">🔗 Challenge a friend</button>
        </div>
        <span id="episodeShareFeedback" class="share-feedback" aria-live="polite"></span>
      </div>`;

    resultBox.innerHTML = `
      ${webQCounterHTML()}
      <div class="cta-row">
        ${hasNextEpisode && !isWebEpLimit() ? `<a class="primary-btn" href="episode.html?theme=${theme.slug}&episode=${nextEpisodeNumber}" data-rewarded-href="episode.html?theme=${theme.slug}&episode=${nextEpisodeNumber}">Next Episode</a>` : ""}
        ${hasNextEpisode && isWebEpLimit() ? webWallHTML("Yay! You've played an episode", theme.title, "episodes", null, false, `Download Trivia Gauntlet free to play Episode ${nextEpisodeNumber} of ${theme.title}.`) : ""}
        ${!hasNextEpisode && isWebEpLimit() ? webWallHTML("Want more Episode Mode trivia?", null, "episodes", null, true, "Download Trivia Gauntlet.") : ""}
      </div>
      ${shareHtml}
      ${notifyHtml}
      ${affiliateHtml}
      ${relatedHtml}
    `;
    _wireEpisodeNotify(theme.slug, safeEpisode);
    const _redditBtn = document.getElementById("episodeShareRedditBtn");
    if (_redditBtn) _redditBtn.addEventListener("click", () => _episodeShare(false)); // no link
    const _friendBtn = document.getElementById("episodeShareFriendBtn");
    if (_friendBtn) _friendBtn.addEventListener("click", () => _episodeShare(true));  // with link
  }

  function showQuestion(index) {
    const prev = slidesContainer.querySelector(".question-slide.active");
    if (prev) {
      prev.classList.remove("active");
      prev.classList.add("answered");
      if (ONE_PER_PAGE_EPISODE) prev.style.display = "none";
    }
    const slide = slidesContainer.querySelector(`.question-slide[data-index="${index}"]`);
    if (slide) {
      slide.classList.add("active");
      if (ONE_PER_PAGE_EPISODE) slide.style.display = "block";
      slide.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    scoreEl.textContent = `Score: ${score}`;
    if (window.TGPromo) TGPromo.render(slidesContainer, theme && theme.slug);
  }

  // Pre-render all question slides
  renderQuestions.forEach((q, index) => {
    const slide = document.createElement("div");
    slide.className = "question-slide";
    slide.dataset.index = index;

    const qNum = document.createElement("p");
    qNum.className = "slide-question-num";
    qNum.textContent = `Question ${index + 1} of ${episodeQuestions.length}`;

    const contextP = document.createElement("div");
    contextP.className = "episode-context";
    contextP.textContent = cleanText(q.context);

    const qText = document.createElement("h2");
    qText.textContent = q.question || "";

    const optsList = document.createElement("div");
    optsList.className = "options";

    let answered = false;
    let selectedAnswer = null;

    q.options.forEach(option => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = option;
      btn.addEventListener("click", () => {
        if (answered || currentIndex !== index) return;
        selectedAnswer = option;
        optsList.querySelectorAll(".option-btn").forEach(b => {
          b.classList.remove("selected", "correct-anim", "wrong-anim");
        });
        btn.classList.add("selected");
      });
      optsList.appendChild(btn);
    });

    const feedbackP = document.createElement("p");
    feedbackP.className = "feedback";

    const descDiv = document.createElement("div");
    descDiv.className = "episode-description";

    const submitBtn = document.createElement("button");
    submitBtn.className = "primary-btn";
    submitBtn.textContent = "Submit";

    const nextBtn = document.createElement("button");
    nextBtn.className = "secondary-btn";
    nextBtn.textContent = "Next";
    nextBtn.style.display = "none";

    const ctaRow = document.createElement("div");
    ctaRow.className = "cta-row";
    ctaRow.appendChild(submitBtn);
    ctaRow.appendChild(nextBtn);

    submitBtn.addEventListener("click", () => {
      if (answered || !selectedAnswer || currentIndex !== index) return;

      answered = true;
      qResults[index] = selectedAnswer === q.answer;

      optsList.querySelectorAll(".option-btn").forEach(b => {
        b.disabled = true;
        b.classList.remove("selected");
        if (b.textContent === q.answer) b.classList.add("correct-anim");
      });

      if (selectedAnswer === q.answer) {
        score += 1;
        if (typeof SoundFX !== 'undefined') SoundFX.play('correct');
        feedbackP.textContent = "Correct";
        feedbackP.className = "feedback correct";
      } else {
        if (typeof SoundFX !== 'undefined') SoundFX.play('wrong');
        feedbackP.textContent = "Wrong";
        feedbackP.className = "feedback wrong";
        optsList.querySelectorAll(".option-btn").forEach(b => {
          if (b.textContent === selectedAnswer) b.classList.add("wrong-anim");
        });
      }

      descDiv.innerHTML = `
        <div class="episode-description-box">
          <p class="episode-description-label">Explanation</p>
          <p>${cleanText(q.description)}</p>
        </div>
      `;

      scoreEl.textContent = `Score: ${score}`;
      submitBtn.style.display = "none";
      nextBtn.style.display = "inline-block";
    });

    nextBtn.addEventListener("click", () => {
      currentIndex += 1;
      if (currentIndex >= episodeQuestions.length) {
        renderResult();
      } else {
        if (typeof _saveMidQuiz === 'function') _saveMidQuiz("episode", theme.slug, safeEpisode, { questions: renderQuestions, currentIndex, score, qResults });
        showQuestion(currentIndex);
      }
    });

    slide.appendChild(qNum);
    slide.appendChild(contextP);
    slide.appendChild(qText);
    slide.appendChild(optsList);
    slide.appendChild(feedbackP);
    slide.appendChild(descDiv);
    slide.appendChild(ctaRow);
    slidesContainer.appendChild(slide);
  });

  if (ONE_PER_PAGE_EPISODE) {
    slidesContainer.querySelectorAll(".question-slide").forEach(s => {
      s.style.display = "none";
    });
  }

  showQuestion(currentIndex);
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "episode") {
    renderEpisodePage();
  }
});

/* ---------------- NEXT-EPISODE EMAIL SIGNUP ---------------- */
const EP_NOTIFY_URL = 'https://formspree.io/f/mpqybwea'; // same form as contact.html

function _wireEpisodeNotify(themeSlug, episodeNum) {
  const form = document.getElementById("epNotifyForm");
  if (!form) return;
  const input = document.getElementById("epNotifyEmail");
  const btn = document.getElementById("epNotifyBtn");
  const status = document.getElementById("epNotifyStatus");
  const done = () => {
    try { localStorage.setItem(`tg_ep_notify_${themeSlug}`, "1"); } catch (e) {}
    const card = document.getElementById("epNotifyCard");
    form.remove(); status.remove();
    const sub = card && card.querySelector(".notify-card-sub");
    if (sub) sub.outerHTML = `<div class="notify-card-done">✅ You're on the list — we'll email you when the next episode drops.</div>`;
  };
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = (input.value || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      status.textContent = "Please enter a valid email.";
      input.focus();
      return;
    }
    btn.disabled = true;
    btn.textContent = "Saving…";
    status.textContent = "";
    const platform = (window.Capacitor && window.Capacitor.getPlatform)
      ? window.Capacitor.getPlatform() : "web";
    try {
      const res = await fetch(EP_NOTIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          type: "episode-notify",
          email,
          theme: themeSlug,
          last_episode: episodeNum,
          platform,
          _subject: `Episode notify: ${themeSlug}`,
        }),
      });
      if (!res.ok) throw new Error(res.status);
      if (typeof gtag === "function") gtag("event", "episode_notify_signup", { theme: themeSlug });
      done();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Notify me";
      status.textContent = "Couldn't save that — please try again.";
    }
  });
}
