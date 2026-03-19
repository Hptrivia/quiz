const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");

const themesPath = path.join(dataDir, "themes.json");
const newThemesPath = path.join(dataDir, "new_themes.json");
const episodeThemesPath = path.join(dataDir, "episode_themes.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fullPath(relativePath) {
  return path.join(rootDir, relativePath);
}

function existsRelative(relativePath) {
  return fs.existsSync(fullPath(relativePath));
}

function normalizeDataPath(fileName) {
  return `data/${fileName}`;
}

function isEpisodeLikeFileName(name) {
  const lower = name.toLowerCase();
  return lower.includes("episode");
}

function main() {
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(themesPath)) {
    console.error("Missing data/themes.json");
    process.exit(1);
  }

  const themes = readJson(themesPath);

  if (!Array.isArray(themes)) {
    console.error("themes.json is not an array");
    process.exit(1);
  }

  const newThemes = fs.existsSync(newThemesPath) ? readJson(newThemesPath) : [];
  const episodeThemes = fs.existsSync(episodeThemesPath) ? readJson(episodeThemesPath) : {};

  if (fs.existsSync(newThemesPath) && !Array.isArray(newThemes)) {
    errors.push("new_themes.json is not an array");
  }

  if (fs.existsSync(episodeThemesPath) && (typeof episodeThemes !== "object" || Array.isArray(episodeThemes) || episodeThemes === null)) {
    errors.push("episode_themes.json is not an object");
  }

  const slugMap = new Map();
  const questionFileMap = new Map();

  themes.forEach((theme, index) => {
    const label = `themes.json [${index}]`;

    if (!theme || typeof theme !== "object" || Array.isArray(theme)) {
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
    } else if (!existsRelative(questionFile)) {
      errors.push(`${label}: question file not found -> ${questionFile}`);
    }

    if (slug) {
      if (slugMap.has(slug)) {
        errors.push(`${label}: duplicate slug "${slug}" also used at themes.json [${slugMap.get(slug)}]`);
      } else {
        slugMap.set(slug, index);
      }
    }

    if (questionFile) {
      if (questionFileMap.has(questionFile)) {
        warnings.push(`${label}: duplicate questionFile "${questionFile}" also used at themes.json [${questionFileMap.get(questionFile)}]`);
      } else {
        questionFileMap.set(questionFile, index);
      }
    }
  });

  if (Array.isArray(newThemes)) {
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
  }

  const allTxtFiles = fs.existsSync(dataDir)
    ? fs.readdirSync(dataDir)
        .filter(name => name.toLowerCase().endsWith(".txt"))
        .map(name => normalizeDataPath(name))
    : [];

  const usedQuestionFiles = new Set(
    themes
      .map(theme => theme.questionFile)
      .filter(Boolean)
  );

  allTxtFiles.forEach(file => {
    const baseName = path.basename(file);
    if (isEpisodeLikeFileName(baseName)) return;

    if (!usedQuestionFiles.has(file)) {
      warnings.push(`Unused txt file in data folder (not referenced by themes.json): ${file}`);
    }
  });

  const usedEpisodeFiles = new Set();

  if (episodeThemes && typeof episodeThemes === "object" && !Array.isArray(episodeThemes)) {
    Object.entries(episodeThemes).forEach(([slug, file], index) => {
      const label = `episode_themes.json ["${slug}"]`;

      if (!slugMap.has(slug)) {
        errors.push(`${label}: slug not found in themes.json`);
      }

      if (typeof file !== "string" || !file.trim()) {
        errors.push(`${label}: invalid episode file value`);
        return;
      }

      const relativeFile = file.startsWith("data/") ? file : `data/${file}`;
      usedEpisodeFiles.add(relativeFile);

      if (!existsRelative(relativeFile)) {
        errors.push(`${label}: episode file not found -> ${relativeFile}`);
      }
    });
  }

  allTxtFiles.forEach(file => {
    const baseName = path.basename(file);
    if (!isEpisodeLikeFileName(baseName)) return;

    if (!usedEpisodeFiles.has(file)) {
      warnings.push(`Unused episode txt file in data folder (not referenced by episode_themes.json): ${file}`);
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
