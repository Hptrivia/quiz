---
name: project-online-multiplayer-versus-catblitz
description: "Real-time online multiplayer built for Versus (trivia) and Category Blitz Versus — architecture decisions, what's done, what's still open"
metadata: 
  node_type: memory
  type: project
  originSessionId: 948a4ec8-57ff-493d-9887-eae668382d4a
  modified: 2026-08-29T07:05:25.404Z
---

Built 2026-08-28: "Play Online with a Friend" mode added to both `versus.html` (trivia) and `category-blitz-versus.html`, alongside the existing local pass-and-play. Both fully implemented and smoke-tested (two-browser-context drivers added to `scripts/smoke-test.js`, both passing), but **not yet confirmed working by the user in real live testing** — several rounds of live bugs were already found and fixed (SQL not applied yet, banner placement, wall exemptions) so treat as "should work" not "confirmed solid."

**Why these specific choices (in case they get questioned or re-litigated later):**
- Polling (1.5s), not Supabase Realtime — matches the codebase's existing plain-REST style (same pattern as `leaderboard.js`), no new library, no websocket connection-state to manage. User explicitly chose this after I framed it as a tradeoff.
- Client-trusted answers, no Edge Function — same trust level the rest of the app already has (leaderboard scores are self-reported too). Explicitly decided this isn't worth building server authority for a casual friends-vs-friends feature.
- Trivia Versus Online: both players get the *same* question (departure from hot-seat's turn-based own-question-each), flat 1 point per correct answer (no difficulty weighting, no speed bonus — user explicitly simplified away from an initial speed-bonus idea), Best of 3/5/10, steal mechanic dropped entirely (doesn't map onto simultaneous play).
- Category Blitz Versus Online: both players get the *same spun letter* each round (departure from hot-seat, which gives each player their own letter) — this was a deliberate, explicit ask, not something hot-seat already does. No shared round timer needed — each side's own `cbRenderRound` timer runs independently since nobody can see the other's answer until both submit anyway.
- Contest/self-correct: **opponent reviews you, not yourself.** After going back and forth (user first rejected self-contest as "crazy" with no check on it, then reconsidered a live-visible self-toggle), the final design is: on the shared reveal screen, each player can only mark the OTHER's unrecognized words correct/incorrect (same UI hot-seat already has, `cbRenderResult`'s existing toggle), never their own. This wasn't optional polish — it's the *only* way custom (non-wordlist) categories can ever score points online, since the wordlist can never mark a custom category "correct" on its own.
- No freeform chat — fixed set of 6 emoji reactions instead, explicitly to avoid moderation/abuse surface for near-zero fun-factor loss.
- Web monetization: Trivia Versus Online automatically inherits the existing 30-questions/day web cap (page-load gate is path-based, no extra code needed). Category Blitz Versus Online needed the existing "1 free round ever, shared with Solo" wall added explicitly — I initially built an exemption for someone joining via a friend's invite link (to protect the growth/viral angle) but the user explicitly rejected that: **no exemption, same wall applies whether creating or joining.**
- No mid-match ads online — the existing hot-seat "watch a rewarded ad or the match ends early" mechanic doesn't translate to a live 2-player match (would strand the other player). Page-load interstitial/wall still applies automatically since it's the same URL.
- Shared tables across game modes: `multiplayer_rooms` / `multiplayer_answers` (+ `multiplayer_reactions`) have a `game_mode` column so a future mode (e.g. NAPT, see [[project_napt_game_mode]]) can reuse the same room/join/poll plumbing without new tables. Category Blitz's room row repurposes `question_ids` to hold the letter sequence instead of question ids, and `payload`/`score` columns instead of `theme_slugs`/`choice`.
- SQL is split across 3 files on purpose: `multiplayer-rooms.sql` (trivia base), `multiplayer-category-blitz.sql` (extends schema + reactions table), `multiplayer-cleanup-cron.sql` (pg_cron auto-delete, kept separate so a missing/failing pg_cron extension can't block the actual game schema). Retention: 14 days for finished/abandoned rooms, 30 min for never-joined "waiting" rooms — user picked 14 over my initial 30-day default.

**Known gaps, not built:**
- No deep linking (Universal Links/App Links) — the "Copy Invite Link" share link *always* opens in the regular browser, never the native app, even if the recipient has it installed. Confirmed via absence of `.well-known/apple-app-site-association` / `assetlinks.json` anywhere in the repo. Flagged as a real future project if the user wants links to open in-app.
- No automatic match-abandonment timeout — a disconnected opponent only shows a warning banner (15s of silence) with a manual "Leave Match" button; the room itself never auto-closes on its own. User was asked whether to add an auto-timeout (e.g. 60-90s) and hadn't answered as of this save — worth following up.
- Category Blitz reveal-screen re-grading of the opponent's words (for the ✓/✗ icons) is a fresh local wordlist check, independent of whatever review toggle either side applies — this is fine since it's the review toggle (not the icon redraw) that's authoritative for scoring.

**Files touched:** `supabase/multiplayer-rooms.sql`, `supabase/multiplayer-category-blitz.sql`, `supabase/multiplayer-cleanup-cron.sql`, `assets/versus-multiplayer.js` (new), `assets/catblitz-versus-multiplayer.js` (new), `versus.html`, `category-blitz-versus.html`, `assets/versus.js` (refactored to extract `vsResolveThemeContext`/`vsBuildQuestionPools` as shared helpers used by both hot-seat and online), `assets/announcements.js` (new banner entry), `scripts/smoke-test.js` (two new multi-context test drivers: `versus-online`, `catblitz-versus-online`).

**2026-08-29 — Continue-gate bug fixed, confirmed real.** User reported (correctly)
that Category Blitz Versus's "Continue" button advanced the clicking player to the
next letter immediately, with zero check on whether the opponent had finished
reviewing/contesting words — the file's own header comment admitted it: "'Continue'
locks in whatever the scores are at that moment." Trivia Versus never had this bug:
it has no post-answer review/contest step (multiple-choice correctness is
unambiguous, so "both answered" and "safe to auto-advance" are the same moment),
whereas Category Blitz's free-text answers need a human review step that Trivia
Versus simply doesn't have, and the old code conflated "submitted" with "done
reviewing."

Fix: added `multiplayer_answers.ready` boolean column (migration appended to
`supabase/multiplayer-category-blitz.sql` — **NOT YET RUN by the user as of this
save**; confirmed via a live REST call that the column doesn't exist in production
yet, which is why `catblitz-versus-online` now fails the smoke test with "never
reached end screen" until the migration runs). New `mpClickContinue()` sets your own
row's `ready=true` instead of advancing directly; `mpAdvanceRound()` only fires once
both rows show `ready=true` (checked each poll tick in `mpSyncReveal`, or immediately
if the opponent was already ready when you click). Added an `mpRoom.advancing` guard
against the same client calling `mpAdvanceRound` twice for one round.

**ACTION NEEDED next session:** confirm the user has run
`alter table multiplayer_answers add column if not exists ready boolean not null default false;`
in Supabase, then re-run `node scripts/smoke-test.js catblitz-versus-online` to
confirm it's green (it currently fails against the un-migrated database).

**Open bug, unresolved:** Trivia Versus (not Category Blitz) — user reported the
right/wrong feedback text at the bottom of the reveal stops appearing from Q3 onward
in at least one live match, while score still updates correctly. Reviewed
`mpMaybeResolveRound`/`mpRenderReveal`/`mpRenderRound` in `assets/versus-multiplayer.js`
closely — round-reset logic (`answeredThisRound`/`roundResolved` reset each round)
looked structurally sound, found no round-3-specific branch anywhere. Asked the user
for repro details (every match vs. one-off, single- vs. multi-theme, console errors)
— not yet answered. Best hypothesis if it recurs: a duplicate-question-text collision
in the `q.id || q.question` lookup key used by both host's draw and guest's
`questionMap` — worth checking first if the affected theme has near-duplicate
question wording.

**Discussed and explicitly deferred (not building):** a mutual-agreement dispute
feature for Category Blitz Versus scoring — letting either player dispute ANY word,
including their own, requiring the other player's explicit Accept before it takes
effect (vs. today's one-way opponent-only toggle with no confirmation, described
above under "Contest/self-correct"). Sized as comparable in complexity to this whole
online-multiplayer build, not a quick add-on: new schema tracking per-word proposal
state (not just a score number), doubled interactive UI states on BOTH reveal
columns (today only the opponent's column is interactive), and an extra "no pending
proposals" condition on top of the Continue-gate above. User's call: the existing
one-way review already covers the common case (opponent visibly reviews your
unrecognized words right there on the reveal screen); the gap — opponent doesn't
bother reviewing — is a rare edge case not worth the complexity right now. Revisit
only if this actually comes up in live play.

**Also fixed same session:** both Versus Online lobbies (`versus.html`,
`category-blitz-versus.html`) were showing `resultAppBannerHTML()`'s "Download the
free app to save your progress..." banner instead of the homepage's "Get 100+
questions for all themes" banner — user wanted them to match. Extracted a new shared
`lobbyAppBannerHTML()` in `assets/profile.js` (same copy/href logic as the
homepage's `_injectWebBanner()`, just returned as an HTML string so it can be
inserted into `#vsMpAppBanner`/`#cbMpAppBanner`) and pointed both files at it instead
of `resultAppBannerHTML()`.

See also [[feedback_tools_branch_sync]] (not applicable here — these are main-site files, not the tools branch), [[project_napt_game_mode]] (Category Blitz's room/join plumbing was deliberately generalized so NAPT could reuse it later), [[project-random-trivia-mode]] (unrelated feature, same session).
