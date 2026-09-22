import { test as base, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { projects } from '../src/data/content';
import { siteContact } from '../src/data/site-config';
import { mainPages, route, ui } from '../src/i18n/ui';

const test = base.extend<{ allow404: boolean; runtimeAudit: void }>({
  allow404: [false, { option: true }],
  runtimeAudit: [async ({ page, allow404 }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(`Uncaught: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error' && !(allow404 && message.text().includes('404'))) errors.push(`Console: ${message.text()}`);
    });
    page.on('requestfailed', request => {
      const failure = request.failure()?.errorText || 'Unknown network failure';
      // A page transition may cancel a request from the previous document.
      if (!failure.includes('ERR_ABORTED')) errors.push(`Network: ${request.url()} — ${failure}`);
    });
    page.on('response', response => {
      if (response.status() >= 400 && !(allow404 && response.status() === 404)) errors.push(`HTTP ${response.status()}: ${response.url()}`);
    });
    await use();
    expect(errors, 'No unexplained browser or resource failures').toEqual([]);
  }, { auto: true }],
});

test.use({ reducedMotion: 'reduce', colorScheme: 'light' });

async function open(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.ok(), `${path} returns successful HTML`).toBe(true);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('main h1')).toBeVisible();
}

async function noHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(dimensions.document, `Document width at ${dimensions.viewport}px`).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body, `Body width at ${dimensions.viewport}px`).toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function waitForRenderedScene(page: Page) {
  const scene = page.locator('.ice-hero-scene');
  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute('data-scene', 'webgl');
  await expect(scene.locator('canvas')).toBeVisible();
  await expect(scene.locator('[data-scene-fallback]')).toHaveCount(0);
  expect(await scene.locator('canvas').evaluate(canvas => canvas instanceof HTMLCanvasElement && canvas.width > 0 && canvas.height > 0)).toBe(true);
  test.info().annotations.push({ type: 'scene-evidence', description: 'hero: visible WebGL canvas with SVG fallback removed after first frame' });
  await page.evaluate(() => window.scrollTo(0, 0));
}

test('root provides a working English entrance', async ({ page }) => {
  await open(page, '/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('link', { name: ui.en.explore, exact: true })).toHaveAttribute('href', '/en/work/');
});

test('built pages and scripts exclude the retired playground and old contact address', () => {
  const buildRoot = resolve('dist');
  expect(existsSync(buildRoot), 'Production build exists before browser acceptance').toBe(true);
  for (const lang of ['en', 'zh']) expect(existsSync(join(buildRoot, lang, 'play', 'index.html'))).toBe(false);
  const artifacts = readdirSync(buildRoot, { recursive: true, encoding: 'utf8' }).filter(file => /\.(?:html|js|xml)$/.test(file));
  expect(artifacts.length).toBeGreaterThan(0);
  for (const file of artifacts) {
    const output = readFileSync(join(buildRoot, file), 'utf8');
    expect(output, file).not.toMatch(/myu12@uci\.edu|Ice Playground|["']ice-playground(?:["' ])|\/(?:en|zh)\/play\//i);
  }
});

for (const lang of ['en', 'zh'] as const) {
  test(`${lang} main pages have localized content, metadata, and real links`, async ({ page }) => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const path of ['', ...mainPages]) {
      await open(page, route(lang, path));
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      titles.add(await page.title());
      const description = page.locator('meta[name="description"]');
      await expect(description).toHaveAttribute('content', lang === 'zh' ? /[\u4e00-\u9fff]/ : /[a-zA-Z]/);
      descriptions.add((await description.getAttribute('content'))!);
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', await page.title());
      await expect(page.locator('a[href="#"], a[href=""], img[src=""]')).toHaveCount(0);
      await expect(page.locator(`footer a[href="${siteContact.mailto}"]`)).toBeVisible();
      await expect(page.locator(`a[href="${siteContact.github}"]`).first()).toBeVisible();
      await expect(page.locator('#site-nav a')).toHaveCount(mainPages.length);
      expect(await page.locator('#site-nav a').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(mainPages.map(section => route(lang, section)));
      await expect(page.locator('a[href$="/play/"], a[href$="/play"], .play-teaser')).toHaveCount(0);
      expect(await page.locator('body').innerText()).not.toMatch(/Ice Playground|冰积木(?:乐园|游乐场)/i);
      expect(await page.locator('a[href^="mailto:"]').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(expect.arrayContaining([siteContact.mailto]));
      expect(await page.locator('a[href^="mailto:"]').evaluateAll(links => links.every(link => link.getAttribute('href') === links[0].getAttribute('href')))).toBe(true);
      expect(await page.locator('img').evaluateAll(images => images.every(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
    }
    expect(titles.size).toBe(4);
    expect(descriptions.size).toBe(4);
  });

  for (const project of projects) {
    test(`${lang} ${project.slug} supports direct access and refresh`, async ({ page }) => {
      const path = route(lang, `work/${project.slug}`);
      await open(page, path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(project.title[lang]);
      await expect(page.getByText(ui[lang].diagram, { exact: true }).first()).toBeVisible();
      const refreshed = await page.reload();
      expect(refreshed?.ok()).toBe(true);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(project.title[lang]);
      await expect(page.locator(`a[href="${route(lang, 'work')}"]`).first()).toBeVisible();
    });
  }

  test(`${lang} project filters expose the matching set and selection state`, async ({ page }) => {
    await open(page, route(lang, 'work'));
    const cards = page.locator('article.project-card');
    await expect(cards).toHaveCount(6);
    for (const category of ['ai', 'software', 'experiments', 'all'] as const) {
      const button = page.locator(`[data-filter="${category}"]`);
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('[data-filter][aria-pressed="true"]')).toHaveCount(1);
      const expected = category === 'all' ? projects : projects.filter(project => project.categories.includes(category));
      await expect(page.locator('article.project-card:not([hidden])')).toHaveCount(expected.length);
      for (const project of expected) {
        await expect(page.locator(`article.project-card a[href="${route(lang, `work/${project.slug}`)}"]`).first()).toBeVisible();
      }
    }
  });
}

test('language switching retains a deep project page in both directions', async ({ page }) => {
  await open(page, '/en/work/context-ai/');
  await page.locator('[data-language-switch]').click();
  await expect(page).toHaveURL(/\/zh\/work\/context-ai\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(projects[1].title.zh);
  await page.locator('[data-language-switch]').click();
  await expect(page).toHaveURL(/\/en\/work\/context-ai\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(projects[1].title.en);
});

test('theme choice updates the page and survives refresh', async ({ page }) => {
  await open(page, '/en/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('.theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('ice-theme'))).toBe('dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.theme-toggle')).toHaveAttribute('aria-label', ui.en.light);
  await waitForRenderedScene(page);
  await page.screenshot({ path: `${process.env.SCREENSHOT_DIRECTORY || 'docs/screenshots/revision'}/dark-home.png`, fullPage: true });
});

for (const width of [320, 360, 390, 768, 1024, 1440]) {
  test(`pages remain within a ${width}px viewport`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/en/', '/zh/', '/en/work/', '/zh/about/', '/zh/resume/', '/en/work/yunxinyi/']) {
      await open(page, path);
      await noHorizontalOverflow(page);
    }
  });
}

test('mobile navigation opens, closes with Escape, and follows a link', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/en/');
  const toggle = page.locator('.menu-toggle');
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(toggle).toBeVisible();
  await expect(navigation).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(navigation).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(navigation).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await navigation.getByRole('link', { name: 'Work', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/work\/$/);
  await expect(page.locator('.menu-toggle')).toHaveAttribute('aria-expanded', 'false');
});

for (const lang of ['en', 'zh'] as const) {
  test(`${lang} reduced-motion character stays clear, responds, and preserves pause`, async ({ page }) => {
    await open(page, route(lang));
    await expect(page.locator('.person-button')).toBeVisible();
    await expect(page.locator('img.avatar-image')).toHaveAttribute('src', '/images/avatar/front-960.webp');
    expect(await page.locator('img.avatar-image').evaluate(image => (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await expect(page.locator('.view-control, .avatar-caption')).toHaveCount(0);
    await expect(page.locator('.hello-button')).toHaveText(ui[lang].hello);
    await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-state', 'idle');
    await expect(page.getByRole('button', { name: ui[lang].greet, exact: true })).toBeEnabled();
    await page.getByRole('button', { name: ui[lang].greet, exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.avatar-greeting')).toHaveText(ui[lang].greeting);
    await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-state', 'idle');
    await page.getByRole('button', { name: ui[lang].hello, exact: true }).click();
    await expect(page.locator('.avatar-greeting')).toHaveText(ui[lang].greeting);
    await page.getByRole('button', { name: ui[lang].pause, exact: true }).click();
    expect(await page.evaluate(() => localStorage.getItem('ice-paused'))).toBe('true');
    await page.reload();
    await expect(page.getByRole('button', { name: ui[lang].resumeAnimation, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-state', 'paused');
    await page.getByRole('button', { name: ui[lang].resumeAnimation, exact: true }).click();
    await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-state', 'idle');
  });
}

test('email copy succeeds with clipboard permission and reports the actual address', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, '/en/');
  await page.getByRole('button', { name: ui.en.copy, exact: true }).click();
  await expect(page.locator('.copy-status')).toHaveText(ui.en.copied);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(siteContact.email);
});

test('clipboard rejection reports failure and selects the usable email address', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'clipboard', {
      configurable: true,
      get: () => ({ writeText: async () => { throw new Error('Clipboard blocked for this test'); } }),
    });
  });
  await open(page, '/zh/');
  await page.getByRole('button', { name: ui.zh.copy, exact: true }).click();
  await expect(page.locator('.copy-status')).toHaveText(ui.zh.copyFailed);
  await expect(page.locator('.copy-status')).not.toHaveText(ui.zh.copied);
  await expect(page.locator('[data-email-text]')).toBeFocused();
  expect(await page.evaluate(() => getSelection()?.toString())).toContain(siteContact.email);
});

test('missing Clipboard API leaves a selectable address and honest failure feedback', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'clipboard', { configurable: true, get: () => undefined });
  });
  await open(page, '/en/');
  await page.getByRole('button', { name: ui.en.copy, exact: true }).click();
  await expect(page.locator('.copy-status')).toHaveText(ui.en.copyFailed);
  await expect(page.locator('[data-email-text]')).toHaveAttribute('href', siteContact.mailto);
  expect(await page.evaluate(() => getSelection()?.toString())).toContain(siteContact.email);
});

test('web resume provides print behavior without an invented PDF download', async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => {
      const root = document.documentElement;
      root.dataset.printCalls = String(Number(root.dataset.printCalls || 0) + 1);
    };
  });
  await open(page, '/en/resume/');
  await expect(page.locator('a[href$=".pdf"]')).toHaveCount(0);
  await page.getByRole('button', { name: ui.en.print, exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-print-calls', '1');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.site-header')).toBeHidden();
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('.resume-contact a').first()).toHaveText(siteContact.email);
  await expect(page.locator('.resume-contact a').first()).toHaveAttribute('href', siteContact.mailto);
});

test('WebGL fallback keeps the character, greeting, and page content usable', async ({ page }) => {
  await open(page, '/en/?webgl=0');
  const stage = page.locator('.ice-hero-scene');
  await expect(stage).toHaveAttribute('data-scene', 'svg');
  await expect(stage.locator('svg')).toBeVisible();
  await expect(page.locator('.person-button')).toBeVisible();
  const hello = page.getByRole('button', { name: ui.en.hello, exact: true });
  await hello.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.avatar-greeting')).toHaveText(ui.en.greeting);
  await expect(page.locator('main h1')).toBeVisible();
  await expect(stage.locator('canvas')).toHaveCount(0);
});

test('saves the current desktop, mobile, and project views', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, '/en/');
  await waitForRenderedScene(page);
  await page.screenshot({ path: `${process.env.SCREENSHOT_DIRECTORY || 'docs/screenshots/revision'}/desktop-home.png`, fullPage: true });
  await open(page, '/en/work/context-ai/');
  await page.screenshot({ path: `${process.env.SCREENSHOT_DIRECTORY || 'docs/screenshots/revision'}/project-detail.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/en/');
  await waitForRenderedScene(page);
  await page.screenshot({ path: `${process.env.SCREENSHOT_DIRECTORY || 'docs/screenshots/revision'}/mobile-home.png`, fullPage: true });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('core pages, project content, and language links remain usable', async ({ page }) => {
    await open(page, '/en/');
    await expect(page.getByRole('link', { name: ui.en.explore, exact: true })).toBeVisible();
    await expect(page.locator('img.avatar-image')).toBeVisible();
    await page.locator('[data-language-switch]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh');
    await open(page, '/en/work/');
    await expect(page.locator('article.project-card')).toHaveCount(6);
    await expect(page.locator('article.project-card:visible')).toHaveCount(6);
    await open(page, '/en/resume/');
    await expect(page.locator('.resume-contact a').first()).toHaveText(siteContact.email);
  });
});

test.describe('not-found routes', () => {
  test.use({ allow404: true });
  for (const lang of ['en', 'zh'] as const) {
    test(`${lang} retired playground route returns the normal 404`, async ({ page }) => {
      const response = await page.goto(`/${lang}/play/`);
      expect(response?.status()).toBe(404);
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('.ice-playground')).toHaveCount(0);
      await expect(page.locator('main a[href="/en/"]')).toBeVisible();
      await expect(page.locator('main a[href="/en/work/"]')).toBeVisible();
    });
  }
  test('404 exposes usable home and work links', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist/');
    expect(response?.status()).toBe(404);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('main a[href="/en/"]')).toBeVisible();
    await expect(page.locator('main a[href="/en/work/"]')).toBeVisible();
  });
});
