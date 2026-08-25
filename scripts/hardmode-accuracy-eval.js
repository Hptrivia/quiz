#!/usr/bin/env node
// Scored accuracy eval for Hard Mode's typed-answer matcher (hm* functions
// in assets/app.js). Generates a battery of realistic typed-input variants
// per real answer in data/*.txt and checks each against the REAL matching
// logic (extracted from app.js, not duplicated) -- both variants that
// SHOULD pass (false-negative check) and variants that SHOULD fail
// (false-positive check). Prints pass rate per bucket + overall.
//
// Usage: node scripts/hardmode-accuracy-eval.js [--verbose]

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const APP_JS = path.join(__dirname, '..', 'assets', 'app.js');
const VERBOSE = process.argv.includes('--verbose');

// --- Load the real hm* matching logic straight out of app.js -------------
// Pure block: HM_KEY ... end of hmIsCorrect. No DOM/window/localStorage
// dependency in this range (confirmed by reading it).
function loadHmLogic() {
  const src = fs.readFileSync(APP_JS, 'utf8');
  const startMarker = "const HM_KEY = 'tg_hard_mode';";
  const endMarker = 'function hmRenderAnswerControl';
  const startIdx = src.indexOf(startMarker);
  const endIdx = src.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('hm* block markers not found in app.js -- did the code move?');
  }
  const block = src.slice(startIdx, endIdx);
  const exportedNames = [
    'hmNormalize', 'hmWordCount', 'hmShouldOfferTyped', 'hmContentWords',
    'hmFirstContentWord', 'hmIsNameOrTitleShaped', 'hmEditDistance',
    'hmTypoThreshold', 'hmFuzzyMatch', 'hmBuildWordCollisions', 'hmIsCorrect',
  ];
  const factory = new Function(`
    ${block}
    return { ${exportedNames.join(', ')} };
  `);
  return factory();
}

const hm = loadHmLogic();

// --- Load all real theme files --------------------------------------------
function loadThemes() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.txt'));
  const themes = [];
  for (const f of files) {
    let questions;
    try {
      questions = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
    } catch (e) {
      continue; // skip malformed/non-question files
    }
    if (!Array.isArray(questions)) continue;
    themes.push({ file: f, questions });
  }
  return themes;
}

// --- Variant generators -----------------------------------------------------
// Each generator takes the real answer string and returns either a single
// variant string or an array of variant strings, plus expectation.
// expect: true = should be marked correct, false = should be marked wrong.

const NUMBER_WORDS_REV = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five',
  '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten',
  '11': 'eleven', '12': 'twelve', '13': 'thirteen', '14': 'fourteen',
  '15': 'fifteen', '16': 'sixteen', '17': 'seventeen', '18': 'eighteen',
  '19': 'nineteen', '20': 'twenty', '30': 'thirty', '40': 'forty',
  '50': 'fifty', '60': 'sixty', '70': 'seventy', '80': 'eighty',
  '90': 'ninety', '100': 'hundred',
};

function dropOneLetter(word) {
  if (word.length < 3) return null;
  const i = Math.floor(word.length / 2);
  return word.slice(0, i) + word.slice(i + 1);
}

function transposeLetters(word) {
  if (word.length < 3) return null;
  const i = Math.floor(word.length / 2);
  return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
}

function substituteLetterMidword(word) {
  // Change a letter that is NOT the first character (respects the hard
  // first-char-must-match rule -- this variant should still PASS).
  if (word.length < 3) return null;
  const i = Math.floor(word.length / 2);
  const orig = word[i];
  const repl = orig === 'x' ? 'z' : 'x';
  return word.slice(0, i) + repl + word.slice(i + 1);
}

function wrongFirstLetter(word) {
  if (word.length < 2) return null;
  const orig = word[0];
  const repl = orig === 'z' ? 'y' : 'z';
  return repl + word.slice(1);
}

// hmContentWords returns NORMALIZED (lowercased) words, which don't
// string-match inside the original-case answer -- so mutations must be
// built by rejoining the normalized word list, not via answer.replace().
// Returns the mutated typed string, or null if no content word could be
// mutated (e.g. all too short).
function buildMutatedTyped(answer, mutateFn) {
  const normalizedWords = hm.hmNormalize(answer).split(' ').filter(Boolean);
  const contentWords = hm.hmContentWords(answer);
  const leadOffset = normalizedWords.length - contentWords.length;
  for (let i = 0; i < contentWords.length; i++) {
    const variant = mutateFn(contentWords[i]);
    if (variant) {
      const out = normalizedWords.slice();
      out[leadOffset + i] = variant;
      return out.join(' ');
    }
  }
  return null;
}

