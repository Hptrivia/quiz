// Preview mode — generates morning and evening images locally, no Pinterest posting
// Run: node scripts/preview.js                        (uses today's auto theme)
// Run: node scripts/preview.js vampire-diaries        (forces a specific theme)

const path = require('path');
const fs = require('fs');
const { getMorningTheme, getEveningTheme } = require('./get-theme');
const { generatePin } = require('./generate-pin');
const { screenshotSurvival } = require('./screenshot-survival');

function overrideTheme(theme, slug) {
  const themes = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'themes.json'), 'utf8'));
  const found = themes.find(t => t.slug === slug);
  if (!found) { console.error(`Theme "${slug}" not found in data/themes.json`); process.exit(1); }

  const { buildThemeData } = require('./get-theme');
  return buildThemeData(found, theme.template);
}

async function main() {
  const slug = process.argv[2];
  let morning = getMorningTheme();
  let evening = getEveningTheme();
  if (slug) { morning = overrideTheme(morning, slug); evening = overrideTheme(evening, slug); }

  const outDir = path.join(__dirname, '..', 'daily-content', 'preview');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('\n=== MORNING PIN ===');
  console.log(`Theme:    ${morning.title}`);
  console.log(`Category: ${morning.category}`);
  console.log(`Template: ${morning.template}`);
  console.log(`Title:    ${morning.pinTitle}`);
  console.log(`Hook:     ${morning.hook}`);
  console.log(`Board:    ${morning.boardName}`);
  console.log(`Link:     ${morning.themeUrl}`);
  console.log('Generating image...');
  await generatePin(morning, path.join(outDir, 'morning.png'));

  console.log('\n=== EVENING PIN ===');
  console.log(`Theme:    ${evening.title}`);
  console.log(`Category: ${evening.category}`);
  console.log(`Title:    ${evening.title} Trivia – Can You Beat Question 1?`);
  console.log(`Board:    ${evening.boardName}`);
  console.log(`Link:     ${evening.themeUrl}`);
  console.log('Taking screenshot...');
  await screenshotSurvival(evening, path.join(outDir, 'evening.png'));

  console.log(`\n✓ Done — open daily-content/preview/ to review both images`);
}

main().catch(err => { console.error(err); process.exit(1); });
