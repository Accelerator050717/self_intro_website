import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

// Run against the approved production-preview build, separately from Lighthouse.
const base = process.env.BASE_URL || 'http://127.0.0.1:4321';
const screenshots = 'docs/screenshots/gradient-waves/after';
const videos = 'docs/evidence';
const temporary = '.verification/gradient-waves/video';
await Promise.all([screenshots, videos, temporary, 'docs/reports/gradient-waves'].map(path => mkdir(path, { recursive: true })));
const requestedProfile = process.argv[2];
if (requestedProfile && !['desktop', 'mobile'].includes(requestedProfile)) throw new Error('Optional profile must be desktop or mobile');
const profiles = requestedProfile ? [requestedProfile] : ['desktop', 'mobile'];
const reportFile = 'docs/reports/gradient-waves/recordings.json';
const reports = requestedProfile
  ? JSON.parse(await readFile(reportFile, 'utf8').catch(error => { if (error.code === 'ENOENT') return '[]'; throw error; })).filter(report => report.profile !== requestedProfile)
  : [];
const errorMessage = error => String(error instanceof Error ? error.message : error)
  .replace(/[A-Za-z]:[\\/][^\r\n]*/g, '[local path]')
  .replace(/\/(?:Users|home|tmp|var|private)\/[^\r\n]*/g, '[local path]');
