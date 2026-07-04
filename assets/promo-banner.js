// ── Rotating "more themes in the app" house-ad ───────────────────────────────
// A compact, native-styled strip shown UNDER THE SCORE during gameplay, on
// limited web only (browser, non-premium). Each question surfaces a FRESH set of
// real themes — tappable straight to the app store — so browser players see the
// breadth the app has ("180+ more themes… Breaking Bad · The Wire · …") instead
// of a generic "download to save progress" line.
//
// One shared module: each game mode calls TGPromo.render(scoreEl, index, slug)
// from its own "next question is showing" hook — that's the ONLY per-mode code.
//
// Behaviour:
//   • App + premium never see it (isLimitedWeb gate — fail-closed).
//   • Deterministic by question index, so a re-render / resume shows the same set.
//   • Themes are biased to the category currently being played; every 10th
//     question one slot becomes a popular theme from ANOTHER category (discovery).
//   • Clicks are logged by profile.js's delegated data-promo tracker (no extra
//     wiring here) so we can see which promoted themes actually get tapped.
(function () {
  const SHOW = 3;                 // themes listed per question
  const SEEN_KEY = 'tg_promo_seen';// slugs already shown this cycle (no repeats until all shown)
  const CROSS_EVERY = 8;          // weave a cross-category theme in ~every N themes
  // Preferred category walk order (played category is floated to the front at the
  // first exposure via the initial cursor seed). Matches the app's grouping with
  // the user's ask: TV → Sitcoms → General → Sports first, then the rest.
  const CAT_ORDER = ['TV', 'Sitcoms', 'General', 'Sports', 'Games', 'Anime', 'Education', 'Books', 'Countries'];

  let ALL = [];                   // themes.json
  let byCat = {};                 // category -> [themes], in file order
  let loadP = null;
  let ready = false;

  function load() {
    if (loadP) return loadP;
    loadP = fetch('/data/themes.json')
      .then(r => r.json())
      .then(list => {
        ALL = Array.isArray(list) ? list : [];
        byCat = {};
        ALL.forEach(t => { (byCat[t.category] = byCat[t.category] || []).push(t); });
        ready = true;
      })
      .catch(() => {});
    return loadP;
  }

  // Cross-category weave: at every CROSS_EVERY-th slot, swap in a theme from the
  // "discovery" category = the TOP of the order (TV), unless we're already inside
  // that block, in which case the next one (Sitcoms). So while walking any non-TV
  // category the sprinkle is a TV theme; while walking TV it's a Sitcoms theme.
  // A swap is a permutation, so every theme still appears exactly once (no repeats).
  function weave(arr, cats) {
    for (let p = CROSS_EVERY - 1; p < arr.length - 1; p += CROSS_EVERY) {
      const posCat = arr[p].category;
      const disc = cats.find(c => c !== posCat); // top of the order that isn't this block
      if (!disc) continue;
      let q = -1;
      for (let k = p + 1; k < arr.length; k++) {
        if (arr[k].category === disc) { q = k; break; }
      }
      if (q > -1) { const tmp = arr[p]; arr[p] = arr[q]; arr[q] = tmp; }
    }
    return arr;
  }

  // The theme walk order for the CURRENTLY-PLAYED theme: that whole category FIRST,
  // then every OTHER category in the fixed CAT_ORDER from the top — always TV,
  // Sitcoms, General, Sports, … So a Sports game goes Sports → TV → Sitcoms → …;
  // a TV game is just CAT_ORDER as-is. New categories not in CAT_ORDER are appended
  // automatically. Then weaved so every ~8th theme is a TV taste (Sitcoms while in
  // TV) — including within a long played category, so it never feels one-note.
  function orderedFor(currentSlug) {
    const cur = ALL.find(t => t.slug === currentSlug);
    const cat = cur && cur.category;
    const cats = CAT_ORDER.filter(c => byCat[c]);
    Object.keys(byCat).forEach(c => { if (cats.indexOf(c) === -1) cats.push(c); });
    const seq = [];
    if (cat && byCat[cat]) seq.push(cat);
    cats.forEach(c => { if (c !== cat) seq.push(c); });
    const arr = [];
    seq.forEach(c => byCat[c].forEach(t => arr.push(t)));
    return weave(arr, cats);
  }

  function getSeen() { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch (e) { return new Set(); } }
  function setSeen(s) { try { localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(s))); } catch (e) {} }

  // The next SHOW unshown themes, scanning from the current category. Marks them
  // shown (persisted) so later questions/rounds keep advancing with no repeats;
  // once every theme has been shown the cycle resets and starts fresh.
  function nextSet(currentSlug) {
    const order = orderedFor(currentSlug);
    if (!order.length) return [];
    let seen = getSeen();
    // All (bar the played theme) shown → new cycle.
    if (seen.size >= order.length - 1) seen = new Set();
    const set = [];
    for (let k = 0; k < order.length && set.length < SHOW; k++) {
      const t = order[k];
      if (t.slug === currentSlug || seen.has(t.slug)) continue;
      set.push(t);
      seen.add(t.slug);
    }
    setSeen(seen);
    return set;
  }

  function chip(t) {
    // Per-platform target reuses profile.js's globals: mobile web → the visitor's
    // store; desktop → '#' + .web-wall-trigger, which opens the QR/app wall. The
    // data-promo attrs let profile.js's tracker log the tap (with the theme slug).
    const mobile = (typeof isIosWeb === 'function' && isIosWeb()) ||
                   (typeof isAndroidWeb === 'function' && isAndroidWeb());
    const href = (mobile && typeof _storeUrl === 'function' && _storeUrl()) || '#';
    const cls = mobile ? '' : ' web-wall-trigger';
    return `<a class="qtp-chip${cls}" href="${href}" data-promo="quiz_theme_promo" data-promo-theme="${t.slug}">${t.title}</a>`;
  }

  function fill(el, currentSlug) {
    const set = nextSet(currentSlug);
    if (!set.length) { el.style.display = 'none'; return; }
    const count = Math.floor(ALL.length / 10) * 10;
    el.style.display = '';
    el.innerHTML =
      `<span class="qtp-head">📱 ${count}+ more themes in the app &rarr;</span>` +
      `<span class="qtp-chips">${set.map(chip).join('')}</span>`;
  }

  // Append the single promo node as the LAST child of the current question slide,
  // so it sits under the question in every mode regardless of where that mode's
  // score line lives (the old bug: anchoring to the score put it at the top in
  // Episode, where the score is above the slides). Called once per question.
  // No-op for native app / premium.
  function render(slideEl, currentSlug) {
    if (typeof isLimitedWeb !== 'function' || !isLimitedWeb()) return;
    if (!slideEl || !slideEl.appendChild) return;
    let el = document.getElementById('tgQuizPromo');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tgQuizPromo';
      el.className = 'quiz-theme-promo';
    }
    // Move it into (and to the bottom of) whichever slide is now active.
    if (el.parentNode !== slideEl || slideEl.lastChild !== el) slideEl.appendChild(el);
    if (ready) fill(el, currentSlug);
    else load().then(() => { if (document.getElementById('tgQuizPromo') === el) fill(el, currentSlug); });
  }

  window.TGPromo = { render, load };

  // Warm the theme data early so the first question already has it. Guarded so it
  // doesn't fetch inside the native app / for premium users.
  if (typeof isLimitedWeb !== 'function' || isLimitedWeb()) load();
})();
