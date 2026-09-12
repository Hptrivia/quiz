---
name: project-random-trivia-mode
description: "Random Trivia — no-picking-required quiz mode combining all 22 Daily Trivia general-knowledge themes; own page/homepage lane, reuses existing multi-theme engines with zero new game code"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8db1c844-0ed6-422f-8506-5d105276d7d6
  modified: 2026-08-29T07:04:47.418Z
---

Built 2026-08-29: `random-trivia.html`, its own page and URL, with its own homepage
lane (teal `.random-trivia-card`, distinct from Daily/amber, Mashup/purple, Category
Blitz/blue, Recently Added/emerald). Explicitly NOT part of Mashup conceptually or in
UI — the user was adamant about this after I described some plumbing fixes in terms
of "mashup," which read as confusing/wrong even though it was accurate about shared
code paths. Keep all future copy/explanations about this feature free of "mashup"
language.

**How it works:** hardcodes the same 22 slugs behind Daily Trivia's `DAILY_THEMES`
(`assets/daily.js`). All 22 turned out to already be real, fully registered themes in
`themes.json` (my first check was wrong — I matched by DAILY_THEMES' short internal
filenames like `musi`/`sport`/`tv` instead of by `questionFile`, see
[[feedback_verify_before_asserting]] repeat #5). More importantly: the actual game
engines (`app.js` Marathon, `challenge.js`, `survival.js`, `wordle.js`,
`wordsearch.js`, `trivia-rush.js`, `versus.js`) only enforce a MINIMUM of 2 themes for
`?themes=` combos — no maximum at all. The "2-5 themes" cap only lives in the Mashup
picker UI and `mashup-landing.html`'s redirect check. So Random Trivia needed zero new
data files, zero `themes.json` changes, zero new game-mode code — just a landing page
linking `?themes=<22 slugs>` into the existing pages.

**Collateral fix:** 4 files had a hardcoded "back" link pointing at
`mashup-landing.html?themes=...` for multi-theme sessions (`wordle.js`,
`wordsearch.js`, `versus.js`, `trivia-rush.js`) — that page redirects away above 5
themes, so those back buttons would dead-end for a 22-theme Random Trivia session.
Patched all 4 to fall back to `index.html` when `slugs.length > 5`.

**Other pieces:** short SEO blurb at the bottom of the page naming the topic mix
(fun facts, geography, music, etc. — kept brief per user ask); an entry added to
`assets/announcements.js`'s homepage "what's new" toast; inherits ALL existing
monetization/limits automatically (interstitials, 30-questions/day web cap,
Wordle/Word Search web limits) since it introduces no new gameplay code — confirmed
explicitly when asked.

**Copy, final wording** (user wanted general/short, not a topic list, and wanted
homepage cards down to ONE subtext line — see [[project-daily-challenges-hub]] for
the broader homepage-card rule this came from): page description — "A single quiz
combining trivia from every general knowledge topic on the site — perfect for when
you just want to jump straight into a game without picking a theme." Homepage
subtext — "All our general trivia topics in one quiz — jump in without picking a
theme."

**Known gap:** no dedicated smoke-test entry added for `random-trivia.html` itself.
The existing `-mashup` smoke-test modes (`marathon-mashup`, `challenge-mashup`, etc.)
only exercise the shared 2-theme engine code path this page's buttons link into —
they never load `random-trivia.html`, so its own JS (fetching 22 files, building
badges/samples, wiring the 7 mode links) is untested. Flagged to the user, not done.

Related: [[project-daily-challenges-hub]], [[feedback_verify_before_asserting]]
