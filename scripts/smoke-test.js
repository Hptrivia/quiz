#!/usr/bin/env node
// Smoke test for every game mode.
//
// Spins up a local static server, opens each mode in a headless browser,
// plays through it, and FAILS the mode if either:
//   (a) any uncaught JS error fires while playing (e.g. a ReferenceError in a
//       click handler — the exact class of bug that broke the challenge result
//       screen), or
//   (b) the mode never reaches its end/result state.
//
// Usage:  node scripts/smoke-test.js
//         node scripts/smoke-test.js challenge survival   (run only some modes)
//
// Exit code 0 = all passed, 1 = at least one mode failed.

const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = 8099;
const BASE = `http://localhost:${PORT}`;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.txt': 'text/plain',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2',
};

const wait = ms => new Promise(r => setTimeout(r, ms));

// ---- tiny static server -----------------------------------------------------
function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      const filePath = path.join(ROOT, urlPath);
      if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(PORT, () => resolve(server));
  });
}

// ---- in-page interaction helpers -------------------------------------------
const isVisible = (page, sel) => page.evaluate(s =>
  [...document.querySelectorAll(s)].some(e => e.offsetParent !== null), sel);

const clickFirst = (page, sel) => page.evaluate(s => {
  const el = [...document.querySelectorAll(s)].find(e => e.offsetParent !== null && !e.disabled);
  if (el) { el.click(); return true; }
  return false;
}, sel);

const clickText = (page, text) => page.evaluate(t => {
  const el = [...document.querySelectorAll('button, a')]
    .find(b => b.offsetParent !== null && !b.disabled && b.textContent.trim() === t);
  if (el) { el.click(); return true; }
  return false;
}, text);

// click an on-screen Wordle keyboard key by its label
const clickKey = (page, label) => page.evaluate(t => {
  const el = [...document.querySelectorAll('.wordle-key')]
    .find(b => b.textContent.trim() === t);
  if (el) { el.click(); return true; }
  return false;
}, label);

// ---- mode drivers -----------------------------------------------------------
// Wait up to `ms` for a selector to become visible (polling).
async function waitVisible(page, sel, ms = 4000) {
  const step = 200;
  for (let t = 0; t < ms; t += step) {
    if (await isVisible(page, sel)) return true;
    await wait(step);
  }
  return isVisible(page, sel);
}

// Standard quiz: pick an option, Submit, Next, repeat until the result box shows.
async function playQuiz(page, endSel, maxQ = 120) {
  const OPTS = '.option-btn, .daily-option-btn';
  for (let i = 0; i < maxQ; i++) {
    if (await isVisible(page, endSel)) return true;
    await clickFirst(page, OPTS);   // select an answer
    await wait(40);
    await clickText(page, 'Submit'); // submit (no-op for modes that auto-grade)
    await wait(60);
    // advance: standard "Next", or Daily's "Next →"/"See Results" button by id
    if (!(await clickText(page, 'Next'))) await clickFirst(page, '#dailyNextBtn');
    await wait(80);
  }
  return isVisible(page, endSel);
}

// Challenge: play through to `targetRound`, clicking "Next Round" between rounds.
// Round 2 is the one that matters — that's when `safeRound % 2 === 0` turns on the
// rewarded-gate markers + Next Round data-rewarded-href, the cadence a single-round
// test never reaches. (It's also where limited web now pops the app-install wall,
// so the result screen at round 2 is the end of the line on web.) On web the
// rewarded click handler no-ops, so "Next Round" is a plain link we follow by URL.
async function playChallengeRounds(page, endSel, targetRound = 2) {
  for (let r = 1; r <= targetRound; r++) {
    if (!await playQuiz(page, endSel)) return false;
    if (r === targetRound) break;
    const href = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a')].find(x => x.textContent.trim() === 'Next Round');
      return a ? a.getAttribute('href') : null;
    });
    if (!href) return false; // theme ran out of rounds before reaching the target
    await page.goto(new URL(href, page.url()).href, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(200);
  }
  return isVisible(page, endSel);
}

