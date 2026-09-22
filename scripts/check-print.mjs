import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputRelative = process.env.SCREENSHOT_DIRECTORY || 'docs/screenshots/revision';
const output = path.join(root, outputRelative);
const reports = path.join(root, process.env.REPORT_DIRECTORY || 'docs/reports');
const base = process.env.BASE_URL || 'http://127.0.0.1:4321';
// Read the real shared configuration without requiring Node's newer TS loader.
const configSource = await readFile(path.join(root, 'src/data/site-config.ts'), 'utf8');
const configModule = ts.transpileModule(configSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { siteContact } = await import(`data:text/javascript;base64,${Buffer.from(configModule).toString('base64')}`);
await Promise.all([mkdir(output, { recursive: true }), mkdir(reports, { recursive: true })]);
const report = {
  date: new Date().toISOString(), finishedAt: '', base, passed: false, failure: '',
  browser: 'Installed Chrome, headless, print media, A4, native CSS without injection',
  expectedContact: siteContact, results: [], pageErrors: [], consoleErrors: [],
  pdfInspection: 'Browser export and DOM assertions only. Actual PDF text, links, page rendering, and visual inspection are recorded separately in print-pdf-inspection.json.',
};
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  for (const lang of ['en', 'zh']) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1414 } });
    page.on('pageerror', error => report.pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
    try {
      const response = await page.goto(`${base}/${lang}/resume/`, { waitUntil: 'networkidle' });
      assert.equal(response?.status(), 200);
      await page.emulateMedia({ media: 'print' });
      await page.evaluate(() => document.fonts.ready);
      const result = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        heading: document.querySelector('h1')?.textContent,
        navigationHidden: getComputedStyle(document.querySelector('.site-header')).display === 'none',
        footerHidden: getComputedStyle(document.querySelector('.site-footer')).display === 'none',
        projects: document.querySelectorAll('.resume-project').length,
        projectTitles: [...document.querySelectorAll('.resume-project h3')].map(node => node.textContent?.trim()),
        sectionHeadings: [...document.querySelectorAll('.resume-sheet h2')].map(node => node.textContent?.trim()),
        contactLinks: [...document.querySelectorAll('.resume-contact a')].map(node => ({ text: node.textContent, href: node.getAttribute('href') })),
        emailLinks: [...document.querySelectorAll('a[href^="mailto:"]')].map(node => node.getAttribute('href')),
        printText: document.querySelector('main').innerText,
        documentText: document.body.textContent,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      assert.equal(result.navigationHidden, true, `${lang}: navigation must be hidden in print`);
      assert.equal(result.footerHidden, true, `${lang}: footer must be hidden in print`);
      assert.equal(result.projects, 6, `${lang}: all six projects must remain`);
      assert.equal(result.overflow, false, `${lang}: print layout must not overflow`);
      assert(result.contactLinks.some(link => link.text === siteContact.email && link.href === siteContact.mailto), `${lang}: exact shared email text and mailto are required`);
      assert(result.emailLinks.every(href => href === siteContact.mailto), `${lang}: all mailto links must use the shared address`);
      assert(result.printText.includes(siteContact.email));
      assert(!/myu12@uci\.edu/i.test(result.documentText), `${lang}: old contact email must be absent`);
      assert(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.edu\b/i.test(result.printText), `${lang}: school email must not be printed`);
      const pdfFile = `${outputRelative}/resume-print-${lang}.pdf`;
      const screenFile = `${outputRelative}/resume-print-${lang}-browser.png`;
      await page.pdf({ path: path.join(root, pdfFile), format: 'A4', printBackground: true, preferCSSPageSize: true });
      await page.screenshot({ path: path.join(root, screenFile), fullPage: true });
      const { documentText: _documentText, ...evidence } = result;
      report.results.push({ ...evidence, pdfFile, screenFile, passed: true });
    } finally { await page.close(); }
  }
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  report.passed = true;
} catch (error) {
  report.failure = String(error?.stack || error);
  process.exitCode = 1;
} finally {
  await browser.close();
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(reports, 'print.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ passed: report.passed, results: report.results.map(({ lang, heading, projects, contactLinks, pdfFile }) => ({ lang, heading, projects, contactLinks, pdfFile })), failure: report.failure }, null, 2));
}
