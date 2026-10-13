import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { copyFile, mkdir, readFile, readdir, rename, writeFile, stat } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { stripVTControlCharacters } from 'node:util';
import sharp from 'sharp';

// Run against the separately built production preview. Never builds the site.
const phase = process.argv[2];
assert(['before', 'after'].includes(phase), 'Usage: node scripts/record-avatar-interaction.mjs before|after');
const base = process.env.BASE_URL || 'http://127.0.0.1:4321';
const directory = `docs/screenshots/avatar-interaction/${phase}`;
const reportPath = `docs/reports/avatar-interaction/${phase}-recordings.json`;
const temporary = `.verification/avatar-interaction/${phase}/video`;
const previous = await readFile(reportPath, 'utf8').catch(error => {
  if (error.code === 'ENOENT') return null;
  throw error;
});
assert(!previous || !JSON.parse(previous).passed, 'A completed recording is already present; preserve it instead of overwriting it.');
await Promise.all([directory, temporary, 'docs/evidence', 'docs/reports/avatar-interaction'].map(value => mkdir(value, { recursive: true })));
const sanitize = error => stripVTControlCharacters(String(error instanceof Error ? error.message : error))
  .replace(/[A-Za-z]:[\\/][^\r\n]*/g, '[local path]');
if (phase === 'after') {
  await recordAfter();
} else {
const report = {
  phase, startedAt: new Date().toISOString(), passed: false, profiles: [],
  method: 'Continuous Playwright browser video with trusted mouse/touch input; browser rAF reads joint matrices. Keyframes are extracted offline from the actual video, without changing the viewport during recording.',
  timingLimit: 'Video keyframe times use the observed input wall-clock relative to page creation. The browser recorder starts asynchronously; offsets are approximate, not frame-accurate motion-capture timestamps. Browser probe samples have exact performance.now offsets from the trusted click.',
  hardwareLimit: 'Desktop browser and mobile touch emulation on this workstation, not a physical phone or GPU-presented FPS measurement.',
};
let browser;
let failurePhase = 'launch';
try {
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  report.browser = browser.version();
  for (const profile of ['desktop', 'mobile']) {
    const mobile = profile === 'mobile';
    const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 };
    const result = { profile, viewport, passed: false, errors: [], actions: [], screenshots: [], video: null };
    report.profiles.push(result);
    failurePhase = `${profile}: context`;
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile,
      reducedMotion: 'no-preference', recordVideo: { dir: temporary, size: viewport } });
    await context.addInitScript(mobile => {
      sessionStorage.setItem('mingyang:avatar-welcome:v1', 'seen');
      localStorage.setItem('ice-theme', mobile ? 'dark' : 'light');
      localStorage.setItem('ice-paused', 'false');
      const probe = { samples: [], events: [], running: false, start: 0 };
      window.__avatarRecordingProbe = probe;
      document.addEventListener('click', event => {
        const target = event.target.closest('.person-button, .hello-button');
        if (!target) return;
        probe.events.push({ time: performance.now(), wallTime: Date.now(), trusted: event.isTrusted,
          target: target.className, pointerType: event.pointerType || 'unknown' });
      }, true);
      probe.begin = () => {
        probe.start = performance.now(); probe.running = true;
        const sample = () => {
          if (!probe.running) return;
          const exhibit = document.querySelector('.avatar-exhibit');
          const joints = {};
          for (const element of document.querySelectorAll('.avatar-rig [data-joint], .avatar-rig [data-part]')) {
            const local = new DOMMatrix(getComputedStyle(element).transform);
            joints[element.dataset.joint || element.dataset.part] = {
              angle: Math.atan2(local.b, local.a) * 180 / Math.PI,
              x: local.e, y: local.f,
            };
          }
          probe.samples.push({ time: performance.now(), state: exhibit?.dataset.state, joints });
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      };
    }, mobile);
    const recordingStarted = Date.now();
    const page = await context.newPage();
    const video = page.video();
    const cdp = await context.newCDPSession(page);
    page.on('pageerror', error => result.errors.push(sanitize(error)));
    page.on('console', message => { if (message.type() === 'error') result.errors.push(sanitize(message.text())); });
    try {
      failurePhase = `${profile}: navigation`;
      const response = await page.goto(`${base}/${mobile ? 'zh' : 'en'}/`, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
      await page.locator('.person-button').waitFor({ state: 'visible' });
      await page.locator('.avatar-exhibit[data-rig="ready"][data-scene-settled="true"]').waitFor({ timeout: 20000 });
      await page.waitForTimeout(800);
      result.initialControls = await page.locator('.avatar-controls').innerText();
      const home = `${directory}/${profile}-home.png`;
      await page.screenshot({ path: home, animations: 'allow' });
      result.screenshots.push(home);
      failurePhase = `${profile}: position with real input`;
      if (mobile) {
        for (let attempt = 0; attempt < 6; attempt++) {
          const bounds = await page.locator('.avatar-exhibit').boundingBox();
          const difference = bounds.y - 130;
          if (Math.abs(difference) < 35) break;
          const distance = Math.max(-450, Math.min(450, difference));
          const startY = distance > 0 ? 710 : 120;
          const point = y => ({ x: 12, y, id: 0, radiusX: 1, radiusY: 1, force: 1 });
          const beforeY = await page.evaluate(() => scrollY);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(startY)] });
          for (let step = 1; step <= 8; step++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(startY - distance * step / 8)] });
            await page.waitForTimeout(24);
          }
          await page.waitForTimeout(80);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await page.waitForTimeout(250);
          result.actions.push({ type: 'touch scroll', beforeY, afterY: await page.evaluate(() => scrollY) });
        }
      }
      await page.waitForTimeout(900);
      const idle = `${directory}/${profile}-idle.png`;
      await page.screenshot({ path: idle, animations: 'allow' });
      result.screenshots.push(idle);
      result.avatarBounds = await page.locator('.avatar-exhibit').boundingBox();
      const selector = phase === 'before' && await page.locator('.hello-button').count() ? '.hello-button' : '.person-button';
      result.firstTrigger = selector;
      await page.evaluate(() => window.__avatarRecordingProbe.begin());
      await page.waitForTimeout(1000);
      failurePhase = `${profile}: single complete greeting`;
      if (mobile) await page.locator(selector).tap(); else await page.locator(selector).click();
      result.actions.push({ type: mobile ? 'tap' : 'click', selector, elapsedFromPageCreationMs: Date.now() - recordingStarted });
      await page.waitForTimeout(6000);
      const returned = `${directory}/${profile}-returned.png`;
      await page.screenshot({ path: returned, animations: 'allow' });
      result.screenshots.push(returned);
      failurePhase = `${profile}: ten rapid body interactions`;
      const bounds = await page.locator('.person-button').boundingBox();
      const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
      for (let index = 0; index < 10; index++) {
        if (mobile) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
        await page.waitForTimeout(65);
      }
      await page.waitForTimeout(7000);
      const settled = `${directory}/${profile}-rapid-returned.png`;
      await page.screenshot({ path: settled, animations: 'allow' });
      result.screenshots.push(settled);
      const probe = await page.evaluate(() => {
        window.__avatarRecordingProbe.running = false;
        return window.__avatarRecordingProbe;
      });
      delete probe.begin;
      const firstEvent = probe.events[0];
      assert(firstEvent?.trusted, 'The greeting did not receive a trusted click/tap');
      const localSamples = probe.samples.map(sample => ({ ...sample, elapsedMs: sample.time - firstEvent.time }));
      const requestedOffsets = [0, 300, 650, 1000, 1400, 1800, 2400, 3000, 4500];
      result.poseSamples = requestedOffsets.map(offset => localSamples.reduce((best, sample) =>
        Math.abs(sample.elapsedMs - offset) < Math.abs(best.elapsedMs - offset) ? sample : best, localSamples[0]));
      result.events = probe.events.map(event => ({ ...event, elapsedMs: event.time - firstEvent.time }));
      result.rapidInputCount = probe.events.length - 1;
      result.finalState = await page.locator('.avatar-exhibit').getAttribute('data-state');
      result.trustedInputCount = probe.events.filter(event => event.trusted).length;
      result.greetingObserved = localSamples.some(sample => sample.state === 'greeting');
      result.videoFirstInputApproxMs = firstEvent.wallTime - recordingStarted;
      result.motionTransitions = localSamples.filter((sample, index) => index === 0 || sample.state !== localSamples[index - 1].state)
        .map(({ elapsedMs, state }) => ({ elapsedMs, state }));
      await writeFile(`${temporary}/${profile}-probe.json`, `${JSON.stringify(probe, null, 2)}\n`);
      assert.equal(result.rapidInputCount, 10);
      assert(result.greetingObserved, 'No greeting state was observed');
      assert.equal(result.finalState, 'idle');
      assert.deepEqual(result.errors, []);
      result.passed = true;
    } finally {
      await context.close();
      if (video) {
        result.video = `docs/evidence/avatar-interaction-${phase}-${profile}.webm`;
        await rename(await video.path(), result.video);
        result.videoBytes = (await stat(result.video)).size;
      }
    }
    failurePhase = `${profile}: offline video keyframes`;
    const ffmpeg = process.env.FFMPEG_PATH || path.join(os.homedir(), 'AppData/Local/ms-playwright/ffmpeg-1011/ffmpeg-win64.exe');
    result.keyframes = [];
    for (const offset of [0, 300, 650, 1000, 1400, 1800, 2400, 3000, 4500]) {
      const framePath = `${directory}/${profile}-action-${String(offset).padStart(4, '0')}ms.png`;
      const videoTimeMs = result.videoFirstInputApproxMs + offset;
      execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(videoTimeMs / 1000), '-i', result.video, '-frames:v', '1', framePath], { windowsHide: true });
      const bounds = result.avatarBounds;
      const left = Math.max(0, Math.floor(bounds.x)), top = Math.max(0, Math.floor(bounds.y));
      const image = await sharp(framePath).extract({ left, top,
        width: Math.min(viewport.width - left, Math.ceil(bounds.width)),
        height: Math.min(viewport.height - top, Math.ceil(bounds.height)) }).png().toBuffer();
      await writeFile(framePath, image);
      result.keyframes.push({ nominalPostInputMs: offset, approximateVideoTimeMs: videoTimeMs, path: framePath });
    }
    const cellWidth = 300, cellHeight = 440;
    const inputs = [];
    for (const [index, frame] of result.keyframes.entries()) {
      const buffer = await sharp(frame.path).resize(cellWidth, cellHeight - 30, { fit: 'contain', background: '#e7ebf0' }).png().toBuffer();
      inputs.push({ input: buffer, left: index % 3 * cellWidth, top: Math.floor(index / 3) * cellHeight + 30 });
      const label = Buffer.from(`<svg width="300" height="30"><rect width="300" height="30" fill="#e7ebf0"/><text x="10" y="21" font-family="Arial" font-size="16">${phase} ${profile}: ~${frame.nominalPostInputMs} ms</text></svg>`);
      inputs.push({ input: label, left: index % 3 * cellWidth, top: Math.floor(index / 3) * cellHeight });
    }
    result.contactSheet = `${directory}/${profile}-action-contact-sheet.png`;
    await sharp({ create: { width: cellWidth * 3, height: cellHeight * 3, channels: 3, background: '#e7ebf0' } }).composite(inputs).png().toFile(result.contactSheet);
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ profile, passed: result.passed, video: result.video, events: result.events.length, finalState: result.finalState, transitions: result.motionTransitions }));
  }
  report.passed = report.profiles.length === 2 && report.profiles.every(profile => profile.passed);
} catch (error) {
  report.failure = { phase: failurePhase, message: sanitize(error) };
  process.exitCode = 1;
} finally {
  try { await browser?.close(); }
  catch (error) { report.failure ??= { phase: 'browser close', message: sanitize(error) }; report.passed = false; process.exitCode = 1; }
  report.finishedAt = new Date().toISOString();
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ phase, passed: report.passed, failure: report.failure, reportPath }));
}
}

