import { chromium } from '@playwright/test';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const screenshots = 'docs/screenshots/visual-upgrade/after';
const videos = 'docs/evidence';
const temporary = '.verification/visual-upgrade/video';
await Promise.all([screenshots, videos, temporary].map(path => mkdir(path, { recursive: true })));
const reports = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const profile of ['desktop', 'mobile']) {
    const mobile = profile === 'mobile';
    const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 };
    const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile, reducedMotion: 'no-preference', recordVideo: { dir: temporary, size: viewport } });
    await context.addInitScript(mobile => {
      sessionStorage.setItem('mingyang:avatar-welcome:v1', 'seen');
      localStorage.setItem('ice-theme', mobile ? 'dark' : 'light');
    }, mobile);
    const page = await context.newPage();
    const started = Date.now();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:4321/${mobile ? 'zh' : 'en'}/`, { waitUntil: 'networkidle' });
    await page.locator('.avatar-exhibit[data-rig="ready"][data-scene-settled="true"]').waitFor();
    await page.waitForTimeout(700);
    if (mobile) await page.locator('.avatar-exhibit').scrollIntoViewIfNeeded();
    const frames = [];
    async function sample(id, label, start = null) {
      const data = await page.locator('.avatar-rig').evaluate(svg => {
        const joints = {};
        for (const element of svg.querySelectorAll('[data-joint], [data-part]')) {
          const local = new DOMMatrix(getComputedStyle(element).transform), m = element.getCTM();
          joints[element.dataset.joint || element.dataset.part] = { degrees: Math.atan2(local.b, local.a) * 180 / Math.PI, matrix: [m.a, m.b, m.c, m.d, m.e, m.f] };
        }
        return { now: performance.now(), joints };
      });
      const path = `${screenshots}/motion-${profile}-${id}.png`;
      await page.locator('.avatar-exhibit').screenshot({ path, animations: 'allow' });
      frames.push({ id, label, elapsedMs: start === null ? 0 : Math.round(data.now - start), joints: data.joints, path });
    }
    await sample('00', 'Idle');
    if (mobile) await page.locator('.hello-button').tap(); else await page.locator('.hello-button').click();
    await page.waitForFunction(() => document.querySelector('[data-joint="shoulder"]').getAnimations().length > 0);
    const waveStart = await page.locator('[data-joint="shoulder"]').evaluate(el => performance.now() - Number(el.getAnimations()[0].currentTime));
    for (const [index, time, label] of [[1, 380, 'Arm rising'], [2, 1030, 'Wrist wave A'], [3, 1310, 'Wrist wave B'], [4, 1570, 'Wrist wave A'], [5, 2160, 'Arm lowering'], [6, 2850, 'Back to idle']]) {
      const elapsed = await page.evaluate(() => performance.now()) - waveStart;
      if (elapsed < time) await page.waitForTimeout(time - elapsed);
      await sample(String(index).padStart(2, '0'), label, waveStart);
    }
    assert(frames[2].joints.shoulder.degrees < -60 && frames[2].joints.elbow.degrees < -55);
    assert(frames[2].joints.wrist.degrees > 5 && frames[3].joints.wrist.degrees < -5 && frames[4].joints.wrist.degrees > 5);
    for (const joint of ['shoulder', 'elbow', 'wrist']) assert(Math.abs(frames[6].joints[joint].degrees) < 0.05);
    assert(frames.every(frame => JSON.stringify(frame.joints.body.matrix) === JSON.stringify(frames[0].joints.body.matrix)));

    const card = page.locator('[data-light-card]').first();
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    if (mobile) {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewport.width);
      assert.equal(await card.locator('.project-art').evaluate(el => getComputedStyle(el).transform), 'none');
      await card.tap();
      await page.waitForURL('**/zh/work/goldencamp/');
      await page.waitForTimeout(900);
      await page.goBack({ waitUntil: 'networkidle' });
    } else {
      const bounds = await card.boundingBox();
      await page.mouse.move(bounds.x + 40, bounds.y + 50);
      await page.waitForTimeout(650);
      await page.mouse.move(bounds.x + bounds.width * .75, bounds.y + bounds.height * .6, { steps: 32 });
      await page.waitForTimeout(650);
      assert.equal(await card.getAttribute('data-tracking'), 'true');
      await page.screenshot({ path: `${screenshots}/desktop-card-light.png`, animations: 'allow' });
      await page.mouse.move(60, 60, { steps: 20 });
      await page.waitForTimeout(700);
      assert.equal(await card.getAttribute('data-tracking'), null);
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(1000);
    if (mobile) await page.locator('.theme-toggle').tap(); else await page.locator('.theme-toggle').click();
    await page.waitForTimeout(1100);
    if (mobile) {
      await page.locator('.menu-toggle').tap();
      await page.waitForTimeout(850);
      await page.locator('.menu-toggle').tap();
    } else {
      await page.locator('#site-nav a').first().hover();
      await page.waitForTimeout(700);
      await page.locator('#site-nav a').first().click();
      await page.waitForURL('**/en/work/');
      await page.waitForTimeout(850);
      await page.locator('.site-header .brand').click();
      await page.waitForURL('**/en/');
    }
    const remaining = 21000 - (Date.now() - started);
    if (remaining > 0) await page.waitForTimeout(remaining);
    assert.deepEqual(errors, []);
    const video = page.video();
    const durationMs = Date.now() - started;
    await context.close();
    await rename(await video.path(), `${videos}/visual-upgrade-${profile}.webm`);
    // Contact sheet consists only of successive screenshots of the live animation.
    const cellW = 240;
    const metadata = await sharp(frames[0].path).metadata();
    const cellH = Math.round(metadata.height / metadata.width * cellW);
    const composites = [];
    for (let index = 0; index < frames.length; index++) {
      const left = index % 4 * cellW, top = Math.floor(index / 4) * (cellH + 36);
      composites.push({ input: await sharp(frames[index].path).resize(cellW, cellH).png().toBuffer(), left, top });
      const label = `<svg width="${cellW}" height="36"><rect width="100%" height="100%" fill="#eaf5ff"/><text x="10" y="22" font-size="12" font-family="Arial" fill="#132943">${frames[index].label} · ${frames[index].elapsedMs} ms</text></svg>`;
      composites.push({ input: Buffer.from(label), left, top: top + cellH });
    }
    await sharp({ create: { width: cellW * 4, height: (cellH + 36) * 2, channels: 3, background: '#eaf5ff' } }).composite(composites).jpeg({ quality: 88 }).toFile(`${screenshots}/motion-${profile}-sequence.jpg`);
    reports.push({ profile, browser: browser.version(), recordedAt: new Date().toISOString(), recording: `${videos}/visual-upgrade-${profile}.webm`, durationMs, viewport, method: 'Real-time Chromium capture with genuine click/tap. No animation seeking, speed override, mocked joints or rendered substitute video.', frames, errors, passed: true });
    console.log(`${profile}: ${durationMs} ms, live wave verified, card/touch and theme interactions recorded.`);
  }
} finally { await browser.close(); }
await writeFile('docs/reports/visual-upgrade/motion.json', JSON.stringify(reports, null, 2));