let browser;
let failurePhase = 'browser launch';
let activeProfile = null;
try {
  browser = await chromium.launch({ headless: true });
  for (const profile of profiles) {
    activeProfile = profile;
    failurePhase = `${profile}: context setup`;
    const mobile = profile === 'mobile';
    const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 };
    const context = await browser.newContext({
      viewport, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile,
      reducedMotion: 'no-preference', recordVideo: { dir: temporary, size: viewport },
    });
    await context.addInitScript(mobile => {
      sessionStorage.setItem('mingyang:avatar-welcome:v1', 'seen');
      localStorage.setItem('ice-theme', mobile ? 'dark' : 'light');
      localStorage.setItem('ice-paused', 'false');
      let pending = null;
      let draws = 0;
      window.__gradientVideoProbe = {
        count: () => draws,
        capture: () => new Promise((resolve, reject) => {
          const timeout = setTimeout(() => { pending = null; reject(new Error('No real wave draw reached the capture hook')); }, 5000);
          pending = canvas => {
            try {
              const copy = document.createElement('canvas');
              const bounds = canvas.getBoundingClientRect();
              copy.width = 320;
              // Adaptive backing-buffer rounding must not change comparison
              // dimensions: all captures use the actual CSS viewport aspect.
              copy.height = Math.round(bounds.height / bounds.width * 320);
              copy.getContext('2d').drawImage(canvas, 0, 0, copy.width, copy.height);
              resolve({ timeMs: performance.now(), sourceWidth: canvas.width, sourceHeight: canvas.height, dataUrl: copy.toDataURL('image/png') });
            } catch (error) { reject(error); }
            finally { clearTimeout(timeout); }
          };
        }),
      };
      for (const type of ['WebGLRenderingContext', 'WebGL2RenderingContext']) {
        const prototype = window[type]?.prototype;
        if (!prototype) continue;
        for (const method of ['drawArrays', 'drawElements']) {
          const original = prototype[method];
          if (typeof original !== 'function') continue;
          prototype[method] = function (...args) {
            const result = original.apply(this, args);
            if (this.canvas.matches('[data-waves-canvas]')) {
              draws++;
              if (pending) { const capture = pending; pending = null; capture(this.canvas); }
            }
            return result;
          };
        }
      }
    }, mobile);
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const started = Date.now();
    const actions = [];
    const frames = [];
    const waveFrames = [];
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    async function scroll(deltaY) {
      const initialY = await page.evaluate(() => scrollY);
      if (mobile) {
        const distance = Math.max(-540, Math.min(540, deltaY));
        const startY = distance > 0 ? 710 : 120;
        const point = y => ({ x: 12, y, id: 0, radiusX: 1, radiusY: 1, force: 1 });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(startY)] });
        for (let step = 1; step <= 6; step++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(startY - distance * step / 6)] });
          await page.waitForTimeout(20);
        }
        await page.waitForTimeout(70);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(700, 600);
        await page.mouse.wheel(0, deltaY);
      }
      await page.waitForTimeout(160);
      actions.push({ action: mobile ? 'touch drag' : 'wheel', deltaY, initialY, finalY: await page.evaluate(() => scrollY), elapsedMs: Date.now() - started });
    }
    async function scrollToY(target) {
      for (let attempt = 0; attempt < 14; attempt++) {
        const current = await page.evaluate(() => scrollY);
        const difference = target - current;
        if (Math.abs(difference) < 24) return;
        await scroll(Math.max(-900, Math.min(900, difference)));
        if (await page.evaluate(() => scrollY) === current) return;
      }
    }
    async function position(selector, top = 100) {
      const y = await page.locator(selector).evaluate((element, top) => element.getBoundingClientRect().top + scrollY - top, top);
      await scrollToY(Math.max(0, y));
    }
    async function activate(selector) {
      if (mobile) await page.locator(selector).first().tap(); else await page.locator(selector).first().click();
      actions.push({ action: mobile ? 'tap' : 'click', selector, elapsedMs: Date.now() - started });
    }
    async function sample(id, label, waveStart = null) {
      const pose = await page.locator('.avatar-rig').evaluate(svg => {
        const joints = {};
        for (const element of svg.querySelectorAll('[data-joint], [data-part]')) {
          const local = new DOMMatrix(getComputedStyle(element).transform);
          const matrix = element.getCTM();
          joints[element.dataset.joint || element.dataset.part] = {
            degrees: Math.atan2(local.b, local.a) * 180 / Math.PI,
            matrix: [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f],
          };
        }
        return { timeMs: performance.now(), joints };
      });
      const path = `${screenshots}/wave-${profile}-${id}.png`;
      const bounds = await page.locator('.avatar-exhibit').boundingBox();
      const captureStart = await page.evaluate(() => performance.now());
      // Element screenshots can change Chromium screencast clipping. Capture
      // the unchanged full viewport, then crop the saved evidence offline.
      const fullViewport = await page.screenshot({ animations: 'allow' });
      const captureEnd = await page.evaluate(() => performance.now());
      const left = Math.max(0, Math.floor(bounds.x));
      const top = Math.max(0, Math.floor(bounds.y));
      await sharp(fullViewport).extract({
        left, top, width: Math.min(viewport.width - left, Math.ceil(bounds.width)),
        height: Math.min(viewport.height - top, Math.ceil(bounds.height)),
      }).png().toFile(path);
      frames.push({ id, label, elapsedMs: waveStart === null ? 0 : Math.round(pose.timeMs - waveStart),
        screenshotCaptureWindowMs: waveStart === null ? null : [Math.round(captureStart - waveStart), Math.round(captureEnd - waveStart)],
        joints: pose.joints, path });
    }
    try {
      failurePhase = `${profile}: navigation and ready checks`;
      await page.goto(`${base}/${mobile ? 'zh' : 'en'}/`, { waitUntil: 'networkidle' });
      await page.locator('.avatar-exhibit[data-rig="ready"][data-scene-settled="true"]').waitFor();
      await page.locator('.gradient-waves-container[data-state="ready"] canvas').waitFor();
      failurePhase = `${profile}: actual canvas pixel capture and comparison`;
      // No pointer movement during these four snapshots, spaced at least 1s.
      // Capturing immediately after actual GL draw avoids an empty discarded buffer.
      for (let index = 0; index < 4; index++) {
        if (index) await page.waitForTimeout(1000);
        const capture = await page.evaluate(() => window.__gradientVideoProbe.capture());
        const path = `${screenshots}/canvas-${profile}-${index}.png`;
        await writeFile(path, Buffer.from(capture.dataUrl.split(',')[1], 'base64'));
        const { dataUrl: _dataUrl, ...metadata } = capture;
        waveFrames.push({ ...metadata, path });
      }
      const comparisons = [];
      const decoded = await Promise.all(waveFrames.map(frame => sharp(frame.path).removeAlpha().blur(2).raw().toBuffer({ resolveWithObject: true })));
      for (let index = 1; index < decoded.length; index++) {
        const before = decoded[index - 1], after = decoded[index];
        assert.equal(before.data.length, after.data.length);
        let difference = 0, changed = 0;
        for (let pixel = 0; pixel < before.data.length; pixel += 3) {
          let max = 0;
          for (let channel = 0; channel < 3; channel++) {
            const value = Math.abs(before.data[pixel + channel] - after.data[pixel + channel]);
            difference += value; max = Math.max(max, value);
          }
          if (max > 8) changed++;
        }
        comparisons.push({ from: index - 1, to: index, elapsedMs: waveFrames[index].timeMs - waveFrames[index - 1].timeMs, meanAbsoluteChannelDifference: difference / before.data.length, fractionPixelsOver8: changed / (before.data.length / 3) });
      }
      const visibleWaveChange = comparisons.some(pair => pair.fractionPixelsOver8 > 0.005);
      assert(visibleWaveChange, 'Actual wave canvas must show large-scale pixel changes, beyond small grain noise');
      failurePhase = `${profile}: continuous character wave`;
      if (mobile) await position('.avatar-exhibit', 100);
      await sample('00', 'Idle');
      await activate('.hello-button');
      await page.waitForFunction(() => document.querySelector('[data-joint="shoulder"]').getAnimations().length > 0);
      const waveStart = await page.locator('[data-joint="shoulder"]').evaluate(element => performance.now() - Number(element.getAnimations()[0].currentTime));
      for (const [index, time, label] of [[1, 380, 'Arm rising'], [2, 1030, 'Wrist wave A'], [3, 1310, 'Wrist wave B'], [4, 1570, 'Wrist wave A'], [5, 2160, 'Arm lowering'], [6, 2850, 'Back to idle']]) {
        const elapsed = await page.evaluate(() => performance.now()) - waveStart;
        if (elapsed < time) await page.waitForTimeout(time - elapsed);
        await sample(String(index).padStart(2, '0'), label, waveStart);
      }
      assert(frames.some(frame => frame.joints.shoulder.degrees < -55 && frame.joints.elbow.degrees < -50));
      for (const joint of ['shoulder', 'elbow', 'wrist']) assert(Math.abs(frames.at(-1).joints[joint].degrees) < 0.1);
      assert(frames.every(frame => JSON.stringify(frame.joints.body.matrix) === JSON.stringify(frames[0].joints.body.matrix)));
      failurePhase = `${profile}: project, footer, theme and pause interactions`;
      await position('.selected-section', 35);
      actions.push({ action: 'projects dwell', durationMs: 4000, elapsedMs: Date.now() - started });
      await page.waitForTimeout(4000);
      if (mobile) {
        await activate('[data-light-card]');
        await page.waitForURL('**/zh/work/goldencamp/');
        await page.waitForTimeout(1000);
        await page.goBack({ waitUntil: 'networkidle' });
        actions.push({ action: 'project link and browser back', elapsedMs: Date.now() - started });
      }
      await scrollToY(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight));
      actions.push({ action: 'footer dwell', durationMs: 4000, elapsedMs: Date.now() - started });
      await page.waitForTimeout(4000);
      await scrollToY(0);
      await activate('.theme-toggle');
      await page.waitForTimeout(1500);
      if (mobile) await position('.avatar-exhibit', 100);
      await activate('.animation-toggle');
      await page.waitForTimeout(250);
      const pausedDraws = await page.evaluate(() => window.__gradientVideoProbe.count());
      await page.waitForTimeout(2000);
      const stoppedDraws = await page.evaluate(() => window.__gradientVideoProbe.count());
      assert.equal(stoppedDraws, pausedDraws, 'Global pause must stop wave draw calls');
      await activate('.animation-toggle');
      await page.waitForTimeout(1500);
      const resumedDraws = await page.evaluate(() => window.__gradientVideoProbe.count());
      assert(resumedDraws > stoppedDraws, 'Resume must restart actual wave draw calls');
      const remaining = 40000 - (Date.now() - started);
      if (remaining > 0) await page.waitForTimeout(remaining);
      assert.deepEqual(errors, []);
      failurePhase = `${profile}: video close and save`;
      const video = page.video();
      const durationMs = Date.now() - started;
      await cdp.detach();
      await context.close();
      const recording = `${videos}/gradient-waves-${profile}.webm`;
      await rename(await video.path(), recording);
      reports.push({
        profile, browser: browser.version(), recordedAt: new Date().toISOString(), recording, durationMs, viewport,
        method: 'Real-time browser capture with real wheel or explicit touch input and click/tap; no timeline seeking, animation speed changes, or substitute rendered video.',
        keyframeTiming: 'Joint transforms are sampled immediately before full-viewport screenshot capture. The screenshotCaptureWindowMs interval bounds asynchronous capture timing; it is not a claim that a PNG matches the exact earlier joint-sample timestamp. Cropping occurs offline only.',
        durationInRequestedRange: durationMs >= 35000 && durationMs <= 50000,
        canvasEvidence: { method: 'Actual wave canvas copied immediately after WebGL draw, downsampled to width 320; 2px Gaussian blur and >8/255 per-channel threshold suppress fine grain noise. These are pixel differences, not GPU FPS.', frames: waveFrames, comparisons, visibleWaveChange },
        pause: { pausedDraws, stoppedDraws, resumedDraws }, frames, actions, errors, passed: durationMs >= 35000 && durationMs <= 50000,
      });
      if (durationMs < 35000 || durationMs > 50000) process.exitCode = 1;
      console.log(JSON.stringify({ profile, durationMs, recording, visibleWaveChange, comparisons }));
    } catch (error) {
      reports.push({ profile, passed: false, failure: { phase: failurePhase, message: errorMessage(error) }, frames, actions, errors });
      try { await context.close(); }
      catch (closeError) { reports.at(-1).cleanupFailure = { phase: `${profile}: context close`, message: errorMessage(closeError) }; }
      throw error;
    }
  }
} catch (error) {
  if (!reports.some(report => report.profile === activeProfile && report.failure)) {
    reports.push({ profile: activeProfile, passed: false, failure: { phase: failurePhase, message: errorMessage(error) } });
  }
  throw error;
} finally {
  try { await browser?.close(); }
  catch (error) {
    reports.push({ profile: null, passed: false, failure: { phase: 'browser close', message: errorMessage(error) } });
    process.exitCode = 1;
  }
  await writeFile(reportFile, `${JSON.stringify(reports, null, 2)}\n`);
}
