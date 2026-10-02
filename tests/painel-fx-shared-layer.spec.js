const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

// Isola os efeitos para exercitar seus timers sem feeds ou vídeos externos.
test('rajadas contínuas e chuva compartilham a camada sem perder dados ou controles', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.clock.install();
  await page.setContent('<div id="painel-direito" style="width:320px;height:400px"><div id="pd-local">Vento de teste</div><div id="pd-mag"><span id="magnitude-value">120</span></div><button id="control">Detalhes</button></div>');
  await page.addStyleTag({ content: fs.readFileSync(path.join(__dirname, '../css/painel-fx.css'), 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../js/painel-fx.js'), 'utf8') });

  await page.evaluate(() => triggerWindLetters(Infinity));
  await page.clock.runFor(2301);
  await expect(page.locator('#mg-fall-layer')).toHaveCount(1);
  await expect(page.locator('#mg-fall-layer')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#mg-fall-layer')).toHaveCSS('pointer-events', 'none');
  expect(await page.locator('.pd-fx-letter-blown').count()).toBeGreaterThanOrEqual(3);
  await expect(page.locator('#pd-mag')).toHaveCount(1);
  await expect(page.locator('#magnitude-value')).toHaveCount(1);
  await expect(page.locator('#pd-mag')).toHaveText('120');

  await page.clock.runFor(1301);
  await expect(page.locator('.pd-fx-letter-blown')).toHaveCount(0);
  await page.clock.runFor(21000);
  expect(await page.locator('.pd-fx-letter-blown').count()).toBeGreaterThan(0);
  await page.evaluate(() => restoreWindLetters());
  await expect(page.locator('.pd-fx-letter-blown')).toHaveCount(0);
  await expect(page.locator('#pd-local')).toHaveText('Vento de teste');
  await expect(page.locator('.pd-fx-windletter')).toHaveCount(0);
  await page.clock.runFor(5000);
  await expect(page.locator('.pd-fx-letter-blown')).toHaveCount(0);

  await page.evaluate(() => triggerRainEffect(1500));
  await expect(page.locator('#mg-fall-layer')).toHaveCount(1);
  await expect(page.locator('.mg-rain-drop')).toHaveCount(4);
  await page.clock.runFor(1501);
  await expect(page.locator('.mg-rain-wrap')).toHaveCount(0);
  await page.clock.runFor(3000);
  await expect(page.locator('.mg-rain-drop')).toHaveCount(0);

  const sampling = await page.evaluate(() => {
    const original = [1, 2, 3, 4];
    const selected = pickRandom(original, 10);
    return { original, selected: selected.sort(), empty: pickRandom([], 2) };
  });
  expect(sampling).toEqual({ original: [1, 2, 3, 4], selected: [1, 2, 3, 4], empty: [] });
  await page.locator('#control').click();
  expect(errors).toEqual([]);
});
