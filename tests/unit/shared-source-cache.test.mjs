import test from 'node:test';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';import {readFile} from 'node:fs/promises';
import {sourcePolicy,handleSourceInObject,pruneSources} from '../../shared-source-cache.mjs';
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const source=(await readFile(new URL('../../monitor-global-worker-7_7_0.js',import.meta.url),'utf8')).replace(/from "(\.\/[^"\n]+)"/g,(_,p)=>'from '+JSON.stringify(new URL('../../'+p.slice(2),import.meta.url).href));const {default:worker,EarthquakeAlertDelivery}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function store(data=new Map()){return {data,get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v)),delete:async k=>data.delete(k),list:async({prefix='',limit=1000}={})=>new Map([...data].filter(([k])=>k.startsWith(prefix)).slice(0,limit)),setAlarm:async()=>{}};}
function fixture(){const items=new Map(),jobs=[],invocations=new Map(),kv={reads:0,writes:0},env={PUBLIC_SOURCE_MODE:'durable',ADMIN_TOKEN:'private',KV_METRICS_READ_TOKEN:'read-only',TTS_USAGE:{get:async()=>{kv.reads++;return null;},put:async()=>{kv.writes++;throw Error('No KV writes');}}};env.EARTHQUAKE_ALERTS={idFromName:n=>n,get:n=>{if(!items.has(n)){const storage=store();items.set(n,{storage,object:new EarthquakeAlertDelivery({storage,waitUntil:p=>jobs.push(p)},env)});}return {fetch:r=>{invocations.set(n,(invocations.get(n)||0)+1);return items.get(n).object.fetch(new Request(r));}};}};return {env,items,kv,invocations,async flush(){while(jobs.length)await Promise.all(jobs.splice(0));},restart(){env.EARTHQUAKE_ALERTS={...env.EARTHQUAKE_ALERTS};for(const i of items.values())i.object=new EarthquakeAlertDelivery({storage:store(i.storage.data),waitUntil:p=>jobs.push(p)},env);}};}
const request=(extra='',origin='https://worker.test')=>new Request(origin+'/?url='+encodeURIComponent('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=1&limit=1000'+extra));
const feed=(id='one')=>({type:'FeatureCollection',features:[{id}]});

