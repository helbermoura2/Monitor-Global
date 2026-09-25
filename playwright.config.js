// Config mínima só pros testes de fumaça (tests/smoke.spec.js) — o site em si
// não tem build step nenhum, isso aqui só sobe um servidor estático local pro
// Playwright testar contra ele.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  retries: process.env.CI ? 1 : 0, // rede real (GDACS/USGS/etc.) pode falhar por instabilidade transitória
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx serve -l 4173 .',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 20000,
  },
});
