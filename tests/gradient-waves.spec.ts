import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { fragment, vertex } from '../src/components/waves/gradient-waves-shaders';

type DrawFrame = {
  number: number;
  time: number;
  horizon: number[];
  wave: number[];
  crest: number[];
  mouse: number[];
  mouseEnabled: boolean;
  parameters: Record<string, number>;
  width: number;
  height: number;
  cssWidth: number;
};

type GradientProbe = {
  contexts: number;
  connected: number;
  draws: number;
  first: DrawFrame | null;
  latest: DrawFrame | null;
  frames: DrawFrame[];
  deletedPrograms: number;
  deletedBuffers: number;
};

declare global {
  interface Window {
    __gradientProbe: () => GradientProbe;
    __gradientResizeFailure: {
      initialWidth: number;
      reducedWidth: number;
      successfulDraws: number;
      injected: boolean;
    };
  }
}

test.use({ reducedMotion: 'no-preference' });

/**
 * Observe native GL calls rather than trusting a component's diagnostic state.
 * Three.js contexts are excluded by the three GradientWaves color uniforms.
 * This probe does not alter shader source, uniforms, pixels, or animation time.
 */
async function installProbe(page: Page) {
  await page.addInitScript(() => {
    const contexts = new Map<WebGL2RenderingContext, {
      program: WebGLProgram | null;
      locations: Map<WebGLProgram, Map<string, WebGLUniformLocation>>;
      draws: number;
      first: DrawFrame | null;
      frames: DrawFrame[];
      deletedPrograms: number;
      deletedBuffers: number;
    }>();
    const stateFor = (gl: WebGL2RenderingContext) => {
      let state = contexts.get(gl);
      if (!state) {
        state = { program: null, locations: new Map(), draws: 0, first: null, frames: [], deletedPrograms: 0, deletedBuffers: 0 };
        contexts.set(gl, state);
      }
      return state;
    };
    const prototype = WebGL2RenderingContext.prototype;
    const getUniformLocation = prototype.getUniformLocation;
    prototype.getUniformLocation = function (program, name) {
      const location = getUniformLocation.call(this, program, name);
      if (location) {
        const state = stateFor(this);
        let locations = state.locations.get(program);
        if (!locations) { locations = new Map(); state.locations.set(program, locations); }
        locations.set(name, location);
      }
      return location;
    };
    const useProgram = prototype.useProgram;
    prototype.useProgram = function (program) {
      stateFor(this).program = program;
      return useProgram.call(this, program);
    };
    const observe = (gl: WebGL2RenderingContext) => {
      const state = stateFor(gl);
      const program = state.program;
      if (!program) return;
      const locations = state.locations.get(program);
      if (!locations || !['uHorizonColor', 'uWaveColor', 'uCrestColor'].every(name => locations.has(name))) return;
      const uniform = (name: string) => {
        const location = locations.get(name);
        return location ? gl.getUniform(program, location) : null;
      };
      const vector = (name: string) => Array.from(uniform(name) as Float32Array);
      const frame: DrawFrame = {
        number: ++state.draws,
        time: Number(uniform('iTime')),
        horizon: vector('uHorizonColor'),
        wave: vector('uWaveColor'),
        crest: vector('uCrestColor'),
        mouse: vector('uMouse'),
        mouseEnabled: Boolean(uniform('uEnableMouse')),
        parameters: Object.fromEntries([
          'uSpeed', 'uAmplitude', 'uWaveScale', 'uWaveRatio', 'uSwell', 'uTurbulence',
          'uTilt', 'uZoom', 'uHeight', 'uFogDepth', 'uSteps', 'uBrightness', 'uOpacity',
          'uGrain', 'uGrainIntensity', 'uParallax',
        ].map(name => [name, Number(uniform(name))])),
        width: gl.drawingBufferWidth,
        height: gl.drawingBufferHeight,
        cssWidth: (gl.canvas as HTMLCanvasElement).getBoundingClientRect().width,
      };
      if (!state.first) state.first = frame;
      state.frames.push(frame);
      if (state.frames.length > 120) state.frames.shift();
    };
    const drawArrays = prototype.drawArrays;
    prototype.drawArrays = function (mode, first, count) {
      drawArrays.call(this, mode, first, count);
      observe(this);
    };
    const drawElements = prototype.drawElements;
    prototype.drawElements = function (mode, count, type, offset) {
      drawElements.call(this, mode, count, type, offset);
      observe(this);
    };
    const deleteProgram = prototype.deleteProgram;
    prototype.deleteProgram = function (program) {
      deleteProgram.call(this, program);
      stateFor(this).deletedPrograms++;
    };
    const deleteBuffer = prototype.deleteBuffer;
    prototype.deleteBuffer = function (buffer) {
      deleteBuffer.call(this, buffer);
      stateFor(this).deletedBuffers++;
    };
    window.__gradientProbe = () => {
      const gradient = [...contexts].filter(([, state]) => state.first);
      const frames = gradient.flatMap(([, state]) => state.frames);
      return {
        contexts: gradient.length,
        connected: gradient.filter(([gl]) => gl.canvas instanceof HTMLCanvasElement && gl.canvas.isConnected).length,
        draws: gradient.reduce((sum, [, state]) => sum + state.draws, 0),
        first: gradient[0]?.[1].first ?? null,
        latest: frames.at(-1) ?? null,
        frames,
        deletedPrograms: gradient.reduce((sum, [, state]) => sum + state.deletedPrograms, 0),
        deletedBuffers: gradient.reduce((sum, [, state]) => sum + state.deletedBuffers, 0),
      };
    };
  });
}

