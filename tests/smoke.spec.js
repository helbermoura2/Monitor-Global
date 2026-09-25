// Testes de fumaça — não cobrem lógica de negócio, só garantem que o site
// carrega, não quebra com erro de JS não tratado, e a estrutura principal da
// UI aparece. `console.warn`/`console.error` não são checados aqui: o app usa
// esses dois de propósito pra logar falha de UMA fonte sem derrubar o resto
// (fetchWithCorsFallback, try/catch em cada fetch) — isso é comportamento
// esperado, não um bug. Só `pageerror` (exceção não tratada) conta como falha.
const { test, expect } = require('@playwright/test');

test.describe('Monitor Global — smoke', () => {
  test('carrega sem exceção de JavaScript não tratada', async ({ page }) => {
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await page.goto('/index.html');
    await page.waitForTimeout(6000);
    expect(erros, `Exceções de JS na carga:\n${erros.join('\n')}`).toEqual([]);
  });

  test('estrutura principal da UI está presente', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('.mg-logo-word')).toHaveText('MONITOR GLOBAL');
    await expect(page.locator('#mapContainer')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#events')).toBeVisible();
  });

  test('lista de eventos carrega pelo menos um registro real', async ({ page }) => {
    // Depende de rede real (USGS/EMSC/GDACS/etc.) — só funciona com internet de
    // verdade (CI), não no sandbox de desenvolvimento local sem saída externa.
    await page.goto('/index.html');
    await expect(page.locator('#events .event').first()).toBeVisible({ timeout: 45000 });
  });
});