test('30 visitors and origins share one provider request; persisted cache survives object restart without KV',async()=>{
 const f=fixture(),old=fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json(feed());};
 try{const rs=await Promise.all(Array.from({length:30},(_,i)=>worker.fetch(request('',i%2?'https://worker.test':'https://other-edge.test'),f.env)));for(const r of rs){assert.equal(r.status,200);assert.equal(r.headers.get('X-Monitor-Source-State'),'fresh');assert.equal((await r.json()).features[0].id,'one');}assert.equal(calls,1);assert.equal(f.invocations.get('shared-source-v1:earthquake.usgs.gov'),1);f.restart();assert.equal((await worker.fetch(request(),f.env)).status,200);assert.equal(calls,1);assert.equal(f.kv.writes,0);assert.equal(f.kv.reads,0);await f.flush();}finally{globalThis.fetch=old;}
});
test('a provider failure retains valid data with its original timestamp, backs off across keys and restart, then recovers',async()=>{
 const f=fixture(),old=fetch,oldNow=Date.now;let now=oldNow(),calls=0,fail=false;Date.now=()=>now;globalThis.fetch=async()=>{calls++;return fail?new Response('down',{status:503}):Response.json(feed('new'));};
 try{let r=await worker.fetch(request(),f.env);const at=r.headers.get('X-Monitor-Source-Last-Ok');fail=true;now+=31000;r=await worker.fetch(request(),f.env);assert.equal(r.status,200);assert.equal(r.headers.get('X-Monitor-Source-State'),'stale');assert.equal(r.headers.get('X-Monitor-Source-Last-Ok'),at);assert.equal(calls,2);f.restart();assert.equal((await worker.fetch(request('&minlatitude=10'),f.env)).status,503);assert.equal(calls,2);now+=31000;await worker.fetch(request(),f.env);assert.equal(calls,3);now+=61000;fail=false;r=await worker.fetch(request(),f.env);assert.equal(r.headers.get('X-Monitor-Source-State'),'fresh');assert.equal(calls,4);await f.flush();}finally{globalThis.fetch=old;Date.now=oldNow;}
});
test('expired snapshot is never returned as an empty catalogue or a new valid response',async()=>{
 const s=store(),oldNow=Date.now;let now=oldNow();Date.now=()=>now;try{const req=request();await handleSourceInObject(req,{},s,async()=>Response.json(feed()));now+=121000;const r=await handleSourceInObject(req,{},s,async()=>new Response('down',{status:503}));assert.equal(r.status,503);assert.equal(r.headers.get('X-Monitor-Source-State'),'unavailable');const data=await r.json();assert(!('features'in data));await pruneSources(s,now);assert.equal((await s.get('source-index')).length,0);assert.equal([...s.data.keys()].filter(k=>k.startsWith('source-body:')).length,0);}finally{Date.now=oldNow;}
});
test('query filters, location and historical times are isolated; near-identical rolling windows coalesce even when queued',async()=>{
 const now=Date.now(),start=new Date(now-72*3600000).toISOString(),end=new Date(now+300000).toISOString(),a=request('&starttime='+start+'&endtime='+end),b=request('&starttime='+new Date(now+800-72*3600000).toISOString()+'&endtime='+new Date(now+300800).toISOString());
 assert.equal(sourcePolicy(a,undefined,now).key,sourcePolicy(b,undefined,now+800).key);assert.notEqual(sourcePolicy(a,undefined,now).key,sourcePolicy(request('&minlatitude=10'),undefined,now).key);assert.notEqual(sourcePolicy(request('&starttime=2020-01-01'),undefined,now).key,sourcePolicy(request('&starttime=2021-01-01'),undefined,now).key);
 const s=store(),oldNow=Date.now;Date.now=()=>now+10000;let calls=0;try{for(const req of [a,b]){const timed=new Request(req,{headers:{'X-Monitor-Request-At':String(req===a?now:now+800)}});await handleSourceInObject(timed,{},s,async()=>{calls++;return Response.json(feed());});}assert.equal(calls,1);}finally{Date.now=oldNow;}
});
test('admin and paid routes, secret URLs, unknown hosts and write methods cannot enter the shared cache',async()=>{
 for(const path of ['/tts?text=secret','/telegram-m6-check','/population-exposure?lat=1','/rain-nowcast','/?url='+encodeURIComponent('https://not-allowed.test/data'),'/?url='+encodeURIComponent('https://api.open-meteo.com/v1/forecast?apikey=secret')])assert.equal(sourcePolicy(new Request('https://worker.test'+path)),null,path);
 assert.equal(sourcePolicy(new Request('https://worker.test/sp-clima',{method:'POST'})),null);
});
test('invalid 200 bodies cannot overwrite a valid feed; empty official catalogues are successful',async()=>{
 const s=store();let now=Date.now();await handleSourceInObject(request(),{},s,async()=>Response.json(feed()),undefined,now);now+=31000;const r=await handleSourceInObject(request(),{},s,async()=>Response.json({message:'blocked'}),undefined,now);assert.equal(r.headers.get('X-Monitor-Source-State'),'stale');assert.equal((await r.json()).features.length,1);
 const empty=await handleSourceInObject(request(),{},store(),async()=>Response.json({type:'FeatureCollection',features:[]}),undefined,now);assert.equal(empty.status,200);assert.equal((await empty.json()).features.length,0);
});
test('bad query errors do not open the provider circuit; cache size and cleanup remain bounded',async()=>{
 const s=store();let calls=0;for(let i=0;i<18;i++)await handleSourceInObject(request('&minlatitude='+i),{},s,async()=>{calls++;return Response.json(feed());});assert.equal((await s.get('source-index')).length,16);
 const bad=await handleSourceInObject(request('&minlatitude=999'),{},s,async()=>new Response('bad',{status:400}));assert.equal(bad.status,400);assert.equal((await s.get('source-circuit')).failures,0);assert.equal(calls,18);
});
test('real source health requires the admin header and exposes no request URLs or credentials',async()=>{
 const f=fixture();assert.equal((await worker.fetch(new Request('https://worker.test/source-health'),f.env)).status,401);assert.equal((await worker.fetch(new Request('https://worker.test/source-health?token=private'),f.env)).status,401);const r=await worker.fetch(new Request('https://worker.test/source-health',{headers:{'X-Admin-Token':'private'}}),f.env);assert.equal(r.status,200);const text=await r.text();assert(!text.includes('private'));assert(!text.includes('read-only'));assert(!text.includes('minlatitude'));assert.equal(JSON.parse(text).sources.length,20);
});

