// Adds the ad gap to existing wordle/ and wordsearch/ landing pages: page header +
// Play button in one box under <main>, "More Themes" in a second box. Edits the
// pages in place because the generators pick related themes at random, so a full
// rebuild would reshuffle every page.
//   node scripts/split-landing-pages.js          apply
//   node scripts/split-landing-pages.js --undo   put the pages back to one box
// To turn it off for good, also set LANDING_AD_BOXES to false in both generators.
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const undo = process.argv.includes("--undo");
const OPEN = '<section class="theme-split-top">\n';
const GAP = '</section></section><section class="panel theme-split-box">';
const MAIN = '<main class="container narrow">\n';
const RELATED = '<div class="theme-related-quizzes">';

let changed = 0;
for (const dir of ["wordle", "wordsearch"]) {
  for (const file of fs.readdirSync(path.join(rootDir, dir))) {
    if (!file.endsWith(".html")) continue;
    const fp = path.join(rootDir, dir, file);
    const html = fs.readFileSync(fp, "utf8");
    const applied = html.includes(GAP);
    let out = html;
    if (undo && applied) {
      out = html.replace(MAIN + "    " + OPEN, MAIN).replace(GAP, "");
    } else if (!undo && !applied && html.includes(RELATED) && html.includes(MAIN)) {
      out = html.replace(MAIN, MAIN + "    " + OPEN).replace(RELATED, GAP + RELATED);
    }
    if (out !== html) { fs.writeFileSync(fp, out, "utf8"); changed++; }
  }
}
console.log(`${undo ? "Undid" : "Split"} ${changed} landing pages`);
