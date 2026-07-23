const { execSync } = require("child_process");

execSync("node scripts/generate-theme-pages.js", { stdio: "inherit" });
execSync("node scripts/generate-category-pages.js", { stdio: "inherit" });
// Rebuilds data/recent.json (the "Recently Added" feed) so new themes/episodes
// show up on recent.html without a separate command.
execSync("node scripts/generate-recent.js", { stdio: "inherit" });
