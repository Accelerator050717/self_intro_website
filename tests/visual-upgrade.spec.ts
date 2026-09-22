import { test, expect, type Page } from '@playwright/test';

test.use({ reducedMotion: 'no-preference' });
async function ready(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('mingyang:avatar-welcome:v1', 'seen'));
  await page.goto('/en/');
  await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-scene-settled', 'true');
  await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-rig', 'ready');
  await expect(page.locator('.gradient-waves-container')).toHaveAttribute('data-state', 'ready');
}
const wavesMotion = (page: Page) => page.locator('.gradient-waves-container').getAttribute('data-motion');

test('bounded spotlight and cover tilt follow mouse without moving link or title, then settle', async ({ page }) => {
  await ready(page);
  const card = page.locator('[data-light-card]').first();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(650);
  const before = await card.boundingBox();
  const title = await page.locator('.project-card h3').first().boundingBox();
  await card.hover({ position: { x: 60, y: 65 } });
  await expect(card).toHaveAttribute('data-tracking', 'true');
  await expect.poll(() => card.locator('.project-art').evaluate(el => getComputedStyle(el).transform)).not.toBe('none');
  expect(await card.boundingBox()).toEqual(before);
  expect(await page.locator('.project-card h3').first().boundingBox()).toEqual(title);
  const first = await card.evaluate(el => el.style.getPropertyValue('--light-x'));
  await card.hover({ position: { x: 240, y: 120 } });
  await expect.poll(() => card.evaluate(el => el.style.getPropertyValue('--light-x'))).not.toBe(first);
  await page.mouse.move(4, 4);
  await expect(card).not.toHaveAttribute('data-tracking');
  expect(await card.evaluate(el => el.style.getPropertyValue('--tilt-x'))).toBe('');
  await card.focus();
  expect(await card.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/en/work/goldencamp/');
});

test('pause controls ambient motion and card tracking across navigation; resume restores', async ({ page }) => {
  await ready(page);
  await expect.poll(() => wavesMotion(page)).toBe('running');
  await page.locator('.animation-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'still');
  await expect.poll(() => wavesMotion(page)).toBe('paused');
  const card = page.locator('[data-light-card]').first();
  await card.hover();
  await expect(card).not.toHaveAttribute('data-tracking');
  await page.goto('/en/work/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'still');
  await page.locator('[data-light-card]').first().hover();
  await expect(page.locator('[data-light-card]').first()).not.toHaveAttribute('data-tracking');
  await page.goto('/en/');
  await page.locator('.animation-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'enabled');
});

test('viewport waves remain available while greeting and at the footer; hidden document suspends them', async ({ page }) => {
  await ready(page);
  await page.locator('.hello-button').click();
  await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-state', 'greeting');
  await expect.poll(() => wavesMotion(page)).toBe('running');
  await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-state', 'idle');
  await expect.poll(() => wavesMotion(page)).toBe('running');
  await page.locator('footer').scrollIntoViewIfNeeded();
  await expect.poll(() => wavesMotion(page)).toBe('running');
  await page.locator('.person-button').scrollIntoViewIfNeeded();
  await expect.poll(() => wavesMotion(page)).toBe('running');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'still');
  await expect.poll(() => wavesMotion(page)).toBe('paused');
  await page.evaluate(() => {
    delete (document as unknown as { hidden?: boolean }).hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => wavesMotion(page)).toBe('running');
  await expect(page.locator('[data-gradient-waves] canvas')).toHaveCount(1);
});

test('live reduced-motion change cancels decorative tracking and reveals immediately', async ({ page }) => {
  await ready(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'still');
  const card = page.locator('[data-light-card]').first();
  await card.hover();
  await expect(card).not.toHaveAttribute('data-tracking');
  expect(await card.locator('.project-art').evaluate(el => getComputedStyle(el).transform)).toBe('none');
  expect(await page.locator('.project-card').first().evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  await expect.poll(() => wavesMotion(page)).toBe('paused');
});

test('touch keeps stable covers and low-detail waves while preserving actual arm gestures', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  try {
    await ready(page);
    await page.locator('.hello-button').tap();
    await expect.poll(() => page.locator('[data-joint="shoulder"]').evaluate(el => {
      const matrix = new DOMMatrix(getComputedStyle(el).transform);
      return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
    })).toBeLessThan(-60);
    const card = page.locator('[data-light-card]').first();
    await card.scrollIntoViewIfNeeded();
    expect(await card.locator('.project-art').evaluate(el => getComputedStyle(el).transform)).toBe('none');
    await expect(page.locator('.gradient-waves-container')).toHaveAttribute('data-quality', 'low');
    await expect(card).not.toHaveAttribute('data-tracking');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await card.tap();
    await expect(page).toHaveURL('/en/work/goldencamp/');
  } finally { await context.close(); }
});

test('slow optional graphics settle to SVG within a bounded time and actual waving stays available', async ({ page }) => {
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/images/ice/studio-cubeuv.bin.gz', async route => { await gate; await route.abort(); });
  try {
    await ready(page);
    await expect(page.locator('.ice-hero-scene canvas')).toHaveCount(0);
    await expect(page.locator('.brick-stage [data-scene-fallback]')).toBeVisible();
    await page.locator('.hello-button').click();
    await expect.poll(() => page.locator('[data-joint="shoulder"]').evaluate(el => {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return Math.atan2(m.b, m.a) * 180 / Math.PI;
    })).toBeLessThan(-60);
    await expect(page.locator('main h1')).toBeVisible();
  } finally { release(); }
});

test('theme updates paper while retaining one ice canvas; SVG remains available in both palettes', async ({ page }) => {
  await ready(page);
  await expect(page.locator('.ice-hero-scene canvas')).toBeVisible();
  expect(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(245, 250, 255)');
  await page.locator('.theme-toggle').click();
  expect(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(13, 29, 50)');
  await expect(page.locator('.ice-hero-scene canvas')).toHaveCount(1);
  await page.goto('/en/?webgl=0');
  await expect(page.locator('.brick-stage [data-scene-fallback]')).toBeVisible();
  await expect(page.locator('.ice-hero-scene canvas')).toHaveCount(0);
  await page.locator('.theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.brick-stage [data-scene-fallback]')).toBeVisible();
});

test('no JavaScript still exposes all four covers, text, mail and native links', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto('/zh/');
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('.selected-grid .project-card')).toHaveCount(4);
    expect(await page.locator('.project-card').evaluateAll(items => items.every(el => getComputedStyle(el).opacity === '1' && getComputedStyle(el).visibility === 'visible'))).toBe(true);
    await expect(page.locator('.email-address')).toHaveAttribute('href', 'mailto:yumin050717@gmail.com');
    await page.locator('[data-light-card]').first().click();
    await expect(page).toHaveURL('/zh/work/goldencamp/');
  } finally { await context.close(); }
});

test('history return retains card input and a cached pagehide does not consume final cleanup', async ({ page }) => {
  await page.goto('/en/work/');
  await page.locator('[data-light-card]').first().click();
  await expect(page).toHaveURL('/en/work/goldencamp/');
  await page.goBack();
  await expect(page).toHaveURL('/en/work/');
  const card = page.locator('[data-light-card]').first();
  await card.hover();
  await expect(card).toHaveAttribute('data-tracking', 'true');
  // Explicit lifecycle injection exercises both branches even when the browser
  // chooses a fresh document rather than putting this navigation in bfcache.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await page.mouse.move(0, 0);
  await card.hover();
  await expect(card).toHaveAttribute('data-tracking', 'true');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
  await expect(card).not.toHaveAttribute('data-tracking');
  await page.mouse.move(0, 0);
  await card.hover();
  await expect(card).not.toHaveAttribute('data-tracking');
});