async function recordAfter() {
  const report = {
    phase, startedAt: new Date().toISOString(), passed: false, profiles: [], staticScreenshots: [],
    method: 'Real-time browser recording of trusted person clicks/taps/keyboard activations. No animation seeking or playback-rate changes. An explicitly labelled temporary QA timer is added only to the recording DOM, with a binary time code for offline frame alignment. Clean screenshots hide or omit that overlay.',
    timingLimit: 'After zero is the trusted person click event; the QA timer is painted on rAF and sampled by the 25 fps browser recorder. Before zero is the first visible old greeting bubble. The same nominal elapsed times are requested, but repeated recorder frames and delayed rAF can produce selection errors larger than the nominal 40 ms frame spacing; actual decoded times and maximum errors are reported. This is not an input-latency measurement.',
    deviceLimit: 'Chrome desktop and touch/mobile viewport emulation on the workstation. Mobile keyboard coverage uses browser-dispatched physical-keyboard events, not a physical phone or on-screen keyboard.',
    expectedPhasesMs: { preparing: [0, 320], raising: [320, 1140], waving: [1140, 2500], recovering: [2500, 3400] },
  };
  let browser;
  let failurePhase = 'browser launch';
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    report.browser = browser.version();
    for (const profile of ['desktop', 'mobile']) {
      const mobile = profile === 'mobile';
      const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 };
      const result = { profile, viewport, passed: false, errors: [], diagnostics: [], actions: [], screenshots: [], scenarios: [] };
      report.profiles.push(result);
      failurePhase = `${profile}: context`;
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile,
        reducedMotion: 'no-preference', recordVideo: { dir: temporary, size: viewport } });
      await context.addInitScript(mobile => {
        if (localStorage.getItem('ice-theme') === null) localStorage.setItem('ice-theme', mobile ? 'dark' : 'light');
        if (localStorage.getItem('ice-paused') === null) localStorage.setItem('ice-paused', 'false');
      }, mobile);
      const page = await context.newPage();
      const video = page.video();
      const cdp = await context.newCDPSession(page);
      const recordingStarted = Date.now();
      page.on('pageerror', error => {
        result.errors.push(sanitize(error));
        result.diagnostics.push({ type: 'pageerror', elapsedMs: Date.now() - recordingStarted, message: sanitize(error), stack: sanitize(error.stack || ''), path: new URL(page.url()).pathname });
      });
      page.on('console', message => {
        if (message.type() === 'error') result.errors.push(sanitize(message.text()));
        if (['warning', 'error'].includes(message.type())) result.diagnostics.push({ type: 'console', level: message.type(), elapsedMs: Date.now() - recordingStarted, message: sanitize(message.text()), location: message.location() });
      });
      const recordAction = entry => result.actions.push({ elapsedMs: Date.now() - recordingStarted, ...entry });
      const activate = async selector => {
        if (mobile) await page.locator(selector).first().tap(); else await page.locator(selector).first().click();
      };
      const count = async () => Number(await page.locator('.avatar-exhibit').getAttribute('data-greeting-count'));
      const scrollInput = async delta => {
        const initialY = await page.evaluate(() => scrollY);
        if (mobile) {
          const distance = Math.max(-470, Math.min(470, delta));
          const startY = distance > 0 ? 710 : 120;
          const point = y => ({ x: 12, y, id: 0, radiusX: 1, radiusY: 1, force: 1 });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(startY)] });
          for (let step = 1; step <= 8; step++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(startY - distance * step / 8)] });
            await page.waitForTimeout(24);
          }
          await page.waitForTimeout(80);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } else { await page.mouse.move(50, 550); await page.mouse.wheel(0, delta); }
        await page.waitForTimeout(250);
        recordAction({ action: mobile ? 'touch drag' : 'wheel', initialY, finalY: await page.evaluate(() => scrollY) });
      };
      const moveTo = async (selector, top = 130) => {
        for (let attempt = 0; attempt < 8; attempt++) {
          const bounds = await page.locator(selector).first().boundingBox();
          const difference = bounds.y - top;
          const y = await page.evaluate(() => scrollY);
          if (Math.abs(difference) < 35 || (difference < 0 && y === 0)) break;
          await scrollInput(difference);
        }
      };
      const cleanScreenshot = async name => {
        await page.evaluate(() => { const timer = document.querySelector('[data-qa-timer]'); if (timer) timer.style.visibility = 'hidden'; });
        const file = `${directory}/${profile}-${name}.png`;
        await page.screenshot({ path: file, animations: 'allow' });
        await page.evaluate(() => { const timer = document.querySelector('[data-qa-timer]'); if (timer) timer.style.visibility = ''; });
        result.screenshots.push(file);
      };
      const finishScenario = async (name, before, expectedDelta = 1, waitMs = 4050) => {
        await page.waitForTimeout(waitMs);
        const accepted = await count();
        const state = await page.locator('.avatar-exhibit').getAttribute('data-state');
        const entry = { name, completedElapsedMs: Date.now() - recordingStarted, acceptedBefore: before, acceptedAfter: accepted, expectedDelta, finalState: state };
        result.scenarios.push(entry);
        assert.equal(accepted - before, expectedDelta, `${name}: unexpected accepted greeting count`);
        assert.equal(state, 'idle', `${name}: gesture did not return to idle`);
      };
      try {
        failurePhase = `${profile}: ready and no automatic greeting`;
        assert.equal((await page.goto(`${base}/${mobile ? 'zh' : 'en'}/`, { waitUntil: 'networkidle' })).status(), 200);
        await page.locator('.avatar-exhibit[data-rig="ready"][data-action-ready="true"][data-scene-settled="true"]').waitFor({ timeout: 20000 });
        await page.waitForTimeout(1500);
        assert.equal(await count(), 0, 'An automatic greeting occurred before input');
        assert.equal(await page.locator('.hello-button').count(), 0);
        assert.equal(await page.locator('.avatar-greeting:visible').count(), 0);
        await cleanScreenshot('home');
        if (mobile) await moveTo('.avatar-exhibit');
        await page.waitForTimeout(500);
        await cleanScreenshot('idle');
        result.avatarBounds = await page.locator('.avatar-exhibit').boundingBox();
        await page.evaluate(() => {
          const probe = { samples: [], events: [], keys: [], running: true, origin: null };
          window.__avatarRecordingProbe = probe;
          const timer = document.createElement('canvas'); timer.width = 200; timer.height = 38;
          timer.dataset.qaTimer = 'true'; timer.setAttribute('aria-hidden', 'true');
          timer.style.cssText = 'position:fixed;left:8px;bottom:8px;width:200px;height:38px;z-index:2147483647;pointer-events:none';
          document.body.append(timer);
          const ctx = timer.getContext('2d');
          document.addEventListener('click', event => {
            if (!event.target.closest('.person-button')) return;
            const time = performance.now(); if (probe.origin === null) probe.origin = time;
            probe.events.push({ time, elapsedMs: time - probe.origin, trusted: event.isTrusted,
              pointerType: event.pointerType || 'keyboard', detail: event.detail,
              acceptedBeforeHandler: Number(document.querySelector('.avatar-exhibit').dataset.greetingCount) });
          }, true);
          document.addEventListener('keydown', event => {
            if (event.target.closest('.person-button')) probe.keys.push({ key: event.key, repeat: event.repeat, trusted: event.isTrusted, time: performance.now() });
          }, true);
          const tick = () => {
            if (!probe.running) return;
            const time = performance.now();
            const elapsed = probe.origin === null ? 65535 : Math.min(65534, Math.max(0, Math.round(time - probe.origin)));
            const exhibit = document.querySelector('.avatar-exhibit');
            const joints = {};
            for (const element of document.querySelectorAll('.avatar-rig [data-joint], .avatar-rig [data-part]')) {
              const local = new DOMMatrix(getComputedStyle(element).transform);
              joints[element.dataset.joint || element.dataset.part] = { angle: Math.atan2(local.b, local.a) * 180 / Math.PI, x: local.e, y: local.f };
            }
            probe.samples.push({ time, elapsedMs: probe.origin === null ? null : time - probe.origin, state: exhibit?.dataset.state,
              count: Number(exhibit?.dataset.greetingCount), joints });
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 200, 38);
            ctx.fillStyle = '#102c42'; ctx.font = '12px monospace';
            ctx.fillText(`QA ${probe.origin === null ? 'waiting' : `${elapsed}ms`} | ${exhibit?.dataset.state}`, 4, 16);
            ctx.fillStyle = '#df12c0'; ctx.fillRect(4, 20, 16, 5);
            for (let bit = 0; bit < 16; bit++) {
              ctx.fillStyle = elapsed & (1 << (15 - bit)) ? '#ffffff' : '#111111';
              ctx.fillRect(4 + bit * 12, 26, 8, 8);
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        await page.waitForTimeout(700);
        failurePhase = `${profile}: single complete action`;
        await activate('.person-button');
        await finishScenario('single direct person activation', 0, 1, 5000);
        await cleanScreenshot('returned');
        failurePhase = `${profile}: rapid ten inputs`;
        const beforeRapid = await count();
        const bounds = await page.locator('.person-button').boundingBox();
        const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
        for (let index = 0; index < 10; index++) {
          if (mobile) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
          await page.waitForTimeout(65);
        }
        result.acceptedImmediatelyAfterTenInputs = await count();
        assert.equal(result.acceptedImmediatelyAfterTenInputs - beforeRapid, 1);
        await finishScenario('ten rapid direct inputs while busy', beforeRapid);
        await cleanScreenshot('rapid-returned');
        failurePhase = `${profile}: repeat after idle`;
        const beforeRepeat = await count();
        await activate('.person-button');
        await finishScenario('repeat after idle', beforeRepeat);
        failurePhase = `${profile}: Enter and Space`;
        for (const key of ['Enter', 'Space']) {
          const beforeKey = await count();
          await page.locator('.person-button').focus();
          await page.keyboard.press(key);
          await finishScenario(`keyboard ${key}`, beforeKey);
        }
        failurePhase = `${profile}: finite action with background paused`;
        await moveTo('.site-header', 0);
        await activate('[data-global-pause]');
        assert.equal(await page.locator('[data-global-pause]').getAttribute('aria-pressed'), 'true');
        if (mobile) await moveTo('.avatar-exhibit');
        const beforePaused = await count();
        await activate('.person-button');
        await finishScenario('finite greeting while ambient background is paused', beforePaused);
        failurePhase = `${profile}: reduced-motion feedback`;
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const beforeReduced = await count();
        await activate('.person-button');
        await page.waitForTimeout(190);
        result.reducedAnnouncement = await page.locator('.avatar-announcement').innerText();
        assert(result.reducedAnnouncement.length > 0, 'Reduced mode did not announce a greeting');
        await cleanScreenshot('reduced-feedback');
        await finishScenario('reduced-motion static feedback', beforeReduced, 1, 750);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        failurePhase = `${profile}: save gesture samples`;
        const probe = await page.evaluate(() => {
          window.__avatarRecordingProbe.running = false;
          document.querySelector('[data-qa-timer]')?.remove();
          return window.__avatarRecordingProbe;
        });
        await writeFile(`${temporary}/${profile}-probe.json`, `${JSON.stringify(probe, null, 2)}\n`);
        result.events = probe.events;
        result.keys = probe.keys;
        result.motionTransitions = probe.samples.filter((sample, index) => index === 0 || sample.state !== probe.samples[index - 1].state)
          .map(({ elapsedMs, state, count }) => ({ elapsedMs, state, count }));
        result.poseSamples = [0, 300, 320, 650, 1000, 1140, 1400, 1800, 2400, 2500, 3000, 3400, 4500].map(offset =>
          probe.samples.filter(sample => sample.elapsedMs !== null).reduce((best, sample) =>
            Math.abs(sample.elapsedMs - offset) < Math.abs(best.elapsedMs - offset) ? sample : best));
        assert(probe.events.every(event => event.trusted));
        assert.equal(probe.events.length, 16);
        assert.equal(await count(), 7);
        result.finalAcceptedCount = await count();
        result.finalState = await page.locator('.avatar-exhibit').getAttribute('data-state');
        failurePhase = `${profile}: theme, scrolling and navigation`;
        await moveTo('.site-header', 0);
        await activate('[data-global-pause]');
        const initialTheme = await page.locator('html').getAttribute('data-theme');
        await activate('.theme-toggle');
        const nextTheme = await page.locator('html').getAttribute('data-theme');
        assert.notEqual(initialTheme, nextTheme);
        recordAction({ action: mobile ? 'tap theme' : 'click theme', initialTheme, nextTheme });
        await page.waitForTimeout(900);
        await cleanScreenshot('theme-switched');
        await scrollInput(430);
        await page.waitForTimeout(600);
        await moveTo('.hero-actions', 110);
        const href = await page.locator('.hero-actions a').first().getAttribute('href');
        await activate('.hero-actions a');
        await page.waitForURL(url => url.pathname === href);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(700);
        assert.equal(await page.locator('html').getAttribute('data-theme'), nextTheme, 'Theme did not persist on the Work page');
        recordAction({ action: mobile ? 'tap internal work link' : 'click internal work link', destination: new URL(page.url()).pathname });
        await cleanScreenshot('work-navigation');
        await activate('.site-header .brand');
        await page.waitForURL(`${base}/${mobile ? 'zh' : 'en'}/`);
        await page.waitForLoadState('networkidle');
        await page.locator('.avatar-exhibit[data-action-ready="true"]').waitFor();
        await page.waitForTimeout(1100);
        assert.equal(await page.locator('html').getAttribute('data-theme'), nextTheme, 'Theme did not persist after returning home');
        assert.equal(await count(), 0, 'Returning home triggered an automatic greeting');
        const returnedLanguage = await page.locator('html').getAttribute('lang');
        assert(returnedLanguage.startsWith(mobile ? 'zh' : 'en'), 'Navigation changed the current language');
        result.returnedHome = { path: new URL(page.url()).pathname, theme: nextTheme, language: returnedLanguage, greetingCount: await count() };
        recordAction({ action: mobile ? 'tap home link' : 'click home link', destination: new URL(page.url()).pathname });
        assert.deepEqual(result.errors, []);
        result.passed = true;
      } finally {
        await context.close();
        result.video = `docs/evidence/avatar-interaction-after-${profile}.webm`;
        result.privateMaster = `${temporary}/${profile}-master.webm`;
        await rename(await video.path(), result.privateMaster);
        result.masterBytes = (await stat(result.privateMaster)).size;
      }
      failurePhase = `${profile}: decode real video time code and extract keyframes`;
      await extractAfterFrames(result);
      failurePhase = `${profile}: prepare size-limited public video without cutting time`;
      await publishVideo(result);
      failurePhase = `${profile}: offline before/after comparison`;
      await composeBeforeAfter(result);
      await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
      console.log(JSON.stringify({ profile, passed: result.passed, events: result.events?.length, accepted: result.finalAcceptedCount, video: result.video }));
    }
    failurePhase = 'four clean language/theme combinations';
    for (const lang of ['en', 'zh']) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
      try {
        await context.addInitScript(theme => localStorage.setItem('ice-theme', theme), theme);
        const page = await context.newPage();
        await page.goto(`${base}/${lang}/`, { waitUntil: 'networkidle' });
        await page.locator('.avatar-exhibit[data-rig="ready"][data-scene-settled="true"]').waitFor();
        await page.waitForTimeout(1000);
        const file = `${directory}/home-${lang}-${theme}.png`;
        await page.screenshot({ path: file, animations: 'allow' });
        report.staticScreenshots.push({ lang, theme, file, qaOverlay: false });
      } finally { await context.close(); }
    }
    report.passed = report.profiles.length === 2 && report.profiles.every(profile => profile.passed);
  } catch (error) {
    report.failure = { phase: failurePhase, message: sanitize(error) };
    process.exitCode = 1;
  } finally {
    try { await browser?.close(); }
    catch (error) { report.failure ??= { phase: 'browser close', message: sanitize(error) }; report.passed = false; process.exitCode = 1; }
    report.finishedAt = new Date().toISOString();
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ phase, passed: report.passed, failure: report.failure, reportPath }));
  }
}

