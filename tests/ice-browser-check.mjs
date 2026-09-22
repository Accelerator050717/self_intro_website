import { chromium, expect as baseExpect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'docs');
const images = path.join(output, 'screenshots', 'revision');
const base = process.env.BASE_URL || 'http://127.0.0.1:4321';
const report = {
  startedAt: new Date().toISOString(), finishedAt: '', base,
  browser: 'Installed Chrome, headless', scope: 'Hero ice scene only',
  passed: false, failure: '', checks: [], measurements: {},
  pageErrors: [], consoleErrors: [], warnings: [], warningNotes: '',
  visibilityNote: 'Offscreen uses real scrolling. Hidden-page handling uses a document.hidden override and a visibilitychange event; it is not a real operating-system background-tab test.',
};
await mkdir(images, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const expect = baseExpect.configure({ timeout: 20000 });
function observe(page) {
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
    if (message.type() === 'warning' && !report.warnings.includes(message.text())) report.warnings.push(message.text());
  });
}
async function check(name, run) {
  const start = Date.now();
  await run();
  report.checks.push({ name, passed: true, milliseconds: Date.now() - start });
}
async function instrument(context) {
  await context.addInitScript(() => {
    localStorage.setItem('ice-paused', 'true');
    const calls = { total: 0, firstDrawAt: null, firstDrawHadFallback: null };
    Object.defineProperty(window, '__iceDrawCalls', { value: calls });
    // Count real GL work belonging to this scene, independent of avatar/CSS motion.
    for (const prototype of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype]) {
      if (!prototype) continue;
      for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        const original = prototype[method];
        if (typeof original !== 'function') continue;
        prototype[method] = function (...args) {
          if (this.canvas?.closest('.ice-hero-scene')) {
            if (calls.firstDrawAt === null) {
              calls.firstDrawAt = performance.now();
              calls.firstDrawHadFallback = Boolean(document.querySelector('.ice-hero-scene > svg'));
            }
            calls.total++;
          }
          return Reflect.apply(original, this, args);
        };
      }
    }
  });
}
const drawCount = page => page.evaluate(() => window['__iceDrawCalls'].total);
async function expectReady(page) {
  await expect(page.locator('.ice-hero-scene')).toHaveAttribute('data-scene', 'webgl');
  await expect(page.locator('.ice-hero-scene canvas')).toHaveCount(1);
  await expect.poll(() => drawCount(page), { timeout: 20000 }).toBeGreaterThan(0);
  await expect(page.locator('.ice-hero-scene > svg')).toHaveCount(0);
  await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-scene-settled', 'true');
}
async function expectQuiet(page, key) {
  await page.waitForTimeout(250);
  const before = await drawCount(page);
  await page.waitForTimeout(400);
  const additionalDraws = await drawCount(page) - before;
  expect(additionalDraws).toBe(0);
  report.measurements[key] = { milliseconds: 400, additionalDraws };
}
async function setTheme(page, theme) {
  await page.evaluate(value => {
    document.documentElement.dataset.theme = value;
    window.dispatchEvent(new Event('ice-theme-change'));
  }, theme);
}

