// ── Category Blitz — answer checking ────────────────────────────────────────
// Pure checking logic, no DOM/localStorage deps, reused by Daily/Solo/Versus.
// Exact match only (case-insensitive, trailing-plural-stripped) — no fuzzy/
// edit-distance matching, deliberately, so a wrong-but-similar word never
// auto-passes. A category with no wordlist file (custom Versus categories)
// falls through to 'unrecognized' with no error — that IS the auto-checkable
// test, no maintained allowlist needed.

const _cbWordlistCache = {};
const _cbWordlistLoading = {};

function cbNormalize(str) {
  return String(str || "").trim().toLowerCase();
}

function cbLoadCategoryWordlist(categoryId) {
  if (_cbWordlistCache[categoryId]) return Promise.resolve(_cbWordlistCache[categoryId]);
  if (_cbWordlistLoading[categoryId]) return _cbWordlistLoading[categoryId];
  const p = fetchJSON(`data/catblitz/${categoryId}.json`)
    .then(raw => {
      const byLetter = {};
      Object.keys(raw).forEach(letter => { byLetter[letter.toUpperCase()] = new Set(raw[letter]); });
      _cbWordlistCache[categoryId] = byLetter;
      return byLetter;
    })
    .finally(() => { delete _cbWordlistLoading[categoryId]; });
  _cbWordlistLoading[categoryId] = p;
  return p;
}

// Deterministic plural stripping only — not fuzzy matching. Catches "dogs"/
// "foxes" against a singular wordlist entry with zero risk of matching a
// wrong-but-similar word.
function _cbWordSetHas(wordSet, word) {
  if (wordSet.has(word)) return true;
  if (word.endsWith("es") && wordSet.has(word.slice(0, -2))) return true;
  if (word.endsWith("s") && wordSet.has(word.slice(0, -1))) return true;
  return false;
}

// { status: 'correct' | 'incorrect' | 'unrecognized', word }
// 'incorrect' = definitively wrong (blank, or doesn't start with the round's
// letter) — no point logging/resolving those. 'unrecognized' = right first
// letter, non-blank, just not found in the wordlist (or no wordlist exists
// for this category) — the only status callers should offer a resolver for.
async function cbCheckAnswer(categoryId, letter, rawInput) {
  const word = cbNormalize(rawInput);
  if (!word) return { status: "incorrect", word: "" };
  if (word[0].toUpperCase() !== String(letter).toUpperCase()) return { status: "incorrect", word };

  let wordlist;
  try {
    wordlist = await cbLoadCategoryWordlist(categoryId);
  } catch {
    // No wordlist file exists for this category at all (a free-text custom
    // category) — flagged so callers can skip logging it as a candidate,
    // since there's no wordlist to ever fix it against.
    return { status: "unrecognized", word, noWordlist: true };
  }

  const wordSet = wordlist[String(letter).toUpperCase()];
  if (wordSet && _cbWordSetHas(wordSet, word)) return { status: "correct", word };
  return { status: "unrecognized", word };
}

// Fire-and-forget candidate log — never blocks or throws into gameplay.
// Called for every unrecognized word at grading time (confirmed: null, pure
// miss data for human review); Versus calls it again with confirmed: true
// if a player later taps "Contest" to accept it (a stronger signal).
async function cbLogCandidate(categoryId, letter, word, mode, confirmed) {
  if (typeof LB_URL === "undefined" || typeof LB_KEY === "undefined") return;
  try {
    await fetch(`${LB_URL}/rest/v1/catblitz_candidates`, {
      method: "POST",
      headers: {
        apikey: LB_KEY,
        Authorization: `Bearer ${LB_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        category_id: categoryId,
        letter: String(letter).toUpperCase(),
        word,
        mode: mode || null,
        confirmed: confirmed === true ? true : null,
        session_id: typeof lbPlayerId === "function" ? lbPlayerId() : null,
      }),
    });
  } catch {}
}
