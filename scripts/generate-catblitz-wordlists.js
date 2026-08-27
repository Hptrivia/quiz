// generate-catblitz-wordlists.js
// Maximizes real coverage per letter/category via Claude Haiku — run AFTER
// build-catblitz-seed-lists.js. Unlike an earlier version of this script,
// this does NOT ask for "common"/"most likely" answers and does NOT skip a
// letter just because it already has a lot of words — a raw count target
// can hide a bad MIX (e.g. Name/A had 200+ entries from many countries but
// was still missing common Western names like "Andrew"/"Amanda", found via
// a large hit-rate test). Instead: for every letter, repeatedly ask for MORE
// real, distinct entries not already in the list, until a round returns
// too few new ones to bother continuing (diminishing returns) or the round
// cap is hit. Exhaustive-leaning, not popularity-filtered — a real word
// can't hurt an exact-match wordlist, only help it.
//
// Usage: node scripts/generate-catblitz-wordlists.js [category ...]
//   (no args = all categories in data/catblitz/categories.json)
// Requires: ANTHROPIC_API_KEY in a .env file at the repo root (KEY=VALUE,
// one per line — no dotenv package in this repo, loaded manually below).

const fs = require("fs");
const path = require("path");

// ── minimal .env loader (no dotenv dependency) ─────────────────────────────
const ENV_PATH = path.join(__dirname, "../.env");
if (fs.existsSync(ENV_PATH)) {
  fs.readFileSync(ENV_PATH, "utf8").split("\n").forEach(line => {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim();
  });
}

const Anthropic = require("@anthropic-ai/sdk");
const client = new Anthropic();

const DATA_DIR = path.join(__dirname, "../data/catblitz");
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const CALL_DELAY_MS = 350;
const MAX_ROUNDS = 5;        // hard cap on API calls per letter
const MIN_NEW_TO_CONTINUE = 6; // stop early once a round barely adds anything

const NOUNS = {
  name: "real human first names (given names) from anywhere in the world, in Latin-script spelling — mix of Western/English names and names from other cultures/languages, including common nicknames",
  animal: "real animal names (species, or well-known dog/cat breeds)",
  place: "real places — cities, countries, regions, continents, landmarks, bodies of water",
  thing: "real everyday nouns — ordinary physical objects (no proper nouns, no rare technical jargon)",
  food: "real foods — fruits, vegetables, dishes, snacks, or drinks, from any cuisine",
};

function cleanWord(raw) {
  const w = String(raw || "").trim().toLowerCase().replace(/^[-*\d.)\s]+/, "").replace(/\s+/g, " ");
  if (!/^[a-z][a-z' .-]*[a-z.]$|^[a-z]$/.test(w)) return null;
  if (w.length < 2 || w.length > 28) return null;
  return w;
}

async function generateRound(categoryId, letter, exclude) {
  const noun = NOUNS[categoryId];
  if (!noun) return [];
  const excludeSample = [...exclude].slice(-150).join(", "); // cap prompt size
  const prompt = `List as many DIFFERENT ${noun} as you genuinely can, starting with the letter "${letter}". Go for real coverage, not just the most famous ones — include less-common but still real entries too. Do not repeat any of these already-listed ones: ${excludeSample || "(none yet)"}. One per line, lowercase, no numbering, no explanations, no commentary — just the list.`;
  // 60s per-request timeout — without this, an occasional stuck request can
  // hang for many minutes inside the SDK's own retry logic, silently
  // stalling the whole run with no way to tell "slow" from "dead" from the
  // outside. A timeout throws (caught by the caller), which just skips that
  // round and moves on rather than needing a manual kill/restart.
  const resp = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  }, { timeout: 60000 });
  const words = resp.content[0].text.split("\n")
    .map(cleanWord)
    .filter(w => w && w[0] === letter.toLowerCase());
  return [...new Set(words)];
}

async function processLetter(categoryId, letter, data) {
  const existing = new Set(data[letter] || []);
  const startCount = existing.size;
  let totalNew = 0;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    let words;
    try {
      words = await generateRound(categoryId, letter, existing);
    } catch (err) {
      // A timeout/error on this round shouldn't lose earlier rounds' real
      // progress for this letter — just stop here and keep what we have.
      break;
    }
    const newOnes = words.filter(w => !existing.has(w));
    newOnes.forEach(w => existing.add(w));
    totalNew += newOnes.length;
    if (newOnes.length < MIN_NEW_TO_CONTINUE) break; // diminishing returns
    await new Promise(r => setTimeout(r, CALL_DELAY_MS));
  }

  data[letter] = [...existing].sort();
  return { startCount, endCount: existing.size, added: totalNew };
}

async function processCategory(categoryId, onlyLetters) {
  const filePath = path.join(DATA_DIR, `${categoryId}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`  ${categoryId}: no seed file at data/catblitz/${categoryId}.json — run build-catblitz-seed-lists.js first, skipping`);
    return;
  }
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

  const letters = onlyLetters && onlyLetters.length ? ALPHABET.filter(l => onlyLetters.includes(l)) : ALPHABET;
  console.log(`\n${categoryId.toUpperCase()}${onlyLetters ? ` (letters: ${letters.join(",")})` : ""}`);
  for (const letter of letters) {
    process.stdout.write(`  [${letter}] `);
    try {
      const { startCount, endCount, added } = await processLetter(categoryId, letter, data);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`${startCount} → ${endCount} (+${added})`);
    } catch (err) {
      console.log(`✗ ${err.message}`);
    }
  }
}

async function main() {
  const categories = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "categories.json"), "utf8")).map(c => c.id);
  const args = process.argv.slice(2);
  // Optional --letters=X,Y,Z to target specific letters (e.g. resuming after
  // a stuck/killed run instead of redoing the whole alphabet).
  const lettersArg = args.find(a => a.startsWith("--letters="));
  const onlyLetters = lettersArg ? lettersArg.slice("--letters=".length).toUpperCase().split(",") : null;
  const requested = args.filter(a => !a.startsWith("--letters="));
  const toRun = requested.length ? categories.filter(c => requested.includes(c)) : categories;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set — check .env at the repo root.");
    process.exit(1);
  }

  console.log(`Maximizing coverage for: ${toRun.join(", ")}`);
  for (const categoryId of toRun) {
    await processCategory(categoryId, onlyLetters);
  }
  console.log("\nDone.");
}

main().catch(console.error);
