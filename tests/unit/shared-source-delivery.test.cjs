const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(fetcher){const c={Date,URL,Response,Headers,AbortController,setTimeout,clearTimeout,console:{warn(){}},document:{getElementById(){return null}},navigator:{onLine:true},location:{href:'https://site.test/'},fetch:fetcher,throttleOpenMeteo:async()=>{}};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('js/shared-source-delivery.js','utf8'),c);vm.runInContext(fs.readFileSync('js/data-freshness.js','utf8'),c);const core=fs.readFileSync('js/nucleo-estado.js','utf8');vm.runInContext("const WORKER_PROXY=u=>'https://worker.test/?url='+encodeURIComponent(u);const CORS_PROXIES=[WORKER_PROXY];"+core.slice(core.indexOf('async function fetchWithCorsFallback('),core.indexOf('/* ============================ ÁUDIO')),c);return c;}
const url='https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson';
test('browser uses shared collector first and preserves the retained response age',async()=>{
 const calls=[],at=Date.now()-90000,c=setup(async u=>{calls.push(u);return new Response('{"features":[]}',{headers:{'Content-Type':'application/json','X-Monitor-Source':'earthquake.usgs.gov','X-Monitor-Source-State':'stale','X-Monitor-Source-Last-Ok':String(at)}});});
 const r=await c.fetchWithCorsFallback(url);assert(calls[0].startsWith('https://worker.test/'));assert.equal(calls.length,1);assert.equal(r.headers.get('X-Monitor-Source-Last-Ok'),String(at));c.MonitorFreshness.recordStatus('USGS','ok');assert.equal(c.MonitorFreshness.snapshot('USGS').lastOk,at);assert.equal(c.MonitorFreshness.snapshot('USGS').state,'stale');assert.equal(c.MonitorFreshness.snapshot('USGS').retained,true);
});
test('provider cooldown is not bypassed by direct calls or repeated proxy attempts',async()=>{
 let calls=0;const c=setup(async()=>{calls++;return new Response('{}',{status:503,headers:{'X-Monitor-Source-State':'unavailable','Retry-After':'30'}});});await assert.rejects(c.fetchWithCorsFallback(url),/compartilhada/);assert.equal(calls,1);
});
test('transport failure allows a direct fallback and a later fresh result clears retained status',async()=>{
 const calls=[],c=setup(async u=>{calls.push(u);if(String(u).startsWith('https://worker.test/'))throw Error('transport');return Response.json({features:[]});});const r=await c.fetchWithCorsFallback(url);assert.equal(r.status,200);assert.equal(calls.length,2);assert.equal(calls[1],url);
 c.SharedSourceDelivery.record(url,new Response('{}',{headers:{'X-Monitor-Source':'earthquake.usgs.gov','X-Monitor-Source-State':'fresh','X-Monitor-Source-Last-Ok':String(Date.now())}}));c.MonitorFreshness.recordStatus('USGS','ok');assert.equal(c.MonitorFreshness.snapshot('USGS').state,'fresh');
});
