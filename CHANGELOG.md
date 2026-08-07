# Changelog

Running log of notable changes made in collaboration with Claude, kept here (not in Claude Code's `~/.claude` memory) because that directory has already been found to not survive a codespace rebuild. Appended to after meaningful changes, most recent first.

## 2026-08-07

- **New-show data cleanup**: reordered filler/meta questions (who created the show, which network aired it, what year it premiered, how many seasons/episodes, which actor played X) to the end of the question set instead of the beginning, across the 8 new shows added but not yet integrated: `70show`, `100`, `americans`, `atlanta`, `cards`, `law`, `riverdale`, `silo`.
- **Established the "Adding a New Show" protocol** — see `NEW-SHOW-PROTOCOL.md`. Verified against the actual last real batch (commit `6a46fb27`, added hawk/homeland/leftovers/oc/orange/oz/shield/veep) rather than guessed from reading scripts. Found and fixed a real bug along the way: `generate-wordle-pages.js` and `generate-wordsearch-pages.js` were re-dating every existing wordle/wordsearch sitemap URL to "today" on every run instead of only new ones — now they preserve existing `<lastmod>` values, matching the logic `generate-theme-pages.js` already had.
- **`trivia-builder.html` overhaul** (pushed to the `tools` branch, gitignored on `main`):
  - Removed the model picker; hardcoded to Claude Sonnet 5 (was defaulting to the pricier Opus 5).
  - Disabled extended "thinking" on all AI calls (AI Options, Rephrase, Chat, manual-add Generate) — Sonnet 5 runs adaptive thinking by default when unset, which was the cause of slow/expensive AI Options calls.
  - Removed the green highlight on correct answers in the option list.
  - Moved "Approve" to the first button in the question-card action row.
  - AI Chat is now an inline panel under each question card instead of a popup modal; AI Options/Rephrase explanations now post into that same chat log instead of a toast that disappears.
  - Fixed a bug where navigating away and back (or a reload) dropped you back on the homepage instead of restoring the last view/project/filter — now persisted to localStorage.
  - Added a Storage management modal (per-project size, delete individual projects).
  - Added "Add Questions Manually" — freeform textarea, autosaving draft, AI-structures it into full questions (fills in missing options/answer/difficulty) on Generate.
  - Added a live search bar and per-filter-tab counts on the review screen.
  - Moved "View / Export" from the review toolbar into the top-right nav bar.