// Buckets: name -> function(answer, contentWords) -> [{typed, expect}]
const BUCKETS = {};

BUCKETS['exact'] = (answer) => [{ typed: answer, expect: true }];

BUCKETS['case-variants'] = (answer) => [
  { typed: answer.toUpperCase(), expect: true },
  { typed: answer.toLowerCase(), expect: true },
];

BUCKETS['extra-whitespace'] = (answer) => [
  { typed: `  ${answer}  `.replace(/ /g, '  '), expect: true },
];

BUCKETS['drop-leading-article'] = (answer) => {
  const m = /^(the|a|an)\s+(.+)$/i.exec(answer);
  if (!m) return [];
  return [{ typed: m[2], expect: true }];
};

BUCKETS['first-word-only'] = (answer, contentWords) => {
  if (contentWords.length < 2) return [];
  return [{ typed: contentWords[0], expect: true }];
};

BUCKETS['last-word-only'] = (answer, contentWords) => {
  if (contentWords.length < 2) return [];
  return [{ typed: contentWords[contentWords.length - 1], expect: true }];
};

BUCKETS['first-plus-last'] = (answer, contentWords) => {
  if (contentWords.length < 3) return [];
  return [{ typed: `${contentWords[0]} ${contentWords[contentWords.length - 1]}`, expect: true }];
};

BUCKETS['words-wrong-order'] = (answer, contentWords) => {
  if (contentWords.length !== 2) return [];
  return [{ typed: `${contentWords[1]} ${contentWords[0]}`, expect: false }];
};

BUCKETS['digit-to-word-number'] = (answer) => {
  const trimmed = answer.trim();
  if (!/^\d+$/.test(trimmed)) return [];
  const word = NUMBER_WORDS_REV[trimmed];
  if (!word) return [];
  return [{ typed: word, expect: true }];
};

BUCKETS['word-to-digit-number'] = (answer) => {
  const lower = answer.trim().toLowerCase();
  const digit = Object.keys(NUMBER_WORDS_REV).find(d => NUMBER_WORDS_REV[d] === lower);
  if (!digit) return [];
  return [{ typed: digit, expect: true }];
};

