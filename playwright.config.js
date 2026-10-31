// Config mínima só pros testes de fumaça (tests/smoke.spec.js) — o site em si
// não tem build step nenhum, isso aqui só sobe um servidor estático local pro
// Playwright testar contra ele.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  // Node unit tests run in their own step; loading them here mixes two test runners.
  testMatch: '**/*.spec.js',
  timeout: 60000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined,
    launchOptions: process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : undefined,
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    proxy: { server: 'http://127.0.0.1:4174', bypass: '127.0.0.1,localhost,[::1]' },
  },
  webServer: [{
    command: 'node tools/test-offline-proxy.cjs',
    url: 'http://127.0.0.1:4174/health',
    reuseExistingServer: !process.env.CI,
  }, {
    command: 'npx serve -l 4173 .',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 20000,
  }],
});
