import { test, expect, type Page } from '@playwright/test';

test.use({ reducedMotion: 'no-preference' });
const welcomeKey = 'mingyang:avatar-welcome:v1';

async function openReady(page: Page, path = '/en/', automatic = false) {
  if (!automatic) await page.addInitScript(key => sessionStorage.setItem(key, 'seen'), welcomeKey);
  await page.goto(path);
  await page.locator('.person-button').scrollIntoViewIfNeeded();
  await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-rig', 'ready');
  await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-scene-settled', 'true');
}
async function pose(page: Page) {
  return page.locator('.avatar-rig').evaluate(svg => {
    const result: Record<string, number[]> = {};
    for (const name of ['shoulder', 'elbow', 'wrist', 'head', 'body']) {
      const el = svg.querySelector(`[data-joint="${name}"], [data-part="${name}"]`) as SVGGElement;
      const m = el.getCTM()!;
      const local = new DOMMatrix(getComputedStyle(el).transform);
      result[name] = [m.a, m.b, m.c, m.d, m.e, m.f, Math.atan2(local.b, local.a) * 180 / Math.PI];
    }
    return result;
  });
}
async function expectIdle(page: Page) {
  await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-state', 'idle');
  const p = await pose(page);
  for (const joint of ['shoulder', 'elbow', 'wrist']) expect(Math.abs(p[joint][6])).toBeLessThan(.05);
  expect(await page.locator('.avatar-rig').evaluate(svg => svg.getAnimations({ subtree: true }).length)).toBe(0);
}
async function expectRaised(page: Page) {
  await expect.poll(async () => (await pose(page)).shoulder[6], { intervals: [50] }).toBeLessThan(-60);
  const p = await pose(page);
  expect(p.elbow[6]).toBeLessThan(-55);
  expect(p.head[6]).toBeLessThan(-.5);
  expect(p.body[6]).toBe(0);
  return p;
}

test('welcome articulates the actual arm once per session, including language changes and returning home', async ({ page }) => {
  await openReady(page, '/en/', true);
  await expectRaised(page);
  await expectIdle(page);
  await page.locator('[data-language-switch]').click();
  await expect(page).toHaveURL(/\/zh\/$/);
  await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-rig', 'ready');
  await page.waitForTimeout(900);
  await expectIdle(page);
  await page.locator('#site-nav a[href="/zh/work/"]').click();
  await page.locator('.site-header .brand').click();
  await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-rig', 'ready');
  await page.waitForTimeout(900);
  await expectIdle(page);
});

test('two manual greetings move shoulder, elbow, wrist and head while body and feet stay fixed', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await openReady(page);
  const idle = await pose(page);
  for (const selector of ['.person-button', '.hello-button']) {
    const sampling = page.locator('[data-joint="wrist"]').evaluate(async wrist => {
      const angles: number[] = []; const until = performance.now() + 3100;
      while (performance.now() < until) {
        const local = new DOMMatrix(getComputedStyle(wrist).transform);
        angles.push(Math.atan2(local.b, local.a) * 180 / Math.PI);
        await new Promise(requestAnimationFrame);
      }
      return angles;
    });
    await page.locator(selector).click();
    const raised = await expectRaised(page);
    expect(raised.body).toEqual(idle.body);
    const wristAngles = await sampling;
    expect(Math.max(...wristAngles) - Math.min(...wristAngles)).toBeGreaterThan(20);
    await expectIdle(page);
    expect((await pose(page)).body).toEqual(idle.body);
  }
  expect(errors).toEqual([]);
});

test('rapid clicks do not stack or queue greetings', async ({ page }) => {
  await openReady(page);
  await page.locator('.hello-button').evaluate(button => { for (let i = 0; i < 15; i++) (button as HTMLButtonElement).click(); });
  await expectRaised(page);
  expect(await page.locator('.avatar-rig').evaluate(svg => svg.getAnimations({ subtree: true }).length)).toBe(4);
  await expectIdle(page);
  await page.waitForTimeout(900);
  await expectIdle(page);
});

