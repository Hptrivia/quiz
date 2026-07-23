#!/usr/bin/env node
/**
 * Regenerates data/recent.json — the feed behind the "Recently Added" page.
 *
 * The list is derived, never hand-maintained: every theme in themes.json and
 * every episode set in episode_themes.json is dated by when its questions file
 * FIRST landed in git (`--diff-filter=A`), which is the real "added" date. Files
 * that aren't committed yet fall back to their mtime, so a theme added today
 * shows up before it's committed.
 *
 * Themes and episodes are merged into one list sorted newest-first and
 * capped at LIMIT, so adding a new theme automatically pushes the oldest entry
 * off the page. Run it after adding themes/episodes:
 *
 *   node scripts/generate-recent.js
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT  = path.join(__dirname, "..");
const LIMIT = 20;

function readJSON(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

/** First-commit date for a file, or its mtime if git doesn't know it yet. */
function addedDate(relFile) {
  const abs = path.join(ROOT, relFile);
  if (!fs.existsSync(abs)) return null;

  try {
    const out = execFileSync(
      "git",
      ["log", "--diff-filter=A", "--format=%ad", "--date=short", "-1", "--", relFile],
      { cwd: ROOT, encoding: "utf8" }
    ).trim();
    if (out) return out;
  } catch (e) {
    // fall through to mtime
  }

  return fs.statSync(abs).toISOString().slice(0, 10);
}

const themes   = readJSON("data/themes.json");
const episodes = readJSON("data/episode_themes.json");
const titleOf  = Object.fromEntries(themes.map(t => [t.slug, t.title]));

const entries = [];

for (const t of themes) {
  const date = addedDate(t.questionFile);
  if (!date) continue;
  entries.push({
    type: "theme",
    slug: t.slug,
    title: t.title,
    label: t.category,
    date,
    url: `challenge.html?theme=${t.slug}&round=1`
  });
}

for (const [slug, file] of Object.entries(episodes)) {
  const date = addedDate(`data/${file}`);
  if (!date) continue;
  entries.push({
    type: "episode",
    slug,
    title: titleOf[slug] || slug,
    label: "Episode Mode",
    date,
    url: `episode.html?theme=${slug}`
  });
}

// A batch of themes all lands on one day, so date alone can't order within a
// batch. Sort newest day first, then interleave themes and episodes inside
// each day (title-sorted) — otherwise a day like 2026-07-17 renders as 13
// episode rows followed by 7 theme rows instead of a mix.
const byDate = new Map();
for (const e of entries) {
  if (!byDate.has(e.date)) byDate.set(e.date, []);
  byDate.get(e.date).push(e);
}

const ordered = [];
for (const date of [...byDate.keys()].sort().reverse()) {
  const group = byDate.get(date);
  const sortByTitle = (a, b) => a.title.localeCompare(b.title);
  const themeRows   = group.filter(e => e.type === "theme").sort(sortByTitle);
  const episodeRows = group.filter(e => e.type === "episode").sort(sortByTitle);

  for (let i = 0; i < Math.max(themeRows.length, episodeRows.length); i++) {
    if (themeRows[i])   ordered.push(themeRows[i]);
    if (episodeRows[i]) ordered.push(episodeRows[i]);
  }
}

const out = ordered.slice(0, LIMIT);
fs.writeFileSync(
  path.join(ROOT, "data/recent.json"),
  JSON.stringify(out, null, 2) + "\n"
);

console.log(`Wrote data/recent.json — ${out.length} entries (${out[0].date} → ${out[out.length - 1].date})`);
