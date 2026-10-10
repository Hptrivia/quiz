#!/usr/bin/env node
// Balance checker for "Which Character Are You?" quizzes (data/character-quizzes/*.json).
//
// 1. Structure: ids valid, 4 options per question, every character used.
// 2. Every-combination test: tries ALL 4^N answer combinations and prints how
//    often each character wins. Fails if any character is unreachable (too rare)
//    or dominates (limits scale with cast size, see minShare/maxShare).
// 3. Persona test: simulates people who genuinely answer like a character
//    (pick that character's best option 70% of the time, random otherwise) and
//    checks they actually get that character — i.e. the quiz can tell the cast
//    apart, it isn't just balanced noise.
//
// Usage: node scripts/validate-character-quizzes.js [slug]
// Writes the measured odds into data/character-quizzes/<slug>.stats.json, which
// the page generator uses for the "rarest result" FAQ.

const fs = require("fs");
const path = require("path");
const { scoreAnswers, tieSeed } = require("../assets/character-quiz-score.js");

const DIR = path.join(__dirname, "..", "data", "character-quizzes");
// Limits scale with cast size: 7-8 characters → 5%-25%; 5 characters → 8%-30%.
const minShare = n => Math.max(0.05, 0.4 / n);
const maxShare = n => Math.max(0.25, 1.5 / n);
const PERSONA_FIDELITY = 0.7;
const PERSONA_TARGET = 0.6;
const PERSONA_RUNS = 20000;

function checkStructure(quiz) {
  const errs = [];
  const ids = new Set(quiz.characters.map(c => c.id));
  const used = new Set();
  quiz.questions.forEach((q, qi) => {
    if (q.options.length !== 4) errs.push(`Q${qi + 1}: expected 4 options, got ${q.options.length}`);
    q.options.forEach((o, oi) => {
      for (const id of Object.keys(o.points)) {
        if (!ids.has(id)) errs.push(`Q${qi + 1} option ${oi + 1}: unknown character "${id}"`);
        used.add(id);
      }
    });
  });
  for (const id of ids) if (!used.has(id)) errs.push(`Character "${id}" never gets points`);
  for (const c of quiz.characters) {
    for (const f of ["name", "title", "summary", "description", "strengths", "flaw", "signature", "clashReason"]) {
      if (!c[f] || (Array.isArray(c[f]) && !c[f].length)) errs.push(`Character "${c.id}" missing ${f}`);
    }
  }
  return errs;
}

// Exhaustive search with running totals (fast enough for 4^12 ≈ 16.7M).
function exhaustive(quiz) {
  const ids = quiz.characters.map(c => c.id);
  const n = ids.length;
  const Q = quiz.questions.length;
  const pts = quiz.questions.map(q => q.options.map(o => {
    const a = new Int32Array(n);
    ids.forEach((id, i) => { a[i] = o.points[id] || 0; });
    return a;
  }));
  const totals = new Int32Array(n);
  const wins = new Float64Array(n);
  const answers = new Array(Q).fill(0);
  const tied = new Int32Array(n);
  let combos = 0;
  (function go(q) {
    if (q === Q) {
      let best = -1, t = 0;
      for (let i = 0; i < n; i++) {
        if (best < 0 || totals[i] > totals[tied[0]]) { best = i; t = 0; tied[t++] = i; }
        else if (totals[i] === totals[tied[0]]) tied[t++] = i;
      }
      // Same tie rule as the browser (character-quiz-score.js).
      const winner = t > 1 ? tied[tieSeed(answers) % t] : tied[0];
      wins[winner]++;
      combos++;
      return;
    }
    for (let o = 0; o < 4; o++) {
      const p = pts[q][o];
      answers[q] = o;
      for (let i = 0; i < n; i++) totals[i] += p[i];
      go(q + 1);
      for (let i = 0; i < n; i++) totals[i] -= p[i];
    }
  })(0);
  return Object.fromEntries(ids.map((id, i) => [id, wins[i] / combos]));
}

