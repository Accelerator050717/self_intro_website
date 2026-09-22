import { defineConfig } from '@playwright/test';
const evidenceRound = process.env.REPORT_DIRECTORY?.includes('gradient-waves') ? 'gradient-waves' : 'visual-upgrade';
export default defineConfig({
  testDir:'./tests',testMatch:'**/*.spec.ts',fullyParallel:false,workers:1,
  timeout:45000,expect:{timeout:12000},
  outputDir: process.env.REPORT_DIRECTORY ? `.verification/${evidenceRound}/playwright-test-results` : 'test-results',
  reporter:[['list'],['html',{open:'never',outputFolder:process.env.REPORT_DIRECTORY ? `.verification/${evidenceRound}/playwright-report` : 'playwright-report'}],['json',{outputFile:process.env.REPORT_DIRECTORY ? `${process.env.REPORT_DIRECTORY}/playwright.json` : 'docs/test-results.json'}]],
  use:{baseURL:'http://127.0.0.1:4321',browserName:'chromium',headless:true,reducedMotion:'reduce',viewport:{width:1440,height:1000},screenshot:'only-on-failure',trace:'retain-on-failure'},
  webServer:{command:'npm run preview -- --port 4321',url:'http://127.0.0.1:4321/en/',reuseExistingServer:true,timeout:30000}
});
