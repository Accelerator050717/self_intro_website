import { expect, test, type Page } from '@playwright/test';
import { projects } from '../src/data/content';

test.use({ reducedMotion: 'no-preference', colorScheme: 'light' });

async function openWork(page: Page, lang = 'en') {
  await page.goto(`/${lang}/work/`);
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'enabled');
  await expect(page.locator('[data-work-grid] .project-card')).toHaveCount(6);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect.poll(() => page.locator('[data-work-grid]').evaluate(grid => grid.getAnimations({ subtree: true }).length)).toBe(0);
}

const visibleProjects = (page: Page) => page.locator('[data-work-grid] .project-card:not([hidden]) .project-art-link')
  .evaluateAll(links => links.map(link => link.getAttribute('href')!.split('/').filter(Boolean).at(-1)));

for (const lang of ['en', 'zh']) {
  test(`${lang} filtering updates semantics immediately and animates the real retained-card position`, async ({ page }) => {
    await openWork(page, lang);
    const result = await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>('[data-work-grid] .project-card:nth-child(2)')!;
      const before = card.getBoundingClientRect();
      document.querySelector<HTMLButtonElement>('[data-filter="ai"]')!.click();
      const animation = card.getAnimations()[0];
      return {
        before: { x: before.x, y: before.y },
        transform: getComputedStyle(card).transform,
        animation: animation && { duration: animation.effect!.getTiming().duration, frames: (animation.effect as KeyframeEffect).getKeyframes() },
        selected: document.querySelector('[data-filter="ai"]')!.getAttribute('aria-pressed'),
        visible: document.querySelectorAll('[data-work-grid] .project-card:not([hidden])').length,
        status: document.querySelector('[data-filter-status]')!.textContent,
      };
    });
    expect(result.selected).toBe('true');
    expect(result.visible).toBe(projects.filter(project => project.categories.includes('ai')).length);
    expect(result.status).toBe(lang === 'zh' ? '2 个项目' : '2 projects');
    expect(result.animation).toBeDefined();
    expect(result.animation!.duration).toBeGreaterThan(0);
    expect(result.animation!.frames[0].transform).not.toBe(result.animation!.frames.at(-1)!.transform);
    expect(result.transform).not.toBe('none');
    await expect.poll(() => page.locator('[data-work-grid]').evaluate(grid => grid.getAnimations({ subtree: true }).length)).toBe(0);
    const card = page.locator('[data-work-grid] .project-card').nth(1);
    const after = await card.boundingBox();
    expect(after!.x).toBeLessThan(result.before.x - 100);
    expect(await card.evaluate(element => getComputedStyle(element).transform)).toBe('none');
    await expect(page.locator('[data-work-grid] [data-motion-effect]')).toHaveCount(0);
    expect(await visibleProjects(page)).toEqual(['context-ai', 'ml-pipeline']);
  });
}

test('rapid filter changes keep the last selection, remove hidden motion, and leave live project links', async ({ page }) => {
  await openWork(page);
  const immediate = await page.evaluate(() => {
    for (const filter of ['ai', 'all', 'software', 'experiments']) {
      document.querySelector<HTMLButtonElement>(`[data-filter="${filter}"]`)!.click();
    }
    return {
      selected: [...document.querySelectorAll('[data-filter][aria-pressed="true"]')].map(button => (button as HTMLElement).dataset.filter),
      hiddenAnimations: [...document.querySelectorAll<HTMLElement>('.work-grid .project-card[hidden]')].reduce((count, card) => count + card.getAnimations().length, 0),
      visibleAnimations: [...document.querySelectorAll<HTMLElement>('.work-grid .project-card:not([hidden])')].map(card => card.getAnimations().length),
    };
  });
  expect(immediate.selected).toEqual(['experiments']);
  expect(immediate.hiddenAnimations).toBe(0);
  expect(immediate.visibleAnimations.every(count => count <= 1)).toBe(true);
  expect(await visibleProjects(page)).toEqual(['goldencamp', 'ml-pipeline']);
  await expect(page.locator('[data-filter-status]')).toHaveText('2 projects');
  await expect.poll(() => page.locator('[data-work-grid]').evaluate(grid => grid.getAnimations({ subtree: true }).length)).toBe(0);
  expect(await visibleProjects(page)).toEqual(['goldencamp', 'ml-pipeline']);
  await page.locator('.work-grid a[href="/en/work/goldencamp/"]').first().click();
  await expect(page).toHaveURL('/en/work/goldencamp/');
});