function persona(quiz) {
  const out = {};
  for (const c of quiz.characters) {
    let hit = 0;
    for (let r = 0; r < PERSONA_RUNS; r++) {
      const answers = quiz.questions.map(q => {
        if (Math.random() < PERSONA_FIDELITY) {
          const best = Math.max(...q.options.map(o => o.points[c.id] || 0));
          const top = q.options.map((o, i) => [o, i]).filter(([o]) => (o.points[c.id] || 0) === best);
          return top[Math.floor(Math.random() * top.length)][1];
        }
        return Math.floor(Math.random() * 4);
      });
      if (scoreAnswers(quiz, answers).primary === c.id) hit++;
    }
    out[c.id] = hit / PERSONA_RUNS;
  }
  return out;
}

// Player-experience warnings (don't fail the build, but should be looked at):
// give-away answers, two answers for the same character, characters with too
// few chances, and wording slips.
function primaryOf(o) {
  let best = null;
  for (const [id, pts] of Object.entries(o.points)) if (!best || pts > best[1]) best = [id, pts];
  return best;
}
function checkPlayerExperience(quiz) {
  const warns = [];
  const primaryCount = Object.fromEntries(quiz.characters.map(c => [c.id, 0]));
  quiz.questions.forEach((q, qi) => {
    const lens = q.options.map(o => o.text.length);
    const sorted = [...lens].sort((a, b) => a - b);
    const median = (sorted[1] + sorted[2]) / 2;
    lens.forEach((l, oi) => {
      if (l > median * 2 && l - median > 25) warns.push(`Q${qi + 1} option ${oi + 1} is much longer than the others (${l} vs ~${Math.round(median)} chars) — may stand out`);
    });
    const prim = q.options.map(o => primaryOf(o));
    const seen = {};
    prim.forEach(([id, pts], oi) => {
      if (pts >= 3) primaryCount[id]++;
      if (pts >= 3 && seen[id] !== undefined) warns.push(`Q${qi + 1}: options ${seen[id] + 1} and ${oi + 1} both mainly score ${id}`);
      if (pts >= 3) seen[id] = oi;
    });
  });
  // Main-pick count also credits 2-point splits as half a chance.
  quiz.questions.forEach(q => q.options.forEach(o => {
    for (const [id, pts] of Object.entries(o.points)) if (pts === 2) primaryCount[id] += 0.5;
  }));
  for (const [id, n] of Object.entries(primaryCount)) if (n < 3) warns.push(`${id} is the main pick in only ${n} questions — fans of this character may struggle to get it`);
  const texts = [quiz.intro, quiz.metaDescription, ...quiz.questions.flatMap(q => [q.text, ...q.options.map(o => o.text)]),
    ...quiz.characters.flatMap(c => [c.title, c.summary, ...c.description, ...c.strengths, c.flaw, c.signature, c.clashReason])];
  texts.forEach(t => {
    if (/\bthe The\b/.test(t)) warns.push(`"the The" in: ${t.slice(0, 60)}`);
    if (/ {2,}/.test(t)) warns.push(`double space in: ${t.slice(0, 60)}`);
    if (/\b(\w+) \1\b/i.test(t) && !/cool cool|very, very|no doubt, no doubt|love love|you you're/i.test(t)) warns.push(`repeated word in: ${t.slice(0, 60)}`);
    if ((t.match(/"/g) || []).length % 2) warns.push(`unbalanced quote marks in: ${t.slice(0, 60)}`);
  });
  return warns;
}

// Generic, show-agnostic question templates. A quiz may use at most
// MAX_GENERIC of them — everything else must be a scene from the show.
const GENERIC_PATTERNS = [
  /biggest (flaw|weakness)/i, /how do people (see|describe) you/i, /what would your (friends|co-workers)/i,
  /what do people love (most )?about you/i, /which line sounds/i, /what drives you/i, /what matters most/i,
  /what do you (really|secretly) want/i, /what keeps you going/i, /dream (job|career)/i, /^pick a (job|hobby|pet|signature|weapon|snack|superpower|motto|food|outfit|place|companion|treat|colou?r|lunch|car|skill|class|comfort|music|rule|dream|magical|way|friday|saturday|off-duty|movie|gift)/i,
  /your ideal (saturday|lunch|evening)/i, /how do you show (love|you care)/i, /your role in (a|your) (team|friend group|group)/i,
];
const MAX_GENERIC = 2;
function genericQuestions(quiz) {
  return quiz.questions.map((q, i) => [i, q.text]).filter(([, t]) => GENERIC_PATTERNS.some(re => re.test(t)));
}

function pct(x) { return (x * 100).toFixed(1).padStart(5) + "%"; }

function validate(file) {
  const quiz = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(`\n=== ${quiz.show} (${quiz.questions.length} questions, ${quiz.characters.length} characters) ===`);
  let ok = true;

  const errs = checkStructure(quiz);
  errs.forEach(e => console.log("  ✗ " + e));
  if (errs.length) return false;
  checkPlayerExperience(quiz).forEach(w => console.log("  ⚠ " + w));
  const gen = genericQuestions(quiz);
  if (gen.length > MAX_GENERIC) {
    ok = false;
    console.log(`  ✗ ${gen.length} generic questions (max ${MAX_GENERIC}) — rewrite as scenes from the show:`);
    gen.forEach(([i, t]) => console.log(`      Q${i + 1}: ${t}`));
  }
  for (const q of quiz.questions) {
    const others = (ALL_QUESTION_TEXTS.get(q.text.toLowerCase()) || []).filter(s => s !== quiz.slug);
    // Allowed (a question that genuinely fits two shows can be reused), just flagged so it's a conscious choice.
    if (others.length) console.log(`  ⚠ Same question also used in: ${others.join(", ")} — "${q.text}"`);
  }

  const share = exhaustive(quiz);
  const pers = persona(quiz);
  console.log("  Character            All-combos  Answers-like-them");
  for (const c of quiz.characters) {
    const s = share[c.id], p = pers[c.id];
    const flags = [];
    if (s < minShare(quiz.characters.length)) flags.push("TOO RARE");
    if (s > maxShare(quiz.characters.length)) flags.push("DOMINATES");
    if (p < PERSONA_TARGET) flags.push("HARD TO REACH");
    if (flags.length) ok = false;
    console.log(`  ${c.name.padEnd(20)} ${pct(s)}      ${pct(p)}   ${flags.join(", ")}`);
  }
  console.log(ok ? "  ✓ balanced" : "  ✗ needs tuning");

  const statsPath = file.replace(/\.json$/, ".stats.json");
  fs.writeFileSync(statsPath, JSON.stringify({ share, persona: pers, checked: new Date().toISOString().slice(0, 10) }, null, 2) + "\n");
  return ok;
}

// Every question text across ALL quizzes, to catch copy-paste between shows.
const ALL_QUESTION_TEXTS = new Map();
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith(".json") && !f.endsWith(".stats.json"))) {
  const qz = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
  for (const q of qz.questions) {
    const k = q.text.toLowerCase();
    if (!ALL_QUESTION_TEXTS.has(k)) ALL_QUESTION_TEXTS.set(k, []);
    ALL_QUESTION_TEXTS.get(k).push(qz.slug);
  }
}

const only = process.argv[2];
const files = fs.readdirSync(DIR)
  .filter(f => f.endsWith(".json") && !f.endsWith(".stats.json"))
  .filter(f => !only || f === `${only}.json`)
  .map(f => path.join(DIR, f));
if (!files.length) { console.error("No quiz files found"); process.exit(1); }
const allOk = files.map(validate).every(Boolean);
process.exit(allOk ? 0 : 1);
