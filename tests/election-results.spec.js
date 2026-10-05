const {test, expect} = require('@playwright/test');
const fs = require('node:fs');
const {generateKeyPairSync, sign} = require('node:crypto');
const configFixture = fs.readFileSync('tests/fixtures/tse2026-config.jws', 'utf8');
const resultFixture = fs.readFileSync('tests/fixtures/tse2026-president-1.jws', 'utf8');
const decode = text => JSON.parse(Buffer.from(text.trim().split('.')[1], 'base64url'));
const {publicKey, privateKey} = generateKeyPairSync('ed25519');
const kid = 'sNbt9Q_fLS65zE1_ZLNV-XRRwPY';
const testKey = publicKey.export({format: 'jwk'}).x;
function signed(payload) {
  const encoded = Buffer.from(JSON.stringify({alg: 'EdDSA', kid})).toString('base64url') + '.' + Buffer.from(JSON.stringify(payload)).toString('base64url');
  return encoded + '.' + sign(null, Buffer.from(encoded), privateKey).toString('base64url');
}
test.use({serviceWorkers: 'block', viewport: {width: 1600, height: 1000}});
async function setup(page, {realSignature = false, date = '2026-10-05T02:00:00Z'} = {}) {
  await page.clock.install({time: new Date(date)});
  const state = {config: decode(configFixture), first: decode(resultFixture), second: null, failure: false, hold: false, calls: 0};
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') {
      if (url.pathname === '/js/tse-results.mjs' && !realSignature) {
        const source = fs.readFileSync('js/tse-results.mjs', 'utf8').replace('kWlpNHjuws1csyQZwzn3Fhzbi3RD435RbpThtSr4hMc', testKey);
        return route.fulfill({status: 200, contentType: 'text/javascript', body: source});
      }
      return route.continue();
    }
    if (url.hostname !== 'resultados.tse.jus.br') return route.abort();
    if (url.pathname.includes('/config/')) return route.fulfill({status: 200, body: realSignature ? configFixture : signed(state.config)});
    state.calls++;
    if (state.failure) return route.fulfill({status: 503, body: 'maintenance'});
    if (state.hold) return new Promise(resolve => {state.release = async () => {await route.fulfill({status: 200, body: signed(state.first)}).catch(() => {});resolve();};});
    if (url.pathname.includes('/6258/')) return route.fulfill(state.second ? {status: 200, body: signed(state.second)} : {status: 404, body: ''});
    return route.fulfill({status: 200, body: realSignature ? resultFixture : signed(state.first)});
  });
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => !!window.ElectionPanel && !__fetchGlobalFeedsEmAndamento);
  return state;
}
async function open(page) {
  await page.locator('#chip-election').click();
  await expect(page.locator('#election-panel')).toBeVisible();
}

test('assinatura real do TSE, votos e porcentagens no placar; chip não altera filtros', async ({page}) => {
  const errors = [];page.on('pageerror', error => errors.push(error.message));
  const state = await setup(page, {realSignature: true});
  expect(state.calls).toBe(0);
  expect(await page.locator('#chip-election').evaluate(e => e.previousElementSibling.id)).toBe('chip-geo-br');
  const filter = await page.evaluate(() => ({type: sidebarFilter, geo: geoFilter}));
  await open(page);
  await expect(page.locator('#election-panel')).toHaveAttribute('data-state', 'results');
  await expect(page.locator('.election-candidate-votes')).toHaveText(['56.095.679 votos', '53.838.430 votos']);
  await expect(page.locator('.election-candidate-percentage')).toHaveText(['47,04%', '45,15%']);
  await expect(page.locator('#election-counted')).toHaveText('99,95% apurado');
  await expect(page.locator('#election-tse-time')).toContainText('22:51:41 BRT');
  expect(await page.evaluate(() => ({type: sidebarFilter, geo: geoFilter}))).toEqual(filter);
  expect(errors).toEqual([]);
});

test('consulta a cada 30 s mantém abertura; falha preserva votos e aponta indisponibilidade', async ({page}) => {
  const state = await setup(page);await open(page);
  await expect(page.locator('#election-panel')).toHaveAttribute('data-state', 'results');
  state.first.hg = '22:52:26';state.first.ht = '22:52:01';
  state.first.carg[0].agr[0].par[0].cand[0].vap = '56099999';state.first.carg[0].agr[0].par[0].cand[0].pvap = '47,08';
  await page.clock.runFor(30050);
  await expect(page.locator('.election-candidate-votes').first()).toHaveText('56.099.999 votos');
  await expect(page.locator('.election-candidate-percentage').first()).toHaveText('47,08%');
  expect(state.calls).toBe(2);
  state.failure = true;
  await page.clock.runFor(30050);
  await expect(page.locator('#election-feedback')).toContainText('últimos números válidos preservados');
  await expect(page.locator('.election-candidate-votes').first()).toHaveText('56.099.999 votos');
  await expect(page.locator('#election-panel')).toBeVisible();
  await page.locator('#election-close').click();const calls = state.calls;
  await page.clock.runFor(61000);expect(state.calls).toBe(calls);
  await expect(page.locator('#election-panel')).toBeHidden();
});

