# Adding a New Show — Protocol

Confirmed against the actual last real batch (commit `6a46fb27`, 2026-08-02: hawk, homeland, leftovers, oc, orange, oz, shield, veep) — not guessed from what scripts theoretically support, but from what was actually run.

**Hard rule across every step:** adding a new show must never modify an existing show's `themes.json` entry, generated page, word list, or sitemap `<lastmod>` date. Every step below is append-only / new-URLs-only.

## Step 1 — question file (you do this)
Paste/write `data/<name>.txt` — a JSON array of `{question, options:[4], answer, difficulty}`.

## Step 2 — `data/themes.json` entry
Propose the category first (must be exactly one of: `TV, Movies, Anime, Sitcoms, Games, Sports, General, Education, Books, Countries`), get confirmation, then append (never edit an existing entry):
`slug, title, category, description, image:"", questionFile, seoIntro, seoDetail, fanQuestions`.

Note: `scripts/add-seo-details.js` has a `contentMap` upsert pattern that looks built for this, but it's dead — last touched April 2026, not used in the real Aug 2 batch. `themes.json` gets edited directly instead.

## Step 3 — `node scripts/build-site.js`
Runs in order:
1. `generate-theme-pages.js` — builds `themes/<slug>.html`, rewrites `sitemap.xml` (lastmod-preservation already built in)
2. `generate-category-pages.js` — rebuilds all `categories/*.html` (only categories with new entries actually change)
3. `generate-recent.js` — rebuilds `data/recent.json`, dated by the questionFile's first git-commit date (commit the `.txt` first, else it falls back to mtime)

## Step 4 — `data/wordle_words.txt` entry
Key = exact theme **Title**. 12 words, ALL CAPS, **strict 4–7 letters each**.

`node scripts/generate-wordle-pages.js` builds `wordle/<slug>.html` + updates sitemap. Fixed 2026-08-07: previously re-dated every existing `/wordle/` sitemap URL on every run; now preserves existing `<lastmod>` values, only new URLs get today's date.

## Step 5 — `data/wordsearch_words.json` entry
Key = exact theme **Title**. 24 words total: ~12 character/proper-noun names first, then the exact same 12 words from that show's `wordle_words.txt` entry appended after. **3–9 letters each** (fits the grid).

`node scripts/generate-wordsearch-pages.js` builds `wordsearch/<slug>.html` + updates sitemap. Same lastmod-preservation fix applied 2026-08-07.

### Word-selection rules (learned batch-testing 7 shows on 2026-08-07 — get these right the first time)
- **Prefer theme/plot words over character names in the wordle list.** Names are the fallback, not the default. Most shows have enough vocabulary to hit all 12 words with zero names — check before assuming names are needed.
- **If a name is used in wordle, never let it lead the list** — middle position, not first/last.
- **Every word must be something that actually happens/exists IN the show** — a real prop, place, event, or in-universe term, grounded in a specific fact (from the question file or real canon knowledge of the show, not restricted to only the literal Q&A text). Don't default to generic genre vocabulary that could apply to any similar show.
- **Never use real-world actor/actress/author/director surnames as words** — they're never spoken or seen inside the show's fictional world (real mistakes caught: Stanfield, Ferguson, Kunis, Rhys, Russell, Taylor, Morgan). Only in-universe names/terms belong in the word lists, even though "which actress plays X" is a perfectly normal trivia *question*.
- **Don't split one real entity across two slots** (e.g. "Todd Rundgren" → `TODD` + `RUNDGREN` wastes two of twelve slots on one thing).
- **Wordsearch names should be a natural mix of first names and surnames**, not uniformly one or the other — mirror real data like Homeland's `CARRIE, BRODY, SAUL, QUINN, MATHISON, BERENSON, ESTES, NAZIR, DANA, JESSICA, YEVGENY, HAQQANI`.
- **Present category + both word lists per show for confirmation before writing to the data files** — this is the one step that always needs a stop-and-check, even mid-batch.

## Step 6 — `node scripts/validate-themes.js` (optional sanity check)
Not confirmed as part of the regular workflow — treat as a self-check, not a formal step. Known false positive: flags every `xxxeps1.txt` episode file as "unused" (bug checks for substring `"episode"`, real filenames use `eps1`) — ignore those warnings.

## Step 7 — bump `index.html` category counts
No script does this. Homepage has hardcoded `<p>N theme(s)</p>` per category card — increment after adding shows to that category. Easy to miss; nothing errors if skipped, the homepage just shows a stale count.

## Step 8 — `node scripts/smoke-test.js` (final QA)
Puppeteer-based, plays every game mode headless, fails on JS errors or a mode never reaching its end state. Run last.

## Dead — skip entirely
`scripts/generate-wordle-hints.js` / `data/wordle_hints.json` — output file doesn't exist anywhere in the repo, nothing in the live wordle game reads it. Never actually wired in.

## Optional — skip unless explicitly asked
- `data/episode_themes.json` (episode mode, only if an `xxxeps1.txt` exists)
- `data/new_themes.json` (manually curated "Newly Added" badge list)
- `data/normal_pack_links.json` / `episode_pack_links.json` (Ko-fi printable packs)
- `data/affiliate_links.json` (real Amazon affiliate URLs — can't be fabricated, only add if given real links)
