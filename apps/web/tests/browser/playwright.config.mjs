import {defineConfig} from '@playwright/test';
const light = process.env.PERSONALOS_LIGHTWEIGHT_GUARD === '1';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.mjs',
  timeout: 180000,
  expect: {timeout: 30000},
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  outputDir: '../../../../evidence/browser-run/test-results',
  reporter: [['line'], ['./run-manifest-reporter.mjs']],
  use: {
    baseURL: 'http://127.0.0.1:4381',
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    launchOptions: {chromiumSandbox: true},
    reducedMotion: 'no-preference',
    locale: 'zh-CN',
    timezoneId: 'UTC',
    screenshot: light ? 'off' : 'only-on-failure',
    video: light ? 'off' : 'retain-on-failure',
    trace: light ? 'off' : 'retain-on-failure',
  },
  projects: [
    {name: 'mobile-390', use: {viewport: {width: 390, height: 844}, deviceScaleFactor: 1}},
    {name: 'desktop-1280', use: {viewport: {width: 1280, height: 900}, deviceScaleFactor: 1}},
  ],
  webServer: {
    command: 'node ../../dev-server.mjs',
    env: {WEB_PORT: '4381', WEB_HOST: '127.0.0.1'},
    url: 'http://127.0.0.1:4381',
    reuseExistingServer: false,
    timeout: 10000,
  },
});
