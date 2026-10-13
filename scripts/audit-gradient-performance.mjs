import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';

// Same Lighthouse profiles and six-run order as the prior visual-upgrade audit;
// this round has independent raw data and reviewed reports.
const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw new Error('Use before or after');
const url = process.env.AUDIT_URL || 'http://127.0.0.1:4321/en/';
const directory = process.env.REPORT_DIRECTORY || 'docs/reports/gradient-waves';
const round = directory.includes('avatar-interaction') ? 'avatar-interaction' : 'gradient-waves';
const rawDirectory = `.verification/${round}/performance/${phase}`;
mkdirSync(rawDirectory, { recursive: true });
mkdirSync(directory, { recursive: true });
const results = [];
for (const profile of ['desktop', 'mobile']) {
  for (let run = 1; run <= 3; run++) {
    const server = createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    const browser = await chromium.launch({ headless: true, args: [`--remote-debugging-port=${port}`] });
    try {
      const result = await lighthouse(url, {
        port, logLevel: 'error', output: ['html', 'json'], onlyCategories: ['performance'],
      }, profile === 'desktop' ? desktopConfig : undefined);
      writeFileSync(`${rawDirectory}/${profile}-${run}.html`, result.report[0]);
      writeFileSync(`${rawDirectory}/${profile}-${run}.json`, result.report[1]);
      const report = result.lhr;
      const metric = id => report.audits[id]?.numericValue ?? null;
      const scripts = report.audits['resource-summary']?.details?.items?.find(item => item.resourceType === 'script');
      const execution = report.audits['bootup-time']?.details?.items ?? [];
      const entry = {
        phase, profile, run, url, date: report.fetchTime, browser: browser.version(), lighthouseVersion: report.lighthouseVersion,
        benchmarkIndex: report.environment?.benchmarkIndex ?? null,
        settings: { formFactor: report.configSettings.formFactor, throttling: report.configSettings.throttling, screenEmulation: report.configSettings.screenEmulation, throttlingMethod: report.configSettings.throttlingMethod },
        performance: Math.round(report.categories.performance.score * 100),
        fcpMs: metric('first-contentful-paint'), lcpMs: metric('largest-contentful-paint'), tbtMs: metric('total-blocking-time'), cls: metric('cumulative-layout-shift'), speedIndexMs: metric('speed-index'),
        jsTransferBytes: scripts?.transferSize ?? 0, jsRequests: scripts?.requestCount ?? 0,
        jsExecutionMs: execution.reduce((sum, item) => sum + (item.scripting || 0) + (item.scriptParseCompile || 0), 0),
        execution, longTasks: (report.audits['long-tasks']?.details?.items ?? []).slice(0, 8),
        mainThread: report.audits['mainthread-work-breakdown']?.details?.items ?? [],
        runtimeError: report.runtimeError ?? null, warnings: report.runWarnings,
      };
      results.push(entry);
      writeFileSync(`${directory}/${phase}-performance.json`, `${JSON.stringify({ results }, null, 2)}\n`);
      console.log(JSON.stringify({ profile, run, performance: entry.performance, lcpMs: entry.lcpMs, tbtMs: entry.tbtMs, cls: entry.cls, jsTransferBytes: entry.jsTransferBytes, jsExecutionMs: entry.jsExecutionMs, warnings: entry.warnings }));
      if (entry.runtimeError) process.exitCode = 1;
    } finally { await browser.close(); }
  }
}
const summaries = ['desktop', 'mobile'].map(profile => {
  const runs = results.filter(result => result.profile === profile);
  const metrics = Object.fromEntries(['performance', 'lcpMs', 'tbtMs', 'cls', 'jsTransferBytes', 'jsExecutionMs'].map(key => {
    const values = runs.map(run => run[key]).sort((a, b) => a - b);
    return [key, { median: values[1], min: values[0], max: values[2] }];
  }));
  return { profile, metrics };
});
writeFileSync(`${directory}/${phase}-performance.json`, `${JSON.stringify({ date: new Date().toISOString(), url, method: 'Production preview, three desktop and three simulated mobile Lighthouse runs. Simulated TBT is not real-device INP.', summaries, results }, null, 2)}\n`);
console.log(JSON.stringify(summaries, null, 2));
