// Shared scoring for "Which Character Are You?" quizzes.
// Used by the browser (assets/character-quiz.js) AND by the balance validator
// (scripts/validate-character-quizzes.js), so the odds the validator reports are
// exactly the odds real players get.
//
// Rules: sum each chosen option's hidden points per character. Highest total
// wins. Ties for first are broken by tieSeed(answers) — a number derived from
// the answers themselves — so the same answers always give the same result,
// but no character wins ties just by being listed first in the data file.
// "Clash" is the lowest scorer (first-listed on ties; it's only flavour text).
(function (root) {
  function scoreAnswers(quiz, answers) {
    const ids = quiz.characters.map(c => c.id);
    const totals = Object.fromEntries(ids.map(id => [id, 0]));
    answers.forEach((optIdx, qIdx) => {
      const q = quiz.questions[qIdx];
      const opt = q && q.options[optIdx];
      if (!opt) return;
      for (const [id, pts] of Object.entries(opt.points)) totals[id] += pts;
    });
    return rank(ids, totals, tieSeed(answers));
  }

  // Deterministic, order-independent-of-characters tie breaker.
  function tieSeed(answers) {
    let h = 0;
    answers.forEach((a, i) => { h = (h * 31 + (a + 1) * (i + 7)) % 1000003; });
    return h;
  }

  function rank(ids, totals, seed) {
    const sum = ids.reduce((s, id) => s + totals[id], 0) || 1;
    // Stable sort keeps data-file order on ties.
    const ordered = ids
      .map((id, i) => ({ id, i, score: totals[id] }))
      .sort((a, b) => b.score - a.score || a.i - b.i);
    // Rotate the characters tied for first by the seed.
    const tied = ordered.filter(o => o.score === ordered[0].score);
    if (tied.length > 1) {
      const k = (seed || 0) % tied.length;
      const rotated = tied.slice(k).concat(tied.slice(0, k));
      ordered.splice(0, tied.length, ...rotated);
    }
    let clash = ordered[ordered.length - 1];
    for (const o of ordered) if (o.score === clash.score && o.i < clash.i) clash = o;
    // Rounded percentages that still add up to exactly 100.
    const raw = ordered.map(o => (o.score / sum) * 100);
    const pct = raw.map(Math.floor);
    let left = 100 - pct.reduce((a, b) => a + b, 0);
    raw.map((r, k) => [r - Math.floor(r), k])
      .sort((a, b) => b[0] - a[0])
      .slice(0, left)
      .forEach(([, k]) => pct[k]++);
    return {
      primary: ordered[0].id,
      secondary: ordered[1].id,
      clash: clash.id,
      breakdown: ordered.map((o, k) => ({ id: o.id, score: o.score, pct: pct[k] })),
    };
  }

  const api = { scoreAnswers, tieSeed };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CharacterQuizScore = api;
})(this);
