---
name: reference-quiz-docs
description: Key docs and entry-point scripts in the quiz repo worth checking first
metadata: 
  node_type: memory
  type: reference
  originSessionId: 259d5125-1f55-43ba-be12-e54f5b505e05
  modified: 2026-08-05T19:36:57.746Z
---

- `PLATFORM-BEHAVIOR.md` — source-of-truth matrix for how the site/app behaves across iOS/Android app vs iOS/Android/desktop web (ad gating, question/wordle/wordsearch/episode limits, paywalls, unlock CTAs). Says to update it whenever gating/ads/CTAs change — check before and after touching `assets/profile.js` or `assets/admob.js`.
- `SEO-TITLE-TEST.md` — active SEO A/B test on theme-page `<title>` copy ("quiz"/"answers" wording), started 2026-07-29, decision due early September 2026. Controlled by `QUIZ_TITLE_ALL` / `QUIZ_TITLE_TEST_SLUGS` in `scripts/generate-theme-pages.js`. Newly added themes intentionally keep the original title (control group) until the test resolves — don't add new slugs to the test set.
- `scripts/build-site.js` — the main content-pipeline entrypoint: runs `generate-theme-pages.js` → `generate-category-pages.js` → `generate-recent.js`, regenerating `themes/*.html`, `categories/*.html`, `sitemap.xml`, and `data/recent.json` from `data/themes.json`. Run this after editing `data/themes.json`.
- `scripts/validate-themes.js` and `scripts/smoke-test.js` — QA layer (the latter drives every game mode headlessly via Puppeteer). No CI config runs these automatically; they're manual checks.

See [[user-trivia-gauntlet-owner]] for who this is for.
