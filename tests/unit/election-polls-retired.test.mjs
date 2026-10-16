import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const source=await readFile(new URL('../../monitor-global-worker-7_7_0.js',import.meta.url),'utf8');
const resolved=source.replace(/from "(\.\/[^"\n]+)"/g,(_,path)=>'from '+JSON.stringify(new URL('../../'+path.slice(2),import.meta.url).href));
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(resolved).toString('base64'));
test('retired polls endpoint serves stale clients without any KV access',async()=>{
 let kv=0;const env={TTS_USAGE:new Proxy({},{get:()=>()=>{kv++;throw Error('KV should not be accessed');}})};
 const response=await worker.fetch(new Request('https://worker.test/polls-average'),env);assert.equal(response.status,410);assert.equal((await response.json()).retired,true);assert.equal(kv,0);
 const health=await (await worker.fetch(new Request('https://worker.test/health'),env)).json();assert.equal(health.electionPolls,'removed-no-kv-v1');
});
test('real scheduled handler preserves background jobs while retiring the polling collector',async()=>{
 const calls=[],pending=[],context={Request,console,withKvUsage:(env,fn)=>fn(env),maybeRefreshPollsAverageNightly:async()=>calls.push('retired-polls')};
 for(const key of ['runTelegramDailySummary','refreshSpClimaCache','refreshGlobalFeedsCache','runTelegramM6Alerts','refreshRecentDailyBrazilSummaries'])context[key]=async()=>calls.push(key);
 const method=source.slice(source.lastIndexOf('    async scheduled('),source.lastIndexOf('\n};'));
 const scheduled=vm.runInNewContext('({'+method+'}).scheduled',context);await scheduled({}, {}, {waitUntil:p=>pending.push(p)});await Promise.all(pending);
 assert.deepEqual(calls,['runTelegramDailySummary','refreshSpClimaCache','refreshGlobalFeedsCache','runTelegramM6Alerts','refreshRecentDailyBrazilSummaries']);
});
