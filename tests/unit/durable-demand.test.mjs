import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {handlePopulationExposure} from '../../population-exposure-worker.mjs';
import {sourcePolicy,handleSourceInObject,pruneSources} from '../../shared-source-cache.mjs';
import {createRenderCache,renderIdentity} from '../../worker/render-cache.mjs';
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const originalNow=Date.now,originalFetch=globalThis.fetch,originalCache=globalThis.caches;
afterEach(()=>{Date.now=originalNow;globalThis.fetch=originalFetch;if(originalCache===undefined)delete globalThis.caches;else globalThis.caches=originalCache;});
const source=(await readFile(new URL('../../monitor-global-worker-7_7_0.js',import.meta.url),'utf8')).replace(/from "(\.\/[^"\n]+)"/g,(_,p)=>'from '+JSON.stringify(new URL('../../'+p.slice(2),import.meta.url).href));
const {default:worker,EarthquakeAlertDelivery}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function store(){const data=new Map();return {data,get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v)),delete:async k=>data.delete(k),list:async()=>new Map(),transaction:async function(fn){return fn(this);},setAlarm:async()=>{throw Error('No disposable-cache alarms');}};}
const population=(extra='')=>new Request('https://worker.test/population-exposure?lat=-41&lng=-73&mag=5&depth=10&time=1000000'+extra);
test('200 repeated population requests invoke one coordinator, but revisions and five-minute expiry do not reuse it',async()=>{
 delete globalThis.caches;let now=Date.now(),calls=0;Date.now=()=>now;
 const coordinator={idFromName:n=>n,get:()=>({fetch:async()=>{calls++;return Response.json({status:'available',method:'worldpop',ranges:[{population:10}]});}})};
 const env={EARTHQUAKE_ALERTS:coordinator};
 const responses=await Promise.all(Array.from({length:100},()=>handlePopulationExposure(population(),env)));assert(responses.every(r=>r.ok));
 for(let i=0;i<100;i++)assert.equal((await(await handlePopulationExposure(population(),env)).json()).status,'available');assert.equal(calls,1);
 await handlePopulationExposure(population('&eventId=us-revised'),env);assert.equal(calls,2);
 now+=300001;await handlePopulationExposure(population(),env);assert.equal(calls,3);
});
test('population pending replies share ten seconds across cold isolates without postponing the next task poll',async()=>{
 let now=Date.now(),calls=0;Date.now=()=>now;const entries=new Map();globalThis.caches={default:{match:async r=>entries.get(r.url)?.clone(),put:async(r,v)=>entries.set(r.url,v.clone())}};
 const binding=()=>({idFromName:n=>n,get:()=>({fetch:async()=>{calls++;return Response.json({status:'pending',retryAfter:10});}})});
 await handlePopulationExposure(population(),{EARTHQUAKE_ALERTS:binding()});now+=9000;
 const cold={EARTHQUAKE_ALERTS:binding()};await handlePopulationExposure(population(),cold);assert.equal(calls,1);
 now+=1001;await handlePopulationExposure(population(),cold);assert.equal(calls,2);
});
test('legacy source alarms drain without scheduling another alarm, including when a valid snapshot remains',async()=>{
 const s=store(),now=Date.now();await s.put('source-index',[{key:'old',parts:1,until:now-1},{key:'current',parts:1,until:now+60000}]);await s.put('source-body:old:0',new Uint8Array([1]));
 await new EarthquakeAlertDelivery({storage:s},{}).alarm();assert.equal(await s.get('source-body:old:0'),undefined);assert.equal((await s.get('source-index')).length,1);
 await pruneSources(s);const req=new Request('https://worker.test/?url='+encodeURIComponent('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson'));
 await handleSourceInObject(req,{},s,async()=>Response.json({features:[]}));
});
test('idle cron skips public dashboard prewarming and checks historical summaries only every fifteen minutes; live Telegram keeps running',async()=>{
 Date.now=()=>Date.parse('2026-10-18T12:01:00Z');globalThis.fetch=async()=>{throw Error('Unexpected public prewarm or real Telegram call');};
 const calls=[],jobs=[],binding={idFromName:n=>n,get:n=>({fetch:async r=>{calls.push([n,String(r?.url||r)]);return Response.json({ok:true});}})};
 const env={EARTHQUAKE_ALERTS:binding,DAILY_SUMMARY:binding};
 await worker.scheduled({scheduledTime:Date.now()},env,{waitUntil:p=>jobs.push(p)});await Promise.all(jobs.splice(0));assert.deepEqual(calls.map(x=>x[0]),['earthquake-alerts']);
 await worker.scheduled({scheduledTime:Date.parse('2026-10-18T12:15:00Z')},env,{waitUntil:p=>jobs.push(p)});await Promise.all(jobs.splice(0));assert.equal(calls.filter(x=>x[0]==='earthquake-alerts').length,2);assert.equal(calls.filter(x=>x[1].includes('refresh-brazil')).length,3);
});
test('less urgent weather/status cache lasts five minutes; seismic, volcanic escalation and tsunami policies remain unchanged',()=>{
 assert.equal(sourcePolicy(new Request('https://worker.test/metar-observed')).ttl,300000);
 assert.equal(sourcePolicy(new Request('https://worker.test/seismic-status')).ttl,300000);
 for(const [path,ttl]of [['/tsunami-alerts',10000],['/afad-earthquakes',30000],['/usgs-volcano',120000],['/official-weather-alerts?provider=eccc',60000]])assert.equal(sourcePolicy(new Request('https://worker.test'+path)).ttl,ttl);
});
test('identical image inputs share one render, copies cannot poison the cache, changes and expiry render again',async()=>{
 let now=0,calls=0;const cached=createRenderCache({now:()=>now}),compute=async()=>{calls++;return new Uint8Array([1,2,3]);};
 const key=await renderIdentity('alert',{mag:6,population:10});const all=await Promise.all(Array.from({length:30},()=>cached(key,1000,compute)));assert.equal(calls,1);all[0][0]=99;assert.equal((await cached(key,1000,compute))[0],1);
 const revision=await renderIdentity('alert',{mag:6,population:11});assert.notEqual(key,revision);await cached(revision,1000,compute);assert.equal(calls,2);now=1001;await cached(key,1000,compute);assert.equal(calls,3);
});
test('render cache respects byte limits and a failed render can be retried',async()=>{
 let calls=0;const cached=createRenderCache({maxEntries:2,maxBytes:4}),compute=async()=>{calls++;return {png:new Uint8Array(3),caption:'current'};};
 for(const key of ['a','b','a'])await cached(key,1000,compute);assert.equal(calls,3);
 await assert.rejects(cached('failure',1000,async()=>{throw Error('render failed');}));assert.equal((await cached('failure',1000,compute)).png.length,3);
});
