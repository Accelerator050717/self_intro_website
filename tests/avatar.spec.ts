import { test, expect, type Page } from '@playwright/test';

test.use({ reducedMotion: 'no-preference' });
const exhibit = '.avatar-exhibit';
const person = '.person-button';

async function openReady(page: Page, path = '/en/', paused = true) {
  await page.addInitScript(value => localStorage.setItem('ice-paused', String(value)), paused);
  await page.goto(path);
  await page.locator(person).scrollIntoViewIfNeeded();
  await expect(page.locator(exhibit)).toHaveAttribute('data-rig', 'ready');
  await expect(page.locator(person)).toBeEnabled();
  // Deliberately do NOT wait for data-scene-settled: WebGL is optional.
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
async function greetingAnimations(page: Page) {
  return page.locator('.avatar-rig').evaluate(svg => svg.getAnimations({ subtree: true })
    .filter(animation => animation.id.startsWith('avatar-greeting:'))
    .map(animation => ({ id: animation.id, state: animation.playState, time: animation.currentTime })));
}
async function expectIdle(page: Page) {
  await expect(page.locator(exhibit)).toHaveAttribute('data-state', 'idle');
  await expect(page.locator(person)).toHaveAttribute('aria-busy', 'false');
  for (const joint of ['shoulder', 'elbow', 'wrist', 'head']) expect(Math.abs((await pose(page))[joint][6]), joint).toBeLessThan(.05);
  expect(await greetingAnimations(page)).toEqual([]);
}
async function expectRaised(page: Page) {
  await expect.poll(async () => (await pose(page)).shoulder[6], { intervals: [40] }).toBeLessThan(-60);
  await expect.poll(async () => (await pose(page)).elbow[6], { intervals: [40] }).toBeLessThan(-80);
  expect(Math.abs((await pose(page)).head[6])).toBeLessThan(2.1);
  expect((await pose(page)).body[6]).toBe(0);
}
async function rapidClicks(page: Page, count = 10) {
  const bounds = (await page.locator(person).boundingBox())!;
  for (let i = 0; i < count; i++) await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
}

test('home remains idle on arrival, language switch, navigation and reload; only the figure is a greeting control', async ({ page }) => {
  await openReady(page);
  await page.waitForTimeout(1100); await expectIdle(page);
  await expect(page.locator(exhibit)).toHaveAttribute('data-greeting-count', '0');
  await expect(page.locator('.hello-button, .animation-toggle, .avatar-controls, .avatar-greeting')).toHaveCount(0);
  await expect(page.locator(`${exhibit} button`)).toHaveCount(1);
  await page.locator('[data-language-switch]').click();
  await expect(page).toHaveURL('/zh/');
  await expect(page.locator(exhibit)).toHaveAttribute('data-rig', 'ready');
  await page.waitForTimeout(800); await expectIdle(page);
  await page.locator('#site-nav a[href="/zh/work/"]').click();
  await page.locator('.site-header .brand').click();
  await expect(page.locator(exhibit)).toHaveAttribute('data-rig', 'ready');
  await expectIdle(page);
  await page.reload();
  await expect(page.locator(exhibit)).toHaveAttribute('data-rig', 'ready');
  await expectIdle(page);
});

test('real joint motion includes anticipation, staggered starts, a raised pause, damped wrist reversals and an exact final pose', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openReady(page);
  const idle = await pose(page);
  const sampling = page.locator('.avatar-rig').evaluate(async svg => {
    const samples: { state: string; angles: Record<string, number>; body: number[] }[] = [];
    const until = performance.now() + 3900;
    while (performance.now() < until) {
      const angles: Record<string, number> = {};
      for (const name of ['shoulder', 'elbow', 'wrist', 'head']) {
        const joint = svg.querySelector(`[data-joint="${name}"]`)!;
        const matrix = new DOMMatrix(getComputedStyle(joint).transform);
        angles[name] = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
      }
      const m = (svg.querySelector('[data-part="body"]') as SVGGElement).getCTM()!;
      samples.push({ state: svg.closest('.avatar-exhibit')!.getAttribute('data-state')!, angles, body: [m.a, m.b, m.c, m.d, m.e, m.f] });
      await new Promise(requestAnimationFrame);
    }
    return samples;
  });
  await page.locator(person).click();
  await expectRaised(page);
  const samples = await sampling;
  const phases = samples.map(sample => sample.state).filter((state, index, all) => index === 0 || state !== all[index - 1]);
  expect(phases.filter(state => state !== 'idle')).toEqual(['preparing', 'raising', 'waving', 'recovering']);
  const preparation = samples.filter(sample => sample.state === 'preparing');
  expect(Math.max(...preparation.map(sample => sample.angles.shoulder))).toBeGreaterThan(2);
  expect(preparation.some(sample => sample.angles.shoulder > 1 && Math.abs(sample.angles.elbow) < .1 && Math.abs(sample.angles.wrist) < .1)).toBe(true);
  const waving = samples.filter(sample => sample.state === 'waving');
  expect(waving.filter(sample => Math.abs(sample.angles.shoulder + 64) < 1).length).toBeGreaterThan(5);
  const wrist = waving.map(sample => sample.angles.wrist);
  expect(Math.max(...wrist)).toBeGreaterThan(10);
  expect(Math.min(...wrist)).toBeLessThan(-9);
  const extremums = wrist.filter((value, index) => index > 0 && index < wrist.length - 1 &&
    ((value > wrist[index - 1] && value >= wrist[index + 1]) || (value < wrist[index - 1] && value <= wrist[index + 1])));
  expect(extremums.filter(value => value > 5).length).toBeGreaterThanOrEqual(2);
  expect(extremums.filter(value => value < -5).length).toBeGreaterThanOrEqual(2);
  expect(samples.every(sample => Math.abs(sample.angles.head) <= 2.1)).toBe(true);
  expect(samples.every(sample => JSON.stringify(sample.body) === JSON.stringify(idle.body.slice(0, 6)))).toBe(true);
  await expectIdle(page);
  expect((await pose(page)).body).toEqual(idle.body);
  expect(errors).toEqual([]);
});

