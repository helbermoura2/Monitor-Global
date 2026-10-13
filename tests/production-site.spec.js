const { test, expect } = require('@playwright/test');
require('./helpers/card-renderer-fixture.cjs')(test);
test.use({ serviceWorkers: 'block' });

// Executado após o merge, contra os arquivos realmente publicados.
test('site publicado carrega a correção e mantém os efeitos e controles operantes', async ({ page, request }) => {
  test.skip(!process.env.PUBLIC_SITE_URL, 'Validação de produção apenas após publicação.');
  test.setTimeout(240000);
  const base = process.env.PUBLIC_SITE_URL.replace(/\/$/, '');
  await expect.poll(async () => {
    const response = await request.get(base + '/index.html?verify=' + Date.now());
    if (!response.ok()) return false;
    return /js\/globalquake-travel\.js\?v=/.test(await response.text());
  }, { timeout: 120000, intervals: [5000] }).toBe(true);
  const script = await request.get(base + '/js/painel-fx.js?verify=' + Date.now());
  expect(script.ok()).toBe(true);
  const source = await script.text();
  expect(source).toContain('function ensureFallLayer()');
  expect(source).toContain('function pickRandom(');

  const errors = [];
  // Third-party requests are intentionally blocked below; their fetch rejection
  // is expected. Renderer and application JavaScript errors remain fatal.
  page.on('pageerror', error => { if (error.message !== 'Failed to fetch') errors.push(error.message); });
  await page.route('**/*', route => new URL(route.request().url()).hostname === new URL(base).hostname ? route.continue() : route.abort());
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__cardRendererFixtureReady && !__fetchGlobalFeedsEmAndamento && !!window.CardEffectDemo);
  await page.evaluate(() => {
    const item = { id: 'production-browser-qa', type: 'wind', sev: 3, windKmh: 150, source: 'QA', coords: [-70, -20], place: 'Verificação da publicação', time: Date.now() };
    // Pending real quakes from boot must not replace the seeded browser fixture.
    // The test checks preview rendering and controls, not live-feed priority.
    pausarBuscas();
    globalEvents = [];
    pendingNewCameraQuakes.clear();
    pendingQuakeRevisions.clear();
    globalAlerts = [item];
    upsertAlert(item);
    showAlertDetails(item, false);
    clearTimeout(cycleTimeout);
    clearTimeout(window.__mgRadarDelayT);
    clearTimeout(window.__mgWaveDelayT);
    SeismicCinema.stop();
  });
  await expect(page.locator('#pd-local')).toContainText('Verificação da publicação', { timeout: 20000 });
  for (const type of ['hurricane', 'typhoon', 'tropical-storm', 'wind', 'storm', 'volcano-ash', 'flood', 'tsunami']) {
    await page.evaluate(type => CardEffectDemo.preview(type), type);
    if (type === 'tsunami') {
      // Tsunami's demo is a map tour (js/card-effect-demo.js), not the
      // generic card cinema used by every other type -- its own status
      // text ("TESTE · ...") and map surface, never "DEMONSTRAÇÃO" or
      // .pd-cinema-layer.
      await expect(page.locator('#card-fx-demo-status')).toContainText('TESTE');
      await expect(page.locator('.pd-tsunami-surface')).toHaveCount(1);
      await expect(page.locator('.pd-cinema-footage,.pd-cinema-film')).toHaveCount(0);
    } else {
      await expect(page.locator('#card-fx-demo-status')).toContainText('DEMONSTRAÇÃO');
      await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-demo', 'true');
      await expect(page.locator('.pd-cinema-contact')).toHaveCSS('pointer-events', 'none');
    }
    await page.waitForTimeout(2600);
    await expect(page.locator('#pd-local')).toContainText('Verificação da publicação', { timeout: 20000 });
    await expect(page.locator('#pd-focus-btn')).toBeEnabled();
  }
  // Dê à ação de parar uma janela nova, independente da duração das prévias anteriores.
  await page.evaluate(() => CardEffectDemo.preview('wind'));
  await page.locator('#card-fx-demo-status').getByRole('button', { name: 'Parar', exact: true }).click();
  await expect(page.locator('#card-fx-demo-status')).toHaveCount(0);
  expect(errors).toEqual([]);
});
