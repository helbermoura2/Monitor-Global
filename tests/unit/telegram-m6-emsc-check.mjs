import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Cobre dois bugs reais seguidos:
// 1) Um M6.1 na Indonésia (fontes BMKG/EMSC/GEOFON) não disparou o alerta do
//    Telegram porque o pipeline dependia só do catálogo do USGS, que nunca
//    chegou a publicar esse evento. Agora o Worker também consulta o EMSC
//    (seismicportal.eu) e mescla as duas listas, descartando duplicata
//    quando as duas fontes relatam o mesmo sismo.
// 2) Esse mesmo M6.1 foi revisado pra M5.9 pouco depois -- um alerta
//    disparado na hora vira um "falso M6+". Agora o Worker segura o
//    candidato por TELEGRAM_HOLD_MS (3min) e só manda se ele ainda
//    aparecer com mag >= TELEGRAM_MIN_MAG depois da espera (USGS/EMSC
//    filtram a própria consulta pela magnitude ATUAL, então uma revisão
//    pra baixo do limiar faz o evento sumir da resposta sozinho).

let stamp = Date.parse('2026-10-03T12:00:00Z');
const RealDate = Date;
globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [stamp])); }
    static now() { return stamp; }
};

const kvData = new Map();
const kv = {
    async get(k) { const x = kvData.get(k); return x == null ? null : x; },
    async put(k, v) { kvData.set(k, v); },
    async list() { return { keys: [], list_complete: true }; }
};

let usgsFeatures = [];
let emscFeatures = [];
let usgsFail = false;
const sentPhotos = [];

globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('earthquake.usgs.gov')) {
        if (usgsFail) throw new Error('USGS down');
        return new Response(JSON.stringify({ features: usgsFeatures }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.includes('seismicportal.eu')) {
        return new Response(JSON.stringify({ features: emscFeatures }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.includes('api.telegram.org')) {
        if (u.includes('sendPhoto')) { sentPhotos.push(u); return Response.json({ ok: true, result: { message_id: 1 } }); }
        return Response.json({ ok: true, result: { message_id: 2 } });
    }
    throw new Error('Unexpected fetch ' + u);
};

const src = (await readFile(new URL('../../monitor-global-worker-7_7_0.js', import.meta.url), 'utf8'))
    .replace('"./cge-bulletins-worker.mjs"', JSON.stringify(new URL('../../cge-bulletins-worker.mjs', import.meta.url).href))
    .replace('"./summary-flags.mjs"', JSON.stringify(new URL('../../summary-flags.mjs', import.meta.url).href))
    .replace('"./summary-typography.mjs"', JSON.stringify(new URL('../../summary-typography.mjs', import.meta.url).href))
    .replace('"./weather-observations-worker.mjs"', JSON.stringify(new URL('../../weather-observations-worker.mjs', import.meta.url).href))
    .replace('"./official-weather-alerts-worker.mjs"', JSON.stringify(new URL('../../official-weather-alerts-worker.mjs', import.meta.url).href))
    .replace('"./population-exposure-worker.mjs"', JSON.stringify(new URL('../../population-exposure-worker.mjs', import.meta.url).href))
    + '\nexport const __test = { runTelegramM6Alerts, TELEGRAM_HOLD_MS };\n';

const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
const { runTelegramM6Alerts, TELEGRAM_HOLD_MS } = mod.__test;
assert.equal(TELEGRAM_HOLD_MS, 3 * 60000, 'espera de confirmação deve ser 3 minutos');

const env = { TTS_USAGE: kv, TELEGRAM_BOT_TOKEN: 'fake', TELEGRAM_CHAT_ID: 'fake' };
const request = new Request('https://worker.test/telegram-m6-check');

// Caso 1: evento só no EMSC, magnitude se mantém -- primeiro ciclo segura
// (candidato pendente), e só manda depois dos 3 minutos de confirmação.
usgsFeatures = [];
emscFeatures = [{
    id: 'emsc-indo-1', properties: { mag: 6.1, flynn_region: 'SOUTH OF SUMBAWA, INDONESIA', time: stamp - 60000 },
    geometry: { coordinates: [118.5, -9.5, 20] }
}];
const r1a = await runTelegramM6Alerts(request, env);
assert.equal(r1a.sent.length, 0, 'não deve mandar nada no primeiro avistamento');
assert.equal(r1a.pending, 1, 'deve guardar como candidato pendente');
assert.equal(sentPhotos.length, 0);

stamp += TELEGRAM_HOLD_MS + 1000; // passa da janela de confirmação, evento continua aparecendo
const r1b = await runTelegramM6Alerts(request, env);
assert.equal(r1b.sent.length, 1, 'deve mandar o alerta depois de confirmado');
assert.equal(r1b.pending, 0);
assert.equal(sentPhotos.length, 1);

// Caso 2: reproduz o bug do M6.1 -> M5.9 -- vira candidato, mas antes dos 3
// minutos passarem a consulta já não traz mais o evento (magnitude caiu
// abaixo do limiar) -- nunca deve virar alerta.
kvData.clear(); sentPhotos.length = 0;
usgsFeatures = [];
emscFeatures = [{
    id: 'emsc-revisado-1', properties: { mag: 6.1, flynn_region: 'REVISED REGION', time: stamp - 60000 },
    geometry: { coordinates: [119.0, -8.0, 10] }
}];
const r2a = await runTelegramM6Alerts(request, env);
assert.equal(r2a.pending, 1);
assert.equal(r2a.sent.length, 0);

stamp += TELEGRAM_HOLD_MS + 1000;
emscFeatures = []; // magnitude revisada pra 5.9 -- some da consulta (minmag=6.0)
const r2b = await runTelegramM6Alerts(request, env);
assert.equal(r2b.sent.length, 0, 'sismo revisado abaixo do limiar nunca deve virar alerta');
assert.equal(r2b.pending, 0);
assert.equal(r2b.discarded.length, 1, 'deve registrar o candidato descartado');
assert.equal(r2b.discarded[0].id, 'EMSC-emsc-revisado-1');
assert.equal(sentPhotos.length, 0, 'nenhum card deve ter sido mandado pro sismo revisado');

// Caso 3: mesmo sismo reportado por USGS e EMSC -- deve virar 1 candidato
// só (dedup) e, confirmado, 1 alerta só.
kvData.clear(); sentPhotos.length = 0;
const now = stamp - 60000;
usgsFeatures = [{
    id: 'us7000abcd', properties: { mag: 6.3, place: '10km N of Somewhere', time: now, net: 'us' },
    geometry: { coordinates: [120.0, 10.0, 15] }
}];
emscFeatures = [{
    id: 'emsc-dup-1', properties: { mag: 6.2, flynn_region: 'NEAR SOMEWHERE', time: now + 30000 },
    geometry: { coordinates: [120.01, 10.01, 15] }
}];
const r3a = await runTelegramM6Alerts(request, env);
assert.equal(r3a.pending, 1, 'USGS e EMSC reportando o mesmo sismo deve virar 1 candidato só');
stamp += TELEGRAM_HOLD_MS + 1000;
const r3b = await runTelegramM6Alerts(request, env);
assert.equal(r3b.sent.length, 1);
assert.equal(sentPhotos.length, 1);

// Caso 4: USGS cai, EMSC continua cobrindo o ciclo (resiliência via allSettled).
kvData.clear(); sentPhotos.length = 0;
usgsFail = true;
emscFeatures = [{
    id: 'emsc-resil-1', properties: { mag: 6.5, flynn_region: 'TEST REGION', time: stamp - 60000 },
    geometry: { coordinates: [30, 30, 10] }
}];
const r4a = await runTelegramM6Alerts(request, env);
assert.equal(r4a.sources.usgs.failed, true);
assert.equal(r4a.pending, 1);
stamp += TELEGRAM_HOLD_MS + 1000;
const r4b = await runTelegramM6Alerts(request, env);
assert.equal(r4b.sent.length, 1, 'EMSC deve cobrir o ciclo mesmo com USGS fora');
usgsFail = false;

console.log('PASS: espera de 3min confirma magnitude antes de alertar, sismo revisado abaixo do limiar nunca dispara, EMSC cobre o que o USGS não publica, dedup entre fontes evita duplicata, resiliência quando uma fonte falha');