test('só chegada nova acima de M6 fecha; catálogo inicial, seleção e M6,0 mantêm aberto', async ({page}) => {
  await setup(page);await open(page);
  await expect(page.locator('#election-panel')).toHaveAttribute('data-state', 'results');
  await page.evaluate(() => {
    globalEvents = [{id: 'old-M7', mag: 7, time: Date.now(), coords: [-70, -20], depth: 10, place: 'Evento já carregado'}];
    showEventDetails(0, false);
    clearTimeout(cycleTimeout);SeismicCinema.stop();
    queueNewCameraQuakes([{id: 'new-M59', mag: 5.9}, {id: 'new-M60', mag: 6}]);
  });
  await expect(page.locator('#election-panel')).toBeVisible();
  await page.evaluate(() => queueNewCameraQuakes([{id: 'new-M61', mag: 6.1}]));
  await expect(page.locator('#election-panel')).toBeHidden();
  await expect(page.locator('.election-announcement')).toContainText('novo sismo M6,1');
  await page.clock.fastForward(31000);await expect(page.locator('#election-panel')).toBeHidden();
  await open(page);
  await page.evaluate(() => queueNewCameraQuakes([{id: 'new-M61', mag: 6.1}]));
  await expect(page.locator('#election-panel')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#election-panel')).toBeHidden();
});

test('segundo turno aguarda fonte, não inventa participantes e recebe votos oficiais quando disponível', async ({page}) => {
  const state = await setup(page);await open(page);
  await expect(page.locator('#election-panel')).toHaveAttribute('data-state', 'results');
  await page.locator('[data-election-turn="2"]').click();
  await expect(page.locator('#election-empty')).toHaveText('Aguardando dados oficiais do 2º turno.');
  await expect(page.locator('.election-candidate')).toHaveCount(0);
  await expect(page.locator('#election-totalization')).toBeHidden();
  state.second = structuredClone(state.first);state.second.ele = '6258';state.second.t = '2';
  const parties = state.second.carg[0].agr.flatMap(group => group.par);
  const secondParty = parties.find(party => party.sg === 'PT');
  state.second.carg[0].agr = [{par: [parties[0], secondParty]}];
  parties[0].cand[0].vap = '60000000';parties[0].cand[0].pvap = '51,28';
  secondParty.cand[0].vap = '57000000';secondParty.cand[0].pvap = '48,72';
  await page.clock.runFor(30050);
  await expect(page.locator('.election-candidate-votes')).toHaveText(['60.000.000 votos', '57.000.000 votos']);
  await expect(page.locator('.election-candidate-percentage')).toHaveText(['51,28%', '48,72%']);
  await expect(page.locator('#election-source')).toHaveAttribute('href', /eleicao\/6258/);
  await page.locator('[data-election-turn="1"]').click();
  await expect(page.locator('.election-candidate-votes').first()).toHaveText('56.095.679 votos');
});

test('respostas atrasadas não trocam o turno nem reabrem painel fechado', async ({page}) => {
  const state = await setup(page);state.hold = true;await open(page);
  await expect.poll(() => typeof state.release).toBe('function');
  await page.locator('#election-close').click();
  state.hold = false;await state.release();
  await expect(page.locator('#election-panel')).toBeHidden();
  await open(page);await expect(page.locator('#election-panel')).toHaveAttribute('data-state', 'results');
  await page.locator('[data-election-turn="2"]').click();
  await expect(page.locator('#election-empty')).toHaveText('Aguardando dados oficiais do 2º turno.');
  await expect(page.locator('.election-candidate')).toHaveCount(0);
});

test('desktop entre os cartões; mobile oculta e interrompe consultas; módulo expira', async ({page}) => {
  const state = await setup(page);await open(page);
  await expect(page.locator('#election-panel')).toHaveAttribute('data-state', 'results');
  for (const width of [1101,1280,1600,1920]) {
    await page.setViewportSize({width,height:1000});
    await page.clock.runFor(50);
    const bounds = await page.evaluate(() => {
      const rect = id => {const r = document.getElementById(id).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
      return {panel:rect('election-panel'),left:rect('sidebar-left'),right:rect('painel-direito'),header:rect('top-strip'),overflow:document.documentElement.scrollWidth>innerWidth};
    });
    expect(bounds.panel.left).toBeGreaterThanOrEqual(bounds.left.right);
    expect(bounds.panel.right).toBeLessThanOrEqual(bounds.right.left);
    expect(bounds.panel.top).toBeGreaterThan(bounds.header.bottom);
    expect(bounds.overflow).toBe(false);
  }
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('#chip-election')).toBeHidden();
  await expect(page.locator('#election-panel')).toBeHidden();
  const calls = state.calls;await page.clock.runFor(61000);expect(state.calls).toBe(calls);
  await page.setViewportSize({width:1280,height:800});
  await expect(page.locator('#chip-election')).toBeVisible();
  await expect(page.locator('#election-panel')).toBeHidden();
  await page.clock.setSystemTime(new Date('2026-11-01T04:00:00Z'));
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('#chip-election')).toBeHidden();
});
