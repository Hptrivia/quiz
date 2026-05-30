const fs = require('fs');
const path = require('path');

const CATEGORY_ORDER = ['TV', 'Games', 'Anime', 'Sports', 'General', 'Sitcoms', 'Education', 'Books', 'Countries'];

const BOARD_MAP = {
  TV: 'PINTEREST_BOARD_TV_SERIES',
  Anime: 'PINTEREST_BOARD_TV_SERIES',
  Sitcoms: 'PINTEREST_BOARD_TV_SERIES',
  Games: 'PINTEREST_BOARD_GAMES',
  Sports: 'PINTEREST_BOARD_SPORTS',
  General: 'PINTEREST_BOARD_GENERAL',
  Books: 'PINTEREST_BOARD_GENERAL',
  Countries: 'PINTEREST_BOARD_GENERAL',
  Education: 'PINTEREST_BOARD_GENERAL',
};

const BOARD_NAMES = {
  TV: 'TV Series Trivia',
  Anime: 'TV Series Trivia',
  Sitcoms: 'TV Series Trivia',
  Games: 'Games Trivia',
  Sports: 'Sports Trivia',
  General: 'General Trivia',
  Books: 'General Trivia',
  Countries: 'General Trivia',
  Education: 'General Trivia',
};

const DESCRIPTIONS = {
  TV: t => `Test your knowledge of ${t} with this fan quiz. Play now on Trivia Gauntlet.`,
  Anime: t => `Test your knowledge of ${t} with this fan quiz. Play now on Trivia Gauntlet.`,
  Sitcoms: t => `Test your knowledge of ${t} with this fan quiz. Play now on Trivia Gauntlet.`,
  Games: t => `Think you know ${t}? Take this gaming trivia quiz on Trivia Gauntlet.`,
  Sports: t => `Challenge yourself with this ${t} trivia quiz on Trivia Gauntlet.`,
  General: t => `Play this ${t} trivia quiz and see how many you can get right.`,
  Books: t => `Play this ${t} trivia quiz and see how many you can get right.`,
  Countries: t => `Play this ${t} trivia quiz and see how many you can get right.`,
  Education: t => `Play this ${t} trivia quiz and see how many you can get right.`,
};

const PIN_TITLES = {
  1: t => `${t} Trivia Quiz for Real Fans`,
  2: t => `7 ${t} Trivia Questions Most Fans Miss`,
  3: t => `Hard ${t} Quiz`,
};

const HOOKS = {
  1: 'Only real fans score 8/10',
  2: 'Most fans miss these',
  3: 'Can you beat this challenge?',
};

// Color palette index per category (matches pin-builder.html PALS array)
const PALETTE = {
  TV: 0,       // black
  Anime: 5,    // purple
  Sitcoms: 0,  // black
  Games: 6,    // teal
  Sports: 3,   // green
  General: 4,  // amber
  Books: 5,    // purple
  Countries: 2,// blue
  Education: 2,// blue
};

function buildSchedule() {
  const themes = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'themes.json'), 'utf8'));
  const byCategory = {};
  CATEGORY_ORDER.forEach(c => byCategory[c] = []);
  themes.forEach(t => {
    if (byCategory[t.category]) byCategory[t.category].push(t);
  });

  // Round-robin interleave categories so morning/evening cover different ones
  const ordered = [];
  const maxLen = Math.max(...CATEGORY_ORDER.map(c => byCategory[c].length));
  for (let i = 0; i < maxLen; i++) {
    for (const cat of CATEGORY_ORDER) {
      if (byCategory[cat][i]) ordered.push(byCategory[cat][i]);
    }
  }
  return ordered;
}

function getThemeForSlot(dayIndex, offset = 0) {
  const schedule = buildSchedule();
  const total = schedule.length; // 155
  const totalSlots = total * 3;  // 465 (3 templates each)

  const slot = (dayIndex + offset) % totalSlots;
  const themeIdx = slot % total;
  const templateNum = Math.floor(slot / total) + 1;

  const theme = schedule[themeIdx];
  const boardEnvKey = BOARD_MAP[theme.category] || 'PINTEREST_BOARD_GENERAL';

  return {
    slug: theme.slug,
    title: theme.title,
    category: theme.category,
    template: templateNum,
    hook: HOOKS[templateNum],
    pinTitle: PIN_TITLES[templateNum](theme.title),
    description: (DESCRIPTIONS[theme.category] || DESCRIPTIONS.General)(theme.title),
    boardName: BOARD_NAMES[theme.category] || 'General Trivia',
    boardId: process.env[boardEnvKey] || process.env.PINTEREST_BOARD_GENERAL,
    palette: PALETTE[theme.category] || 0,
    themeUrl: `https://triviagauntlet.app/themes/${theme.slug}.html`,
    survivalUrl: `https://triviagauntlet.app/survival.html?theme=${theme.slug}`,
  };
}

function getMorningTheme() {
  const dayIndex = Math.floor(Date.now() / 86400000);
  return getThemeForSlot(dayIndex, 0);
}

function getEveningTheme() {
  const dayIndex = Math.floor(Date.now() / 86400000);
  // Offset by ~half the total so evening is always a different category from morning
  return getThemeForSlot(dayIndex, 77);
}

module.exports = { getMorningTheme, getEveningTheme };
