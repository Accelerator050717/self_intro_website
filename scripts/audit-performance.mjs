import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';

// Own a temporary browser, rather than asking chrome-launcher to remove an
// in-use Windows profile. This never attaches to the user's Chrome session.
const server = createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
await new Promise(resolve => server.close(resolve));
const browser = await chromium.launch({ headless: true, args: [`--remote-debugging-port=${port}`] });
const url = process.env.AUDIT_URL || 'http://127.0.0.1:4321/en/';
const profiles = process.argv.includes('--desktop-only') ? ['desktop'] : ['desktop', 'mobile'];
mkdirSync('docs/reports', { recursive: true });
const summary = [];
try {
  for (const profile of profiles) {
    const result = await lighthouse(url, {
      port, logLevel: 'error', output: ['html', 'json'],
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    }, profile === 'desktop' ? desktopConfig : undefined);
    writeFileSync(`docs/reports/lighthouse-${profile}.report.html`, result.report[0]);
    writeFileSync(`docs/reports/lighthouse-${profile}.report.json`, result.report[1]);
    const report = result.lhr;
    const metrics = Object.fromEntries(['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index'].map(id => [id, report.audits[id].numericValue]));
    const entry = {
      profile, url, date: report.fetchTime, lighthouseVersion: report.lighthouseVersion,
      browser: browser.version(), scores: Object.fromEntries(Object.entries(report.categories).map(([id, value]) => [id, Math.round(value.score * 100)])),
      metrics, runtimeError: report.runtimeError || null, warnings: report.runWarnings,
    };
    summary.push(entry);
    console.log(JSON.stringify(entry, null, 2));
    if (report.runtimeError) process.exitCode = 1;
  }
} finally {
  writeFileSync('docs/reports/lighthouse-summary.json', JSON.stringify(summary, null, 2));
  await browser.close();
}