const probe = (page: Page) => page.evaluate(() => window.__gradientProbe());

async function openGradient(page: Page, path = '/en/work/') {
  await installProbe(page);
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  await expect.poll(async () => (await probe(page)).draws).toBeGreaterThan(0);
  await expect(page.locator('[data-gradient-waves] canvas')).toHaveCount(1);
}

async function unchangedDraws(page: Page, milliseconds = 650) {
  const before = await probe(page);
  await page.waitForTimeout(milliseconds);
  const after = await probe(page);
  expect(after.draws).toBe(before.draws);
  expect(after.latest?.time).toBe(before.latest?.time);
  return after;
}

function expectRgb(actual: number[] | undefined, hex: string) {
  expect(actual).toHaveLength(3);
  for (let channel = 0; channel < 3; channel++) {
    expect(actual![channel]).toBeCloseTo(parseInt(hex.slice(1 + channel * 2, 3 + channel * 2), 16) / 255, 5);
  }
}

test('first GL draw uses the requested colors and only one background canvas', async ({ page }) => {
  await openGradient(page);
  const result = await probe(page);
  expect(result.contexts).toBe(1);
  expect(result.connected).toBe(1);
  expectRgb(result.first?.horizon, '#27cbff');
  expectRgb(result.first?.wave, '#9fe3ff');
  expectRgb(result.first?.crest, '#9de4e2');
  const parameters = {
    uSpeed: 0.4, uAmplitude: 2.5, uWaveScale: 0.6, uWaveRatio: 0.9,
    uSwell: 35, uTurbulence: 20, uTilt: 1.11, uZoom: 1, uHeight: 5.5,
    uFogDepth: 15, uSteps: 70, uBrightness: 1, uOpacity: 1,
    uGrain: 1, uGrainIntensity: 0.05, uParallax: 0.5,
  };
  for (const [name, value] of Object.entries(parameters)) {
    expect(result.first!.parameters[name], name).toBeCloseTo(value, 5);
  }
  expect(result.first?.mouseEnabled).toBe(true);
  await expect.poll(async () => (await probe(page)).draws).toBeGreaterThan(result.draws);
});

test('global pause freezes draws, pointer and shader time; legitimate static updates do not restart the loop', async ({ page }) => {
  await openGradient(page, '/en/');
  await page.locator('[data-global-pause]').click();
  await page.waitForTimeout(100);
  const paused = await probe(page);
  await page.mouse.move(90, 160);
  await unchangedDraws(page, 1100);
  expect((await probe(page)).draws).toBe(paused.draws);
  // Ambient pause does not block an explicit character command. Verify the
  // actual shoulder pose while the independent waves GL counter stays frozen.
  await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-rig', 'ready');
  await page.locator('.person-button').click();
  await expect.poll(() => page.locator('[data-joint="shoulder"]').evaluate(el => {
    const matrix = new DOMMatrix(getComputedStyle(el).transform);
    return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
  })).toBeLessThan(-60);
  expect((await probe(page)).draws).toBe(paused.draws);
  await expect(page.locator('.avatar-exhibit')).toHaveAttribute('data-state', 'idle');
  expect((await probe(page)).draws).toBe(paused.draws);
  await page.locator('.theme-toggle').click();
  await expect.poll(async () => (await probe(page)).draws).toBeGreaterThan(paused.draws);
  const themed = await unchangedDraws(page);
  expect(themed.latest?.time).toBe(paused.latest?.time);
  expectRgb(themed.latest?.horizon, '#126a95');
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect.poll(async () => (await probe(page)).draws).toBeGreaterThan(themed.draws);
  const resized = await unchangedDraws(page);
  expect(resized.latest?.time).toBe(paused.latest?.time);
  await page.locator('[data-global-pause]').click();
  await expect.poll(async () => (await probe(page)).draws).toBeGreaterThan(resized.draws);
  const resumed = (await probe(page)).frames.find(frame => frame.number === resized.draws + 1);
  expect(resumed).toBeDefined();
  expect(resumed!.time - paused.latest!.time).toBeGreaterThanOrEqual(0);
  expect(resumed!.time - paused.latest!.time).toBeLessThan(0.5);
});

