import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw new Error('Use before or after');
const base = process.env.BASE_URL || 'http://127.0.0.1:4321';
const directory = process.env.REPORT_DIRECTORY || 'docs/reports/gradient-waves';
const round = directory.includes('avatar-interaction') ? 'avatar-interaction' : 'gradient-waves';
const rawDirectory = `.verification/${round}/motion/${phase}`;
const reportFile = `${directory}/${phase}-motion.json`;
if (phase === 'before' && existsSync(reportFile) && JSON.parse(readFileSync(reportFile, 'utf8')).passed) {
  throw new Error('A passing before baseline already exists. Preserve it; run after against the new build.');
}
mkdirSync(directory, { recursive: true });
mkdirSync(rawDirectory, { recursive: true });
const durationMs = 10000;
const errorMessage = error => String(error instanceof Error ? error.message : error)
  .replace(/[A-Za-z]:[\\/][^\r\n]*/g, '[local path]')
  .replace(/\/(?:Users|home|tmp|var|private)\/[^\r\n]*/g, '[local path]');
let browser;
let failurePhase = 'browser launch';
let activeProfile = null;
const report = {
  phase, base, date: new Date().toISOString(), finishedAt: '', browser: null, durationMs,
  method: 'Ten continuous seconds per fresh Chromium context, normal motion, welcome already seen, no CPU/network throttling. Desktop wheel and emulated mobile CDP touch scroll gestures run during the same sampling window.',
  limitations: [
    'RAF callback intervals describe browser main-thread scheduling and are not GPU FPS, presented frames, or dropped-frame measurements.',
    'WebGL draw counts instrument actual JavaScript draw calls per canvas. Calls can batch many objects or use multiple render passes; they do not measure GPU completion or presentation FPS.',
    'Command-to-first-scroll-event timings include browser automation scheduling and are not INP or real hardware input latency.',
    'Mobile viewport/touch emulation runs on this desktop machine; no physical mobile device was tested.',
    'The 10-second window starts after page fonts and the avatar rig are ready, with a 1-second settling period; this complements rather than replaces Lighthouse load metrics.',
  ],
  results: [], passed: false, failure: null,
};
try {
  browser = await chromium.launch({ headless: true });
  report.browser = browser.version();
  for (const profile of ['desktop', 'mobile']) {
    activeProfile = profile;
    failurePhase = `${profile}: context setup`;
    const mobile = profile === 'mobile';
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile,
      reducedMotion: 'no-preference', colorScheme: 'light',
    });
    await context.addInitScript(() => {
      localStorage.setItem('ice-theme', 'light');
      sessionStorage.setItem('mingyang:avatar-welcome:v1', 'seen');
      const counts = new Map();
      let nextCanvas = 0;
      for (const type of ['WebGLRenderingContext', 'WebGL2RenderingContext']) {
        const prototype = window[type]?.prototype;
        if (!prototype) continue;
        for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
          const original = prototype[method];
          if (typeof original !== 'function') continue;
          prototype[method] = function (...args) {
            const result = original.apply(this, args);
            let entry = counts.get(this.canvas);
            if (!entry) {
              entry = { id: ++nextCanvas, contextType: type, methods: {} };
              counts.set(this.canvas, entry);
            }
            entry.methods[method] = (entry.methods[method] || 0) + 1;
            return result;
          };
        }
      }
      window.__gradientGlDraws = () => [...counts].map(([canvas, entry]) => ({
        ...entry, methods: { ...entry.methods }, width: canvas.width, height: canvas.height,
        kind: canvas.matches('[data-waves-canvas]') || canvas.closest('.gradient-waves-container') ? 'waves' : canvas.closest('.ice-hero-scene') ? 'ice' : 'other',
        connected: canvas.isConnected,
      }));
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      failurePhase = `${profile}: navigation and ready checks`;
      const response = await page.goto(`${base}/en/`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.avatar-exhibit[data-rig="ready"]').waitFor();
      await page.waitForTimeout(1000);
      const cdp = await context.newCDPSession(page);
      failurePhase = `${profile}: continuous measurement and scroll inputs`;
      const measurement = page.evaluate(durationMs => new Promise(resolve => {
        const intervals = [];
        const longTasks = [];
        const scrollEvents = [];
        const inputs = [];
        const startedAt = performance.now();
        const glStart = window.__gradientGlDraws();
        let previousFrame = null;
        let frameHandle;
        let observer;
        const longTasksSupported = PerformanceObserver.supportedEntryTypes.includes('longtask');
        if (longTasksSupported) {
          observer = new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
              if (entry.startTime >= startedAt) longTasks.push({ startMs: entry.startTime - startedAt, durationMs: entry.duration, name: entry.name });
            }
          });
          observer.observe({ type: 'longtask', buffered: true });
        }
        const onScroll = () => {
          const time = performance.now() - startedAt;
          scrollEvents.push({ timeMs: time, y: scrollY });
          const current = inputs.at(-1);
          if (current && current.firstScrollEventMs === null) current.firstScrollEventMs = time - current.requestedAtMs;
        };
        addEventListener('scroll', onScroll, { passive: true });
        window.__gradientMotionProbe = {
          input: (kind, deltaY) => inputs.push({ kind, deltaY, requestedAtMs: performance.now() - startedAt, initialY: scrollY, firstScrollEventMs: null }),
        };
        const tick = timestamp => {
          if (previousFrame !== null) intervals.push(timestamp - previousFrame);
          previousFrame = timestamp;
          frameHandle = requestAnimationFrame(tick);
        };
        frameHandle = requestAnimationFrame(tick);
        setTimeout(() => {
          cancelAnimationFrame(frameHandle);
          if (observer) {
            for (const entry of observer.takeRecords()) {
              if (entry.startTime >= startedAt) longTasks.push({ startMs: entry.startTime - startedAt, durationMs: entry.duration, name: entry.name });
            }
            observer.disconnect();
          }
          removeEventListener('scroll', onScroll);
          delete window.__gradientMotionProbe;
          resolve({ actualDurationMs: performance.now() - startedAt, intervals, longTasks, longTasksSupported, inputs, scrollEvents, finalY: scrollY, visibilityState: document.visibilityState, glStart, glEnd: window.__gradientGlDraws() });
        }, durationMs);
      }), durationMs);
      // Both profiles receive four downward and four upward inputs. Eight
      // gestures fit within the continuous window; the endpoints include idle.
      await page.waitForFunction(() => !!window.__gradientMotionProbe);
      await page.waitForTimeout(1000);
      const dispatches = [];
      for (let index = 0; index < 8; index++) {
        const deltaY = index < 4 ? 420 : -420;
        const kind = mobile ? 'CDP touchStart/touchMove/touchEnd' : 'Playwright mouse wheel';
        const start = Date.now();
        const recorded = await page.evaluate(({ kind, deltaY }) => {
          if (!window.__gradientMotionProbe) return false;
          window.__gradientMotionProbe.input(kind, deltaY);
          return true;
        }, { kind, deltaY });
        if (!recorded) break;
        if (mobile) {
          // Explicit touch events give observable document scrolling in headless
          // Chromium. Start in the page gutter, outside interactive scene nodes.
          const startY = deltaY > 0 ? 650 : 200;
          const point = y => ({ x: 12, y, id: 0, radiusX: 1, radiusY: 1, force: 1 });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(startY)] });
          for (let step = 1; step <= 7; step++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(startY - deltaY * step / 7)] });
            await page.waitForTimeout(30);
          }
          await page.waitForTimeout(80);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } else {
          await page.mouse.move(850, 650);
          await page.mouse.wheel(0, deltaY);
        }
        dispatches.push({ index, kind, deltaY, automationCallDurationMs: Date.now() - start });
        await page.waitForTimeout(Math.max(0, 900 - (Date.now() - start)));
      }
      const raw = await measurement;
      await cdp.detach();
      failurePhase = `${profile}: summarise and save measurement`;
      const sorted = [...raw.intervals].sort((a, b) => a - b);
      const percentile = ratio => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))] : null;
      const canvases = raw.glEnd.map(canvas => {
        const initial = raw.glStart.find(entry => entry.id === canvas.id);
        const methods = Object.fromEntries(Object.entries(canvas.methods).map(([method, count]) => [method, count - (initial?.methods[method] || 0)]));
        return { ...canvas, methods, callsDuringWindow: Object.values(methods).reduce((sum, count) => sum + count, 0) };
      });
      const result = {
        profile, mobileEmulation: mobile, status: response?.status() ?? null, errors,
        actualDurationMs: raw.actualDurationMs, visibilityState: raw.visibilityState,
        raf: {
          intervals: sorted.length, medianMs: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99), maxMs: sorted.at(-1) ?? null,
          over20Ms: sorted.filter(value => value > 20).length,
          over33_4Ms: sorted.filter(value => value > 33.4).length,
          over50Ms: sorted.filter(value => value > 50).length,
        },
        longTasks: { supported: raw.longTasksSupported, count: raw.longTasks.length, totalMs: raw.longTasks.reduce((sum, task) => sum + task.durationMs, 0), maxMs: Math.max(0, ...raw.longTasks.map(task => task.durationMs)) },
        webglDrawCalls: {
          waves: canvases.filter(canvas => canvas.kind === 'waves').reduce((sum, canvas) => sum + canvas.callsDuringWindow, 0),
          ice: canvases.filter(canvas => canvas.kind === 'ice').reduce((sum, canvas) => sum + canvas.callsDuringWindow, 0),
          other: canvases.filter(canvas => canvas.kind === 'other').reduce((sum, canvas) => sum + canvas.callsDuringWindow, 0),
          canvases,
        },
        scroll: { issuedInputs: raw.inputs.length, inputsWithScrollEvents: raw.inputs.filter(input => input.firstScrollEventMs !== null).length, eventCount: raw.scrollEvents.length, minY: Math.min(0, ...raw.scrollEvents.map(event => event.y)), maxY: Math.max(0, ...raw.scrollEvents.map(event => event.y)), finalY: raw.finalY, inputs: raw.inputs, dispatches },
        rawFile: `${rawDirectory}/${profile}.json`,
      };
      result.passed = result.status === 200 && !errors.length && sorted.length > 0 && raw.actualDurationMs >= durationMs && raw.visibilityState === 'visible' && result.scroll.issuedInputs === 8 && result.scroll.maxY > 0;
      writeFileSync(result.rawFile, `${JSON.stringify(raw, null, 2)}\n`);
      report.results.push(result);
      console.log(JSON.stringify(result));
    } finally {
      try { await context.close(); }
      catch (error) {
        report.failure ??= { phase: `${profile}: context close`, message: errorMessage(error) };
        process.exitCode = 1;
      }
    }
  }
  report.passed = !report.failure && report.results.length === 2 && report.results.every(result => result.passed);
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  report.failure = { phase: failurePhase, message: errorMessage(error) };
  report.passed = false;
  if (activeProfile && !report.results.some(result => result.profile === activeProfile)) {
    report.results.push({ profile: activeProfile, passed: false, failure: report.failure });
  }
  throw error;
} finally {
  try { await browser?.close(); }
  catch (error) {
    report.failure ??= { phase: 'browser close', message: errorMessage(error) };
    report.passed = false;
    process.exitCode = 1;
  }
  report.finishedAt = new Date().toISOString();
  writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
}
