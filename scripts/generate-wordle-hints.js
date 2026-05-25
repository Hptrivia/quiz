// generate-wordle-hints.js
// Generates one-sentence hints for all Wordle words using Claude Haiku (cheap)
// Saves to data/wordle_hints.json — resumable, won't re-generate existing hints
//
// Usage: node scripts/generate-wordle-hints.js
// Requires: ANTHROPIC_API_KEY env var

const Anthropic = require("@anthropic-ai/sdk");
const fs        = require("fs");
const path      = require("path");

const client    = new Anthropic();
const WORDS_FILE = path.join(__dirname, "../data/wordle_words.txt");
const HINTS_FILE = path.join(__dirname, "../data/wordle_hints.json");
const BATCH_SIZE = 8;
const DELAY_MS   = 300;

// Load existing hints so we can resume interrupted runs
let hints = {};
if (fs.existsSync(HINTS_FILE)) {
  hints = JSON.parse(fs.readFileSync(HINTS_FILE, "utf8"));
  console.log(`Loaded ${Object.keys(hints).length} existing theme(s) from hints file.`);
}

const wordsData = JSON.parse(fs.readFileSync(WORDS_FILE, "utf8"));

async function generateBatch(theme, words) {
  const numbered = words.map((w, i) => `${i + 1}. ${w}`).join("\n");
  const resp = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [{
      role: "user",
      content: `You are writing hints for a themed Wordle game. The theme is "${theme}".

For each word below, write ONE short sentence that helps a player guess the word without directly stating it. Be specific to the theme. Keep it under 12 words.

Format your response ONLY as:
WORD: hint text

Words:
${numbered}`
    }]
  });

  const result = {};
  const lines  = resp.content[0].text.split("\n").filter(l => l.includes(":"));
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    const word  = line.slice(0, colonIdx).trim().replace(/^\d+\.\s*/, "").toUpperCase();
    const hint  = line.slice(colonIdx + 1).trim();
    if (words.includes(word) && hint) result[word] = hint;
  }
  return result;
}

async function processTheme(theme, words) {
  const themeHints = hints[theme] || {};
  const missing    = words.filter(w => !themeHints[String(w).toUpperCase()]);
  if (!missing.length) return themeHints;

  const upper = missing.map(w => String(w).toUpperCase());

  for (let i = 0; i < upper.length; i += BATCH_SIZE) {
    const batch    = upper.slice(i, i + BATCH_SIZE);
    const batchHints = await generateBatch(theme, batch);
    Object.assign(themeHints, batchHints);
    if (i + BATCH_SIZE < upper.length) await new Promise(r => setTimeout(r, DELAY_MS));
  }

  return themeHints;
}

async function main() {
  const themes = Object.keys(wordsData);
  console.log(`Generating hints for ${themes.length} theme(s)...\n`);

  for (let i = 0; i < themes.length; i++) {
    const theme = themes[i];
    const words = wordsData[theme];
    if (!Array.isArray(words) || !words.length) continue;

    const alreadyDone = hints[theme]
      ? words.filter(w => hints[theme][String(w).toUpperCase()]).length
      : 0;
    if (alreadyDone === words.length) {
      console.log(`[${i + 1}/${themes.length}] ${theme} — already complete, skipping`);
      continue;
    }

    process.stdout.write(`[${i + 1}/${themes.length}] ${theme}... `);
    try {
      hints[theme] = await processTheme(theme, words);
      fs.writeFileSync(HINTS_FILE, JSON.stringify(hints, null, 2));
      console.log(`✓ (${Object.keys(hints[theme]).length}/${words.length} words)`);
    } catch (err) {
      console.log(`✗ ${err.message}`);
    }
  }

  console.log(`\nDone. Hints saved to data/wordle_hints.json`);
}

main().catch(console.error);