async function extractAfterFrames(result) {
  const ffmpeg = process.env.FFMPEG_PATH || path.join(os.homedir(), 'AppData/Local/ms-playwright/ffmpeg-1011/ffmpeg-win64.exe');
  const timerDirectory = `${temporary}/${result.profile}-timecode`;
  await mkdir(timerDirectory, { recursive: true });
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', result.privateMaster,
    '-vf', `crop=200:38:8:${result.viewport.height - 46}`, `${timerDirectory}/%05d.png`], { windowsHide: true });
  const files = (await readdir(timerDirectory)).filter(file => /^\d+\.png$/.test(file)).sort();
  const decoded = [];
  for (const [index, file] of files.entries()) {
    const { data, info } = await sharp(`${timerDirectory}/${file}`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const marker = (22 * info.width + 12) * info.channels;
    if (!(data[marker] > 150 && data[marker + 1] < 100 && data[marker + 2] > 100)) continue;
    let value = 0;
    for (let bit = 0; bit < 16; bit++) {
      const offset = (30 * info.width + 8 + bit * 12) * info.channels;
      const brightness = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
      value = value * 2 + Number(brightness > 128);
    }
    if (value < 5000) decoded.push({ elapsedMs: value, videoMs: index * 40, frame: index });
  }
  // The counter appears once, on the first greeting. Require monotonic adjacent
  // samples to exclude unrelated pixels before the overlay or after navigation.
  const validated = decoded.filter((frame, index) => index > 0 && frame.frame === decoded[index - 1].frame + 1
    && frame.elapsedMs >= decoded[index - 1].elapsedMs && frame.elapsedMs - decoded[index - 1].elapsedMs < 180);
  assert(validated.length > 50, 'Not enough verifiable timer frames were decoded');
  result.keyframes = [];
  const offsets = [0, 300, 320, 650, 1000, 1140, 1400, 1800, 2400, 2500, 3000, 3400, 4500];
  for (const requested of offsets) {
    const frame = validated.reduce((best, next) => Math.abs(next.elapsedMs - requested) < Math.abs(best.elapsedMs - requested) ? next : best);
    assert(Math.abs(frame.elapsedMs - requested) < 160, `No nearby actual video frame for ${requested} ms`);
    const file = `${directory}/${result.profile}-action-${String(requested).padStart(4, '0')}ms.png`;
    execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(frame.videoMs / 1000), '-i', result.privateMaster, '-frames:v', '1', file], { windowsHide: true });
    const bounds = result.avatarBounds;
    const left = Math.max(0, Math.floor(bounds.x)), top = Math.max(0, Math.floor(bounds.y));
    const image = await sharp(file).extract({ left, top, width: Math.min(result.viewport.width - left, Math.ceil(bounds.width)),
      height: Math.min(result.viewport.height - top, Math.ceil(bounds.height)) }).png().toBuffer();
    await writeFile(file, image);
    result.keyframes.push({ nominalPostInputMs: requested, actualTimerMs: frame.elapsedMs, videoTimeMs: frame.videoMs, path: file });
  }
  result.videoAlignment = { method: 'Read the 16-bit visible QA timer from actual encoded video frames; map the requested elapsed time to the closest recorded timer value.',
    recordedFrameSpacingMs: 40,
    maximumObservedSelectionErrorMs: Math.max(...result.keyframes.map(frame => Math.abs(frame.actualTimerMs - frame.nominalPostInputMs))),
    timerFramesUnderFiveSeconds: decoded.length,
    repeatedAdjacentTimerCodes: decoded.filter((frame, index) => index > 0 && frame.frame === decoded[index - 1].frame + 1 && frame.elapsedMs === decoded[index - 1].elapsedMs).length,
    timerCaveat: 'Repeated timer codes measure repeated observed rAF values; they are distinct from exact duplicate decoded image frames. The public inspection report checks exact image duplicates separately.',
    overlay: 'Temporary 200×38 QA timer, lower-left. It only observes real trusted input and live rAF state. Omitted from clean screenshots and character crops.' };
  const inputs = [];
  const comparisonFrames = result.keyframes.filter(frame => ![320, 1140, 2500, 3400].includes(frame.nominalPostInputMs));
  for (const [index, frame] of comparisonFrames.entries()) {
    inputs.push({ input: await sharp(frame.path).resize(300, 410, { fit: 'contain', background: '#e7ebf0' }).png().toBuffer(), left: index % 3 * 300, top: Math.floor(index / 3) * 440 + 30 });
    inputs.push({ input: Buffer.from(`<svg width="300" height="30"><rect width="300" height="30" fill="#e7ebf0"/><text x="10" y="21" font-family="Arial" font-size="15">after ${result.profile}: ${frame.actualTimerMs} ms</text></svg>`), left: index % 3 * 300, top: Math.floor(index / 3) * 440 });
  }
  result.contactSheet = `${directory}/${result.profile}-action-contact-sheet.png`;
  await sharp({ create: { width: 900, height: 1320, channels: 3, background: '#e7ebf0' } }).composite(inputs).png().toFile(result.contactSheet);
}