for (const preference of ['pause', 'reduce', 'print'] as const) {
  test(`${preference} cancels or suppresses filter animations without delaying the result`, async ({ page }) => {
    await openWork(page);
    if (preference === 'reduce') await page.emulateMedia({ reducedMotion: 'reduce' });
    if (preference === 'print') await page.emulateMedia({ media: 'print' });
    const state = await page.evaluate(cancelWithPause => {
      document.querySelector<HTMLButtonElement>('[data-filter="ai"]')!.click();
      if (cancelWithPause) document.querySelector<HTMLButtonElement>('[data-global-pause]')!.click();
      return {
        animations: document.querySelector('.work-grid')!.getAnimations({ subtree: true }).length,
        visible: document.querySelectorAll('.work-grid .project-card:not([hidden])').length,
        status: document.querySelector('[data-filter-status]')!.textContent,
      };
    }, preference === 'pause');
    expect(state).toEqual({ animations: 0, visible: 2, status: '2 projects' });
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'still');
    if (preference === 'pause') await page.locator('[data-global-pause]').click();
    if (preference === 'reduce') await page.emulateMedia({ reducedMotion: 'no-preference' });
    if (preference === 'print') await page.emulateMedia({ media: 'screen' });
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'enabled');
    const resumed = await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>('[data-filter="all"]')!.click();
      return document.querySelector('.work-grid')!.getAnimations({ subtree: true }).length;
    });
    expect(resumed).toBeGreaterThan(0);
    await expect(page.locator('.work-grid .project-card:not([hidden])')).toHaveCount(6);
  });
}

test('cover artwork has bounded pointer depth while links and text stay fixed', async ({ page }) => {
  await openWork(page);
  const card = page.locator('[data-light-card]').first();
  const illustration = card.locator('.spectrum-illustration');
  const box = (await card.boundingBox())!;
  const title = await page.locator('.project-card h3').first().boundingBox();
  await card.hover({ position: { x: 20, y: 20 } });
  await expect(card).toHaveAttribute('data-tracking', 'true');
  await expect.poll(() => illustration.evaluate(element => new DOMMatrix(getComputedStyle(element).transform).e)).toBeLessThan(-2);
  await card.hover({ position: { x: box.width - 20, y: box.height - 20 } });
  await expect.poll(() => illustration.evaluate(element => new DOMMatrix(getComputedStyle(element).transform).e)).toBeGreaterThan(2);
  const offset = await illustration.evaluate(element => {
    const transform = new DOMMatrix(getComputedStyle(element).transform);
    return { x: transform.e, y: transform.f };
  });
  expect(Math.abs(offset.x)).toBeLessThanOrEqual(5);
  expect(Math.abs(offset.y)).toBeLessThanOrEqual(4);
  expect(await card.boundingBox()).toEqual(box);
  expect(await page.locator('.project-card h3').first().boundingBox()).toEqual(title);
  await page.locator('[data-global-pause]').click();
  await expect(card).not.toHaveAttribute('data-tracking');
  expect(await illustration.evaluate(element => getComputedStyle(element).transform)).toBe('none');
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/en/work/goldencamp/');
});

