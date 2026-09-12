---
name: project-hard-mode-typed-answers
description: Hard Mode (typed answers) feature for Challenge + Marathon -- design decisions, files touched, current status
metadata:
  node_type: memory
  type: project
  originSessionId: 630eb621-19d0-4f5f-acc0-a6484d4de198
  modified: 2026-08-24T09:43:16.900Z
---

Built 2026-08-24: a "Hard Mode" toggle that swaps multiple-choice for a typed
text input in Challenge and Marathon modes. Rule-based answer matching, no
AI/API calls (explicitly rejected -- would need a per-question backend call,
real cost/latency vs. instant/free).

**Status as of 2026-08-24: implemented, smoke-tested clean, NOT yet committed
to git.** User is manually testing in browser; one live bug already found and
fixed (see below). Typo-tolerance numbers are placeholders that still need
tuning against real play.

## Where the code lives
All the matching logic and shared rendering now live in `assets/app.js`
(constants `HM_KEY`/`HM_ASKED_KEY`/`HM_HINT_KEY`, functions prefixed `hm*`),
even though the feature started in `assets/challenge.js` -- moved when the
user asked to extend it to Marathon, since `play.html` (Marathon) only loads
`app.js`, not `challenge.js`. `challenge.html` loads `app.js` before
`challenge.js`, so nothing broke. Touched: `assets/app.js`, `assets/challenge.js`,
`assets/style.css`, `challenge.html`, `play.html`, `profile.html`,
`scripts/smoke-test.js`.

## Design decisions (in order they were settled, each explicitly confirmed by the user)
- Typed input only offered when the answer is <=3 words (`hmShouldOfferTyped`)
  -- verified against real data: 92.4% of ~4,400 answers in `data/*.txt` are
  <=3 words. Longer/phrase answers always fall back to multiple choice.
- Name/title shortcut (`hmIsNameOrTitleShaped`: 2-4 capitalized words, no
  stray punctuation) deliberately applies to ANY answer shaped that way, not
  just real people's names -- this dataset title-cases many non-name answers
  too ("The Addams Family", "Emergency Medicine"), and there's no reliable
  way to tell "name" from "title" without a names dictionary, which wasn't
  worth the added complexity. User confirmed: broader is fine, it only ever
  makes the game MORE forgiving.
- Single-word shortcut = first content word only (skip leading "the/a/an"),
  e.g. "Jaime" for "Jaime Lannister", "Addams" for "The Addams Family" --
  but NOT "Lannister" or "Family" alone. Blocked if that first word collides
  with another distinct answer's first word in the same theme (checked once
  per theme at load, `hmBuildFirstWordCollisions`; mashup checks per theme in
  `questionsByTheme`, not per combined round).
- First+last shortcut (added 2026-08-24 after a live bug report): typing
  exactly two words checks the first against the answer's first content word
  and the last against its last content word, any middle word(s) dropped --
  e.g. "Tom Riddle" for "Tom Marvolo Riddle". Doesn't need the same collision
  check as the single-word shortcut (two words together are specific enough).
- Typo tolerance: the FIRST CHARACTER of each compared word must match
  exactly (hard rule, no exceptions) -- typos happen mid-word ("Cello" ->
  "Celo"), a wrong first letter usually means a genuinely different real
  word ("Cello" -> "Hello"), and the two are mathematically equidistant so a
  plain edit-distance threshold can't tell them apart. User confirmed this
  tradeoff explicitly, including that a rare real fat-fingered first letter
  (e.g. "Norticia" for "Morticia") should be marked wrong. Distance budget
  after the first-char gate: 0 for <=4 chars, 1 for <=7, 2 for longer
  (`hmTypoThreshold`) -- STARTING NUMBERS ONLY, needs real tuning once played
  against more real questions.
- Normalize (`hmNormalize`): lowercase, trim, collapse whitespace, curly
  quotes/non-breaking hyphens/narrow-no-break-spaces -> plain ASCII, strip
  trailing punctuation. Mid-word apostrophes/hyphens kept (O'Malley,
  best-selling).