async function publishVideo(result) {
  const ffmpeg = process.env.FFMPEG_PATH || path.join(os.homedir(), 'AppData/Local/ms-playwright/ffmpeg-1011/ffmpeg-win64.exe');
  const duration = file => {
    const probe = spawnSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8', windowsHide: true });
    const match = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(probe.stderr);
    assert(match, 'Unable to read video duration');
    return (Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000;
  };
  const masterDurationMs = duration(result.privateMaster);
  const maximumBytes = 5 * 1024 * 1024;
  result.videoEncoding = { masterDurationMs, masterDimensions: result.viewport, timeCuts: false, speedChanges: false,
    encoderFrameDropping: false, captureLimit: 'The browser recorder produces a nominal 25 fps stream and can repeat captured frames or omit intermediate browser draws. This recording does not preserve or measure every GPU-presented frame.' };
  if (result.masterBytes <= maximumBytes) {
    await copyFile(result.privateMaster, result.video);
    Object.assign(result.videoEncoding, { reencoded: false, method: 'Byte-identical copy of the complete Playwright WebM recording.' });
  } else {
    const width = result.profile === 'desktop' ? 1152 : result.viewport.width;
    const height = result.profile === 'desktop' ? 800 : result.viewport.height;
    const target = `${temporary}/${result.profile}-public.webm`;
    let bitrate = Math.floor(4.3 * 1024 * 1024 * 8 / (masterDurationMs / 1000));
    for (let attempt = 0; attempt < 2; attempt++) {
      const options = ['-hide_banner', '-loglevel', 'error', '-y', '-i', result.privateMaster,
        '-vf', `scale=${width}:${height}`, '-an', '-c:v', 'libvpx', '-deadline', 'good', '-cpu-used', '4',
        '-threads', '2', '-crf', '28', '-b:v', String(bitrate), '-maxrate', String(bitrate),
        '-bufsize', String(bitrate * 2), '-drop-threshold', '0', target];
      execFileSync(ffmpeg, options, { windowsHide: true, timeout: 180000 });
      if ((await stat(target)).size <= maximumBytes) break;
      bitrate = Math.floor(bitrate * .7);
    }
    assert((await stat(target)).size <= maximumBytes, 'Complete encoded video still exceeds the 5 MiB publication limit');
    await copyFile(target, result.video);
    Object.assign(result.videoEncoding, { reencoded: true, codec: 'libvpx VP8', width, height, bitrate,
      crf: 28, deadline: 'good', cpuUsed: 4, threads: 2, dropThreshold: 0,
      method: 'Lossy spatial/bitrate re-encoding of the complete private master. All scenes and time are retained; no trims, concatenation, animation seeking or speed changes.' });
  }
  result.videoBytes = (await stat(result.video)).size;
  result.videoEncoding.publicDurationMs = duration(result.video);
  assert(Math.abs(result.videoEncoding.publicDurationMs - masterDurationMs) <= 41, 'Public re-encoding changed duration');
  assert(result.videoBytes <= maximumBytes);
}

async function composeBeforeAfter(result) {
  const beforeReport = JSON.parse(await readFile('docs/reports/avatar-interaction/before-recordings.json', 'utf8'));
  const before = beforeReport.profiles.find(profile => profile.profile === result.profile);
  assert(before, 'Matching before recording is missing');
  const inputs = [];
  const cellWidth = 240, cellHeight = 360;
  const offsets = [0, 300, 650, 1000, 1400, 1800, 2400, 3000, 4500];
  const heading = Buffer.from(`<svg width="1440" height="70"><rect width="1440" height="70" fill="#e7ebf0"/><text x="14" y="26" font-family="Arial" font-size="20">${result.profile} — before / after at matching elapsed times</text><text x="14" y="50" font-family="Arial" font-size="14">Before zero: first visible greeting bubble. After zero: trusted person click. Both recordings are 25 fps; exact decoded after times are shown.</text></svg>`);
  inputs.push({ input: heading, left: 0, top: 0 });
  for (const [index, offset] of offsets.entries()) {
    const beforeFrame = before.keyframes.find(frame => frame.nominalPostInputMs === offset);
    const afterFrame = result.keyframes.find(frame => frame.nominalPostInputMs === offset);
    assert(beforeFrame && afterFrame);
    for (const [side, frame] of [beforeFrame, afterFrame].entries()) {
      const left = index % 3 * cellWidth * 2 + side * cellWidth;
      const top = 70 + Math.floor(index / 3) * cellHeight;
      const label = `${side === 0 ? 'BEFORE' : 'AFTER'} ${side === 0 ? offset : frame.actualTimerMs} ms`;
      inputs.push({ input: Buffer.from(`<svg width="240" height="30"><rect width="240" height="30" fill="#e7ebf0"/><text x="10" y="21" font-family="Arial" font-size="15">${label}</text></svg>`), left, top });
      inputs.push({ input: await sharp(frame.path).resize(cellWidth, cellHeight - 30, { fit: 'contain', background: '#e7ebf0' }).png().toBuffer(), left, top: top + 30 });
    }
  }
  result.comparison = `docs/screenshots/avatar-interaction/comparison-${result.profile}.png`;
  await sharp({ create: { width: 1440, height: 1150, channels: 3, background: '#e7ebf0' } }).composite(inputs).png().toFile(result.comparison);
}
