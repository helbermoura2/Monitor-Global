import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {sharedSourceResponse,publicSourceHealth,sourcePolicy} from '../../shared-source-cache.mjs';
import {edgeSourceStore} from '../../edge-source-store.mjs';
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const source=(await readFile(new URL('../../monitor-global-worker-7_7_0.js',import.meta.url),'utf8')).replace(/from "(\.\/[^"\n]+)"/g,(_,p)=>'from '+JSON.stringify(new URL('../../'+p.slice(2),import.meta.url).href));
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const originalFetch=globalThis.fetch,originalNow=Date.now,originalCache=globalThis.caches;
afterEach(()=>{globalThis.fetch=originalFetch;Date.now=originalNow;if(originalCache===undefined)delete globalThis.caches;else globalThis.caches=originalCache;});
function fixture(){let durable=0;const stats={cacheReads:0,cacheWrites:0},saved=new Map();globalThis.caches={default:{match:async r=>{stats.cacheReads++;return saved.get(r.url)?.clone();},put:async(r,response)=>{stats.cacheWrites++;saved.set(r.url,response.clone());}}};const env={ADMIN_TOKEN:'private',EARTHQUAKE_ALERTS:{idFromName:n=>n,get:()=>{durable++;throw Error('Public feeds must not invoke Durable Objects');}}};return {env,saved,stats,get durable(){return durable;},restart(){env.EARTHQUAKE_ALERTS={...env.EARTHQUAKE_ALERTS};}};}
const request=(extra='',origin='https://worker.test')=>new Request(origin+'/?url='+encodeURIComponent('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=1000'+extra));
const feed=(id='current')=>({type:'FeatureCollection',features:[{id}]});
test('200 actual Worker feed reads across aliases invoke one provider and zero Durable Objects',async()=>{
 const f=fixture();let upstream=0;globalThis.fetch=async()=>{upstream++;return Response.json(feed());};
 const replies=await Promise.all(Array.from({length:100},(_,i)=>worker.fetch(request('',i%2?'https://alias.test':'https://worker.test'),f.env)));
 for(const response of replies){assert.equal(response.status,200);assert.equal((await response.json()).features[0].id,'current');}
 for(let i=0;i<100;i++)await worker.fetch(request(),f.env);
 assert.equal(upstream,1);assert.equal(f.durable,0);assert.equal((await worker.fetch(request(),f.env)).headers.get('X-Monitor-Source-Edge'),'memory');
});
test('cold edge state retains original timestamps, shares provider backoff across filters, and expires without fake empty data',async()=>{
 const f=fixture();let now=Date.now(),calls=0,failed=false;Date.now=()=>now;globalThis.fetch=async()=>{calls++;return failed?new Response('unavailable',{status:503}):Response.json(feed());};
 const first=await worker.fetch(request(),f.env),at=first.headers.get('X-Monitor-Source-Last-Ok');
 now+=31000;failed=true;f.restart();let response=await worker.fetch(request(),f.env);assert.equal(response.status,200);assert.equal(response.headers.get('X-Monitor-Source-State'),'stale');assert.equal(response.headers.get('X-Monitor-Source-Last-Ok'),at);assert.equal(calls,2);
 f.restart();now+=1000;response=await worker.fetch(request('&minlatitude=10'),f.env);assert.equal(response.status,503);assert.equal(calls,2);
 now+=90000;response=await worker.fetch(request(),f.env);assert.equal(response.status,503);assert(!('features'in await response.json()));assert.equal(f.durable,0);
});
test('invalid success and partial replies cannot extend freshness; source recovery replaces retained data',async()=>{
 const f=fixture();let now=Date.now(),mode='partial';Date.now=()=>now;
 const req=new Request('https://worker.test/global-volcano');
 const load=()=>mode==='invalid'?Response.json({error:'blocked'}):Response.json({...feed(mode),partial:mode==='partial'});
 let response=await sharedSourceResponse(req,f.env,load);const at=response.headers.get('X-Monitor-Source-Last-Ok');assert.equal(response.headers.get('X-Monitor-Source-State'),'partial');
 now+=31000;mode='invalid';response=await sharedSourceResponse(req,f.env,load);assert.equal(response.headers.get('X-Monitor-Source-State'),'stale');assert.equal(response.headers.get('X-Monitor-Source-Last-Ok'),at);assert.equal((await response.json()).features[0].id,'partial');
 now+=31000;mode='recovered';response=await sharedSourceResponse(req,f.env,load);assert.equal(response.headers.get('X-Monitor-Source-State'),'fresh');assert.equal((await response.json()).features[0].id,'recovered');assert.equal(f.durable,0);
});
test('Retry-After survives a cold isolate and new filter keys without another provider attempt',async()=>{
 const f=fixture();let now=Date.now(),calls=0;Date.now=()=>now;
 const load=()=>{calls++;return new Response('unavailable',{status:429,headers:{'Retry-After':'600'}});};
 assert.equal((await sharedSourceResponse(request(),f.env,load)).status,503);now+=300001;f.restart();
 assert.equal((await sharedSourceResponse(request('&minlatitude=20'),f.env,load)).status,503);assert.equal(calls,1);assert.equal(f.durable,0);
});
test('Cache API failure still serves a validated public feed from bounded local state, without a Durable fallback',async()=>{
 const f=fixture();globalThis.caches={default:{match:async()=>{throw Error('cache down');},put:async()=>{throw Error('cache down');}}};let calls=0;globalThis.fetch=async()=>{calls++;return Response.json(feed());};
 for(let i=0;i<30;i++)assert.equal((await worker.fetch(request(),f.env)).status,200);
 assert.equal(calls,1);assert.equal(f.durable,0);assert.equal((await publicSourceHealth(f.env,'earthquake.usgs.gov')).persistenceDegraded,true);
});
test('a full day of 25 feeds every 45 seconds uses zero Durable requests and preserves urgent cache deadlines',async()=>{
 const f=fixture();delete globalThis.caches;let now=Date.now(),calls=0;Date.now=()=>now;
 const requests=[...Array.from({length:24},(_,i)=>request('&minlongitude='+i)),new Request('https://worker.test/tsunami-alerts')];
 const load=()=>{calls++;return Response.json(feed());};
 for(let tick=0;tick<1920;tick++){for(const req of requests){const response=await sharedSourceResponse(req,f.env,load);assert.equal(response.status,200);}now+=45000;}
 assert.equal(calls,48000);assert.equal(f.durable,0);assert.equal(sourcePolicy(request()).ttl,30000);assert.equal(sourcePolicy(requests.at(-1)).ttl,10000);
});
test('raw USGS real-time feed keeps its fifteen-second deadline and never resets collection time on a hit',async()=>{
 const f=fixture();let now=Date.now(),calls=0;Date.now=()=>now;const req=new Request('https://worker.test/?url='+encodeURIComponent('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson'));
 const load=()=>{calls++;return Response.json(feed());};const first=await sharedSourceResponse(req,f.env,load);const at=first.headers.get('X-Monitor-Source-Last-Ok');now+=14999;const hit=await sharedSourceResponse(req,f.env,load);assert.equal(hit.headers.get('X-Monitor-Source-Last-Ok'),at);assert.equal(calls,1);now+=2;await sharedSourceResponse(req,f.env,load);assert.equal(calls,2);assert.equal(f.durable,0);
});
test('paid, private, population and delivery routes do not enter the public source cache',()=>{
 for(const path of ['/tts?text=secret','/population-exposure?lat=1','/rain-weather','/telegram-m6-check','/telegram-image/secret','/translate-pt'])assert.equal(sourcePolicy(new Request('https://worker.test'+path)),null);
});
test('edge state transactions roll back and corrupted snapshots cannot prevent a fresh collection',async()=>{
 const f=fixture(),key=new Request('https://worker.test/state');let store=edgeSourceStore(f.env.EARTHQUAKE_ALERTS,'sample',key);
 await assert.rejects(store.run(s=>s.transaction(async tx=>{await tx.put('source-circuit',{failures:10});throw Error('rollback');})));
 assert.equal(await store.run(s=>s.get('source-circuit')),undefined);
 f.saved.set(key.url,new Response(new Uint8Array([255,255,255,255]),{headers:{'X-Monitor-Edge-State-Until':String(Date.now()+60000)}}));f.restart();store=edgeSourceStore(f.env.EARTHQUAKE_ALERTS,'sample',key);
 await store.run(async s=>{assert.equal(await s.get('source-circuit'),undefined);await s.put('source-circuit',{next:Date.now()+60000,failures:1});});assert.equal(store.persistenceDegraded,false);
});
test('state memory evicts old groups above eight MiB and restores their binary bodies from edge storage',async()=>{
 const f=fixture(),binding=f.env.EARTHQUAKE_ALERTS;let first;
 for(let i=0;i<4;i++){
  const store=edgeSourceStore(binding,'large-'+i,new Request('https://worker.test/state/'+i));if(i===0)first=store;
  await store.run(async s=>{await s.put('source-index',[{key:'body',parts:1,bytes:3*1024*1024,until:Date.now()+60000,at:Date.now(),ttl:30000}]);await s.put('source-body:body:0',new Uint8Array(3*1024*1024).fill(7));});
 }
 const restored=edgeSourceStore(binding,'large-0',new Request('https://worker.test/state/0'));assert.notEqual(restored,first);assert.equal((await restored.run(s=>s.get('source-body:body:0'))).byteLength,3*1024*1024);
});