test('synchronous lock rejects same-task clicks before React renders', async ({ page }) => {
  await openReady(page);
  await page.locator(person).evaluate(button => { for (let i = 0; i < 11; i++) (button as HTMLButtonElement).click(); });
  await expect(page.locator(exhibit)).toHaveAttribute('data-greeting-count', '1');
  expect(await greetingAnimations(page)).toHaveLength(4);
  await expectRaised(page); await expectIdle(page);
  await page.waitForTimeout(600); await expectIdle(page);
  await expect(page.locator(exhibit)).toHaveAttribute('data-greeting-count', '1');
});

for (const phase of ['preparing', 'raising', 'waving', 'recovering']) {
  test(`10 trusted clicks during ${phase} neither restart, interrupt nor queue an action`, async ({ page }) => {
    await openReady(page);
    await page.locator(person).click();
    await expect(page.locator(exhibit)).toHaveAttribute('data-state', phase);
    const before = await greetingAnimations(page);
    const announcement = await page.locator('.avatar-announcement').textContent();
    await rapidClicks(page);
    await expect(page.locator(exhibit)).toHaveAttribute('data-greeting-count', '1');
    const after = await greetingAnimations(page);
    expect(after.map(animation => animation.id)).toEqual(before.map(animation => animation.id));
    expect(Number(after[0].time)).toBeGreaterThanOrEqual(Number(before[0].time));
    if (phase === 'waving') expect(await page.locator('.avatar-announcement').textContent()).toBe(announcement);
    await expectIdle(page);
    await page.waitForTimeout(700); await expectIdle(page);
    await expect(page.locator(exhibit)).toHaveAttribute('data-greeting-count', '1');
    await page.locator(person).click(); await expectRaised(page); await expectIdle(page);
    await expect(page.locator(exhibit)).toHaveAttribute('data-greeting-count', '2');
  });
}

test('lock remains until the final joint finishes, even after the wrist is neutral', async ({ page }) => {
  await openReady(page);
  await page.locator(person).click();
  await expect.poll(async () => (await greetingAnimations(page)).find(animation => animation.id.endsWith(':wrist'))?.state, { intervals: [20] }).toBe('finished');
  await expect(page.locator(exhibit)).toHaveAttribute('data-state', 'recovering');
  expect(Math.abs((await pose(page)).wrist[6])).toBeLessThan(.05);
  expect(Math.abs((await pose(page)).shoulder[6])).toBeGreaterThan(1);
  await rapidClicks(page);
  await expect(page.locator(exhibit)).toHaveAttribute('data-greeting-count', '1');
  await expectIdle(page);
  await page.locator(person).click(); await expectRaised(page); await expectIdle(page);
});

