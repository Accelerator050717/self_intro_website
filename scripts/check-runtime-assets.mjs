import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseURL = 'http://127.0.0.1:4321';
const layerNames = ['body', 'head', 'upper-arm', 'forearm', 'hand'];
const requiredRigPaths = ['/images/avatar/rig/rig.json', ...layerNames.map(name => `/images/avatar/rig/${name}.webp`)];
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const route of ['/en/', '/zh/', '/en/about/', '/en/work/', '/en/work/context-ai/', '/zh/resume/']) {
    const isHome = /^\/(en|zh)\/$/.test(route);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      const requests = [];
      const failures = [];
      page.on('request', request => requests.push(request.url()));
      page.on('requestfailed', request => failures.push({ url: request.url(), error: request.failure()?.errorText }));
      page.on('response', response => { if (response.status() >= 400) failures.push({ url: response.url(), status: response.status() }); });
      const started = Date.now();
      await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
      if (isHome) {
        await page.locator('.ice-hero-scene canvas').waitFor({ state: 'visible' });
        await page.locator('.ice-hero-scene [data-scene-fallback]').waitFor({ state: 'detached' });
        await page.locator('.avatar-exhibit[data-rig="ready"]').waitFor();
      }
      const sceneRequests = requests.filter(url => /\/(IceScene|environment)[^/]*\./.test(url));
      const avatarAssets = requests.filter(url => new URL(url).pathname.startsWith('/images/avatar/'));
      const avatarPaths = [...new Set(avatarAssets.map(url => new URL(url).pathname))];
      const frontImages = avatarPaths.filter(path => /^\/images\/avatar\/front-(480|960)\.webp$/.test(path));
      const unexpectedAvatarAssets = avatarPaths.filter(path => !requiredRigPaths.includes(path) && !frontImages.includes(path));
      const missingRigAssets = isHome ? requiredRigPaths.filter(path => !avatarPaths.includes(path)) : [];
      const retiredViewRequests = requests.filter(url => /\/images\/avatar\/(?:right|back|left|side)-[^/]+/.test(new URL(url).pathname));
      const retiredViewPreloads = await page.locator('link[rel="preload"],link[rel="prefetch"]').evaluateAll(links => links.flatMap(link => ['href', 'imagesrcset'].map(attribute => link.getAttribute(attribute) || '')).filter(value => /\/images\/avatar\/(?:right|back|left|side)-/.test(value)));
      const external = requests.filter(url => new URL(url).origin !== baseURL);
      const privateFiles = requests.filter(url => /assets\/originals|\.venv-assets|memories|Prompt\.md/.test(url));
      const expectedStaticPortrait = route.endsWith('/about/');
      const pageAssetsMatch = isHome
        ? sceneRequests.length > 0 && frontImages.length === 1 && avatarPaths.length === requiredRigPaths.length + 1
        : sceneRequests.length === 0 && avatarPaths.length === (expectedStaticPortrait ? 1 : 0) && frontImages.length === (expectedStaticPortrait ? 1 : 0);
      const passed = !external.length && !privateFiles.length && !failures.length && !retiredViewRequests.length && !retiredViewPreloads.length && !unexpectedAvatarAssets.length && !missingRigAssets.length && pageAssetsMatch;
      results.push({ route, passed, sceneReadyElapsedMs: isHome ? Date.now() - started : null, sceneRequests, avatarAssets, missingRigAssets, unexpectedAvatarAssets, retiredViewRequests, retiredViewPreloads, external, privateFiles, failures, requestCount: requests.length });
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
mkdirSync('docs/reports', { recursive: true });
writeFileSync('docs/reports/runtime-assets.json', JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
console.log(JSON.stringify(results, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
