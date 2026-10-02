const { test, expect } = require('@playwright/test');

// Executado após o merge, contra os arquivos realmente publicados.
test('site publicado carrega a correção e mantém os efeitos e controles operantes', async ({ page, request }) => {
  test.skip(!process.env.PUBLIC_SITE_URL, 'Validação de produção apenas após publicação.');
  test.setTimeout(180000);
  const base = process.env.PUBLIC_SITE_URL.replace(/\/$/, '');
  await expect.poll(async () => {
    const response = await request.get(base + '/index.html?verify=' + Date.now());
    if (!response.ok()) return false;
    return (await response.text()).includes('js/painel-fx.js?v=20261002-shared-layer-fix');
  }, { timeout: 120000, intervals: [5000] }).toBe(true);
  const script = await request.get(base + '/js/painel-fx.js?v=20261002-shared-layer-fix');
  expect(script.ok()).toBe(true);
  const source = await script.text();
  expect(source).toContain('function ensureFallLayer()');
  expect(source).toContain('function pickRandom(');

  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).hostname === new URL(base).hostname ? route.continue() : route.abort());
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !__fetchGlobalFeedsEmAndamento && !!window.CardEffectDemo);
  await page.evaluate(() => {
    const item = { id: 'production-browser-qa', type: 'earthquake', mag: 3, depth: 10, source: 'QA', coords: [-70, -20], place: 'Verificação da publicação', time: Date.now() };
    globalEvents = [item];
    showEventDetails(0, false);
    clearTimeout(cycleTimeout);
    clearTimeout(window.__mgRadarDelayT);
    clearTimeout(window.__mgWaveDelayT);
    SeismicCinema.stop();
  });
  await expect(page.locator('#pd-local')).toContainText('Verificação da publicação');
  for (const type of ['hurricane', 'wind', 'storm', 'volcano-ash', 'flood']) {
    await page.evaluate(type => CardEffectDemo.preview(type), type);
    await expect(page.locator('#card-fx-demo-status')).toContainText('DEMONSTRAÇÃO');
    await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-demo', 'true');
    await expect(page.locator('.pd-cinema-contact')).toHaveCSS('pointer-events', 'none');
    await page.waitForTimeout(2600);
    await expect(page.locator('#pd-local')).toContainText('Verificação da publicação');
    await expect(page.locator('#pd-focus-btn')).toBeEnabled();
  }
  await page.locator('#card-fx-demo-status').getByRole('button', { name: 'Parar', exact: true }).click();
  await expect(page.locator('#card-fx-demo-status')).toHaveCount(0);
  expect(errors).toEqual([]);
});