test('Enter and Space trigger the native figure control with visible focus; held/repeated keys do not queue', async ({ page }) => {
  await openReady(page);
  let accepted = 0;
  for (const key of ['Enter', 'Space']) {
    await page.locator(person).focus(); await page.keyboard.down(key);
    for (let i = 0; i < 10; i++) await page.keyboard.down(key);
    await page.keyboard.up(key);
    await expect(page.locator(person)).toBeFocused();
    expect(await page.locator(person).evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    await expectRaised(page); await expectIdle(page);
    await expect(page.locator(exhibit)).toHaveAttribute('data-greeting-count', String(++accepted));
  }
});

test('background pause persists and stops ambient motion but does not block an explicit figure greeting', async ({ page }) => {
  await openReady(page);
  await expect(page.locator('[data-global-pause]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator(person).click(); await expectRaised(page); await expectIdle(page);
  await page.reload();
  await expect(page.locator(exhibit)).toHaveAttribute('data-rig', 'ready');
  await expect(page.locator('[data-global-pause]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator(person).click(); await expectRaised(page); await expectIdle(page);
});

test('offscreen cancellation resets every joint and does not replay on returning', async ({ page }) => {
  await openReady(page);
  await page.locator(person).click(); await expectRaised(page);
  await page.locator('footer').scrollIntoViewIfNeeded();
  await expectIdle(page);
  const stopped = await pose(page); await page.waitForTimeout(500); expect(await pose(page)).toEqual(stopped);
  await page.locator(person).scrollIntoViewIfNeeded();
  await page.waitForTimeout(250); await expectIdle(page);
  await page.locator(person).click(); await expectRaised(page); await expectIdle(page);
});

test('hidden-document, cached-page and print handlers cancel and unlock safely (explicit lifecycle injection)', async ({ page }) => {
  await openReady(page);
  for (const interruption of ['hidden', 'pagehide', 'print']) {
    await page.locator(person).click(); await expectRaised(page);
    await page.evaluate(kind => {
      if (kind === 'hidden') {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
      } else window.dispatchEvent(kind === 'print' ? new Event('beforeprint') : new PageTransitionEvent('pagehide', { persisted: true }));
    }, interruption);
    await expectIdle(page);
    const count = await page.locator(exhibit).getAttribute('data-greeting-count');
    await page.locator(person).evaluate(button => (button as HTMLButtonElement).click());
    await expect(page.locator(exhibit)).toHaveAttribute('data-greeting-count', count!);
    await page.evaluate(kind => {
      if (kind === 'hidden') {
        delete (document as unknown as { hidden?: boolean }).hidden;
        document.dispatchEvent(new Event('visibilitychange'));
      } else window.dispatchEvent(kind === 'print' ? new Event('afterprint') : new PageTransitionEvent('pageshow', { persisted: true }));
    }, interruption);
    await page.waitForTimeout(100); await expectIdle(page);
  }
  await page.locator(person).click(); await expectRaised(page); await expectIdle(page);
});

for (const failure of ['cancelled-joint', 'initialization']) {
  test(`${failure} resets a partially running gesture; the next greeting completes`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await openReady(page);
    if (failure === 'initialization') await page.locator('[data-joint="wrist"]').evaluate(el => {
      const original = el.animate;
      el.animate = function (...args) { el.animate = original; throw new Error(`Injected animation failure: ${args.length} arguments`); };
    });
    await page.locator(person).click();
    if (failure === 'cancelled-joint') {
      await expectRaised(page);
      await page.locator('.avatar-rig').evaluate(svg => svg.getAnimations({ subtree: true }).find(animation => animation.id.endsWith(':elbow'))!.cancel());
    }
    await expectIdle(page);
    await page.locator(person).click(); await expectRaised(page); await expectIdle(page);
    expect(errors).toEqual([]);
  });
}

test('a stalled native animation is bounded by cleanup and cannot lock later greetings', async ({ page }) => {
  await openReady(page);
  await page.locator(person).click();
  await page.locator('.avatar-rig').evaluate(svg => svg.getAnimations({ subtree: true }).find(animation => animation.id.endsWith(':shoulder'))!.pause());
  await rapidClicks(page);
  await expect(page.locator(exhibit)).toHaveAttribute('data-greeting-count', '1');
  await expectIdle(page);
  await page.locator(person).click(); await expectRaised(page); await expectIdle(page);
  await expect(page.locator(exhibit)).toHaveAttribute('data-greeting-count', '2');
});

test('repeated navigation and theme switches do not stack rigs or leave an action locked', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openReady(page);
  for (let i = 0; i < 3; i++) {
    await page.locator(person).click(); await expectRaised(page);
    await page.locator('.theme-toggle').click();
    await expect(page.locator(exhibit)).toHaveAttribute('data-greeting-count', '1');
    await page.locator('#site-nav a[href="/en/work/"]').click();
    await page.locator('.site-header .brand').click();
    await expect(page.locator(exhibit)).toHaveAttribute('data-rig', 'ready');
    await expect(page.locator('.avatar-rig')).toHaveCount(1);
    await expectIdle(page);
    await expect(page.locator(exhibit)).toHaveAttribute('data-greeting-count', '0');
  }
  await page.locator(person).click(); await expectRaised(page); await expectIdle(page);
  expect(errors).toEqual([]);
});

test('fine-pointer response moves only the head and blends from its current pose into greeting', async ({ page }) => {
  await openReady(page, '/en/', false);
  const idle = await pose(page);
  const bounds = (await page.locator(person).boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * .9, bounds.y + bounds.height * .3);
  await expect.poll(async () => (await pose(page)).head[6]).toBeGreaterThan(1);
  expect((await pose(page)).body).toEqual(idle.body);
  expect((await pose(page)).shoulder).toEqual(idle.shoulder);
  await page.mouse.down(); await page.mouse.up();
  await expectRaised(page); await expectIdle(page);
  await page.mouse.move(0, 0); await page.waitForTimeout(200); await expectIdle(page);
});

test('live reduced motion cancels ongoing joint motion and provides a finite locked static acknowledgement', async ({ page }) => {
  await openReady(page, '/zh/');
  await page.locator(person).click(); await expectRaised(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expectIdle(page);
  await page.locator(person).click(); await rapidClicks(page);
  await expect(page.locator('.avatar-announcement')).not.toBeEmpty();
  expect(await greetingAnimations(page)).toEqual([]);
  expect((await pose(page)).shoulder[6]).toBe(0);
  await expectIdle(page);
  await expect(page.locator(exhibit)).toHaveAttribute('data-greeting-count', '2');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator(person).click(); await expectRaised(page); await expectIdle(page);
});

test('failed character layer retains the supplied full figure and a usable static greeting', async ({ page }) => {
  await page.route('**/images/avatar/rig/hand.webp', route => route.abort());
  await page.goto('/en/');
  await expect(page.locator(exhibit)).toHaveAttribute('data-rig', 'fallback');
  await expect(page.locator('.avatar-image')).toBeVisible();
  await expect(page.locator('.avatar-rig')).toHaveCount(0);
  await page.locator(person).click();
  await expect(page.locator('.avatar-announcement')).not.toBeEmpty();
  await expect(page.locator(exhibit)).toHaveAttribute('data-state', 'idle');
  await expect(page.locator('main h1')).toBeVisible();
});

test('a stalled ice scene module cannot disable a ready articulated character', async ({ page }) => {
  let release!: () => void;
  const stalled = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/HeroBricks*.js', async route => { await stalled; await route.abort(); });
  try {
    await openReady(page);
    await page.waitForTimeout(550);
    await expect(page.locator(exhibit)).toHaveAttribute('data-scene-settled', 'false');
    await page.locator(person).click(); await expectRaised(page); await expectIdle(page);
  } finally { release(); }
});

test('unavailable storage preserves manual input and original content', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage denied'); };
    Storage.prototype.setItem = () => { throw new Error('Storage denied'); };
    Storage.prototype.removeItem = () => { throw new Error('Storage denied'); };
  });
  await page.goto('/en/');
  await expect(page.locator(exhibit)).toHaveAttribute('data-rig', 'ready');
  await page.locator(person).click(); await expectRaised(page); await expectIdle(page);
});

test('retired experiment storage is removed without clearing theme or unrelated data', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('mingyang:ice-play:v1', '{"retired":true}');
    localStorage.setItem('ice-theme', 'dark'); localStorage.setItem('unrelated-preference', 'keep');
  });
  await openReady(page);
  expect(await page.evaluate(() => ({ retired: localStorage.getItem('mingyang:ice-play:v1'), theme: localStorage.getItem('ice-theme'), other: localStorage.getItem('unrelated-preference') }))).toEqual({ retired: null, theme: 'dark', other: 'keep' });
});

for (const width of [320, 390]) {
  test(`trusted taps at ${width}px in Chinese dark theme are locked during motion and work again after reset`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    try {
      await page.addInitScript(() => localStorage.setItem('ice-theme', 'dark'));
      await openReady(page, '/zh/');
      await page.locator(person).tap();
      const bounds = (await page.locator(person).boundingBox())!;
      for (let i = 0; i < 10; i++) await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await expect(page.locator(exhibit)).toHaveAttribute('data-greeting-count', '1');
      await expectRaised(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const fits = await page.locator(exhibit).evaluate(el => {
        const matrix = (el.querySelector('[data-joint="wrist"]') as SVGGElement).getScreenCTM()!;
        const box = el.getBoundingClientRect();
        return [[492, 636], [532, 636], [532, 687], [492, 687]].every(([x, y]) => {
          const point = new DOMPoint(x, y).matrixTransform(matrix);
          return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
        });
      });
      expect(fits).toBe(true);
      await expectIdle(page);
      await page.locator(person).tap(); await expectRaised(page); await expectIdle(page);
      await expect(page.locator(exhibit)).toHaveAttribute('data-greeting-count', '2');
    } finally { await context.close(); }
  });
}
