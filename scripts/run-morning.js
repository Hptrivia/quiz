const path = require('path');
const { getMorningTheme } = require('./get-theme');
const { generatePin } = require('./generate-pin');
const { postToPinterest } = require('./post-pinterest');

async function main() {
  const theme = getMorningTheme();
  console.log(`Morning: ${theme.title} | Template ${theme.template} | ${theme.category}`);

  const date = new Date().toISOString().split('T')[0];
  const imagePath = path.join(__dirname, '..', 'daily-content', date, 'morning.png');

  await generatePin(theme, imagePath);
  await postToPinterest(imagePath, theme);

  console.log('Morning job done');
}

main().catch(err => { console.error(err); process.exit(1); });
