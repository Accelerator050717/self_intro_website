import { chromium } from '@playwright/test';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const output = 'docs/screenshots/revision';
const evidence = 'docs/evidence';
await mkdir(output, { recursive: true }); await mkdir(evidence, { recursive: true });
await mkdir('.verification/avatar-video', { recursive: true });
const browser = await chromium.launch({ headless: true });
const reports = [];
try {
  for (const profile of ['desktop', 'mobile']) {
    const mobile = profile === 'mobile';
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      hasTouch: mobile, isMobile: mobile, reducedMotion: 'no-preference',
      recordVideo: { dir: '.verification/avatar-video', size: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } },
    });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(({ mobile }) => {
      sessionStorage.setItem('mingyang:avatar-welcome:v1', 'seen');
      if (mobile) localStorage.setItem('ice-theme', 'dark');
    }, { mobile });
    await page.goto(`http://127.0.0.1:4321/${mobile ? 'zh' : 'en'}/`);
    await page.locator('.avatar-exhibit[data-rig=ready]').waitFor();
    await page.locator('.avatar-exhibit').scrollIntoViewIfNeeded();
    await page.locator('.avatar-exhibit[data-scene-settled=true]').waitFor();
    await page.waitForTimeout(300);
    const frames = [];
    async function frame(id, label, started = null) {
      const metrics = await page.locator('.avatar-rig').evaluate(svg => {
        const joints = {};
        for (const el of svg.querySelectorAll('[data-joint], [data-part]')) {
          const local = new DOMMatrix(getComputedStyle(el).transform); const m = el.getCTM();
          joints[el.dataset.joint || el.dataset.part] = { degrees: Math.atan2(local.b, local.a) * 180 / Math.PI, matrix: [m.a, m.b, m.c, m.d, m.e, m.f] };
        }
        return { now: performance.now(), joints };
      });
      const path = `${output}/avatar-${profile}-${id}.png`;
      await page.locator('.avatar-exhibit').screenshot({ path, animations: 'allow' });
      frames.push({ id, label, elapsedMs: started === null ? 0 : Math.round(metrics.now - started), joints: metrics.joints, path });
    }
    async function trigger(selector) {
      if (mobile) await page.locator(selector).tap(); else await page.locator(selector).click();
      await page.waitForFunction(() => document.querySelector('[data-joint="shoulder"]').getAnimations()[0]?.currentTime !== null);
      return page.locator('[data-joint="shoulder"]').evaluate(el => performance.now() - Number(el.getAnimations()[0].currentTime));
    }
    async function at(ms, start, id, label) {
      const elapsed = await page.evaluate(() => performance.now()) - start;
      if (elapsed < ms) await page.waitForTimeout(ms - elapsed);
      await frame(id, label, start);
    }
    await frame('00', 'Idle');
    const first = await trigger('.hello-button');
    await at(380, first, '01', 'Arm rising');
    await at(1030, first, '02', 'Wrist wave A');
    await at(1310, first, '03', 'Wrist wave B');
    await at(1570, first, '04', 'Wrist wave A');
    await at(2160, first, '05', 'Arm lowering');
    await at(2850, first, '06', 'Back to idle');
    await page.waitForTimeout(450);
    const second = await trigger('.person-button');
    await at(1050, second, '07', 'Second greeting');
    await at(2860, second, '08', 'Idle again');
    assert.equal(await page.locator('.avatar-exhibit').getAttribute('data-state'), 'idle');
    const base = JSON.stringify(frames[0].joints.body.matrix);
    assert(frames.every(item => JSON.stringify(item.joints.body.matrix) === base), 'Body and feet must not move');
    assert(frames[2].joints.shoulder.degrees < -60 && frames[2].joints.elbow.degrees < -55, 'Actual arm raises');
    assert(frames[2].joints.wrist.degrees > 5 && frames[3].joints.wrist.degrees < -5 && frames[4].joints.wrist.degrees > 5, 'Actual wrist swings both ways twice');
    for (const index of [6, 8]) for (const joint of ['shoulder', 'elbow', 'wrist']) assert(Math.abs(frames[index].joints[joint].degrees) < .05, 'Pose returns to idle');
    assert(frames[7].joints.shoulder.degrees < -60, 'Second greeting raises own arm');
    assert.equal(errors.length, 0, errors.join('\n'));
    const video = page.video();
    await context.close();
    await rename(await video.path(), `${evidence}/avatar-${profile}.webm`);
    const cellW = mobile ? 260 : 300;
    const composites = []; const sample = await sharp(frames[0].path).metadata();
    const cellH = Math.round(sample.height / sample.width * cellW); const labelH = 48;
    for (let index = 0; index < frames.length; index++) {
      const f = frames[index], left = (index % 3) * cellW, top = Math.floor(index / 3) * (cellH + labelH);
      composites.push({ input: await sharp(f.path).resize(cellW, cellH).png().toBuffer(), left, top });
      const label = `<svg width="${cellW}" height="${labelH}"><rect width="100%" height="100%" fill="#eef4fa"/><text x="12" y="19" font-family="Arial" font-size="13" fill="#17374b">${f.id} · ${f.label}</text><text x="12" y="37" font-family="Arial" font-size="11" fill="#526a80">${f.elapsedMs} ms · ${index > 6 ? 'greeting 2' : 'greeting 1'}</text></svg>`;
      composites.push({ input: Buffer.from(label), left, top: top + cellH });
    }
    await sharp({ create: { width: cellW * 3, height: (cellH + labelH) * 3, channels: 3, background: '#eef4fa' } }).composite(composites).jpeg({ quality: 88 }).toFile(`${output}/avatar-${profile}-sequence.jpg`);
    reports.push({ profile, browser: browser.version(), recordedAt: new Date().toISOString(), recording: `${evidence}/avatar-${profile}.webm`, method: 'Real-time browser click/tap recording; no seeking, playback-rate override or mocked animation. Frame times are measured from the actual running animation clock.', frames, errors, passed: true });
    console.log(`${profile}: 9 actual frames, two greetings, body fixed, joint motion and idle reset verified.`);
  }
} finally { await browser.close(); }
await writeFile('docs/reports/avatar-motion.json', JSON.stringify(reports, null, 2));
