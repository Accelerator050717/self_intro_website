import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('docs/screenshots/revision', { recursive: true });
mkdirSync('docs/reports', { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: width === 1440 ? 1000 : 844 }, reducedMotion: 'reduce' });
    try {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:4321/en/', { waitUntil: 'networkidle' });
      await page.locator('.ice-hero-scene canvas').waitFor({ state: 'visible' });
      await page.locator('.ice-hero-scene [data-scene-fallback]').waitFor({ state: 'detached' });
      await page.locator('.avatar-exhibit[data-rig="ready"]').waitFor();
      const screenshot = `docs/screenshots/revision/inspect-home-${width}.png`;
      await page.screenshot({ path: screenshot, fullPage: true });
      const layout = await page.locator('body').evaluate(() => ({
        viewport: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overflow: [...document.querySelectorAll('body *')].filter(element => getComputedStyle(element).display !== 'none').map(element => ({
          tag: element.tagName, class: element.getAttribute('class'), left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right,
        })).filter(bounds => bounds.left < -0.5 || bounds.right > innerWidth + 0.5),
      }));
      const retiredControls = await page.locator('.view-control,.avatar-caption,a[href="/en/play/"],a[href="/zh/play/"]').count();
      const helloButton = await page.locator('.hello-button').isVisible();
      results.push({ width, screenshot, ...layout, errors, retiredControls, helloButton, rigReady: true, webglReady: true, passed: layout.scrollWidth <= width && errors.length === 0 && retiredControls === 0 && helloButton });
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
writeFileSync('docs/reports/revision-visual-check.json', JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
console.log(JSON.stringify(results, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
