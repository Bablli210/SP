/*
 * Screenshot a running page at desktop (1440x900) and phone (390x844) and
 * report console errors and horizontal overflow.
 *
 *   NODE_PATH=$(npm root -g) node scripts/snap.cjs http://127.0.0.1:4321/work/ /tmp/out/work [--full] [--wait=800] [--reduced]
 *
 * Writes <out>-desktop.png and <out>-mobile.png.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const [, , url, out, ...flags] = process.argv;
if (!url || !out) { console.error('usage: node scripts/snap.cjs <url> <outPrefix> [--full] [--wait=ms] [--reduced]'); process.exit(1); }
const full = flags.includes('--full');
const reduced = flags.includes('--reduced');
const wait = Number((flags.find((f) => f.startsWith('--wait=')) || '--wait=900').split('=')[1]);

(async () => {
  const browser = await chromium.launch();
  for (const [name, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(wait);
    if (full) {
      // scroll through so lazy images and reveals load
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < h; y += 700) { await page.evaluate((y) => window.scrollTo(0, y), y); await page.waitForTimeout(120); }
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400);
    }
    const file = `${out}-${name}.png`;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, fullPage: full });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const wide = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.right > document.documentElement.clientWidth + 1 && r.width > 0 && getComputedStyle(e).position !== 'fixed'; }).slice(0, 5).map((e) => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]));
    console.log(`${file}  overflow=${overflow}px${wide.length ? '  wide: ' + wide.join(', ') : ''}${errors.length ? '\n  ' + errors.join('\n  ') : ''}`);
    await ctx.close();
  }
  await browser.close();
})();