test('existing project contents track actual reading position even when ambient motion is paused', async ({ page }) => {
  await page.goto('/en/work/context-ai/');
  await page.locator('[data-global-pause]').click();
  const sections = page.locator('.project-sections section[id]');
  const chosen = sections.nth(1);
  const id = await chosen.getAttribute('id');
  await chosen.evaluate(section => window.scrollTo({ top: section.getBoundingClientRect().top + scrollY - 120, behavior: 'instant' }));
  const current = page.locator('.project-aside a[aria-current="location"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAttribute('href', `#${id}`);
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'still');
  await page.locator('.project-aside a').first().click();
  await expect(page).toHaveURL(/#section-0$/);
  await expect(current).toHaveAttribute('href', '#section-0');
});

type NavigationSample = { transition: boolean; ready?: boolean; main?: string; root?: string; skipped?: boolean };
declare global {
  interface Window {
    __siteNavigation: NavigationSample[];
    __nativeSkipStats: { revealed: boolean; transition: boolean; skips: number };
  }
}

async function observeNavigation(page: Page) {
  await page.addInitScript(() => {
    window.__siteNavigation = [];
    window.addEventListener('pagereveal', event => {
      const transition = (event as Event & { viewTransition?: ViewTransition }).viewTransition;
      const record: NavigationSample = { transition: Boolean(transition) };
      window.__siteNavigation.push(record);
      if (!transition) return;
      void transition.ready.then(() => {
        record.ready = true;
        record.main = getComputedStyle(document.documentElement, '::view-transition-new(page-content)').animationName;
        record.root = getComputedStyle(document.documentElement, '::view-transition-new(root)').animationName;
      }, () => { record.skipped = true; });
    });
  });
}

test('native content transition keeps navigation real and gives the background no fade', async ({ page }) => {
  await observeNavigation(page);
  await openWork(page);
  const supportsTransition = await page.evaluate(() => 'onpagereveal' in window);
  await page.locator('.project-card a[href="/en/work/context-ai/"]').first().click();
  await expect(page).toHaveURL('/en/work/context-ai/');
  await expect(page.locator('main h1')).toHaveText(projects[1].title.en);
  if (supportsTransition) {
    await expect.poll(() => page.evaluate(() => window.__siteNavigation.find(sample => sample.transition)?.ready)).toBe(true);
    const sample = await page.evaluate(() => window.__siteNavigation.find(entry => entry.transition)!);
    expect(sample.main).toBe('content-arrival');
    expect(sample.root).toBe('none');
  }
  await expect(page.locator('[data-gradient-waves] canvas')).toHaveCount(1);
  await page.locator('[data-language-switch]').click();
  await expect(page).toHaveURL('/zh/work/context-ai/');
  await expect(page.locator('main h1')).toHaveText(projects[1].title.zh);
  await page.goBack();
  await expect(page).toHaveURL('/en/work/context-ai/');
});

test('saved global pause skips native navigation motion and remains set on the destination', async ({ page }) => {
  await observeNavigation(page);
  await openWork(page);
  await page.locator('[data-global-pause]').click();
  const supportsTransition = await page.evaluate(() => 'onpagereveal' in window);
  await page.locator('.project-card a[href="/en/work/context-ai/"]').first().click();
  await expect(page).toHaveURL('/en/work/context-ai/');
  await expect(page.locator('[data-global-pause]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'still');
  expect(await page.locator('main').evaluate(element => getComputedStyle(element).viewTransitionName)).toBe('none');
  if (supportsTransition) {
    const records = await page.evaluate(() => window.__siteNavigation);
    expect(records.every(sample => !sample.transition || sample.skipped || !sample.ready)).toBe(true);
  }
  await expect(page.locator('[data-gradient-waves] canvas')).toHaveCount(1);
});

test('native navigation has parsed opt-in before a delayed external stylesheet and still animates only main', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await observeNavigation(page);
  await openWork(page);
  let delayedStyles = 0;
  let releaseStyles!: () => void;
  const stylesReady = new Promise<void>(resolve => { releaseStyles = resolve; });
  await page.route('**/*.css', async route => {
    delayedStyles += 1;
    await stylesReady;
    await route.continue();
  });
  try {
    await page.locator('.project-card a[href="/en/work/context-ai/"]').first().click({ noWaitAfter: true });
    await page.waitForURL('/en/work/context-ai/', { waitUntil: 'commit' });
    await expect.poll(() => delayedStyles).toBeGreaterThan(0);
    // The external stylesheet is still held. The browser must already have
    // parsed the receiving document's own opt-in, before its first reveal.
    await expect.poll(() => page.evaluate(() => {
      const style = document.querySelector<HTMLStyleElement>('head style[data-navigation-opt-in]');
      return [...(style?.sheet?.cssRules ?? [])].some(rule => rule.cssText.includes('navigation: auto'));
    })).toBe(true);
  } finally {
    releaseStyles();
  }
  await page.waitForLoadState('load');
  await expect(page.locator('main h1')).toHaveText(projects[1].title.en);
  await expect.poll(() => page.evaluate(() => window.__siteNavigation.find(sample => sample.transition)?.ready)).toBe(true);
  const transition = await page.evaluate(() => window.__siteNavigation.find(sample => sample.transition)!);
  expect(transition.main).toBe('content-arrival');
  expect(transition.root).toBe('none');
  await page.locator('[data-language-switch]').click();
  await expect(page).toHaveURL('/zh/work/context-ai/');
  await expect(page.locator('main h1')).toHaveText(projects[1].title.zh);
  expect(errors).toEqual([]);
});

test('receiving head actively skips native motion without unhandled rejection while its module is delayed', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__nativeSkipStats = { revealed: false, transition: false, skips: 0 };
    window.addEventListener('pagereveal', event => {
      window.__nativeSkipStats.revealed = true;
      window.__nativeSkipStats.transition = Boolean((event as Event & { viewTransition?: ViewTransition }).viewTransition);
    });
    if ('ViewTransition' in window) {
      const skip = ViewTransition.prototype.skipTransition;
      ViewTransition.prototype.skipTransition = function () {
        window.__nativeSkipStats.skips += 1;
        return skip.call(this);
      };
    }
    // Deliberately do not read or catch ready: this regression relies on the
    // product's own handlers, not a test observer settling its promises.
  });
  await openWork(page);
  // Change the destination preference after the outgoing handlers ran. The
  // receiving document gets a real transition, then must actively skip it.
  await page.evaluate(() => {
    window.addEventListener('pageswap', () => localStorage.setItem('ice-paused', 'true'), { once: true });
  });
  let delayedModules = 0;
  let releaseModules!: () => void;
  const modulesReady = new Promise<void>(resolve => { releaseModules = resolve; });
  await page.route('**/*.js', async route => {
    delayedModules += 1;
    await modulesReady;
    await route.continue();
  });
  try {
    await page.locator('.project-card a[href="/en/work/context-ai/"]').first().click({ noWaitAfter: true });
    await page.waitForURL('/en/work/context-ai/', { waitUntil: 'commit' });
    await expect.poll(() => delayedModules).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => window.__nativeSkipStats.revealed)).toBe(true);
    const stats = await page.evaluate(() => window.__nativeSkipStats);
    expect(stats.transition).toBe(true);
    expect(stats.skips).toBeGreaterThan(0);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'still');
    await expect(page.locator('main h1')).toHaveText(projects[1].title.en);
    const motion = await page.locator('main').evaluate(element => ({
      name: getComputedStyle(element).viewTransitionName,
      active: document.getAnimations().some(animation => animation instanceof CSSAnimation && animation.animationName === 'content-arrival'),
    }));
    expect(motion).toEqual({ name: 'none', active: false });
    // Advance through actual rendered frames so rejected promises have been
    // reported before examining pageerror; no global error suppression exists.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(errors).toEqual([]);
  } finally {
    releaseModules();
  }
  await page.waitForLoadState('load');
  await expect(page.locator('[data-global-pause]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-language-switch]').click();
  await expect(page).toHaveURL('/zh/work/context-ai/');
  await expect(page.locator('[data-global-pause]')).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});
