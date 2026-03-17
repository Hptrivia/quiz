const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const themesPath = path.join(rootDir, "data", "themes.json");
const newThemesPath = path.join(rootDir, "data", "new_themes.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fileExists(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  return fs.existsSync(fullPath);
}

function main() {
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(themesPath)) {
    console.error("Missing data/themes.json");
    process.exit(1);
  }

  if (!fs.existsSync(newThemesPath)) {
    warnings.push("Missing data/new_themes.json");
  }

  const themes = readJson(themesPath);
  const newThemes = fs.existsSync(newThemesPath) ? readJson(newThemesPath) : [];

  if (!Array.isArray(themes)) {
    console.error("themes.json is not an array");
    process.exit(1);
  }

  if (!Array.isArray(newThemes)) {
    errors.push("new_themes.json is not an array");
  }

  const slugMap = new Map();
  const questionFileMap = new Map();

  themes.forEach((theme, index) => {
    const label = `themes.json [${index}]`;

    if (!theme || typeof theme !== "object") {
      errors.push(`${label}: entry is not an object`);
      return;
    }

    const { slug, title, category, questionFile } = theme;

    if (!slug || typeof slug !== "string") {
      errors.push(`${label}: missing or invalid slug`);
    }

    if (!title || typeof title !== "string") {
      errors.push(`${label}: missing or invalid title`);
    }

    if (!category || typeof category !== "string") {
      errors.push(`${label}: missing or invalid category`);
    }

    if (!questionFile || typeof questionFile !== "string") {
      errors.push(`${label}: missing or invalid questionFile`);
    } else if (!fileExists(questionFile)) {
      errors.push(`${label}: question file not found -> ${questionFile}`);
    }

    if (slug) {
      if (slugMap.has(slug)) {
        errors.push(
          `${label}: duplicate slug "${slug}" also used at themes.json [${slugMap.get(slug)}]`
        );
      } else {
        slugMap.set(slug, index);
      }
    }

    if (questionFile) {
      if (questionFileMap.has(questionFile)) {
        warnings.push(
          `${label}: duplicate questionFile "${questionFile}" also used at themes.json [${questionFileMap.get(questionFile)}]`
        );
      } else {
        questionFileMap.set(questionFile, index);
      }
    }
  });

  newThemes.forEach((slug, index) => {
    const label = `new_themes.json [${index}]`;

    if (typeof slug !== "string" || !slug.trim()) {
      errors.push(`${label}: invalid slug`);
      return;
    }

    if (!slugMap.has(slug)) {
      errors.push(`${label}: slug "${slug}" not found in themes.json`);
    }
  });

  console.log("----- Theme Validation Report -----");

  if (!errors.length && !warnings.length) {
    console.log("All good. No issues found.");
    return;
  }

  if (warnings.length) {
    console.log("\nWarnings:");
    warnings.forEach(w => console.log(`- ${w}`));
  }

  if (errors.length) {
    console.log("\nErrors:");
    errors.forEach(e => console.log(`- ${e}`));
    process.exitCode = 1;
  }
}

main();