// Wordle: burn six guesses to force the result panel (we don't know the word, so
// we either lose all six or stumble into a win — both reach the result).
// Daily Wordle validates guesses against a dictionary, so pass real words via
// `validWords`; regular Wordle skips validation, so junk letters work there.
async function playWordle(page, endSel, validWords) {
  const len = await page.evaluate(() => {
    const row = document.querySelector('.wordle-row');
    return row ? row.querySelectorAll('.wordle-tile').length : 5;
  });
  const pool = 'QWXZVBN';
  for (let g = 0; g < 6; g++) {
    if (await isVisible(page, endSel)) break;
    const word = validWords && validWords[g];
    if (word && word.length === len) {
      for (const ch of word) await clickKey(page, ch);
    } else {
      for (let i = 0; i < len; i++) await clickKey(page, pool[(g + i) % pool.length]);
    }
    await clickKey(page, 'ENTER');
    await wait(900); // tile flip animation
  }
  // result panel appears a beat after the final flip — poll for it
  return waitVisible(page, endSel, 4000);
}

// Trivia Rush: timed, auto-advances. Keep tapping answers until game over.
async function playTriviaRush(page, endSel) {
  await clickFirst(page, '#trStartBtn');
  await wait(400);
  for (let i = 0; i < 80; i++) {
    if (await isVisible(page, endSel)) return true;
    await clickFirst(page, '.tr-option-btn');
    await wait(350);
  }
  return isVisible(page, endSel);
}

// Versus: start with default player names, play turns. End detection is loose,
// so this mode passes primarily on "no JS error during real play".
async function playVersus(page) {
  await clickFirst(page, '#vsStartBtn');
  await wait(400);
  for (let i = 0; i < 40; i++) {
    await clickFirst(page, '.option-btn');
    await wait(40);
    await clickFirst(page, '#vsSubmitBtn');
    await wait(60);
    await clickFirst(page, '#vsNextBtn');
    await wait(80);
    // stop once the steal/next flow stalls (no more visible play buttons)
    const playing = await isVisible(page, '.option-btn') ||
                    await isVisible(page, '#vsNextBtn') ||
                    await isVisible(page, '#vsSubmitBtn');
    if (!playing) break;
  }
  return true; // success = no pageerror (checked by runner)
}

function buildModes(themes) {
  const a = themes[0], b = themes[1];
  // `themes` is an array of slug strings, so match the slug directly (the old
  // `t.slug === 'friends'` was always undefined → fell back to themes[0]=`bible`,
  // which has no episode data, so the episode test could never reach the end).
  const ep = themes.includes('friends') ? 'friends' : a;
  return [
    { name: 'marathon',        url: `play.html?theme=${a}`,            run: p => playQuiz(p, '#resultBox') },
    { name: 'marathon-mashup', url: `play.html?themes=${a},${b}`,      run: p => playQuiz(p, '#resultBox') },
    { name: 'challenge',       url: `challenge.html?theme=${a}&round=1`, run: p => playChallengeRounds(p, '#challengeResultBox') },
    { name: 'challenge-mashup',url: `challenge.html?themes=${a},${b}`, run: p => playChallengeRounds(p, '#challengeResultBox') },
    { name: 'survival',        url: `survival.html?theme=${a}`,        start: '[data-difficulty="mixed"]', run: p => playQuiz(p, '#survivalResultBox') },
    { name: 'survival-mashup', url: `survival.html?themes=${a},${b}`,  start: '[data-difficulty="mixed"]', run: p => playQuiz(p, '#survivalResultBox') },
    { name: 'episode',         url: `episode.html?theme=${ep}&episode=1`, run: p => playQuiz(p, '#episodeResultBox') },
    { name: 'daily-trivia',    url: `daily.html`,                      run: p => playQuiz(p, '#dailyResult') },
    { name: 'trivia-rush',     url: `trivia-rush.html?theme=${a}`,     run: p => playTriviaRush(p, '#trGameOverBox') },
    { name: 'trivia-rush-mashup', url: `mashup-trivia-rush.html?themes=${a},${b}`, run: p => playTriviaRush(p, '#trGameOverBox') },
    { name: 'versus',          url: `versus.html`,                     run: p => playVersus(p) },
    { name: 'wordle',          url: `wordle.html?theme=${ep}`,         run: p => playWordle(p, '#wordleResultPanel') },
    { name: 'wordle-mashup',   url: `wordle.html?themes=${a},${b}`,    run: p => playWordle(p, '#wordleResultPanel') },
    { name: 'daily-wordle',    url: `daily-wordle.html`,               run: p => playWordle(p, '#dwResult', ['CRANE','SLATE','MOUNT','BRICK','PLUMB','GHOST']) },
    { name: 'wordsearch',      url: `wordsearch.html?theme=${ep}`,     run: async p => {
        // load + render check only (solving a grid via drag is too brittle)
        await wait(600);
        return p.evaluate(() => { const g = document.getElementById('wsGrid'); return !!g && g.children.length > 0; });
      } },
  ];
}

