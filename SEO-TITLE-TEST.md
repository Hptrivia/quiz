# SEO A/B test — "Quiz" in the page title

**Started:** 2026-07-29 · **Measure:** August 2026 · **Decide:** early September 2026

## Why

Search Console (2026-03-15 → 2026-07-26) showed the site ranks far worse for "quiz" searches
than "trivia" searches, because the theme page title never contained the word "quiz".

| Query contains | Queries | Impressions | Avg position | CTR |
|---|---|---|---|---|
| trivia | 229 | 4,008 | 8.33 | 24.2% |
| questions | 120 | 2,324 | 7.98 | 18.3% |
| **quiz** | **157** | **2,416** | **11.34** | 13.0% |
| answers | 40 | 529 | 9.10 | 17.8% |

Same demand for "X quiz" as "X trivia", three positions worse. Direct example:
"invincible trivia" = position 6.4, "invincible quiz" = position 8.6.

## What changed

**Only the `<title>` tag and the meta description. `<h1>`, body copy, `og:title` and
`twitter:title` are all untouched** — `og:title` drives Reddit link previews and Reddit is
the main traffic source, so it was deliberately left alone.

Before: `Breaking Bad Trivia Questions | Trivia Gauntlet`
After:  `Breaking Bad Trivia Quiz — Questions & Answers | Trivia Gauntlet`

Purely additive: "trivia" and "questions" both remain, "quiz" and "answers" are added.

Controlled by `QUIZ_TITLE_TEST_SLUGS` in `scripts/generate-theme-pages.js`.
**New themes added after this date keep the ORIGINAL title** so the control group stays clean.

## Test group — 52 pages (2,019 impressions, 72 clicks, avg position 17.53)

half-man, parks-and-recreation, nigerian-music, dexter, prison-break, suits,
nigerian-football, gta-v, marketing-and-brands, cyberpunk-2077, the-boys, the-wire,
death-stranding, elden-ring, heroes, the-witcher-3, dark-souls-3, lies-of-p, the-sopranos,
family-guy, desperate-housewives, red-dead-redemption-2, greys-anatomy, world-facts, ben-10,
rick-and-morty, ozark, the-bear, history, house, seinfeld, yakuza, succession, language,
the-crown, daredevil, clair-obscur-expedition-33, food-drink, the-big-bang-theory,
modern-family, mad-men, the-last-of-us, health-and-medicine, breaking-bad, spartacus,
hollywood, god-of-war, star-trek, arrow, bleach, fun-facts, bones

**Control group:** the other 171 theme pages, unchanged.

Chosen from the 20–100 impression band — enough volume to read a directional shift, small
enough that nothing important is at risk. Deliberately EXCLUDES the top earners:
invincible (5,976 impressions), off-campus, the-pitt, superstore, arcane.

## How to decide

Export Search Console for August, then compare **test group vs control group** — not
before/after. The site is growing ~10× year-on-year, so everything rises regardless; only
the gap between the two groups isolates the title change.

- **Test group gains on control** → set `QUIZ_TITLE_ALL = true` in the generator, regenerate all.
- **No difference or worse** → empty `QUIZ_TITLE_TEST_SLUGS`, regenerate, done.

## Known confound

Regenerating these 52 pages also reshuffled their sample questions and related-theme links
(`Math.random()` at `generate-theme-pages.js:27` and `:121`). The control group did not get
reshuffled. This is minor — same questions, same pool, different 10 — but it means a
difference could in principle come from content churn rather than the title.

## Caveat

Google rewrites the displayed title for roughly a third of results, so a changed `<title>`
does not guarantee a changed search listing.
