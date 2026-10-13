import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseURL = 'http://127.0.0.1:4321';
const scenarios = [];
for (const lang of ['en', 'zh']) {
  for (const theme of ['light', 'dark']) {
    for (const mobile of [false, true]) {
      for (const paused of [false, true]) {
        scenarios.push({ path: `/${lang}/`, theme, mobile, paused });
      }
    }
  }
}
for (const path of ['/en/work/', '/en/about/', '/en/resume/', '/en/work/context-ai/', '/zh/work/yunxinyi/', '/en/404/']) {
  scenarios.push({ path, theme: 'light', mobile: false, paused: false });
}

const reportDirectory = process.env.REPORT_DIRECTORY || 'docs/reports';
mkdirSync(reportDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const reports = [];
try {
  for (const scenario of scenarios) {
    const { path, theme, mobile, paused } = scenario;
    const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 };
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    try {
      await context.addInitScript(({ theme, paused }) => {
        localStorage.setItem('ice-theme', theme);
        localStorage.setItem('ice-paused', String(paused));
      }, { theme, paused });
      const page = await context.newPage();
      await page.goto(`${baseURL}${path}`, { waitUntil: 'networkidle' });
      await page.waitForFunction((expectedTheme) => document.documentElement.dataset.theme === expectedTheme, theme);
      if (/^\/(en|zh)\/$/.test(path)) {
        await page.locator('.avatar-exhibit[data-rig="ready"]').waitFor();
        await page.locator('.avatar-exhibit[data-state="idle"]').waitFor();
        await page.waitForFunction(value => document.querySelector('[data-global-pause]')?.getAttribute('aria-pressed') === String(value), paused);
      }
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      reports.push({ ...scenario, viewport, reducedMotion: 'reduce', violations: results.violations, passes: results.passes.length });
    } finally { await context.close(); }
  }
} finally { await browser.close(); }

writeFileSync(`${reportDirectory}/axe.json`, JSON.stringify({ date: new Date().toISOString(), browser: browser.version(), scope: 'Automated WCAG A/AA rules on retained pages and both localized homes in light/dark, desktop/mobile and paused/unpaused states. This is not a complete accessibility conformance assessment.', reports }, null, 2));
console.log(JSON.stringify({ scenarios: reports.length, violations: reports.reduce((total, report) => total + report.violations.length, 0), reports: reports.map(report => ({
  ...report, violations: report.violations.map(violation => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })),
})) }, null, 2));
if (reports.some(report => report.violations.length)) process.exitCode = 1;
