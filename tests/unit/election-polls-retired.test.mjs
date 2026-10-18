import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const source=await readFile(new URL('../../monitor-global-worker-7_7_0.js',import.meta.url),'utf8');
const resolved=source.replace(/from "(\.\/[^"\n]+)"/g,(_,path)=>'from '+JSON.stringify(new URL('../../'+path.slice(2),import.meta.url).href));
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(resolved).toString('base64'));
test('retired polls endpoint serves stale clients without any KV access',async()=>{
 let kv=0;const env={TTS_USAGE:new Proxy({},{get:()=>()=>{kv++;throw Error('KV should not be accessed');}})};
 const response=await worker.fetch(new Request('https://worker.test/polls-average'),env);assert.equal(response.status,410);assert.equal((await response.json()).retired,true);assert.equal(kv,0);
 const health=await (await worker.fetch(new Request('https://worker.test/health'),env)).json();assert.equal(health.electionPolls,'removed-no-kv-v1');
});
test('scheduled delivery keeps demand-only feeds retired and revises history only every fifteen minutes',async()=>{
 const calls=[],pending=[],context={Request,console,Date,withKvUsage:(env,fn)=>fn(env),maybeRefreshPollsAverageNightly:async()=>calls.push('retired-polls')};
 for(const key of ['runTelegramDailySummary','refreshSpClimaCache','refreshGlobalFeedsCache','runTelegramM6Alerts','refreshRecentDailyBrazilSummaries'])context[key]=async()=>calls.push(key);
 const method=source.slice(source.lastIndexOf('    async scheduled('),source.lastIndexOf('\n};'));
 const scheduled=vm.runInNewContext('({'+method+'}).scheduled',context);
 async function tick(time){calls.length=0;await scheduled({scheduledTime:Date.parse(time)}, {}, {waitUntil:p=>pending.push(p)});await Promise.all(pending.splice(0));return [...calls];}
 assert.deepEqual(await tick('2026-10-18T00:03:00Z'),['runTelegramDailySummary','runTelegramM6Alerts']);
 assert.deepEqual(await tick('2026-10-18T00:15:00Z'),['runTelegramDailySummary','runTelegramM6Alerts','refreshRecentDailyBrazilSummaries']);
});
