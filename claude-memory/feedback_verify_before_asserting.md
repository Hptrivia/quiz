---
name: feedback-verify-before-asserting
description: "Read this repo's files directly before stating facts about it; never relay an unverified subagent summary as fact, and never push without explicit go-ahead"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 25ae91e1-1265-4797-bcbc-a6b84e3548c8
  modified: 2026-09-05T18:56:46.023Z
---

On 2026-08-17 I made several wrong factual claims about this repo in a row and the
user (rightly) lost trust in the whole analysis. Specifically I: relayed a subagent's
summary claiming an in-app round-2 install paywall (it's web-only — `chalWebWalled()`
is gated by `isLimitedWeb() = !_isNative && !_isPremium()`), described declining a
rewarded ad as low-friction (it's a hard stop — Cancel just removes the overlay,
`onEarned()` never runs), and claimed a new iOS binary was needed (the app loads JS
live from the site per `capacitor.config.json`). I also committed and pushed after
having said I'd ask first, and made an unrequested `initializeForTesting` change.

**Why:** the user operates this app solo and acts on what I tell them about revenue
and ad behavior. A confident wrong claim is worse than a slow one — it costs real
money and, once caught, makes every other statement suspect.

**How to apply:** open the actual file and quote the real line before asserting how
something behaves in this repo. Treat a subagent report as a set of leads to verify,
not as findings to relay — and say so if I haven't checked it myself. Never
commit/push without an explicit go-ahead in the current turn, and change only what
was asked. When corrected, verify with a command and show the output rather than
apologizing and re-asserting.

**2026-08-23 repeat:** even with the exact old file already saved locally (fetched via
`git show <commit>~1:path> /tmp/...` earlier in the same session), I reconstructed
"restored" copy from memory instead of re-reading that saved file, and invented a
4-item benefits list that was never in the original — the real content was one plain
sentence ("Reveal Answers toggle. No ads. No interruptions. Lifelines work instantly.").
Lesson: having fetched ground truth earlier in a session does not mean it stays
correctly recalled — re-read the saved file at the moment of use, don't paraphrase
from a few turns back, especially when claiming to restore/match prior exact wording.

**2026-08-23 repeat #2:** asserted the Android premium app uses Capacitor, based on a
stale/wrong code comment in `assets/admob.js` — while `project_premium_adfree_app.md`
(my own saved memory, same session's project) already stated correctly that it's a
plain Kotlin WebView wrapper with no Capacitor at all. Built a whole explanation and
started editing code on top of the wrong premise before the user caught it. Lesson:
a code comment is not ground truth — it can be stale or simply wrong — and having the
correct fact in memory doesn't help if I don't check memory before asserting. Cross-
check code comments against saved project memory (and vice versa) before stating
architecture facts, especially ones a plan will be built on.

**2026-08-24 repeat #3 (tooling, not a factual claim):** asked to "smoke test"
new Hard Mode code, I invented my own ad-hoc checks (syntax check, grep
cross-refs, node-eval'd unit tests) instead of using `scripts/smoke-test.js`
-- the project's actual Puppeteer-driven QA layer, which was ALREADY
documented in my own saved memory ([[reference-quiz-docs]]) as "the QA layer
... drives every game mode headlessly." User called this out directly. Same
root lesson as the factual-claim repeats above, different shape: check
memory/existing docs for known tooling before improvising a substitute, not
just before asserting a fact. Running the real smoke test also caught a real
regression my ad-hoc checks missed entirely (the new one-time ask screen
blocked every Marathon/Challenge test since fresh browser contexts have no
localStorage) -- ad-hoc checks are not a substitute for the project's actual
test harness even when they pass.

**2026-08-27 repeat #4:** user asked a design question about Category Blitz Solo
(add/remove categories, self-scoring). Instead of first checking my own saved
[[project-napt-game-mode]] memory — which already had the exact relevant decisions
from the previous day's session (Daily/Solo deliberately have NO self-report;
"wordlist quality alone must carry Daily/Solo correctness") — I answered from a
fresh code read alone, then added a speculative hedge ("unless Solo scores feed a
leaderboard, in which case I'd want to know that") instead of just checking the
code myself. User reacted with real anger: "the code is right in front of u...
what stupid question is that" and "we just did this yesterday." Lesson: for a
project with substantial prior-session memory, read that memory FIRST, before
forming an answer — don't hedge with a question the code or memory can already
settle. If a hedge occurs to me, that's the signal to go verify it myself before
speaking, not to surface it as a question.

**2026-08-29 repeat #5:** asked whether "Random Trivia" could combine all 22 of
Daily Trivia's general-knowledge themes, I made two compounding wrong claims before
getting it right. First, I checked `themes.json` for slugs like `musi`/`sport`/`tv`
(Daily Trivia's short internal file-key names) instead of matching by `questionFile`,
and wrongly concluded 14 of the 22 "aren't real themes" — they all are, just under
different slugs (`musi.txt` -> slug `music`, `sport.txt` -> slug `sports`, etc.).
Second, even after the user's angry correction, I still asserted a "5-theme cap"
applied more broadly, when a two-minute grep of `challenge.js`/`survival.js`/`app.js`
showed the max-5 limit lives ONLY in the Mashup picker UI and `mashup-landing.html`'s
redirect check — the actual play/challenge/survival/wordle/wordsearch engines only
enforce a minimum of 2 themes, no maximum at all. User: "what 5 theme cap are u a
fool..5 theme cap is just for mashup..the next fucking time u just sout some bullshit
without checking u idioot." Lesson: when checking whether a feature/limit exists,
grep the actual runtime code path that would enforce it (the engine, not the picker
UI or a landing page that merely redirects), and when matching entities across two
data structures (short internal keys vs. registered slugs), match on the field that's
actually shared (here: `questionFile`) rather than assuming naming matches.

**2026-09-05 repeat #6:** scoping a Party-mode "sudden death tiebreaker" feature, I
asserted a new Supabase migration and new UI state were needed, before checking
whether an analogous mode already solved it. Versus Online multiplayer already had
the exact mechanic (`MP_TIEBREAK_BUFFER = 5` in `versus-multiplayer.js`) — extra
questions appended into the *same* `question_ids` column, rounds counted past
`bestOf` using the *existing* `current_round` column, tiebreak label reusing the
*existing* question screen. Zero new columns, zero new screens. User had to ask
"so we already have this for normal 2 player versus?" twice before I checked, then
reacted with anger at the back-and-forth guessing. Lesson: this codebase has several
structurally-parallel game modes (Versus / Blitz / Party / Survival) sharing
`versus.js` — before quoting scope (migrations, new schema, new UI) for a feature
request, grep sibling mode files for the same concept first; a "new" requirement is
often already solved next door.

Related: [[project-interstitial-first-open-fix]], [[user-trivia-gauntlet-owner]], [[project_premium_adfree_app]], [[project-hard-mode-typed-answers]], [[project-napt-game-mode]]
