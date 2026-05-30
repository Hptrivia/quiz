const path = require('path');
const { getEveningTheme } = require('./get-theme');
const { screenshotSurvival } = require('./screenshot-survival');
const { postToPinterest } = require('./post-pinterest');

async function main() {
  const theme = getEveningTheme();
  console.log(`Evening: ${theme.title} | Screenshot | ${theme.category}`);

  const date = new Date().toISOString().split('T')[0];
  const imagePath = path.join(__dirname, '..', 'daily-content', date, 'evening.png');

  await screenshotSurvival(theme, imagePath);

  // Evening pin title is slightly different — screenshot shows gameplay
  const eveningTheme = {
    ...theme,
    pinTitle: `${theme.title} Trivia – Can You Beat Question 1?`,
  };
  await postToPinterest(imagePath, eveningTheme);

  console.log('Evening job done');
}

main().catch(err => { console.error(err); process.exit(1); });
