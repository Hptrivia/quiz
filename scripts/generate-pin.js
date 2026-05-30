const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function generatePin(theme, outputPath) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });

    const htmlPath = `file://${path.resolve(__dirname, '..', 'pin-builder.html')}`;
    await page.goto(htmlPath, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for Google Fonts
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 1500));

    // Set all inputs and render
    await page.evaluate((t) => {
      document.getElementById('theme-input').value = t.title;
      document.getElementById('hk').value = t.hook;
      document.getElementById('cat-input').value = t.category;
      document.getElementById('qst').value = `Can you answer every ${t.title} question?`;
      setPal(t.palette);
      render();

      // Tighten scrim — dark overlay only at bottom where title sits
      const p = PALS[t.palette];
      [1, 2, 3].forEach(n => {
        document.getElementById('scrim' + n).style.background =
          `linear-gradient(to top, rgba(${p.base},.97) 0%, rgba(${p.base},.95) 15%, rgba(${p.base},.6) 28%, rgba(${p.base},0) 40%)`;
      });
    }, theme);

    await new Promise(r => setTimeout(r, 500));

    // Capture the right template as a 1000x1500 PNG
    const imageBase64 = await page.evaluate(async (templateNum) => {
      const pin = document.getElementById('pin' + templateNum);
      const scale = 1000 / pin.offsetWidth;

      const canvas = await html2canvas(pin, {
        scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        imageTimeout: 0,
        logging: false,
      });

      const out = document.createElement('canvas');
      out.width = 1000;
      out.height = 1500;
      out.getContext('2d').drawImage(canvas, 0, 0, 1000, 1500);
      return out.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
    }, theme.template);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, Buffer.from(imageBase64, 'base64'));
    console.log(`Pin image saved: ${outputPath}`);
    return outputPath;

  } finally {
    await browser.close();
  }
}

module.exports = { generatePin };