test('hidden lifecycle handler stops native draws and resumes without a time jump', async ({ page }) => {
  await openGradient(page);
  // Explicit event injection verifies the handler, not operating-system tab scheduling.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(100);
  const hidden = await unchangedDraws(page, 1100);
  await page.locator('.theme-toggle').click();
  expect((await unchangedDraws(page)).draws).toBe(hidden.draws);
  await page.evaluate(() => {
    delete (document as unknown as { hidden?: boolean }).hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(async () => (await probe(page)).draws).toBeGreaterThan(hidden.draws);
  const resumed = (await probe(page)).frames.find(frame => frame.number === hidden.draws + 1);
  expect(resumed).toBeDefined();
  expect(resumed!.time - hidden.latest!.time).toBeLessThan(0.5);
});

test('live reduced motion freezes actual GL drawing and normal preference resumes', async ({ page }) => {
  await openGradient(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(150);
  const reduced = await unchangedDraws(page);
  await page.mouse.move(200, 180);
  await unchangedDraws(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(async () => (await probe(page)).draws).toBeGreaterThan(reduced.draws);
});

test('initial reduced motion and saved pause never start a continuous render loop', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('ice-paused', 'true'));
  await installProbe(page);
  await page.goto('/zh/');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('.gradient-waves-container')).toHaveAttribute('data-state', 'ready');
  await page.waitForTimeout(100);
  await unchangedDraws(page);
  // A first static render and ResizeObserver/theme correction may draw; neither
  // may keep scheduling frames while a stop preference is already active.
  expect((await probe(page)).connected).toBe(1);
});

test('language, main-page and project navigation retain exactly one live gradient', async ({ page }) => {
  await openGradient(page);
  await page.locator('[data-language-switch]').click();
  await expect(page).toHaveURL('/zh/work/');
  await expect.poll(async () => (await probe(page)).draws).toBeGreaterThan(0);
  expect((await probe(page)).connected).toBe(1);
  await page.locator('.project-card a').first().click();
  await expect(page).toHaveURL('/zh/work/goldencamp/');
  await expect.poll(async () => (await probe(page)).draws).toBeGreaterThan(0);
  await expect(page.locator('[data-gradient-waves] canvas')).toHaveCount(1);
  expect((await probe(page)).connected).toBe(1);
  await page.goBack();
  await expect(page).toHaveURL('/zh/work/');
  await expect.poll(async () => (await probe(page)).draws).toBeGreaterThan(0);
  expect((await probe(page)).connected).toBe(1);
});

test('theme changes uniforms on the existing context and mouse updates real shader input', async ({ page }) => {
  await openGradient(page);
  await page.mouse.move(55, 100);
  await expect.poll(async () => (await probe(page)).latest?.mouse[0]).toBeLessThan(0.3);
  await page.mouse.move(1250, 250);
  await expect.poll(async () => (await probe(page)).latest?.mouse[0]).toBeGreaterThan(0.6);
  await page.locator('.theme-toggle').click();
  await expect.poll(async () => (await probe(page)).latest?.horizon[0]).toBeCloseTo(0x12 / 255, 5);
  const dark = await probe(page);
  expectRgb(dark.latest?.wave, '#174d70');
  expectRgb(dark.latest?.crest, '#328b9e');
  expect(dark.contexts).toBe(1);
  await expect(page.locator('[data-gradient-waves] canvas')).toHaveCount(1);
  await page.reload();
  await expect.poll(async () => (await probe(page)).draws).toBeGreaterThan(0);
  expectRgb((await probe(page)).first?.horizon, '#126a95');
});

test('coarse pointer renders low detail at DPR at most one and still allows navigation', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
    hasTouch: true, isMobile: true, reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  try {
    await openGradient(page, '/zh/work/');
    const initial = await probe(page);
    expect(initial.first?.parameters.uSteps).toBe(40);
    expect(initial.first?.mouseEnabled).toBe(false);
    expect(initial.first!.width / initial.first!.cssWidth).toBeLessThanOrEqual(1);
    await page.touchscreen.tap(35, 200);
    await page.mouse.move(330, 600);
    await page.waitForTimeout(250);
    expect((await probe(page)).latest?.mouse).toEqual([0.5, 0.5]);
    await page.locator('.project-card a').first().tap();
    await expect(page).toHaveURL('/zh/work/goldencamp/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  } finally { await context.close(); }
});

test('global pause works on non-home pages and survives normal page navigation', async ({ page }) => {
  await openGradient(page);
  await page.locator('[data-global-pause]').click();
  await page.waitForTimeout(100);
  await unchangedDraws(page);
  await page.locator('.project-card a').first().click();
  await expect(page).toHaveURL('/en/work/goldencamp/');
  await expect.poll(async () => (await probe(page)).draws).toBeGreaterThan(0);
  await page.waitForTimeout(100);
  await unchangedDraws(page);
  expect(await page.evaluate(() => localStorage.getItem('ice-paused'))).toBe('true');
  const paused = await probe(page);
  await page.locator('[data-global-pause]').click();
  await expect.poll(async () => (await probe(page)).draws).toBeGreaterThan(paused.draws);
});

for (const failure of ['query', 'unavailable-context', 'initialization', 'context-loss'] as const) {
  test(`gradient ${failure} keeps a static background and usable page without further draws`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await installProbe(page);
    if (failure === 'initialization') {
      await page.addInitScript(() => {
        const original = WebGL2RenderingContext.prototype.getProgramParameter;
        WebGL2RenderingContext.prototype.getProgramParameter = function (program, parameter) {
          if (parameter === this.LINK_STATUS) return false;
          return original.call(this, program, parameter);
        };
      });
    }
    if (failure === 'unavailable-context') {
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
          configurable: true,
          value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
            if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') return null;
            return Reflect.apply(original, this, [type, ...args]);
          },
        });
      });
    }
    await page.goto(`/en/work/${failure === 'query' ? '?webgl=0' : ''}`);
    if (failure === 'context-loss') {
      await expect.poll(async () => (await probe(page)).draws).toBeGreaterThan(0);
      await page.locator('[data-waves-canvas]').evaluate(canvas => {
        const gl = (canvas as HTMLCanvasElement).getContext('webgl2');
        const extension = gl?.getExtension('WEBGL_lose_context');
        if (!extension) throw new Error('Test browser did not expose WEBGL_lose_context');
        extension.loseContext();
      });
    }
    await expect(page.locator('.gradient-waves-container')).toHaveAttribute('data-state', 'fallback');
    await expect(page.locator('.site-waves-fallback')).toBeVisible();
    await expect(page.locator('[data-waves-canvas]')).toHaveCount(0);
    await unchangedDraws(page);
    await expect(page.locator('main h1')).toBeVisible();
    await page.locator('.project-card a').first().click();
    await expect(page).toHaveURL('/en/work/goldencamp/');
    expect(pageErrors).toEqual([]);
  });
}

