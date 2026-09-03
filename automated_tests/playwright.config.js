const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',

  timeout: 30 * 1000,

  expect: {
    timeout: 5000,
  },

  use: {
    baseURL: 'http://localhost:5000',

    headless: false,

    screenshot: 'only-on-failure',

    trace: 'retain-on-failure',
  },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
});