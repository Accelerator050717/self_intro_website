import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw new Error('Use before or after');
const base = process.env.BASE_URL || 'http://127.0.0.1:4321';
const directory = `docs/screenshots/gradient-waves/${phase}`;
const reportDirectory = 'docs/reports/gradient-waves';
mkdirSync(directory, { recursive: true });
mkdirSync(reportDirectory, { recursive: true });
const cases = [
  { name: 'desktop-home', path: '/en/', target: 'top' },
  { name: 'desktop-projects', path: '/en/', target: '.selected-section' },
  { name: 'desktop-footer', path: '/en/', target: 'footer' },
  { name: 'mobile-zh-dark', path: '/zh/', target: 'top', mobile: true, theme: 'dark', fullPage: true },
  { name: 'desktop-work', path: '/en/work/', target: 'top' },
  { name: 'desktop-about', path: '/en/about/', target: 'top' },
  { name: 'desktop-detail', path: '/en/work/context-ai/', target: 'top' },
  { name: 'desktop-resume', path: '/en/resume/', target: 'top' },
];
if (phase === 'after') {
  cases.push(
    { name: 'desktop-en-dark', path: '/en/', target: 'top', theme: 'dark' },
    { name: 'desktop-zh-light', path: '/zh/', target: 'top' },
    { name: 'desktop-zh-dark', path: '/zh/', target: 'top', theme: 'dark' },
    { name: 'mobile-en-light', path: '/en/', target: 'top', mobile: true },
    { name: 'mobile-en-dark', path: '/en/', target: 'top', mobile: true, theme: 'dark' },
    { name: 'mobile-zh-light', path: '/zh/', target: 'top', mobile: true },
    { name: 'narrow-en-light', path: '/en/', target: 'top', mobile: true, width: 320 },
  );
}
const browser = await chromium.launch({ headless: true });
const report = {
  phase, base, date: new Date().toISOString(), finishedAt: '', browser: browser.version(),
  method: `${cases.length} production-preview scenes, normal motion, fresh contexts, welcome already seen. After additionally covers both languages and themes on desktop/mobile plus width 320. Mobile is Chromium emulation, not a physical device.`,
  results: [], passed: false,
};
try {
  for (const scene of cases) {
    const width = scene.width ?? (scene.mobile ? 390 : 1440);
    const height = scene.mobile ? 844 : 1000;
    const theme = scene.theme || 'light';
    const context = await browser.newContext({
      viewport: { width, height }, deviceScaleFactor: 1, isMobile: !!scene.mobile,
      hasTouch: !!scene.mobile, colorScheme: theme, reducedMotion: 'no-preference',
    });
    await context.addInitScript(({ theme }) => {
      localStorage.setItem('ice-theme', theme);
      sessionStorage.setItem('mingyang:avatar-welcome:v1', 'seen');
    }, { theme });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const response = await page.goto(`${base}${scene.path}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      if (/^\/(en|zh)\/$/.test(scene.path)) {
        await page.locator('.avatar-exhibit[data-rig="ready"]').waitFor();
        await page.waitForFunction(() => {
          const scene = document.querySelector('.ice-hero-scene');
          return scene?.querySelector('canvas') || scene?.getAttribute('data-webgl') === 'fallback';
        }, { timeout: 15000 });
      }
      if (scene.target === 'footer') await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      else if (scene.target !== 'top') await page.locator(scene.target).scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      const screenshot = `${directory}/${scene.name}.png`;
      await page.screenshot({ path: screenshot });
      let fullPageScreenshot = null;
      if (scene.fullPage) {
        fullPageScreenshot = `${directory}/${scene.name}-full.png`;
        await page.screenshot({ path: fullPageScreenshot, fullPage: true });
      }
      const layout = await page.evaluate(() => ({
        width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        scrollY, documentHeight: document.documentElement.scrollHeight,
        title: document.title, theme: document.documentElement.dataset.theme,
        canvases: [...document.querySelectorAll('canvas')].map(canvas => ({ width: canvas.width, height: canvas.height, class: canvas.className })),
      }));
      const result = {
        name: scene.name, path: scene.path, viewport: { width, height }, mobileEmulation: !!scene.mobile,
        expectedTheme: theme, status: response?.status() ?? null, errors, screenshot, fullPageScreenshot,
        htmlSha256: createHash('sha256').update(await response.body()).digest('hex'), ...layout,
      };
      report.results.push(result);
      console.log(JSON.stringify({ name: result.name, status: result.status, errors, scrollY: result.scrollY, overflow: layout.scrollWidth > width }));
    } finally { await context.close(); }
  }
  report.passed = report.results.length === cases.length && report.results.every(result => result.status === 200 && !result.errors.length && result.scrollWidth <= result.viewport.width && result.theme === result.expectedTheme);
  if (!report.passed) process.exitCode = 1;
} finally {
  await browser.close();
  report.finishedAt = new Date().toISOString();
  writeFileSync(`${reportDirectory}/${phase}-screenshots.json`, `${JSON.stringify(report, null, 2)}\n`);
}