try {
  await check('Reduced motion + saved pause: SVG persists through environment loading, then a real static frame replaces it', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', colorScheme: 'light' });
    await instrument(context);
    let releaseEnvironment;
    const environmentGate = new Promise(resolve => { releaseEnvironment = resolve; });
    let requestedEnvironment;
    const environmentRequested = new Promise(resolve => { requestedEnvironment = resolve; });
    await context.route('**/images/ice/studio-cubeuv.bin.gz', async route => {
      requestedEnvironment();
      await environmentGate;
      await route.continue();
    });
    const page = await context.newPage(); observe(page);
    try {
      await page.goto(`${base}/en/`, { waitUntil: 'domcontentloaded' });
      await Promise.race([environmentRequested, new Promise((_, reject) => setTimeout(() => reject(new Error('Environment was not requested')), 20000))]);
      await expect(page.locator('.ice-hero-scene canvas')).toHaveCount(1);
      await expect(page.locator('.ice-hero-scene > svg')).toBeVisible();
      await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-scene-settled', 'false');
      expect(await drawCount(page)).toBe(0);
      releaseEnvironment();
      await page.waitForLoadState('networkidle');
      await expectReady(page);
      const firstFrame = await page.evaluate(() => window['__iceDrawCalls']);
      expect(firstFrame.firstDrawHadFallback).toBe(true);
      report.measurements.firstFrame = firstFrame;
      await expectQuiet(page, 'reducedAndPaused');
      await page.screenshot({ path: path.join(images, 'ice-hero-1440-light-webgl.png') });
      const beforeTheme = await drawCount(page);
      await page.getByRole('button', { name: 'Use dark theme', exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect.poll(() => drawCount(page)).toBeGreaterThan(beforeTheme);
      await expectReady(page);
      await expectQuiet(page, 'darkThemeIdle');
      await page.screenshot({ path: path.join(images, 'ice-hero-1440-dark-webgl.png') });
    } finally { releaseEnvironment(); await context.close(); }
  });
  await check('Saved pause and greeting with normal motion: static 3D stays ready without continuous GL draws', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, reducedMotion: 'no-preference' });
    await instrument(context);
    const page = await context.newPage(); observe(page);
    try {
      await page.goto(`${base}/zh/`); await page.waitForLoadState('networkidle');
      await expectReady(page);
      await expect(page.locator('.animation-toggle')).toHaveAttribute('aria-pressed', 'true');
      await expectQuiet(page, 'pausedWithNormalMotion');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(images, 'ice-hero-390-paused-webgl.png') });
      await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-rig', 'ready');
      await page.locator('.animation-toggle').click();
      await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-state', 'greeting');
      await expectQuiet(page, 'greetingPausesBrickInteraction');
      await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-state', 'idle');
      await expectReady(page);
    } finally { await context.close(); }
  });
  await check('Hidden and offscreen scenes stop GL rendering even when theme invalidates; returning draws again', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await instrument(context);
    const page = await context.newPage(); observe(page);
    try {
      await page.goto(`${base}/en/`); await page.waitForLoadState('networkidle'); await expectReady(page);
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.waitForTimeout(200);
      const hiddenBefore = await drawCount(page);
      await setTheme(page, 'dark');
      await expectQuiet(page, 'hiddenThemeChange');
      expect(await drawCount(page)).toBe(hiddenBefore);
      await page.evaluate(() => {
        delete document['hidden'];
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await expect.poll(() => drawCount(page)).toBeGreaterThan(hiddenBefore);
      await page.locator('footer').scrollIntoViewIfNeeded();
      await expect.poll(() => page.locator('.ice-hero-scene').evaluate(node => node.getBoundingClientRect().bottom)).toBeLessThan(-80);
      await page.waitForTimeout(250);
      const offscreenBefore = await drawCount(page);
      await setTheme(page, 'light');
      await expectQuiet(page, 'offscreenThemeChange');
      expect(await drawCount(page)).toBe(offscreenBefore);
      await page.locator('.avatar-exhibit').scrollIntoViewIfNeeded();
      await expect.poll(() => drawCount(page)).toBeGreaterThan(offscreenBefore);
      await expectReady(page);
    } finally { await context.close(); }
  });
  await check('WebGL context loss returns to SVG and leaves real page content available', async () => {
    const context = await browser.newContext({ viewport: { width: 768, height: 1100 }, reducedMotion: 'reduce' });
    await instrument(context);
    const page = await context.newPage(); observe(page);
    try {
      await page.goto(`${base}/zh/`); await page.waitForLoadState('networkidle'); await expectReady(page);
      const injected = await page.evaluate(() => {
        const canvas = document.querySelector('.ice-hero-scene canvas');
        const extension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
        if (!extension) return false;
        extension.loseContext();
        return true;
      });
      expect(injected).toBe(true);
      await expect(page.locator('.ice-hero-scene')).toHaveAttribute('data-scene', 'svg');
      await expect(page.locator('.ice-hero-scene > svg')).toBeVisible();
      await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-scene-settled', 'true');
      await expect(page.locator('.ice-hero-scene canvas')).toHaveCount(0);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    } finally { await context.close(); }
  });
  await check('Invalid local environment safely returns to SVG', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await context.route('**/images/ice/studio-cubeuv.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: 0 }) }));
    const page = await context.newPage(); observe(page);
    try {
      await page.goto(`${base}/en/`); await page.waitForLoadState('networkidle');
      await expect(page.locator('.ice-hero-scene')).toHaveAttribute('data-scene', 'svg');
      await expect(page.locator('.ice-hero-scene > svg')).toBeVisible();
      await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-scene-settled', 'true');
      await expect(page.locator('.ice-hero-scene canvas')).toHaveCount(0);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    } finally { await context.close(); }
  });
  await check('Forced SVG at 320px and JavaScript disabled preserve the hero and page content', async () => {
    for (const javascript of [true, false]) {
      const context = await browser.newContext({ javaScriptEnabled: javascript, viewport: { width: javascript ? 320 : 1440, height: 1000 }, reducedMotion: 'reduce' });
      const page = await context.newPage(); observe(page);
      try {
        await page.goto(`${base}/en/${javascript ? '?webgl=0' : ''}`); await page.waitForLoadState('networkidle');
        await expect(page.locator('.brick-stage [data-scene-fallback="hero"]')).toBeVisible();
        await expect(page.locator('.ice-hero-scene canvas')).toHaveCount(0);
        if (javascript) await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-scene-settled', 'true');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        expect(await page.locator('.avatar-exhibit img').evaluateAll(nodes => nodes.some(node => node.complete && node.naturalWidth > 0 && node.getBoundingClientRect().width > 0))).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: path.join(images, javascript ? 'ice-hero-320-svg.png' : 'ice-hero-no-javascript.png') });
      } finally { await context.close(); }
    }
  });
  expect(report.pageErrors).toEqual([]);
  expect(report.consoleErrors).toEqual([]);
  report.passed = true;
} catch (error) {
  report.failure = String(error?.stack || error);
  process.exitCode = 1;
} finally {
  await browser.close();
  report.finishedAt = new Date().toISOString();
  report.warningNotes = 'THREE.Clock deprecation comes from React Three Fiber 9.7. Windows shader precision warnings and warnings caused by deliberate WEBGL_lose_context are retained. These Hero checks do not validate the avatar limb animation.';
  await writeFile(path.join(output, 'ice-browser-results.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks, measurements: report.measurements, pageErrors: report.pageErrors, consoleErrors: report.consoleErrors, failure: report.failure }, null, 2));
}