test('actual global dashboard shares nested provider state and fits the free Worker subrequest budget',async t=>{
 const f=fixture(),calls=new Map();let network=0;
 globalThis.fetch=async input=>{network++;const url=new URL(input);calls.set(url.hostname,(calls.get(url.hostname)||0)+1);if(url.hostname==='eonet.gsfc.nasa.gov')return Response.json({events:[]});if(url.hostname==='api.weather.gov')return Response.json({features:[]});return new Response('<?xml version="1.0"?><rss><channel><title>Official feed</title></channel></rss>',{headers:{'Content-Type':'application/xml'}});};
 const response=await worker.fetch(new Request('https://worker.test/global-feeds'),f.env),data=await response.json();assert.equal(response.status,200);assert.equal(data.fontes.length,5);assert.equal(data.risco.level,'NORMAL');assert.equal(f.durable,0);
 const total=network+f.stats.cacheReads+f.stats.cacheWrites;t.diagnostic('Cold aggregate: '+total+' subrequests ('+network+' upstream, '+f.stats.cacheReads+' cache reads, '+f.stats.cacheWrites+' cache writes)');assert(total<50,'cold aggregate uses '+total+' subrequests');assert.equal(calls.get('www.nhc.noaa.gov'),1);
 await worker.fetch(new Request('https://worker.test/?url='+encodeURIComponent('https://www.nhc.noaa.gov/gis/forecast/archive/atl/latest/track_latest.xml')),f.env);assert.equal(calls.get('www.nhc.noaa.gov'),1);
});