// ---- data integrity (no browser) -------------------------------------------
// Every theme needs a parseable, non-empty question file plus wordle + wordsearch
// word lists. A single malformed file (e.g. a stray trailing comma) silently loads
// as an empty theme — which breaks that theme's games and short-changes any mashup
// that includes it. Wordle/wordsearch are single aggregate files keyed by theme
// TITLE (allData[theme.title]), matching how wordle.js / wordsearch.js look them up.
function validateData() {
  const problems = [];
  const read = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

  let themes;
  try { themes = read('data/themes.json'); }
  catch (e) { return [`data/themes.json — invalid JSON: ${e.message}`]; }

  let wordle = {}, wordsearch = {};
  try { wordle = read('data/wordle_words.txt'); }
  catch (e) { problems.push(`data/wordle_words.txt — invalid JSON: ${e.message}`); }
  try { wordsearch = read('data/wordsearch_words.json'); }
  catch (e) { problems.push(`data/wordsearch_words.json — invalid JSON: ${e.message}`); }

  for (const t of themes) {
    // Question file: present, parseable, non-empty array.
    if (!t.questionFile) {
      problems.push(`${t.slug} — no questionFile in themes.json`);
    } else if (!fs.existsSync(path.join(ROOT, t.questionFile))) {
      problems.push(`${t.slug} — questionFile missing: ${t.questionFile}`);
    } else {
      try {
        const q = read(t.questionFile);
        const arr = Array.isArray(q) ? q : (q && q.questions);
        if (!Array.isArray(arr)) problems.push(`${t.slug} — ${t.questionFile}: not a question array`);
        else if (!arr.length)    problems.push(`${t.slug} — ${t.questionFile}: empty (0 questions)`);
      } catch (e) {
        problems.push(`${t.slug} — ${t.questionFile}: invalid JSON (${e.message})`);
      }
    }
    // Wordle + wordsearch word lists (keyed by title).
    if (!Array.isArray(wordle[t.title]) || !wordle[t.title].length)
      problems.push(`${t.slug} — no wordle words (key "${t.title}")`);
    if (!Array.isArray(wordsearch[t.title]) || !wordsearch[t.title].length)
      problems.push(`${t.slug} — no wordsearch words (key "${t.title}")`);
  }
  return problems;
}

async function runMode(browser, mode) {
  // Fresh context per mode = isolated localStorage (no resume/session leakage).
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));

  let reached = false, crashed = null;
  try {
    await page.goto(`${BASE}/${mode.url}`, { waitUntil: 'networkidle2', timeout: 30000 });
    if (mode.start) { await wait(500); await clickFirst(page, mode.start); await wait(400); }
    reached = await mode.run(page);
  } catch (e) {
    crashed = e.message;
  }
  await context.close();

  const ok = errors.length === 0 && reached && !crashed;
  return { name: mode.name, ok, reached, errors, crashed };
}

async function main() {
  const filter = process.argv.slice(2);

  // Data integrity first — fast, no browser needed.
  const dataProblems = validateData();
  console.log(`\nData integrity: ${dataProblems.length ? `${dataProblems.length} problem(s)` : 'all theme files valid'}`);
  dataProblems.forEach(p => console.log(`  FAIL  ${p}`));
  // If themes.json itself is unparseable we can't build the mode tests.
  let themes;
  try {
    themes = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'themes.json'), 'utf8')).map(t => t.slug);
  } catch {
    console.log('\nResults: cannot run mode tests — data/themes.json is invalid\n');
    process.exit(1);
  }

  const server = await startServer();
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  let modes = buildModes(themes);
  if (filter.length) modes = modes.filter(m => filter.includes(m.name));

  console.log(`\nRunning ${modes.length} game-mode smoke tests...\n`);
  const results = [];
  for (const mode of modes) {
    const r = await runMode(browser, mode);
    results.push(r);
    const mark = r.ok ? ' OK ' : 'FAIL';
    let line = `  ${mark}  ${mode.name}`;
    if (!r.ok) {
      if (r.crashed)             line += `  — driver error: ${r.crashed}`;
      else if (r.errors.length)  line += `  — JS error: ${r.errors[0]}`;
      else if (!r.reached)       line += `  — never reached end screen`;
    }
    console.log(line);
  }

  await browser.close();
  server.close();

  const failed = results.filter(r => !r.ok);
  console.log(`\nResults: ${results.length - failed.length} passed, ${failed.length} failed; data problems: ${dataProblems.length}\n`);
  process.exit(failed.length + dataProblems.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
