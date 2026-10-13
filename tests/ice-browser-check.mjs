import { chromium, expect as baseExpect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, process.env.REPORT_DIRECTORY || 'docs/reports/avatar-interaction');
const images = path.join(root, process.env.SCREENSHOT_DIRECTORY || 'docs/screenshots/avatar-interaction/after');
const base = process.env.BASE_URL || 'http://127.0.0.1:4321';
const report = {
  startedAt: new Date().toISOString(), finishedAt: '', base,
  browser: 'Installed Chrome, headless', scope: 'Hero ice scene, transparent composition, local pointer feedback and finite gesture integration',
  passed: false, failure: '', checks: [], measurements: {}, browsersClosed: false,
  pageErrors: [], consoleErrors: [], warnings: [], warningNotes: '',
  visibilityNote: 'Offscreen uses real scrolling. Hidden-page handling uses a document.hidden override and a visibilitychange event; it is not a real operating-system background-tab test.',
};
await Promise.all([mkdir(images, { recursive: true }), mkdir(output, { recursive: true })]);
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
    const probe = { serial: 0, snapshot: null };
    Object.defineProperty(window, '__iceProbe', { value: probe });
    const locations = new WeakMap();
    const states = new WeakMap();
    const stateFor = gl => {
      if (!states.has(gl)) states.set(gl, { queued: false, draws: [] });
      return states.get(gl);
    };
    const capture = gl => {
      const state = stateFor(gl);
      state.queued = false;
      if (gl.isContextLost() || gl.getParameter(gl.FRAMEBUFFER_BINDING) !== null) return;
      const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let edgePixels = 0, nonzeroEdge = 0, maxEdgeAlpha = 0, opaquePixels = 0;
      const luminance = [];
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4, alpha = pixels[index + 3];
        if (alpha === 255) opaquePixels++;
        if (x < 2 || x >= width - 2 || y < 2 || y >= height - 2) {
          edgePixels++; if (alpha) nonzeroEdge++;
          maxEdgeAlpha = Math.max(maxEdgeAlpha, alpha);
        }
        if (x > width * .26 && x < width * .75 && y > height * .08 && y < height * .35 && alpha >= 250) {
          luminance.push(pixels[index] * .2126 + pixels[index + 1] * .7152 + pixels[index + 2] * .0722);
        }
      }
      if (opaquePixels > 100) {
        probe.serial++;
        probe.snapshot = {
          serial: probe.serial, width, height, alphaContext: gl.getContextAttributes()?.alpha,
          edge: { pixels: edgePixels, nonzeroAlphaPixels: nonzeroEdge, maxAlpha: maxEdgeAlpha },
          opaquePixels,
          brick: { sampledOpaquePixels: luminance.length,
            meanLuminance: luminance.reduce((sum, value) => sum + value, 0) / luminance.length,
            blackFraction: luminance.filter(value => value < 10).length / luminance.length },
          draws: state.draws, glError: gl.getError(),
        };
      }
      state.draws = [];
    };
    // Test-side GL observation: no product hooks/userData and no screenshot-only
    // inference of a tilt. Read before browser compositing discards the frame.
    for (const prototype of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype]) {
      if (!prototype) continue;
      const getUniformLocation = prototype.getUniformLocation;
      prototype.getUniformLocation = function (...args) {
        const location = Reflect.apply(getUniformLocation, this, args);
        if (location) {
          if (!locations.has(args[0])) locations.set(args[0], new Map());
          locations.get(args[0]).set(args[1], location);
        }
        return location;
      };
      for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        const original = prototype[method];
        if (typeof original !== 'function') continue;
        prototype[method] = function (...args) {
          const result = Reflect.apply(original, this, args);
          if (this.canvas?.closest('.ice-hero-scene')) {
            if (calls.firstDrawAt === null) {
              calls.firstDrawAt = performance.now();
              calls.firstDrawHadFallback = Boolean(document.querySelector('.ice-hero-scene > svg'));
            }
            calls.total++;
            const state = stateFor(this);
            if (this.getParameter(this.FRAMEBUFFER_BINDING) === null) {
              const program = this.getParameter(this.CURRENT_PROGRAM);
              const uniforms = {};
              for (const name of ['modelMatrix', 'modelViewMatrix', 'projectionMatrix', 'envMapIntensity', 'roughness']) {
                const location = locations.get(program)?.get(name);
                if (!location) continue;
                const value = this.getUniform(program, location);
                uniforms[name] = ArrayBuffer.isView(value) ? Array.from(value) : value;
              }
              state.draws.push({ method, count: method.startsWith('drawElements') ? args[1] : args[2], ...uniforms });
              if (!state.queued) { state.queued = true; queueMicrotask(() => capture(this)); }
            }
          }
          return result;
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
async function recordComposition(page, key) {
  await page.waitForFunction(() => window['__iceProbe'].snapshot?.opaquePixels > 100);
  const { draws: _draws, ...snapshot } = await page.evaluate(() => window['__iceProbe'].snapshot);
  expect(snapshot.alphaContext).toBe(true);
  expect(snapshot.edge.nonzeroAlphaPixels).toBe(0);
  expect(snapshot.edge.maxAlpha).toBe(0);
  expect(snapshot.brick.sampledOpaquePixels).toBeGreaterThan(100);
  expect(snapshot.brick.meanLuminance).toBeGreaterThan(35);
  expect(snapshot.brick.blackFraction).toBeLessThan(.05);
  expect(snapshot.glError).toBe(0);
  report.measurements[key] = snapshot;
}
async function peripheralBrick(page) {
  return page.evaluate(() => {
    const frame = window['__iceProbe'].snapshot;
    const draw = frame?.draws.find(item => item.modelMatrix && item.count > 100 && !item.method.includes('Instanced')
      && Math.abs(item.modelMatrix[12] + 2.1) < .001 && Math.abs(item.modelMatrix[14] - 1.4) < .001);
    if (!draw) return null;
    const canvas = document.querySelector('.ice-hero-scene canvas').getBoundingClientRect();
    const multiply = (matrix, vector) => [0, 1, 2, 3].map(row => vector.reduce((sum, value, col) => sum + matrix[col * 4 + row] * value, 0));
    // Front/top face points on the exposed left decorative brick, in local space.
    const point = (x, y, z) => {
      const clip = multiply(draw.projectionMatrix, multiply(draw.modelViewMatrix, [x, y, z, 1]));
      return { x: canvas.left + (clip[0] / clip[3] + 1) / 2 * canvas.width,
        y: canvas.top + (1 - clip[1] / clip[3]) / 2 * canvas.height };
    };
    return { modelMatrix: draw.modelMatrix, envMapIntensity: draw.envMapIntensity,
      roughness: draw.roughness, points: [point(-.18, .12, .444), point(.18, .12, .444)] };
  });
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
      await recordComposition(page, 'compositionDesktopLight');
      await page.locator('[data-global-pause]').click();
      await expect(page.locator('[data-global-pause]')).toHaveAttribute('aria-pressed', 'false');
      await expectQuiet(page, 'reducedWithAmbientEnabled');
      const reducedBrick = await peripheralBrick(page);
      expect(reducedBrick).not.toBeNull();
      const reducedCount = await drawCount(page);
      await page.mouse.move(reducedBrick.points[0].x, reducedBrick.points[0].y);
      await expectQuiet(page, 'reducedPointer');
      expect(await drawCount(page)).toBe(reducedCount);
      await page.screenshot({ path: path.join(images, 'ice-hero-1440-light-webgl.png') });
      const beforeTheme = await drawCount(page);
      await page.getByRole('button', { name: 'Use dark theme', exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect.poll(() => drawCount(page)).toBeGreaterThan(beforeTheme);
      await expectReady(page);
      await expectQuiet(page, 'darkThemeIdle');
      await recordComposition(page, 'compositionDesktopDark');
      await page.screenshot({ path: path.join(images, 'ice-hero-1440-dark-webgl.png') });
    } finally { releaseEnvironment(); await context.close(); }
  });
  await check('A click starts one finite gesture while ambient pause remains active; coarse pointers never animate ice', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
    await instrument(context);
    const page = await context.newPage(); observe(page);
    try {
      await page.goto(`${base}/zh/`); await page.waitForLoadState('networkidle');
      await page.locator('.avatar-exhibit').scrollIntoViewIfNeeded();
      await expectReady(page);
      await expect(page.locator('.animation-toggle, .hello-button')).toHaveCount(0);
      await expect(page.locator('[data-global-pause]')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-greeting-count', '0');
      await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-state', 'idle');
      await expectQuiet(page, 'pausedWithNormalMotion');
      await recordComposition(page, 'compositionMobileLight');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(images, 'ice-hero-390-paused-webgl.png') });
      await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-rig', 'ready');
      await page.evaluate(() => {
        const exhibit = document.querySelector('.avatar-exhibit');
        const phases = ['idle']; window['__iceGesturePhases'] = phases;
        const observer = new MutationObserver(() => {
          const phase = exhibit.getAttribute('data-state');
          if (phase !== phases.at(-1)) phases.push(phase);
          if (phase === 'idle' && phases.length > 1) observer.disconnect();
        });
        observer.observe(exhibit, { attributes: true, attributeFilter: ['data-state'] });
      });
      await page.locator('.person-button').click();
      await expect(page.locator('.person-button')).toHaveAttribute('aria-busy', 'true');
      // Phase changes may cause one finite React/R3F invalidation. Observe the
      // stable waving phase to distinguish that update from continuous drawing.
      await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-state', 'waving');
      await expectQuiet(page, 'greetingPausesBrickInteraction');
      await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-state', 'idle');
      await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-greeting-count', '1');
      await expect(page.locator('.person-button')).toHaveAttribute('aria-busy', 'false');
      const phases = await page.evaluate(() => window['__iceGesturePhases']);
      expect(phases).toEqual(['idle', 'preparing', 'raising', 'waving', 'recovering', 'idle']);
      report.measurements.finiteGestureWithAmbientPause = { phases, accepted: 1 };
      await expect(page.locator('[data-global-pause]')).toHaveAttribute('aria-pressed', 'true');
      const mobileThemeCount = await drawCount(page);
      await setTheme(page, 'dark');
      await expect.poll(() => drawCount(page)).toBeGreaterThan(mobileThemeCount);
      await expectQuiet(page, 'mobileDarkIdle');
      await recordComposition(page, 'compositionMobileDark');
      await page.screenshot({ path: path.join(images, 'ice-hero-390-dark-webgl.png') });
      // Resume via the actual header control, then return to the stage. A coarse
      // pointer must remain static even when pause is no longer the guard.
      await page.locator('[data-global-pause]').click();
      await page.locator('.avatar-exhibit').scrollIntoViewIfNeeded();
      await expect(page.locator('[data-global-pause]')).toHaveAttribute('aria-pressed', 'false');
      expect(await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches)).toBe(false);
      await expectQuiet(page, 'coarsePointerBeforeHover');
      const coarseBrick = await peripheralBrick(page);
      expect(coarseBrick).not.toBeNull();
      const coarseCount = await drawCount(page);
      await page.mouse.move(coarseBrick.points[0].x, coarseBrick.points[0].y);
      await expectQuiet(page, 'coarsePointer');
      expect(await drawCount(page)).toBe(coarseCount);
      await expectReady(page);
    } finally { await context.close(); }
  });
  await check('Fine pointer changes a peripheral brick matrix and specular response; leave/pause restore a quiet static scene', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
    await instrument(context);
    const page = await context.newPage(); observe(page);
    try {
      await page.goto(`${base}/en/`); await page.waitForLoadState('networkidle'); await expectReady(page);
      await page.locator('[data-global-pause]').click();
      await expect(page.locator('[data-global-pause]')).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-state', 'idle');
      await expectQuiet(page, 'finePointerBeforeHover');
      const before = await peripheralBrick(page);
      expect(before).not.toBeNull();
      const serial = await page.evaluate(() => window['__iceProbe'].serial);
      await page.mouse.move(before.points[0].x, before.points[0].y);
      await expect.poll(() => page.evaluate(() => window['__iceProbe'].serial)).toBeGreaterThan(serial);
      const firstHover = await peripheralBrick(page);
      await page.mouse.move(before.points[1].x, before.points[1].y, { steps: 3 });
      await expectQuiet(page, 'finePointerStationary');
      const hover = await peripheralBrick(page);
      expect(hover).not.toBeNull();
      report.measurements.pointerDebug = { before, firstHover, hover };
      expect(hover.modelMatrix[13] - before.modelMatrix[13]).toBeCloseTo(.055, 3);
      expect(hover.modelMatrix.slice(0, 12).some((value, index) => Math.abs(value - before.modelMatrix[index]) > .001)).toBe(true);
      expect(hover.roughness).toBeLessThan(before.roughness);
      expect(Math.abs(hover.roughness - firstHover.roughness)).toBeGreaterThan(.001);
      await recordComposition(page, 'compositionPointerHover');
      await page.screenshot({ path: path.join(images, 'ice-pointer-hover.png') });
      await page.mouse.move(10, 10);
      await expectQuiet(page, 'pointerLeave');
      const restored = await peripheralBrick(page);
      expect(restored.modelMatrix).toEqual(before.modelMatrix);
      expect(restored.envMapIntensity).toBe(before.envMapIntensity);
      expect(restored.roughness).toBe(before.roughness);
      await page.locator('[data-global-pause]').click();
      await expect(page.locator('[data-global-pause]')).toHaveAttribute('aria-pressed', 'true');
      await expectQuiet(page, 'pauseSettledBeforePointer');
      const pausedCount = await drawCount(page);
      await page.mouse.move(before.points[0].x, before.points[0].y);
      await page.mouse.move(before.points[1].x, before.points[1].y, { steps: 3 });
      await expectQuiet(page, 'pausedPointer');
      expect(await drawCount(page)).toBe(pausedCount);
      report.measurements.pointerResponse = { before, firstHover, hover, restored, pausedDraws: await drawCount(page) - pausedCount };
      delete report.measurements.pointerDebug;
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
  report.browsersClosed = true;
  report.finishedAt = new Date().toISOString();
  report.warningNotes = 'THREE.Clock deprecation comes from React Three Fiber 9.7. Windows shader precision warnings and warnings caused by deliberate WEBGL_lose_context are retained. The gesture phase check is an integration check; joint seams, occlusion and motion quality require inspection of the separate new-frame captures. Instrumentation overhead means this script is not a performance measurement.';
  await writeFile(path.join(output, 'ice-browser-results.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks, measurements: report.measurements, pageErrors: report.pageErrors, consoleErrors: report.consoleErrors, failure: report.failure }, null, 2));
}