- One-time opt-in ask is a PAGE STEP (matching Survival's `#difficultyBox`
  pattern), not an overlay -- user's explicit call: this is a real gameplay
  choice, not a nag like the app-install popups. Fires from whichever of the
  four entry points (Challenge single/mashup, Marathon single/mashup) the
  player hits first; shared `tg_hard_mode`/`tg_hard_mode_asked` localStorage
  keys mean it's never asked twice regardless of order. Copy is bullet
  points (user asked for this over a paragraph), ends with a bullet noting
  scope ("Currently only applies to Challenge and Marathon"). Whichever
  button they click shows a brief "Settings saved" confirmation for 900ms
  before the quiz box appears.
- Settings row added to `profile.html` `#tab-settings`: self-descriptive line
  ("Type answers instead of picking (currently Off) -- Challenge and
  Marathon only") + toggle button, same localStorage keys as the ask prompt.
- Result-screen reminder: NOT a popup -- a plain one-line text+link
  (`hmResultHintHtml`) sitting in the result screen itself, under the score
  line, shown only to players who said "No", capped at 3 times total
  (`tg_hard_mode_hint_shown` counter) -- shared budget across Challenge AND
  Marathon combined, not 3 each. Never re-shows the full ask screen.
- Explicitly out of scope for now: Survival, Episode, Daily, Trivia Rush,
  Versus all stay multiple-choice-only. User asked specifically about
  Marathon and stopped there; the shared `hm*` helpers in app.js are already
  reusable if any of those get added later.

## Update 2026-08-24 (later same day, second session block): more real bugs found and fixed
User is manually testing in the browser and finding real bugs fast (2 within
seconds). Explicitly rejected "wait and patch reactively" as a strategy —
told me directly that's not good enough at this bug-rate, and players won't
report what they hit, they'll just get a wrong "Wrong" and move on. Also
explicitly rejected a proposed AI-classify-every-answer approach once the
real scale was checked (9,952 distinct name/title-shaped answers, not the
~1,000 originally guessed) -- not feasible in one session. Landed on a much
better technique instead, worth reusing for future edge-case hunting:

**Simulate diverse typed inputs against the REAL dataset and check for
structural failures, rather than manually reviewing word lists in the
abstract.** E.g.: for every answer, does typing the exact answer match
itself (sanity check)? Does a single dropped-letter typo still pass? Does
the digit form of a spelled-out number match? This is pure script, runs
instantly across the whole ~24,000-answer typed-eligible pool, and it's what
actually caught two real bugs that pure reasoning/word-review would have
missed entirely:
- An answer that's literally `"?"` (data/language.txt, "Which punctuation
  mark ends a question?") failed to match itself -- `hmNormalize`'s trailing-
  punctuation strip wiped an all-punctuation answer down to an empty,
  unmatchable string. Fixed: strip falls back to the un-stripped form if
  stripping would leave nothing.
- 165 answers use spelled-out numbers ("Seven," "Ten," "One hour") where
  typing the digit form ("7," "10," "1 hour") failed outright. Fixed: added
  `HM_NUMBER_WORDS` (one-hundred) as a normalize-time substitution, applied
  to both sides before comparing.

Also fixed via direct data-scanning (not the simulation technique, but same
"verify against real data before asserting a plan" spirit):
- **Diacritics never normalized** (785 answers have them: Beyoncé, Pokémon,
  Ernő Rubik, Skarsgård...). Fixed with Unicode NFD decompose + strip
  combining marks in `hmNormalize` -- "Beyonce" now matches "Beyoncé".
- **Title-case answers with lowercase connector words got ZERO shortcut
  treatment** -- "Game of Thrones," "Back to the Future" (700+ answers
  within the <=3-word typed-input range) failed `hmIsNameOrTitleShaped`
  entirely because it required every word capitalized. Fixed: added
  `HM_TITLE_CONNECTORS` (of/the/a/and/in/to/on/for/with/at/by/from/or/as) --
  first and last word must still be capitalized, but a middle word can be a
  recognized connector.
- **Last-word shortcut generalized**: single typed word can now match either
  the FIRST or LAST content word (was first-only) -- fixes "mcgonagall" for
  "Minerva McGonagall" (previously only "minerva" worked). Guarded by (a) a
  small hand-picked `HM_GENERIC_LAST_WORDS` blocklist (~20 words: family,
  medicine, academy, house, team...) so "Family"/"Medicine" still correctly
  reject, and (b) `hmBuildWordCollisions` (renamed from
  `hmBuildFirstWordCollisions`) now checks collisions on BOTH first and last
  positions, not just first.
- **First+last shortcut added** for exactly-2-word typed input: "Tom Riddle"
  now matches "Tom Marvolo Riddle" (first+last, middle word(s) dropped).
- **Real regression, found via smoke test, root-caused and fixed**: the
  one-time ask screen was firing between rounds of the SAME first-ever
  session (round 2 is technically a fresh page load = "seen before" =
  true), not just skipped-then-shown-on-a-genuinely-separate-playthrough as
  intended. Fixed by gating the ask call itself to only ever run when
  `round`/`page` param is "1" (or absent) -- round 2+ never calls
  `hmMaybeAskFirstTime` at all, so it can't interrupt mid-session. Verified
  directly via a throwaway Puppeteer script tracing localStorage +
  `#hardModeAsk` display state across round 1 -> round 2 (same session) ->
  round 1 of a new theme (separate playthrough) -- confirmed ask stays
  hidden through round 2, then correctly appears on the next fresh
  playthrough.

**Explicitly rejected/deferred approaches, with reasons** (don't re-propose
these without new information):
- Names dictionary to detect "is this actually a person's name" -- user
  called it "too complex." Also technically wouldn't have solved the actual
  problem: many fictional character names (Morticia, Gomez) aren't real
  first names anyway, so it would have missed exactly the cases Hard Mode
  needs to handle.
- AI-classifying all 9,952 individual name/title-shaped answers -- not
  feasible at that scale in one session. Narrowed instead to the ~1,444
  distinct REPEATED last words (words appearing 2+ times across the whole
  site) as the actual tractable review surface -- one-off words default to
  "allowed" since a word appearing exactly once site-wide is inherently low
  collision-risk. **This 1,444-word review has NOT been done yet** -- still
  running on the small hand-picked 20-word blocklist. Explicitly deferred by
  the user ("we will continue with checking for edge cases later") -- pick
  this up next session if asked to continue.
- Global (site-wide) word-frequency-based auto-blocking -- rejected on
  investigation: common real surnames (Smith, Jones, Morgan, Stark, Taylor,
  Davis, Jackson, Pierce, Bennett...) are ALSO frequent across 200+ themes,
  so a pure-frequency cutoff would incorrectly block legitimate surnames
  right alongside genuinely generic words (city, day, king, house, academy).
  The per-theme collision check (already built) is the right scope for
  ambiguity; the last-word-generic question needs actual judgment, not
  frequency alone.

**State as of this update: still uncommitted, still not pushed.** All 4
game-mode smoke tests pass (marathon/marathon-mashup/challenge/challenge-
mashup). Diacritics, numbers, title-connectors, the "?" bug, and the ask-
timing regression are all fixed and verified. The 1,444-word last-word
review is the known remaining piece, explicitly paused, not abandoned.

Also see [[feedback-confirm-before-wide-changes]] for a hard lesson from
this session: don't treat "not sure" as a yes, and don't over-correct "stop
narrating" into "silently do the next big undiscussed thing" either.

## Bug found during manual testing (fixed same session)
User typed "tom riddle" for "What is Voldemort's real name?" (answer: "Tom
Marvolo Riddle") and got marked Wrong. Root cause: the shortcut logic only
handled a single word, nothing for "first + last, skip the middle name" --
a very natural way to answer. Fixed by adding the first+last-word shortcut
described above. Lesson for next time testing this: try common partial-name
patterns (skip middle name, skip title/prefix like "Doctor") since the
dataset has several of both shapes.

## Testing infrastructure note
`scripts/smoke-test.js` is the existing Puppeteer-based QA layer (see
[[reference-quiz-docs]] -- it's documented there and I still didn't check
memory before improvising my own ad-hoc checks first; see
[[feedback-verify-before-asserting]]). It needed updating for this feature:
each mode test runs in a fresh browser context (empty localStorage), so the
new one-time ask screen blocks the quiz box exactly like Survival's
difficulty picker does -- added `start: '.hm-ask-no'` to the
marathon/marathon-mashup/challenge/challenge-mashup mode configs, and bumped
the post-click wait from 400ms to 1000ms to clear the 900ms "Settings saved"
confirmation beat. All four modes pass after the fix.

Related: [[reference-quiz-docs]], [[feedback-verify-before-asserting]], [[user-trivia-gauntlet-owner]]