test('keyboard can trigger both named controls with visible focus', async ({ page }) => {
  await openReady(page);
  for (const [selector, key] of [['.hello-button', 'Enter'], ['.person-button', 'Space']]) {
    const button = page.locator(selector);
    await button.focus(); await page.keyboard.press(key);
    await expect(button).toBeFocused();
    expect(await button.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    await expectRaised(page); await expectIdle(page);
  }
});

test('pause cancels and resets joints, survives refresh, and resumes without a queue', async ({ page }) => {
  await openReady(page);
  await page.locator('.hello-button').click(); await expectRaised(page);
  await page.locator('.animation-toggle').click();
  await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-state', 'paused');
  expect((await pose(page)).shoulder[6]).toBe(0);
  expect(await page.locator('.avatar-rig').evaluate(svg => svg.getAnimations({ subtree: true }).length)).toBe(0);
  await page.locator('.hello-button').click();
  expect((await pose(page)).shoulder[6]).toBe(0);
  await page.reload();
  await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-rig', 'ready');
  await expect(page.locator('.animation-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.animation-toggle').click(); await expectIdle(page);
  await page.locator('.hello-button').click(); await expectRaised(page); await expectIdle(page);
});

test('offscreen cancels actual joint updates and returning does not replay', async ({ page }) => {
  await openReady(page);
  await page.locator('.hello-button').click(); await expectRaised(page);
  await page.locator('footer').scrollIntoViewIfNeeded();
  await expectIdle(page);
  const stopped = await pose(page); await page.waitForTimeout(600); expect(await pose(page)).toEqual(stopped);
  await page.locator('.person-button').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500); await expectIdle(page);
});

test('visibility handler cancels actual animations (injected hidden-document event)', async ({ page }) => {
  await openReady(page);
  await page.locator('.hello-button').click(); await expectRaised(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expectIdle(page);
  await page.evaluate(() => {
    delete (document as unknown as { hidden?: boolean }).hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(500); await expectIdle(page);
});

test('pointer response rotates only the head and resets on leave', async ({ page }) => {
  await openReady(page);
  const before = await pose(page);
  const bounds = (await page.locator('.person-button').boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * .9, bounds.y + bounds.height * .3);
  await expect.poll(async () => (await pose(page)).head[6]).toBeGreaterThan(1);
  expect((await pose(page)).body).toEqual(before.body);
  expect((await pose(page)).shoulder).toEqual(before.shoulder);
  await page.mouse.move(0, 0); await page.waitForTimeout(250);
  expect(Math.abs((await pose(page)).head[6])).toBeLessThan(.05);
});

test('reduced motion has no auto, wrist or pointer animation and offers static feedback', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openReady(page, '/zh/', true);
  await expectIdle(page);
  await page.locator('.person-button').hover();
  await page.locator('.hello-button').click();
  await expect(page.locator('.avatar-greeting')).not.toBeEmpty();
  await expectIdle(page);
  expect((await pose(page)).head[6]).toBe(0);
  expect(await page.evaluate(key => sessionStorage.getItem(key), welcomeKey)).toBeNull();
});

test('failed animation layer retains original figure and usable content', async ({ page }) => {
  await page.route('**/images/avatar/rig/hand.webp', route => route.abort());
  await page.goto('/en/');
  await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-rig', 'fallback');
  await expect(page.locator('.avatar-image')).toBeVisible();
  await expect(page.locator('.avatar-rig')).toHaveCount(0);
  await page.locator('.hello-button').click();
  await expect(page.locator('.avatar-greeting')).not.toBeEmpty();
  await expect(page.locator('main h1')).toBeVisible();
});

test('failed optional 3D module keeps the articulated character and SVG stage usable', async ({ page }) => {
  await page.route('**/HeroBricks*.js', route => route.abort());
  await openReady(page);
  await expect(page.locator('.brick-stage [data-scene-fallback]')).toBeVisible();
  await page.locator('.hello-button').click(); await expectRaised(page); await expectIdle(page);
  await expect(page.locator('main h1')).toBeVisible();
});

test('unavailable storage does not break manual greeting or erase other preferences', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage denied'); };
    Storage.prototype.setItem = () => { throw new Error('Storage denied'); };
    Storage.prototype.removeItem = () => { throw new Error('Storage denied'); };
  });
  await page.goto('/en/');
  await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-rig', 'ready');
  await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-scene-settled', 'true');
  await expectIdle(page);
  await page.locator('.hello-button').click(); await expectRaised(page); await expectIdle(page);
});

test('retired experiment storage is removed without clearing theme or other data', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('mingyang:ice-play:v1', '{"retired":true}');
    localStorage.setItem('ice-theme', 'dark'); localStorage.setItem('unrelated-preference', 'keep');
  });
  await openReady(page);
  expect(await page.evaluate(() => ({ retired: localStorage.getItem('mingyang:ice-play:v1'), theme: localStorage.getItem('ice-theme'), other: localStorage.getItem('unrelated-preference') }))).toEqual({ retired: null, theme: 'dark', other: 'keep' });
});

for (const width of [320, 390]) {
  test(`touch greeting at ${width}px in Chinese dark theme fits the character canvas`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('ice-theme', 'dark'));
    await openReady(page, '/zh/');
    await page.locator('.hello-button').tap(); await expectRaised(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    // The transformed visible hand rectangle must remain within the exhibit at peak pose.
    const fits = await page.locator('.avatar-exhibit').evaluate(exhibit => {
      const hand = exhibit.querySelector('[data-joint="wrist"]') as SVGGElement;
      const m = hand.getScreenCTM()!; const box = exhibit.getBoundingClientRect();
      return [[492, 636], [532, 636], [532, 687], [492, 687]].every(([x, y]) => {
        const p = new DOMPoint(x, y).matrixTransform(m);
        return p.x >= box.left && p.x <= box.right && p.y >= box.top && p.y <= box.bottom;
      });
    });
    expect(fits).toBe(true);
    await expectIdle(page);
    await page.locator('.person-button').tap(); await expectRaised(page); await expectIdle(page);
    await context.close();
  });
}