test('edge cache absorbs later visitors without another coordinator or provider request',async()=>{
 const f=fixture(),old=fetch,oldCache=globalThis.caches,cache=new Map();let calls=0;globalThis.fetch=async()=>{calls++;return Response.json(feed());};globalThis.caches={default:{match:async r=>cache.get(r.url)?.clone(),put:async(r,response)=>cache.set(r.url,response.clone())}};
 try{await worker.fetch(request(),f.env);const object=f.items.get('shared-source-v1:earthquake.usgs.gov'),before=await object.storage.get('source-circuit');const response=await worker.fetch(request(),f.env);assert.equal(response.status,200);assert.equal(calls,1);assert.equal(cache.size,1);assert.deepEqual(await object.storage.get('source-circuit'),before);await f.flush();assert.equal(f.items.has('kv-operation-metrics-v1'),false);}finally{globalThis.fetch=old;if(oldCache===undefined)delete globalThis.caches;else globalThis.caches=oldCache;}
});
test('provider Retry-After is respected; oversized data is not persisted',async()=>{
 const s=store(),now=Date.now();await handleSourceInObject(request(),{},s,async()=>new Response('busy',{status:429,headers:{'Retry-After':'600'}}),undefined,now);assert.equal((await s.get('source-circuit')).next,now+600000);
 const big=store(),r=await handleSourceInObject(request(),{},big,async()=>new Response('x'.repeat(3*1024*1024+1)),undefined,now);assert.equal(r.status,503);assert.equal(await big.get('source-index'),undefined);
});

test('unchanged provider bodies reuse chunks while recording a new successful collection time',async()=>{
 const s=store(),put=s.put;let bodies=0;s.put=async(k,v)=>{if(k.startsWith('source-body:'))bodies++;return put(k,v);};const now=Date.now(),req=request();await handleSourceInObject(req,{},s,async()=>Response.json(feed()),undefined,now);const first=bodies;const r=await handleSourceInObject(req,{},s,async()=>Response.json(feed()),undefined,now+31000);assert.equal(bodies,first);assert.equal(Number(r.headers.get('X-Monitor-Source-Last-Ok')),now+31000);
});
test('global aggregate route is implemented and reuses the same provider coordinator as direct feeds',async()=>{
 const f=fixture(),old=fetch,calls=new Map();globalThis.fetch=async u=>{const url=new URL(u);calls.set(url.hostname,(calls.get(url.hostname)||0)+1);if(url.hostname==='eonet.gsfc.nasa.gov')return Response.json({events:[]});if(url.hostname==='api.weather.gov')return Response.json({features:[]});return new Response('<?xml version="1.0"?><rss><channel><title>Official feed</title></channel></rss>',{headers:{'Content-Type':'application/xml'}});};
 try{const r=await worker.fetch(new Request('https://worker.test/global-feeds'),f.env);assert.equal(r.status,200);const data=await r.json();assert.equal(data.fontes.length,5);assert.equal(data.risco.level,'NORMAL');assert(f.items.has('shared-source-v1:www.nhc.noaa.gov'));assert.equal(calls.get('www.nhc.noaa.gov'),1);await worker.fetch(new Request('https://worker.test/?url='+encodeURIComponent('https://www.nhc.noaa.gov/gis/forecast/archive/atl/latest/track_latest.xml')),f.env);assert.equal(calls.get('www.nhc.noaa.gov'),1);await f.flush();}finally{globalThis.fetch=old;}
});

test('real Worker serves a valid source even when durable cache reads and writes exceed quota',async()=>{
 const f=fixture(),original=globalThis.fetch,get=f.env.EARTHQUAKE_ALERTS.get;let calls=0,writes=0;
 f.env.EARTHQUAKE_ALERTS.get=name=>{const object=get(name),storage=f.items.get(name).storage;storage.get=async()=>{throw Error('quota exceeded');};storage.put=async()=>{writes++;throw Error('quota exceeded');};storage.setAlarm=async()=>{throw Error('unexpected alarm');};return object;};
 globalThis.fetch=async()=>{calls++;return Response.json(feed('current'));};
 try{for(let i=0;i<20;i++){const response=await worker.fetch(request(),f.env);assert.equal(response.status,200);assert.equal(response.headers.get('X-Monitor-Source-State'),'fresh');assert.equal((await response.json()).features[0].id,'current');}assert.equal(calls,1);assert.equal(writes,1);assert.equal(f.items.has('kv-operation-metrics-v1'),false);await f.flush();}finally{globalThis.fetch=original;}
});

test('50 simultaneous coordinator failures share one invocation and retain HTTP 503',async()=>{const f=fixture();let calls=0;f.env.EARTHQUAKE_ALERTS.get=()=>({fetch:async()=>{calls++;throw Error('object unavailable');}});const responses=await Promise.all(Array.from({length:50},()=>worker.fetch(request(),f.env)));assert(responses.every(r=>r.status===503));assert.equal(calls,1);assert.equal((await worker.fetch(request(),f.env)).status,503);assert.equal(calls,1);});

test('unconfigured optional WeatherAPI is unavailable with a readable retry deadline, not an internal error',async()=>{
 const r=await worker.fetch(new Request('https://worker.test/weatherapi?q=1,2'),{});assert.equal(r.status,503);assert.equal(r.headers.get('Retry-After'),'1800');assert(Number(r.headers.get('X-Monitor-Source-Next-Retry'))>Date.now());assert.equal((await r.json()).configured,false);
});