BUCKETS['missing-apostrophe'] = (answer) => {
  if (!answer.includes("'")) return [];
  return [{ typed: answer.replace(/'/g, ''), expect: true }];
};

BUCKETS['missing-diacritic'] = (answer) => {
  const stripped = answer.normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (stripped === answer) return [];
  return [{ typed: stripped, expect: true }];
};

BUCKETS['single-midword-typo-substitute'] = (answer) => {
  const typed = buildMutatedTyped(answer, substituteLetterMidword);
  return typed ? [{ typed, expect: true }] : [];
};

BUCKETS['single-dropped-letter'] = (answer) => {
  const typed = buildMutatedTyped(answer, dropOneLetter);
  return typed ? [{ typed, expect: true }] : [];
};

BUCKETS['single-transposed-letters'] = (answer) => {
  const typed = buildMutatedTyped(answer, transposeLetters);
  return typed ? [{ typed, expect: true }] : [];
};

// Decided 2026-08-25: plural/singular swaps SHOULD count as correct
// (dedicated exact-match exception in hmIsCorrect, see assets/app.js) --
// was an open question earlier, now settled.
BUCKETS['singular-plural'] = (answer) => {
  const trimmed = answer.trim();
  if (/s$/i.test(trimmed) && !/ss$/i.test(trimmed)) {
    return [{ typed: trimmed.slice(0, -1), expect: true }];
  }
  if (!/s$/i.test(trimmed) && /^[a-z]+$/i.test(trimmed)) {
    return [{ typed: trimmed + 's', expect: true }];
  }
  return [];
};

BUCKETS['skipped-title-prefix'] = (answer) => {
  const m = /^(Doctor|Dr|Mr|Mrs|Ms|Sir|Lord|Lady|Captain|President|King|Queen)\.?\s+(.+)$/i.exec(answer);
  if (!m) return [];
  return [{ typed: m[2], expect: true }];
};

// --- False positive checks --------------------------------------------------

// hmFuzzyMatch's hard first-char rule checks typed[0] vs target[0] on the
// WHOLE compared string. For the phrase-fallback path that's the first
// character of the whole normalized answer; for the single-word shortcut
// path it's the first character of the matched content word. Test both.
BUCKETS['wrong-first-letter'] = (answer) => {
  const normalizedWords = hm.hmNormalize(answer).split(' ').filter(Boolean);
  const out = [];
  const wholePhraseVariant = wrongFirstLetter(normalizedWords[0]);
  if (wholePhraseVariant) {
    const typed = [wholePhraseVariant, ...normalizedWords.slice(1)].join(' ');
    out.push({ typed, expect: false });
  }
  if (hm.hmIsNameOrTitleShaped(answer)) {
    const contentWords = hm.hmContentWords(answer);
    const shortcutVariant = wrongFirstLetter(contentWords[0]);
    if (shortcutVariant && contentWords.length > 1) {
      out.push({ typed: shortcutVariant, expect: false });
    }
  }
  return out;
};

BUCKETS['blank-input'] = () => [{ typed: '', expect: false }];

BUCKETS['whitespace-only-input'] = () => [{ typed: '   ', expect: false }];

BUCKETS['unrelated-word'] = (answer) => [
  { typed: 'zzz_unrelated_zzz', expect: false },
];

BUCKETS['different-same-first-letter'] = (answer) => {
  const normalizedWords = hm.hmNormalize(answer).split(' ').filter(Boolean);
  const first = normalizedWords[0];
  if (!first || first.length < 2) return [];
  // A plausible-but-wrong word sharing the first letter, far enough by edit
  // distance from the real word that it must fail.
  const fake = first[0] + 'x'.repeat(Math.max(3, first.length));
  const typed = [fake, ...normalizedWords.slice(1)].join(' ');
  return [{ typed, expect: false }];
};

// same-theme distractor variants are generated separately per theme (needs
// sibling answers), see runThemeCrossChecks below.

// --- Shape breakdown ---------------------------------------------------------
// Tags an answer with every shape it has (not mutually exclusive) so we can
// show, up front, what's actually in the real dataset -- proof the variant
// buckets above are exercising every shape that exists, not a guessed subset.
function classifyShape(answer, contentWords) {
  const tags = [];
  const trimmed = answer.trim();
  const wordCount = hm.hmWordCount(answer);
  tags.push(wordCount === 1 ? '1-word' : wordCount === 2 ? '2-word' : '3-word');
  if (/^\d+$/.test(trimmed)) tags.push('pure-number');
  if (hm.hmIsNameOrTitleShaped(answer)) tags.push('name/title-shaped');
  const normalizedWords = hm.hmNormalize(answer).split(' ').filter(Boolean);
  const first = (normalizedWords[0] || '').replace(/\.$/, '');
  if (wordCount > 1 && ['the', 'a', 'an'].includes(first)) tags.push('leading-article');
  if (wordCount > 1 && ['dr', 'mr', 'mrs', 'ms', 'sir', 'lord', 'lady', 'captain', 'president', 'king', 'queen'].includes(first)) tags.push('title-prefix');
  if (/'/.test(answer)) tags.push('has-apostrophe');
  if (answer.normalize('NFD') !== answer.normalize('NFD').replace(/[̀-ͯ]/g, '')) tags.push('has-diacritic');
  if (!tags.includes('name/title-shaped') && wordCount > 1) tags.push('plain-phrase (not name-shaped)');
  return tags;
}

function runShapeBreakdown(themes) {
  const counts = {};
  let total = 0;
  for (const { questions } of themes) {
    for (const q of questions) {
      if (!q.answer || !q.question) continue;
      if (!hm.hmShouldOfferTyped(q.answer)) continue;
      total++;
      for (const tag of classifyShape(q.answer)) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
  }
  console.log(`Shape breakdown of the ${total} typed-eligible answers (tags overlap, so columns don't sum to ${total}):`);
  for (const tag of Object.keys(counts).sort((a, b) => counts[b] - counts[a])) {
    const pct = ((counts[tag] / total) * 100).toFixed(1);
    console.log(`  ${tag.padEnd(30)} ${String(counts[tag]).padStart(6)}  (${pct}%)`);
  }
  console.log('');
}

// --- Runner ------------------------------------------------------------------

function runEval() {
  const themes = loadThemes();
  runShapeBreakdown(themes);
  const bucketNames = Object.keys(BUCKETS);
  const stats = {};
  for (const name of bucketNames) stats[name] = { pass: 0, fail: 0, total: 0, failures: [] };
  const crossStats = { pass: 0, fail: 0, total: 0, failures: [] };

  let eligibleCount = 0;

  for (const { file, questions } of themes) {
    const wordCollisions = hm.hmBuildWordCollisions(questions);
    const themeAnswers = questions.map(q => q.answer).filter(Boolean);

    for (const q of questions) {
      if (!q.answer || !q.question) continue;
      if (!hm.hmShouldOfferTyped(q.answer)) continue;
      eligibleCount++;

      const isNameShaped = hm.hmIsNameOrTitleShaped(q.answer);
      const contentWords = isNameShaped ? hm.hmContentWords(q.answer) : hm.hmContentWords(q.answer);

      for (const name of bucketNames) {
        const variants = BUCKETS[name](q.answer, contentWords) || [];
        for (const { typed, expect } of variants) {
          const got = hm.hmIsCorrect(typed, q, wordCollisions);
          const ok = got === expect;
          stats[name].total++;
          if (ok) stats[name].pass++;
          else {
            stats[name].fail++;
            if (stats[name].failures.length < 8) {
              stats[name].failures.push({ file, answer: q.answer, typed, expect, got });
            }
          }
        }
      }

      // Cross-answer false-positive check: does typing a DIFFERENT real
      // answer from the same theme incorrectly match this question?
      const distractor = themeAnswers.find(a => a !== q.answer && hm.hmShouldOfferTyped(a));
      if (distractor) {
        const got = hm.hmIsCorrect(distractor, q, wordCollisions);
        crossStats.total++;
        if (!got) crossStats.pass++;
        else {
          crossStats.fail++;
          if (crossStats.failures.length < 8) {
            crossStats.failures.push({ file, answer: q.answer, typed: distractor, expect: false, got });
          }
        }
      }
    }
  }

  // --- Report ---
  console.log(`Typed-eligible answers scanned: ${eligibleCount}\n`);
  console.log('Bucket'.padEnd(32), 'Pass/Total', 'Rate');
  console.log('-'.repeat(60));

  let grandPass = 0, grandTotal = 0;
  for (const name of bucketNames) {
    const s = stats[name];
    if (s.total === 0) { console.log(name.padEnd(32), '(no cases)'); continue; }
    grandPass += s.pass;
    grandTotal += s.total;
    const rate = ((s.pass / s.total) * 100).toFixed(1);
    console.log(name.padEnd(32), `${s.pass}/${s.total}`.padEnd(12), `${rate}%`);
  }
  console.log('cross-theme-distractor'.padEnd(32), `${crossStats.pass}/${crossStats.total}`.padEnd(12),
    crossStats.total ? `${((crossStats.pass / crossStats.total) * 100).toFixed(1)}%` : 'n/a');
  grandPass += crossStats.pass;
  grandTotal += crossStats.total;

  console.log('-'.repeat(60));
  console.log('OVERALL'.padEnd(32), `${grandPass}/${grandTotal}`.padEnd(12),
    `${((grandPass / grandTotal) * 100).toFixed(1)}%`);

  if (VERBOSE) {
    console.log('\n--- Failures (up to 8 per bucket) ---');
    for (const name of bucketNames) {
      const s = stats[name];
      if (!s.failures.length) continue;
      console.log(`\n[${name}]`);
      for (const f of s.failures) {
        console.log(`  ${f.file}: answer="${f.answer}" typed="${f.typed}" expected=${f.expect} got=${f.got}`);
      }
    }
    if (crossStats.failures.length) {
      console.log('\n[cross-theme-distractor]');
      for (const f of crossStats.failures) {
        console.log(`  ${f.file}: answer="${f.answer}" typed="${f.typed}" expected=${f.expect} got=${f.got}`);
      }
    }
  } else {
    console.log('\n(run with --verbose to see failure examples)');
  }
}

runEval();
