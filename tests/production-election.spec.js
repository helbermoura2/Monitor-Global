const {test, expect} = require('@playwright/test');

test('apuração publicada usa TSE real e mostra votos e percentuais no desktop', async ({page, request}) => {
  test.skip(!process.env.PUBLIC_SITE_URL, 'Verificação apenas após publicação.');
  test.skip(Date.now() >= Date.parse('2026-11-01T03:00:00Z'), 'Módulo eleitoral temporário encerrado.');
  test.setTimeout(180000);
  const base = process.env.PUBLIC_SITE_URL.replace(/\/$/, '');
  await expect.poll(async () => {
    const response = await request.get(base + '/index.html?election-verify=' + Date.now());
    return response.ok() && (await response.text()).includes('js/election-results.js?v=20261005-election');
  }, {timeout: 120000, intervals: [5000]}).toBe(true);
  await page.setViewportSize({width: 1600, height: 1000});
  await page.route('**/*', route => {
    const hostname = new URL(route.request().url()).hostname;
    return hostname === new URL(base).hostname || hostname === 'resultados.tse.jus.br' ? route.continue() : route.abort();
  });
  await page.goto(base, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => !!window.ElectionPanel);
  await page.locator('#chip-election').click();
  await page.locator('[data-election-turn="1"]').click();
  await expect(page.locator('#election-panel')).toHaveAttribute('data-state', 'results', {timeout: 30000});
  await expect(page.locator('.election-candidate')).toHaveCount(2);
  for (const votes of await page.locator('.election-candidate-votes').allTextContents()) expect(votes).toMatch(/^[\d.]+ votos$/);
  for (const percent of await page.locator('.election-candidate-percentage').allTextContents()) expect(percent).toMatch(/^\d+,\d{2}%$/);
  await expect(page.locator('#election-source')).toHaveAttribute('href', /resultados\.tse\.jus\.br\/oficial\/app/);
  await page.locator('#election-close').click();
  await expect(page.locator('#election-panel')).toBeHidden();
  await page.setViewportSize({width: 390, height: 844});
  await expect(page.locator('#chip-election')).toBeHidden();
});