test('failed aggregate stays unavailable without a healthy empty catalogue or excessive subrequests',async()=>{
 const f=fixture();let network=0;globalThis.fetch=async()=>{network++;return new Response('offline',{status:503});};
 const response=await worker.fetch(new Request('https://worker.test/global-feeds'),f.env);assert.equal(response.status,503);assert.equal(response.headers.get('X-Monitor-Source-State'),'unavailable');assert.equal(f.durable,0);assert(network+f.stats.cacheReads+f.stats.cacheWrites<50);
});
test('caller-supplied collection timestamps cannot poison rolling-window cache identity',async()=>{
 const f=fixture();let now=Date.now(),calls=0;Date.now=()=>now;
 const extra='&starttime='+encodeURIComponent(new Date(now-86400000).toISOString())+'&endtime='+encodeURIComponent(new Date(now+300000).toISOString()),normal=request(extra);
 globalThis.fetch=async()=>{calls++;return Response.json(feed());};await worker.fetch(new Request(normal,{headers:{'X-Monitor-Request-At':String(now-120000)}}),f.env);
 f.restart();now+=1000;assert.equal((await worker.fetch(normal,f.env)).status,200);assert.equal(calls,1);assert.equal(f.durable,0);
});
test('the real Worker proxy preserves Retry-After from a failed provider through normalization',async()=>{
 const f=fixture();let now=Date.now(),calls=0;Date.now=()=>now;globalThis.fetch=async()=>{calls++;return new Response('provider cooling down',{status:429,headers:{'Retry-After':'600'}});};
 const first=await worker.fetch(request(),f.env);assert.equal(first.status,503);assert.equal(first.headers.get('Retry-After'),'600');
 f.restart();now+=300001;assert.equal((await worker.fetch(request('&minlatitude=20'),f.env)).status,503);assert.equal(calls,1);assert.equal(f.durable,0);
});