test('an injected draw failure during adaptive resize falls back without accessing released GL resources', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await installProbe(page);
  await page.addInitScript(() => {
    window.__gradientResizeFailure = { initialWidth: 0, reducedWidth: 0, successfulDraws: 0, injected: false };
    // Controlled slow-frame timestamps reach the adaptive branch deterministically.
    // This is fault injection, not a performance measurement or motion recording.
    const requestFrame = window.requestAnimationFrame;
    let injectedSpacing = 0;
    window.requestAnimationFrame = callback => requestFrame.call(window, timestamp => {
      injectedSpacing += 50;
      callback(timestamp + injectedSpacing);
    });
    const drawArrays = WebGL2RenderingContext.prototype.drawArrays;
    WebGL2RenderingContext.prototype.drawArrays = function (mode, first, count) {
      const canvas = this.canvas;
      const fault = window.__gradientResizeFailure;
      if (canvas instanceof HTMLCanvasElement && canvas.hasAttribute('data-waves-canvas')) {
        const width = this.drawingBufferWidth;
        if (!fault.initialWidth) fault.initialWidth = width;
        if (!fault.injected && width < fault.initialWidth) {
          fault.reducedWidth = width;
          fault.injected = true;
          throw new Error('Injected GradientWaves draw failure after adaptive buffer resize');
        }
        drawArrays.call(this, mode, first, count);
        fault.successfulDraws++;
        return;
      }
      drawArrays.call(this, mode, first, count);
    };
  });
  await page.goto('/en/work/');
  await expect.poll(() => page.evaluate(() => window.__gradientResizeFailure.injected)).toBe(true);
  const fault = await page.evaluate(() => window.__gradientResizeFailure);
  expect(fault.successfulDraws).toBeGreaterThanOrEqual(18);
  expect(fault.reducedWidth).toBeGreaterThan(0);
  expect(fault.reducedWidth).toBeLessThan(fault.initialWidth);
  await expect(page.locator('.gradient-waves-container')).toHaveAttribute('data-state', 'fallback');
  await expect(page.locator('.site-waves-fallback')).toBeVisible();
  await expect(page.locator('[data-waves-canvas]')).toHaveCount(0);
  const stopped = await unchangedDraws(page);
  expect(stopped.connected).toBe(0);
  expect(stopped.deletedPrograms).toBeGreaterThan(0);
  expect(stopped.deletedBuffers).toBeGreaterThan(0);
  expect(stopped.latest?.parameters.uSteps).toBe(70);
  await expect(page.locator('main h1')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('print hides the decorative canvas and stops real draws while keeping the resume readable', async ({ page }) => {
  await openGradient(page, '/en/resume/');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('[data-gradient-waves]')).toBeHidden();
  await expect(page.locator('main h1')).toBeVisible();
  await page.waitForTimeout(100);
  const printed = await unchangedDraws(page);
  await page.emulateMedia({ media: 'screen' });
  await expect.poll(async () => (await probe(page)).draws).toBeGreaterThan(printed.draws);
});

test('user-supplied shader strings match the pinned official GradientWaves source', () => {
  const hash = (source: string) => createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex');
  expect(hash(vertex)).toBe('427d4b9827b17bd6a699b4f7a6c48b9b072549ae625face5f159414c404f2f95');
  expect(hash(fragment)).toBe('2a42dd89921e9d970e2b1bd835cfb71adde89de569562a190c7d92611410e9fa');
});

test('viewport background keeps drawing at the footer and page lifecycle releases actual GL resources', async ({ page }) => {
  await openGradient(page, '/en/about/');
  await page.locator('footer').scrollIntoViewIfNeeded();
  const footer = await probe(page);
  await expect.poll(async () => (await probe(page)).draws).toBeGreaterThan(footer.draws);
  // Exercise lifecycle handlers explicitly without claiming real BFCache coverage.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  const cached = await unchangedDraws(page);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect.poll(async () => (await probe(page)).draws).toBeGreaterThan(cached.draws);
  expect((await probe(page)).contexts).toBe(1);
  const beforeCleanup = await probe(page);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
  await expect(page.locator('[data-waves-canvas]')).toHaveCount(0);
  const disposed = await unchangedDraws(page);
  expect(disposed.connected).toBe(0);
  expect(disposed.deletedPrograms).toBeGreaterThan(beforeCleanup.deletedPrograms);
  expect(disposed.deletedBuffers).toBeGreaterThan(beforeCleanup.deletedBuffers);
});

test('without JavaScript the static background, content and native navigation remain available', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto('/zh/about/');
    await expect(page.locator('.site-waves-fallback')).toBeVisible();
    await expect(page.locator('[data-waves-canvas]')).toHaveCount(0);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('footer a[href^="mailto:"]')).toBeVisible();
    await page.locator('[data-language-switch]').click();
    await expect(page).toHaveURL('/en/about/');
    await expect(page.locator('.site-waves-fallback')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  } finally { await context.close(); }
});

test('cached-page lifecycle rereads saved pause and theme before resuming real draws', async ({ page }) => {
  await openGradient(page);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await unchangedDraws(page);
  // Model preferences changed while this document was cached. This is an
  // injected lifecycle-handler test, not a claim of an actual BFCache hit.
  await page.evaluate(() => {
    localStorage.setItem('ice-paused', 'true');
    localStorage.setItem('ice-theme', 'dark');
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.waitForTimeout(150);
  const restoredPaused = await unchangedDraws(page);
  expectRgb(restoredPaused.latest?.horizon, '#126a95');
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    localStorage.setItem('ice-paused', 'false');
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect.poll(async () => (await probe(page)).draws).toBeGreaterThan(restoredPaused.draws);
  expect((await probe(page)).contexts).toBe(1);
});
