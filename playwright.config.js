// @ts-check
const { defineConfig } = require('@playwright/test');

/**
 * Playwright configuration for Estralis Bot
 * Supports headless mode toggle via HEADLESS env variable
 */
module.exports = defineConfig({
  testDir: './',
  testMatch: 'index.js',
  timeout: 120_000,
  retries: 1,
  workers: 1,

  use: {
    // Toggle headless mode: HEADLESS=false node index.js
    headless: process.env.HEADLESS !== 'false',
    viewport: { width: 1280, height: 900 },
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    screenshot: 'on',
    trace: 'on-first-retry',
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
