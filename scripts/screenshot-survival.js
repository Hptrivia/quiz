const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function screenshotSurvival(theme, outputPath) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    // 500x750 at scale 2 = exactly 1000x1500px (Pinterest 2:3 ratio)
    await page.setViewport({ width: 500, height: 750, deviceScaleFactor: 2 });

    await page.goto(theme.survivalUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Click Mixed difficulty
    await page.click('button[data-difficulty="mixed"]');
    await new Promise(r => setTimeout(r, 2000));

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await page.screenshot({ path: outputPath, type: 'png', fullPage: false });
    console.log(`Survival screenshot saved: ${outputPath}`);
    return outputPath;

  } finally {
    await browser.close();
  }
}

module.exports = { screenshotSurvival };
