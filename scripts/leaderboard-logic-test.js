#!/usr/bin/env node
// Business-logic tests for the Daily Trivia / Daily Wordle leaderboard math —
// separate from scripts/smoke-test.js, which only checks that each mode
// reaches its end screen without a JS error. This file exercises the actual
// exported functions (dcGetLifetimeScore, updateDWStreak, etc.) with
// controlled inputs so the scoring/streak/exclusion rules are asserted
// directly, not inferred from a randomly-played quiz.
//
// Never hits the live Supabase leaderboard table: window.lbSubmit /
// window.lbShowSubmit are stubbed out before any code path that could call
// them, so this can run repeatedly without leaving fake rows in production
// data.
//
// Usage:  node scripts/leaderboard-logic-test.js
// Exit code 0 = all passed, 1 = at least one failed.

const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = 8098; // distinct from smoke-test.js's 8099 so both can run concurrently
const BASE = `http://localhost:${PORT}`;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.txt': 'text/plain',
};

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

const wait = ms => new Promise(r => setTimeout(r, ms));

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
function assertTrue(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ---- fake clock: Date reads window.__fakeDateISO from localStorage, falling
// back to the real clock if unset. Install once per page; change the date
// before any navigation by registering another init script that overwrites
// the stored ISO string (init scripts run in registration order, so the
// most-recently-added one wins by the time the page's own scripts run). ----
async function installFakeDateClass(page) {
  await page.evaluateOnNewDocument(() => {
    const OrigDate = Date;
    class FakeDate extends OrigDate {
      constructor(...args) {
        if (args.length === 0) {
          const stored = window.localStorage.getItem('__fakeDateISO');
          super(stored ? new OrigDate(stored).getTime() : OrigDate.now());
        } else {
          super(...args);
        }
      }
      static now() {
        const stored = window.localStorage.getItem('__fakeDateISO');
        return stored ? new OrigDate(stored).getTime() : OrigDate.now();
      }
    }
    window.Date = FakeDate;
  });
}

async function setFakeDateForNextNav(page, iso) {
  await page.evaluateOnNewDocument((iso) => { window.localStorage.setItem('__fakeDateISO', iso); }, iso);
}

// Stub the leaderboard network functions so no test ever writes a real row
// to the production Supabase table. Call AFTER leaderboard.js has already
// defined the real lbSubmit/lbShowSubmit (i.e. after page.goto resolves) —
// this just reassigns the globals.
async function stubLeaderboardCalls(page) {
  await page.evaluate(() => {
    window.__lbCalls = [];
    window.lbSubmit = (...args) => { window.__lbCalls.push(['lbSubmit', ...args]); return Promise.resolve([]); };
    window.lbShowSubmit = (slug) => { window.__lbCalls.push(['lbShowSubmit', slug]); };
  });
}

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`   OK   ${name}`);
  } catch (e) {
    results.push({ name, ok: false, err: e.message });
    console.log(`  FAIL  ${name}  — ${e.message}`);
  }
}

