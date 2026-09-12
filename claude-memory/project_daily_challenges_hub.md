---
name: project-daily-challenges-hub
description: Daily Challenges homepage restructure — single hub button replacing the old 3-card trio; own page daily-challenges.html now holds the individual Daily Trivia/Wordle/Blitz cards
metadata: 
  node_type: memory
  type: project
  originSessionId: 8db1c844-0ed6-422f-8506-5d105276d7d6
  modified: 2026-08-29T07:04:58.359Z
---

Built 2026-08-29: the homepage's old 3-card "Daily Challenges" trio (Daily Trivia /
Daily Wordle / Daily Blitz shown side by side) was replaced with a single button
linking to new `daily-challenges.html`, which now holds that trio with full live
streak-status behavior intact.

`assets/daily.js`, `assets/daily-wordle.js`, `assets/catblitz-daily.js`'s
homepage-card-status init functions (`initDailyHomepageCard` etc.) were extended to
also fire on `document.body.dataset.page === "daily-challenges"` (previously only
`"home"`), so the streak text ("🔥 X day streak" / "Come back tomorrow") still updates
correctly on the new hub page.

**Homepage card-copy rule established this session** (applies site-wide, not just
here): on an individual game-mode/theme page, a title + CTA line + description line
(3 lines total) is fine. On the HOMEPAGE specifically, a featured card should carry
only ONE subtext line under the title, never a separate CTA+description pair — the
user called the old 2-line version "three fucking subtexts" and had me collapse it.
Applied here (Daily Challenges homepage button) and confirmed correct on
[[project-random-trivia-mode]]'s homepage card, which already followed this from the
start.

New CSS: `.daily-hub-card` (teal-adjacent amber/blue gradient) was deliberately kept
SEPARATE from `.daily-challenge-card` — the latter is the exact class
`daily.js`'s `initDailyHomepageCard()` selects via `document.querySelector(".daily-challenge-card")`
to overwrite CTA/sub text with live status. Reusing that class on the new single
homepage button would have let the per-game JS silently clobber its static copy.

Related: [[project-random-trivia-mode]]
