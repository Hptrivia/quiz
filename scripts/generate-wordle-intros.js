// generate-wordle-intros.js
// Generates one unique, non-spoiling intro paragraph per theme for the wordle
// landing pages (wordle/<slug>.html), so those pages stop sharing one
// templated sentence.
//
// The theme's actual wordle word list is passed to the model as an explicit
// ban list ("do not use these words") and the output is checked in code
// against that same list — a word being a well-known character/place name
// for a show is exactly why it's likely to BOTH be a chosen wordle answer
// AND something a generic description would mention, so simply not showing
// the model the list does not prevent overlap. Leaks are retried; the ban
// list itself never appears in the published page.
//
// Saves to data/wordle_intros.json — resumable, won't re-generate existing entries.
//
// Usage: node scripts/generate-wordle-intros.js
// Requires: ANTHROPIC_API_KEY in a .env file at the repo root (KEY=VALUE,
// one per line — no dotenv package in this repo, loaded manually below).

const fs        = require("fs");
const path      = require("path");

const ENV_PATH = path.join(__dirname, "../.env");
if (fs.existsSync(ENV_PATH)) {
  fs.readFileSync(ENV_PATH, "utf8").split("\n").forEach(line => {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim();
  });
}

const Anthropic = require("@anthropic-ai/sdk");
const client       = new Anthropic();
const THEMES_FILE  = path.join(__dirname, "../data/themes.json");
const WORDS_FILE   = path.join(__dirname, "../data/wordle_words.txt");
const INTROS_FILE  = path.join(__dirname, "../data/wordle_intros.json");
const DELAY_MS     = 150;
const MAX_ATTEMPTS = 4;

let intros = {};
if (fs.existsSync(INTROS_FILE)) {
  intros = JSON.parse(fs.readFileSync(INTROS_FILE, "utf8"));
  console.log(`Loaded ${Object.keys(intros).length} existing intro(s).`);
}

const themes = JSON.parse(fs.readFileSync(THEMES_FILE, "utf8"));
const wordsData = JSON.parse(fs.readFileSync(WORDS_FILE, "utf8"));

// wordle_words.txt is keyed by theme TITLE, not slug
const titleToWords = {};
for (const [title, words] of Object.entries(wordsData)) {
  titleToWords[title.toLowerCase()] = words.map(w => String(w).toUpperCase());
}

function getThemeContext(category) {
  if (category === "Games") return "a video game";
  if (category === "Sports") return "a sport";
  if (category === "Books") return "a book series";
  if (category === "Movies") return "a film";
  return "a show";
}

function findLeaks(text, bannedWords) {
  const textWords = new Set((text.toUpperCase().match(/[A-Z']+/g) || []));
  return bannedWords.filter(w => textWords.has(w));
}

async function generateIntro(theme, bannedWords) {
  const avoid = [theme.description, theme.seoIntro, theme.seoDetail]
    .filter(Boolean).join(" ");
  const banList = bannedWords.join(", ");

  let lastText = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const extra = attempt === 1 ? "" :
      `\n\nYour previous attempt used one of the banned words (${findLeaks(lastText, bannedWords).join(", ")}). Try again with completely different wording that avoids all banned words.`;

    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `Write a 2-3 sentence intro paragraph (under 55 words) for a Wordle-style puzzle page themed around "${theme.title}", ${getThemeContext(theme.category)}.

Rules:
- Write about ${theme.title} itself: what it is, why it's well known, standout details. Do NOT mention Wordle, puzzles, guessing, letters, or word games — that's covered elsewhere on the page.
- CRITICAL: this theme's puzzle answers must stay hidden. Do NOT use any of these words anywhere, in any form: ${banList}
- Do not repeat phrasing from this existing description (write it differently, don't just paraphrase it sentence-by-sentence): "${avoid}"
- Plain prose, no lists, no markdown, no quotation marks around the output.
- Output ONLY the paragraph text, nothing else.${extra}`
      }]
    });

    lastText = resp.content[0].text.trim();
    if (findLeaks(lastText, bannedWords).length === 0) return lastText;
  }

  throw new Error(`could not avoid banned words after ${MAX_ATTEMPTS} attempts: ${findLeaks(lastText, bannedWords).join(", ")}`);
}

async function main() {
  console.log(`Generating wordle intros for ${themes.length} theme(s)...\n`);

  for (let i = 0; i < themes.length; i++) {
    const theme = themes[i];
    if (intros[theme.slug]) {
      console.log(`[${i + 1}/${themes.length}] ${theme.slug} — already done, skipping`);
      continue;
    }

    const bannedWords = titleToWords[theme.title.toLowerCase()] || [];

    process.stdout.write(`[${i + 1}/${themes.length}] ${theme.slug}... `);
    try {
      intros[theme.slug] = await generateIntro(theme, bannedWords);
      fs.writeFileSync(INTROS_FILE, JSON.stringify(intros, null, 2));
      console.log("✓");
    } catch (err) {
      console.log(`✗ ${err.message}`);
    }
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\nDone. Intros saved to data/wordle_intros.json`);
}

main().catch(console.error);
