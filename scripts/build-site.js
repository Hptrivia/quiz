const { execSync } = require("child_process");

execSync("node scripts/generate-theme-pages.js", { stdio: "inherit" });
execSync("node scripts/generate-category-pages.js", { stdio: "inherit" });
