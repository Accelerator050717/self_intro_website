import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw new Error('Use before or after');
const directory = `docs/screenshots/visual-upgrade/${phase}`;
mkdirSync(directory, { recursive: true });
mkdirSync('docs/reports/visual-upgrade', { recursive: true });
const browser = await chromium.launch({ headless: true });
const cases = [
  ['desktop-en-light', 1440, 1000, 'en', 'light', ''],
  ['desktop-zh-light', 1440, 1000, 'zh', 'light', ''],
  ['desktop-en-dark', 1440, 1000, 'en', 'dark', ''],
  ['mobile-en-light', 390, 844, 'en', 'light', ''],
  ['mobile-zh-dark', 390, 844, 'zh', 'dark', ''],
  ['narrow-en-light', 320, 844, 'en', 'light', ''],
  ['detail-en-light', 1440, 1000, 'en', 'light', 'work/context-ai/'],
  ['detail-mobile-dark', 390, 844, 'zh', 'dark', 'work/context-ai/'],
];
const results = [];
try {
  for (const [name, width, height, lang, theme, suffix] of cases) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', colorScheme: theme });
    await context.addInitScript(({ theme }) => {
      localStorage.setItem('ice-theme', theme);
      sessionStorage.setItem('mingyang:avatar-welcome:v1', 'seen');
    }, { theme });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(`http://127.0.0.1:4321/${lang}/${suffix}`, { waitUntil: 'networkidle' });
    if (!suffix) {
      await page.locator('.avatar-exhibit[data-rig="ready"]').waitFor();
      await page.locator('.ice-hero-scene canvas').waitFor({ state: 'visible' });
      await page.locator('.ice-hero-scene [data-scene-fallback]').waitFor({ state: 'detached' });
    }
    await page.screenshot({ path: `${directory}/${name}-viewport.png` });
    await page.screenshot({ path: `${directory}/${name}-full.png`, fullPage: true });
    const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, title: document.title }));
    const result = { name, width, height, lang, theme, path: `/${lang}/${suffix}`, status: response.status(), errors, ...layout };
    results.push(result);
    console.log(JSON.stringify(result));
    await context.close();
  }
} finally { await browser.close(); }
writeFileSync(`docs/reports/visual-upgrade/${phase}-screenshots.json`, JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
if (results.some(result => result.errors.length || result.scrollWidth > result.width || result.status !== 200)) process.exitCode = 1;
if (phase === 'after') {
  for (const [profile, name, width, height] of [['desktop', 'desktop-en-light-viewport', 720, 500], ['mobile', 'mobile-en-light-full', 390, null]]) {
    const before = `docs/screenshots/visual-upgrade/before/${name}.png`;
    const after = `${directory}/${name}.png`;
    const meta = await sharp(before).metadata();
    const cellHeight = height ?? Math.round(meta.height / meta.width * width);
    const composites = [];
    for (const [index, path, label] of [[0, before, 'Before'], [1, after, 'After']]) {
      const resized = await sharp(path).resize(width, cellHeight, { fit: 'contain', background: '#f5faff' }).png().toBuffer();
      const caption = `<svg width="${width}" height="38"><rect width="100%" height="100%" fill="#eaf5ff"/><text x="16" y="25" fill="#132943" font-family="Arial" font-size="16">${label} · same viewport and theme</text></svg>`;
      composites.push({ input: Buffer.from(caption), left: index * width, top: 0 }, { input: resized, left: index * width, top: 38 });
    }
    await sharp({ create: { width: width * 2, height: cellHeight + 38, channels: 3, background: '#f5faff' } }).composite(composites).jpeg({ quality: 90 }).toFile(`docs/screenshots/visual-upgrade/comparison-${profile}.jpg`);
  }
}
