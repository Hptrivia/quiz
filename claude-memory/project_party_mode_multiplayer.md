---
name: project-party-mode-multiplayer
description: "N-player Party Mode — party.html, assets/party-multiplayer.js, supabase/multiplayer-party.sql + multiplayer-chat.sql (all applied live). Now includes host-scheduled start/countdown, mid-match rejoin, host-kick, and free-text chat (shared with Category Blitz Versus). Uncommitted."
metadata: 
  node_type: memory
  type: project
  originSessionId: 8020d7df-8592-4510-8461-9130627ae63f
  modified: 2026-09-03T20:57:25.132Z
---

**Build status (2026-09-03, later session same day): implemented, not committed.**
Files: `supabase/multiplayer-party.sql` (new `multiplayer_players` table — room_code,
player_id, name, is_host, eliminated, joined_at, last_seen — applied live by user),
`assets/party-multiplayer.js` (new, `pty`-prefixed, self-contained REST helpers, own
`PTY_ROUND_SECONDS=15`/`PTY_POLL_MS=1500`/`PTY_DISCONNECT_MS=15000`), `party.html`
(new page), plus a 2-line addition to `versus.html`. `versus-multiplayer.js`/
`versus.html`'s own 2p flow untouched throughout.

**Entry-point placement — got corrected once, worth remembering:** first pass (built
via a delegated fork) added Party as a new homepage/theme-page card next to the
Versus card — user rejected this hard ("i didnt fucking say it would be a new card
in the theme page"). Correct placement: a small link inside `versus.html`'s existing
"Play Online with a Friend" section (`#vsOnlineFields`, right under the name field —
"More than 2 players? Start a Party →"), only visible when Online mode is selected,
forwarding `location.search` so the theme carries over (party.html has no theme
picker of its own, same convention as versus.html — theme must arrive via URL param).
**Lesson: when delegating a UI-integration task to a subagent, either specify exact
placement or flag it as an open question — don't let the agent invent where a new
entry point goes.**

**Testing:** extended `scripts/smoke-test.js` (Puppeteer) with a generic N-context
runner (`runMultiplayerModeN`/`mode.runN`/`mode.players`) and a `playPartyMode`
driver — `node scripts/smoke-test.js party-score-10p party-survival-10p` spins up 10
real headless-Chrome tabs (1 host + 9 guests) against the live Supabase project, each
player clicking a different option index per round so scores actually diverge
(uniform clicking would make every test a boring tie). Both passed, including a
genuine Survival tie (last two players both missed the final simultaneous question).

**Bugs the test surfaced in the real app (both fixed same session):**
- Guest joining with a blank name defaulted to the literal string `"Player"` for
  everyone (no number) — fixed to query current roster size and default to
  `Player ${n+1}` (2p Versus already did the equivalent right, party.html's join
  handler didn't).
- Arriving via the invite link (`?ptyJoin=CODE`) showed the full create-a-room form
  (game type, question count, Create/Join toggle) underneath the pre-filled join
  fields — confusing/redundant. Fixed: joining via link now hides those
  host-only controls entirely and collapses to "Join the Party — enter your name"
  with the code shown read-only.

**UI iteration, same session:** the live per-question screen originally re-rendered
the FULL vertical N-player scoreboard at the top of every question (reusing the
Results screen's list component) — user called this "stupid UI," dominates the
screen especially at 10 players. Replaced with a one-line compact status
(`ptyRenderLiveStatus`: "You: 3 pts · Guest3 leads with 4" / "6 players still in") that
expands into a full ranking via a tap-to-open **absolutely-positioned overlay**
(`.pty-live-score-panel`, closes on outside click) — explicitly not a block that
pushes the question down, and not a full-screen-covering modal either; user's own
phrasing was "doesn't cover or extend the screen." `ptyRenderScoreboardInto(elId)` is
the shared full-list renderer, used by both the Results screen and this overlay.

See [[feedback_no_test_during_iteration]] (user told me to stop re-running the
10-player smoke test after every small UI tweak mid-session — only test at real
checkpoints).

Idea floated 2026-09-03: extend the existing online multiplayer (see [[project_online_multiplayer_versus_catblitz]]) beyond strict 2-player Versus into a "party mode" — one host creates a room, shares a link, up to N people join, everyone answers ~10 shared questions, highest score wins. Primary motivation: a Reddit post inviting strangers to join a live head-to-head is a much stronger growth/engagement hook than the current "post your solo score" pattern. Also floated: a survival/elimination mode (wrong answer = you're out, last one standing wins) as an alt game mode once party lobby exists. Host would get light moderation controls (kick a player).

**Status: brainstorm/planning only. No code touched. Session was explicitly "iron out details, build later."**

**Feasibility take (given as recommendation, not yet re-verified against latest code):**
- NOT a DB strain. The existing architecture polls every 1.5s per player against Supabase REST/PostgREST (no websockets/Realtime, no Edge Function — fully client-trusted, anon key has RLS `for all using (true)`) — cost scales with concurrent *rooms*, not players-per-room. Even a successful Reddit post (dozens–low hundreds of concurrent players across many rooms) is trivial REST volume for Supabase's free/low tier.
- The real cost is refactoring, not scale — and it's DB schema, not just UI. Verified (2026-09-03, via code read of `versus-multiplayer.js`, `catblitz-versus-multiplayer.js`, `supabase/multiplayer-rooms.sql`): the 2-player limit is structural, not a counter — `multiplayer_rooms` has literal singular `host_id`/`host_score`/`host_last_seen`/`guest_id`/`guest_score`/`guest_last_seen` columns (join = atomic PATCH `guest_id=is.null`, race-safe via PostgREST returning 0 rows if already taken). Going to N players needs a genuinely new `multiplayer_players` table (room_code, player_id, name, score, last_seen, is_host) — `multiplayer_answers` already is one-row-per-player-per-round with a `score` column, so *that* table generalizes to N players for free; it's specifically the room-level host/guest columns that don't. Plus: open lobby UI (join-via-link, live player list, host-clicks-Start) and scoreboard-style reveal UI instead of 2 columns. `game_mode` discriminator column already exists on `multiplayer_rooms` (shared by 'versus' and 'category-blitz' today) so a party mode can reuse the same room-shell pattern.
- Survival mode is comparatively cheap *after* N-player lobby exists — it reuses the "everyone gets the same question simultaneously" sync Trivia Versus Online already has; it's just a different win-condition (elimination vs total score), not new sync infra. Recommended as phase 2, not bundled into the initial party-lobby build.

**Scope, confirmed by user 2026-09-03 (final, after several rounds of correction — this is the version to build from):**
- Player count: NO fixed cap. As many people as want to join a party room; host starts whenever ready (min 2). Only a generous invisible backend safety ceiling (~50) against abuse, never surfaced as a UX limit.
- UI: 2-player Versus keeps its existing side-by-side "both scores live" header UNCHANGED — do not touch it. Party mode gets its OWN separate compact scoreboard component (vertical, scrollable, sorted high-to-low) — it does not reuse or extend the 2p header, because that header doesn't scale past 2 scores without crowding. Two different components by design, not one generalized one.
- Host controls = only a "Start" button, enabled once ≥2 have joined. No kick/moderation feature.
- Question timer: party mode = 15s/question. Existing 2-player Versus separately drops 30s→20s. Both plain constant changes, not yet done.
- Self-reported/client-trusted scoring: explicitly NOT a concern worth solving. Score is computed and displayed automatically by the game immediately after each round — no manual entry step, no realistic window to tamper mid-round (15-20s). Leave as-is, same trust model as the rest of the app. This was raised and closed in-session, don't re-raise it as an open risk later.
- Minor non-blocking flag: party's 15s question window sits close to the existing 15s disconnect-forfeit threshold (`MP_DISCONNECT_MS`) — a brief connection hiccup near the end of a question could read as "forfeited" instead of "ran out of time." Sanity-check once built, doesn't change the plan.
- Disconnect handling: NOT a new risk. Round-advance is already per-player (not host-authoritative) with an existing 15s stale-presence auto-forfeit (`MP_DISCONNECT_MS`) — generalizes to N players without new design work.

**Waiting-lobby UX, added 2026-09-03:** while waiting for the host to start, show a live join feed ("Alex joined!"), a running player count, and a rotating promo/tips line (other themes/modes) — all cheap since the lobby is already polling the players table, just render the diff each tick. Could reuse the existing `multiplayer_reactions` emoji system for waiting-room reactions too. No new backend needed for any of this.

Confirmed 2026-09-03: `.vs-scoreboard` (2p) is `display:flex; flex-wrap:wrap` — genuinely a horizontal row of 2 chips, not a vertical list (verified via CSS in `versus.html`, not just inferred) — so the plan to give party mode its own separate vertical scoreboard component stands as correct.

**Still open / not yet decided:**
- Anonymous/no-login join UX for strangers arriving via a Reddit link needs to stay frictionless (existing 2p flow's exact login requirement not reconfirmed this session).

**Note on this session's process (for calibration, not for the user):** took three rounds of correction to land on accurate scope — repeatedly raised concerns (UI crowding, host-disconnect risk, cheating risk) at a plausible-sounding but wrong confidence level, then over-corrected the opposite way when pushed, before finally getting each one right by actually re-reading what was asked and re-checking the code. Next time on this project: default to what's stated above as settled, don't re-litigate it, don't re-raise the closed self-reporting question.

See also [[project_online_multiplayer_versus_catblitz]] for the underlying 2-player architecture this would extend, [[project_napt_game_mode]] (another mode that was already designed to reuse the same room/join/poll plumbing).

**2026-09-03, later session same day — scheduled start + chat + host-kick, implemented, SQL applied, smoke tests passing (24/24 incl. both party tests):**
- `supabase/multiplayer-chat.sql` (new, applied live by user): renamed `multiplayer_reactions.emoji` → `message` (table now generic free-text chat, not fixed emoji/phrases), added `multiplayer_rooms.scheduled_start_at` (nullable timestamptz), added `multiplayer_players.banned` (boolean default false).
- **Host-scheduled start**: lobby-only UI (`#ptyScheduleGroup`, host-only) — Now/+1h/+2h/+3h buttons, plus once set: +30m/+1h/Clear and a live countdown shown to EVERYONE in the lobby. No server/cron exists in this app's architecture (client-polls-Supabase only) — auto-start works by having *whichever* lobby tab (host's or any guest's) notices the countdown hit zero attempt the same conditional `status=eq.waiting` PATCH the manual Start button already used (`ptyTryAutoStart`); first writer wins, so it still fires even if the host's own tab is closed at that moment. This was almost rejected by the user, who initially read "any guest tab can trigger it" as guests getting start control — clarified it's implementation plumbing only (no button, no guest permission), not a design change; user accepted once that was clear.
- **Mid-match/post-match rejoin**: someone who already joined a room's lobby before it started can now come back via the same invite link while the match is active OR after it's finished (`ptyResumeIntoMatch` — rebuilds roster + cumulative scores from `multiplayer_answers`, resumes at the room's current round). A brand-new player_id (never in the roster) still cannot join once status isn't `waiting`. Late joiners who were NEVER in the room (spectate-or-play for people who missed the start entirely) — explicitly NOT built, discussed only: user asked "how difficult," told spectate-only is the easy version, actually playing is a real design decision (Score Attack could let them start at 0; Survival makes no sense for a true late joiner) — left for a future session, nothing implemented.
- **Host-kick**: small ✕ next to each non-self name in the lobby roster (host only) → `ptyKickPlayer` PATCHes that row `banned:true` (not deleted) so the same browser/device can't immediately rejoin under any name; a different browser/device gets a fresh anonymous ID and isn't covered (inherent limit of a code-only, no-login system — told to user explicitly). The kicked person's own tab detects it (their id vanishes from the banned-filtered roster poll) and gets bounced to setup with "You were removed from this room by the host."
- **Free-text chat, shared across Party AND Category Blitz Versus**: `chatSanitize`/`chatCensor`/`chatCanSend` added to `assets/app.js` (shared, not duplicated) — a simple word-substring blocklist (catches plurals/suffixes like "cunts", not just exact matches — first version was exact-match only and missed "cunts", user caught it in testing, fixed to substring match) plus a 2s per-room send cooldown. Wired into: Party lobby chat (`#ptyLobbyChatLog`/Form), Party results-screen chat (`#ptyResultsChatLog`/Form) — one continuous room-lifetime chat log shown on both screens (no chat during the live question rounds themselves, deliberately, screen moves too fast), and Category Blitz Versus's existing between-round reveal-screen chat, which previously was a fixed set of 6 emoji + 5 preset phrase buttons (`MP_REACTIONS`/`MP_MESSAGES`, removed) — user explicitly asked to replace that preset system with the same free-text input everywhere, not just add free text to Party. Shared CSS: `.tg-chat*` classes added to `assets/style.css` (log/bubble/input/form), reused by both features instead of Blitz's old page-local `.cb-mp-chat*` classes (removed).
- **Inline-link visibility bug**: this site's global CSS is `a { color: inherit; text-decoration: none; }` — plain `<a>` tags dropped into body copy are visually invisible as links. Hit this with the new lobby "browse the site while you wait" note and the app-download hint appended to it — added a reusable `.tg-inline-link` class (blue, underlined) in `assets/style.css` rather than one-off inline styles. Worth checking for this again any time new inline-text links get added to copy elsewhere in the app.
- App-download nudge added to the lobby's "nothing to do yet" waiting note (limited-web visitors only, via `isLimitedWeb()`), platform-correct link (App Store / Play Store / web-wall-trigger), same store-link pattern as `lobbyAppBannerHTML` in `profile.js`.
- Chat/UGC app-store compliance was raised proactively (Apple/Google review guidelines on user-generated content expect a profanity filter + a way to remove abusive users) — both now exist (censor + host-kick); recommended NOT restricting chat to web-only given rooms are private/code-invite-only (much lower risk than open stranger chat), user did not push back.
- Status at end of session: all changes written, `node -c` clean, `node scripts/smoke-test.js` 24/24 passing (including `party-score-10p`/`party-survival-10p` after the SQL migration was applied — they failed hard beforehand, "never reached end screen," because the lobby poll queries the new `banned` column on every tick and errors out entirely if it doesn't exist yet). **Nothing committed or pushed.**
