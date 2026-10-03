import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Cobre o bug real: um M6.1 na Indonésia (fontes BMKG/EMSC/GEOFON) não disparou
// o alerta do Telegram porque o pipeline dependia só do catálogo do USGS, que
// nunca chegou a publicar esse evento. Agora o Worker também consulta o EMSC
// (seismicportal.eu) e mescla as duas listas, descartando duplicata quando as
// duas fontes relatam o mesmo sismo.

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
    + '\nexport const __test = { runTelegramM6Alerts };\n';

const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
const { runTelegramM6Alerts } = mod.__test;

const env = { TTS_USAGE: kv, TELEGRAM_BOT_TOKEN: 'fake', TELEGRAM_CHAT_ID: 'fake' };
const request = new Request('https://worker.test/telegram-m6-check');

// Caso 1: evento só no EMSC (reproduz o bug relatado — USGS nunca publicou).
usgsFeatures = [];
emscFeatures = [{
    id: 'emsc-indo-1', properties: { mag: 6.1, flynn_region: 'SOUTH OF SUMBAWA, INDONESIA', time: Date.now() - 600000 },
    geometry: { coordinates: [118.5, -9.5, 20] }
}];
const r1 = await runTelegramM6Alerts(request, env);
assert.equal(r1.sent.length, 1, 'deveria disparar alerta vindo só do EMSC');
assert.equal(r1.sources.usgs.count, 0);
assert.equal(r1.sources.emsc.count, 1);
assert.equal(sentPhotos.length, 1);

// Caso 2: mesmo sismo reportado por USGS e EMSC — deve mandar 1 alerta só.
kvData.clear(); sentPhotos.length = 0;
const now = Date.now() - 600000;
usgsFeatures = [{
    id: 'us7000abcd', properties: { mag: 6.3, place: '10km N of Somewhere', time: now, net: 'us' },
    geometry: { coordinates: [120.0, 10.0, 15] }
}];
emscFeatures = [{
    id: 'emsc-dup-1', properties: { mag: 6.2, flynn_region: 'NEAR SOMEWHERE', time: now + 30000 },
    geometry: { coordinates: [120.01, 10.01, 15] }
}];
const r2 = await runTelegramM6Alerts(request, env);
assert.equal(r2.sent.length, 1, 'USGS e EMSC reportando o mesmo sismo deve virar 1 alerta só');
assert.equal(sentPhotos.length, 1);

// Caso 3: USGS cai, EMSC continua cobrindo o ciclo (resiliência via allSettled).
kvData.clear(); sentPhotos.length = 0;
usgsFail = true;
emscFeatures = [{
    id: 'emsc-resil-1', properties: { mag: 6.5, flynn_region: 'TEST REGION', time: Date.now() - 600000 },
    geometry: { coordinates: [30, 30, 10] }
}];
const r3 = await runTelegramM6Alerts(request, env);
assert.equal(r3.sources.usgs.failed, true);
assert.equal(r3.sent.length, 1, 'EMSC deve cobrir o ciclo mesmo com USGS fora');

console.log('PASS: EMSC cobre sismo que o USGS nunca publica, dedup entre fontes evita duplicata, resiliência quando uma fonte falha');
