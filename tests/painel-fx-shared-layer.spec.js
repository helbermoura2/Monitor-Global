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
  await page.clock.runFor(20000);
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

  // Uma revisão pode misturar letras antigas com texto recém-adicionado.
  await page.evaluate(() => {
    triggerWindLetters(Infinity);
    document.getElementById('pd-local').append(' atualizado');
    restoreWindLetters();
  });
  await expect(page.locator('#pd-local')).toHaveText('Vento de teste atualizado');

  const sampling = await page.evaluate(() => {
    const original = [1, 2, 3, 4];
    const selected = pickRandom(original, 10);
    return { original, selected: selected.sort(), empty: pickRandom([], 2) };
  });
  expect(sampling).toEqual({ original: [1, 2, 3, 4], selected: [1, 2, 3, 4], empty: [] });
  await page.locator('#control').click();
  expect(errors).toEqual([]);
});

test('letras ao vento não reiniciam a digitação nem truncam o título', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.clock.install();
  await page.setContent('<div id="painel-direito" style="width:320px;height:400px"><div id="pd-local">Título inicial completo</div></div>');
  for (const file of ['ui-motion.js', 'painel-fx.js']) {
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../js', file), 'utf8') });
  }
  await page.evaluate(() => triggerWindLetters(Infinity));
  await page.clock.runFor(3000);
  await expect(page.locator('#pd-local')).toHaveText('Título inicial completo');
  await expect(page.locator('.mg-headline-ghost')).toHaveCount(0);
  await page.evaluate(() => { document.getElementById('pd-local').textContent = 'Novo evento com rajadas de vento'; });
  await page.clock.runFor(3000);
  await expect(page.locator('#pd-local')).toHaveText('Novo evento com rajadas de vento');
  await page.evaluate(() => restoreWindLetters());
  await page.clock.runFor(3000);
  await expect(page.locator('#pd-local')).toHaveText('Novo evento com rajadas de vento');
  expect(await page.locator('#pd-local').evaluate(el => el._mgTypeId)).toBeFalsy();
  expect(errors).toEqual([]);
});

test('primeiro quadro anterior ao início não interrompe a chuva', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.setContent('<div id="painel-direito" style="width:320px;height:400px"><div id="pd-mag"></div></div>');
  await page.evaluate(() => {
    window.requestAnimationFrame = callback => { window.__testFrame = callback; return 1; };
    window.cancelAnimationFrame = () => {};
  });
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../js/cinematic-card.js'), 'utf8') });
  const result = await page.evaluate(() => {
    const realNow = performance.now.bind(performance);
    const now = realNow();
    performance.now = () => now + 1000;
    CinematicCard.start({ id: 'early-frame', type: 'storm', detail: 'Trovoada' }, Infinity);
    performance.now = realNow;
    // Positivo desde a navegação, mas anterior ao início da cena:
    // força desenho no primeiro callback e reproduz o raio negativo antigo.
    window.__testFrame(now + 500);
    window.__testFrame(now + 1700);
    return { active: CinematicCard.isActive(), opacity: Number(document.querySelector('.pd-cinema-layer').style.opacity) };
  });
  expect(result.active).toBe(true);
  expect(result.opacity).toBeGreaterThan(.8);
});
