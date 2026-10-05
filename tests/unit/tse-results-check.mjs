import assert from 'node:assert/strict';
import fs from 'node:fs';
import {verifyTseJws, resolvePresidentialElections, normalizePresidentialResults, TseResultsClient, tseTimestamp} from '../../js/tse-results.mjs';

const configText = fs.readFileSync('tests/fixtures/tse2026-config.jws', 'utf8');
const resultText = fs.readFileSync('tests/fixtures/tse2026-president-1.jws', 'utf8');
const config = await verifyTseJws(configText), raw = await verifyTseJws(resultText);
const elections = resolvePresidentialElections(config);
assert.equal(elections.get(1).id, '6257');
assert.equal(elections.get(2).id, '6258');
const result = normalizePresidentialResults(raw, elections.get(1));
assert.equal(result.candidates.length, 12);
assert.equal(result.candidates[0].votes, 56095679);
assert.equal(result.candidates[0].percentage, 47.04);
assert.equal(result.candidates[1].votes, 53838430);
assert.equal(result.candidates[1].percentage, 45.15);
assert.equal(result.percentageCounted, 99.95);
assert.equal(new Date(result.updatedAt).toISOString(), '2026-10-05T01:51:41.000Z');
const parts = resultText.trim().split('.');
const tampered = structuredClone(raw);tampered.carg[0].agr[0].par[0].cand[0].vap = '0';
await assert.rejects(verifyTseJws([parts[0], Buffer.from(JSON.stringify(tampered)).toString('base64url'), parts[2]].join('.')), /Assinatura TSE inválida/);
const unknownHeader = Buffer.from(JSON.stringify({alg: 'none', kid: 'unknown'})).toString('base64url');
await assert.rejects(verifyTseJws([unknownHeader, parts[1], parts[2]].join('.')), /desconhecida/);
for (const change of [{ele: '619'}, {t: '2'}, {f: 's'}, {cdabr: 'sp'}, {tpabr: 'uf'}]) assert.throws(() => normalizePresidentialResults({...raw, ...change}, elections.get(1)), /fora da eleição/);
const badVotes = structuredClone(raw);badVotes.carg[0].agr[0].par[0].cand[0].vap = '';
assert.throws(() => normalizePresidentialResults(badVotes, elections.get(1)), /Contagem/);
const badPercent = structuredClone(raw);badPercent.carg[0].agr[0].par[0].cand[0].pvap = '101,0';
assert.throws(() => normalizePresidentialResults(badPercent, elections.get(1)), /Percentual/);
const badSections = structuredClone(raw);badSections.s.st = String(Number(raw.s.ts) + 1);
assert.throws(() => normalizePresidentialResults(badSections, elections.get(1)), /Totalização/);
assert.throws(() => tseTimestamp('invalid', '00:00:00'), /Horário/);

const second = structuredClone(raw);second.ele = '6258';second.t = '2';second.tf = 's';
second.carg[0].agr = second.carg[0].agr.slice(0, 1);
second.carg[0].agr[0].par = second.carg[0].agr[0].par.slice(0, 1);
second.carg[0].agr[0].par[0].cand.push({...second.carg[0].agr[0].par[0].cand[0], sqcand: 'other', nmu: 'CANDIDATO TESTE', n: '13', vap: '60000000', pvap: '51,68'});
const result2 = normalizePresidentialResults(second, elections.get(2));
assert.equal(result2.turn, 2);assert.equal(result2.finished, true);assert.equal(result2.candidates.length, 2);
assert.equal(result2.candidates[0].votes, 60000000);

let mode = 'ok', calls = [], now = result.generatedAt;
const client = new TseResultsClient(async (url, options) => {
  calls.push(url);assert.equal(options.credentials, 'omit');assert.equal(options.cache, 'no-store');
  if (url.includes('/config/')) return new Response(configText);
  if (url.includes('/6258/') || mode === '404') return new Response('', {status: 404});
  if (mode === 'fail') throw Error('offline');
  if (mode === 'tampered') return new Response([parts[0], Buffer.from(JSON.stringify(tampered)).toString('base64url'), parts[2]].join('.'));
  return new Response(resultText);
}, () => now);
assert.deepEqual(await client.load(2), {status: 'pending', turn: 2});
assert.equal(client.lastGood.has(2), false);
await client.load(1);assert.equal(client.lastGood.get(1).candidates[0].votes, 56095679);
assert.ok(calls.some(url => url.includes('br-c0001-e006258-u.jws?nocache=')));
for (const failure of ['fail', 'tampered', '404']) {
  mode = failure;await assert.rejects(client.load(1));
  assert.equal(client.lastGood.get(1).candidates[0].votes, 56095679);
}
mode = 'ok';
client.lastGood.set(1, {...result, generatedAt: result.generatedAt + 1000});
await assert.rejects(client.load(1), /anterior/);
client.lastGood.set(1, {...result, updatedAt: result.updatedAt + 1000});
await assert.rejects(client.load(1), /anterior/);
const canceled = new AbortController();canceled.abort();
await assert.rejects(new TseResultsClient(async (_url, options) => {
  assert.equal(options.signal.aborted, true);throw new DOMException('Aborted', 'AbortError');
}).load(1, {signal: canceled.signal}), {name: 'AbortError'});
console.log('PASS: real TSE signatures, votes/percentages, national scope, two turns, missing results, tampering, failed requests, old responses and cancellation');