async function main() {
  const server = await startServer();
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  console.log('\nRunning leaderboard-logic tests...\n');

  // ── Test 1: cumulative lifetime score carries across days ──────────────
  await test('daily-trivia lifetime score accumulates across two days', async () => {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await installFakeDateClass(page);
    await setFakeDateForNextNav(page, '2026-09-10T12:00:00Z');
    await page.goto(`${BASE}/daily.html`, { waitUntil: 'networkidle2', timeout: 30000 });

    const day1Total = await page.evaluate(() => window.saveDailyResult(7, 10, []).lifetimeScore);
    assertEqual(day1Total, 7, 'day 1: lifetimeScore after first play');
    assertEqual(await page.evaluate(() => window.dcGetLifetimeScore()), 7, 'day 1: dcGetLifetimeScore()');

    await setFakeDateForNextNav(page, '2026-09-11T12:00:00Z'); // next day
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });

    const day2Total = await page.evaluate(() => window.saveDailyResult(5, 10, []).lifetimeScore);
    assertEqual(day2Total, 12, 'day 2: lifetimeScore should be day1 + day2 (7+5)');
    assertEqual(await page.evaluate(() => window.dcGetLifetimeScore()), 12, 'day 2: dcGetLifetimeScore()');

    await context.close();
  });

  // ── Test 2: backfill from dcHistory when dcLifetimeScore was never set ──
  await test('daily-trivia lifetime score backfills from existing dcHistory', async () => {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const history = JSON.stringify([
      { date: '2026-09-01', score: 5, total: 10 },
      { date: '2026-09-02', score: 3, total: 10 },
      { date: '2026-09-03', score: 7, total: 10 },
    ]); // sums to 15
    await page.evaluateOnNewDocument((h) => { window.localStorage.setItem('dcHistory', h); }, history);
    await page.goto(`${BASE}/daily.html`, { waitUntil: 'networkidle2', timeout: 30000 });

    assertEqual(await page.evaluate(() => window.dcGetLifetimeScore()), 15, 'backfilled lifetime score');
    assertEqual(
      await page.evaluate(() => window.localStorage.getItem('dcLifetimeScore')),
      '15',
      'dcLifetimeScore should now be persisted, not recomputed every read'
    );

    await context.close();
  });

  // ── Test 3: Wordle hint confirm() actually blocks the reveal ───────────
  await test('daily-wordle hint confirm() blocks reveal on Cancel, allows it on OK', async () => {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    let dialogAccept = false;
    page.on('dialog', async d => { await (dialogAccept ? d.accept() : d.dismiss()); });

    await page.goto(`${BASE}/daily-wordle.html`, { waitUntil: 'networkidle2', timeout: 30000 });
    for (let i = 0; i < 20 && !(await page.$('#dwRevealBtn')); i++) await wait(200);

    const before = await page.evaluate(() => document.getElementById('dwRevealBtn').textContent);
    assertTrue(before.includes('2 left'), `expected 2 reveals left before any use, got "${before}"`);

    dialogAccept = false; // Cancel
    await page.click('#dwRevealBtn');
    await wait(300);
    const afterCancel = await page.evaluate(() => document.getElementById('dwRevealBtn').textContent);
    assertTrue(afterCancel.includes('2 left'), `Cancel should not consume a reveal, got "${afterCancel}"`);

    dialogAccept = true; // OK
    await page.click('#dwRevealBtn');
    await wait(300);
    const afterAccept = await page.evaluate(() => document.getElementById('dwRevealBtn').textContent);
    assertTrue(afterAccept.includes('1 left'), `OK should consume one reveal, got "${afterAccept}"`);

    await context.close();
  });

  // ── Test 4: a hinted solve never reaches the leaderboard submit path ────
  await test('daily-wordle excludes hinted solves from the leaderboard submission', async () => {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    page.on('dialog', d => d.accept());
    await page.goto(`${BASE}/daily-wordle.html`, { waitUntil: 'networkidle2', timeout: 30000 });
    await stubLeaderboardCalls(page);

    await page.evaluate(() => window.dwMaybeSubmitTodayGuesses(true, 3, 1)); // solved, 1 hint used
    let calls = await page.evaluate(() => window.__lbCalls);
    assertEqual(calls.length, 0, 'a hinted solve must not call lbSubmit/lbShowSubmit at all');

    await page.evaluate(() => window.dwMaybeSubmitTodayGuesses(true, 3, 0)); // solved, no hints
    calls = await page.evaluate(() => window.__lbCalls);
    assertEqual(calls.length, 1, 'a hint-free solve should reach the leaderboard submit path exactly once');
    assertEqual(calls[0][0], 'lbShowSubmit', 'with no saved profile name, it should ask via lbShowSubmit');
    assertEqual(calls[0][1], await page.evaluate(() => window.dwTodayLbSlug()), 'submitted under today\'s wordle slug');

    await context.close();
  });

  // ── Test 5: Wordle streak resets (not just stalls) after a missed day ──
  await test('daily-wordle streak resets to 1 after a missed day, best is preserved', async () => {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await installFakeDateClass(page);
    await setFakeDateForNextNav(page, '2026-09-10T12:00:00Z');
    await page.goto(`${BASE}/daily-wordle.html`, { waitUntil: 'networkidle2', timeout: 30000 });

    // Pretend they had a 5-day streak that last completed 2026-09-05 —
    // several days before "today" (2026-09-10), i.e. a missed day, not
    // yesterday.
    await page.evaluate(() => {
      window.localStorage.setItem('dwStreak', JSON.stringify({ current: 5, best: 5, lastCompleted: '2026-09-05' }));
    });

    const streak = await page.evaluate(() => window.updateDWStreak(true));
    assertEqual(streak.current, 1, 'missed day should reset current streak to 1, not continue from 5');
    assertEqual(streak.best, 5, 'best streak should be preserved through the reset');

    // Same-day re-call must be a no-op (shouldn't double count a single day).
    const again = await page.evaluate(() => window.updateDWStreak(true));
    assertEqual(again.current, 1, 'calling updateDWStreak twice on the same day must not increment twice');

    await context.close();
  });

  await browser.close();
  server.close();

  const failed = results.filter(r => !r.ok);
  console.log(`\nResults: ${results.length - failed.length} passed, ${failed.length} failed\n`);
  process.exit(failed.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
