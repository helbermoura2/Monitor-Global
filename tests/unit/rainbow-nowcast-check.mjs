import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {handleRainbowNowcast,handleRainbowInObject,normalizeRainbow,rainbowLocation} from '../../rainbow-nowcast-worker.mjs';
const now=Date.parse('2026-10-10T20:15:30Z'),loc={lat:-23.558,lng:-46.634},key='rainbow:point:-23.558,-46.634';
const request=(lat=loc.lat,lng=loc.lng)=>new Request('https://worker.test/rain-nowcast?lat='+lat+'&lng='+lng);
const fixture=(stamp=now)=>({latitude:loc.lat,longitude:loc.lng,summary:{intensity:'extreme'},forecast:Array.from({length:240},(_,i)=>({
 timestampBegin:Math.floor(stamp/60000)*60+i*60,timestampEnd:Math.floor(stamp/60000)*60+(i+1)*60,precipRate:i<25?12:0,precipType:'rain'
}))});
const memory=()=>{const map=new Map();return {map,get:async k=>structuredClone(map.get(k)),put:async(k,v)=>{map.set(k,structuredClone(v));},delete:async k=>map.delete(k)};};
let calls=0;const env={RAINBOW_API_KEY:'test-private-secret'};
const fetcher=async(url,options)=>{calls++;assert.match(url,/\/precip-global\/-46\.634\/-23\.558$/);assert.equal(options.headers['Ocp-Apim-Subscription-Key'],env.RAINBOW_API_KEY);assert(!url.includes(env.RAINBOW_API_KEY));return Response.json(fixture());};
assert.equal((await (await handleRainbowNowcast(request(),{})).json()).reason,'not_configured');
assert.equal((await (await handleRainbowNowcast(request(),env)).json()).reason,'storage_unavailable');
for(const query of ['lat=&lng=0','lat=NaN&lng=0','lat=91&lng=0','lat=0&lng=null','lng=0'])assert.equal(rainbowLocation(new URL('https://x/?'+query)),null);
const storage=memory();const result=await (await handleRainbowInObject(request(),env,storage,{now,fetcher})).json();
assert.equal(result.ok,true);assert.equal(result.forecast[0].rate,12);assert.equal(result.forecast[0].end-result.forecast[0].start,60000);assert(!JSON.stringify(result).includes(env.RAINBOW_API_KEY));
await handleRainbowInObject(request(),env,storage,{now:now+590000,fetcher});assert.equal(calls,1);assert.equal(storage.map.get('rainbow:budget').used,1);
const used=memory();await used.put('rainbow:budget',{month:'2026-10',day:'2026-10-10',used:4500,dailyUsed:10});
assert.equal((await (await handleRainbowInObject(request(),env,used,{now,fetcher})).json()).reason,'monthly_limit');assert.equal(calls,1);
await used.put('rainbow:budget',{month:'2026-10',day:'2026-10-10',used:200,dailyUsed:150});assert.equal((await (await handleRainbowInObject(request(),env,used,{now,fetcher})).json()).reason,'daily_limit');
await used.put(key,result);assert.equal((await (await handleRainbowInObject(request(),env,used,{now,fetcher})).json()).ok,true);assert.equal(calls,1);
const failed=memory();let failures=0;
const reject=async()=>{failures++;return Response.json({secret:env.RAINBOW_API_KEY},{status:401});};
assert.equal((await (await handleRainbowInObject(request(),env,failed,{now,fetcher:reject})).json()).reason,'authentication');
await handleRainbowInObject(request(-23.6,-46.6),env,failed,{now:now+1,fetcher:reject});assert.equal(failures,1);assert.equal(failed.map.get('rainbow:budget').used,1);
const timeout=memory();await handleRainbowInObject(request(),env,timeout,{now,fetcher:async()=>{throw Error('secret in upstream error');}});
assert.equal(timeout.map.get('rainbow:budget').used,1);assert(!JSON.stringify(timeout.map.get(key)).includes('secret'));
assert.deepEqual(timeout.map.get(key).diagnostic,{httpStatus:null,stage:'request'});
for(const [status,stage] of [[503,'http'],[200,'payload']]){
 const diagnosticStorage=memory();const response=await (await handleRainbowInObject(request(),env,diagnosticStorage,{now,fetcher:async()=>Response.json({private:env.RAINBOW_API_KEY},{status})})).json();
 assert.deepEqual(response.diagnostic,{httpStatus:status,stage});assert(!JSON.stringify(response).includes(env.RAINBOW_API_KEY));
}
const legacy=memory();await legacy.put(key,{ok:false,at:now,expiresAt:now+600000});await legacy.put('rainbow:pause',{until:now+600000,reason:'provider_unavailable'});
await legacy.put('rainbow:budget',{month:'2026-10',day:'2026-10-10',used:12,dailyUsed:12});
await handleRainbowInObject(request(),env,legacy,{now,fetcher:async()=>Response.json(fixture())});assert.equal(legacy.map.get('rainbow:budget').used,13);assert.equal(legacy.map.get(key).ok,true);
const corrupt=memory();await corrupt.put('rainbow:budget',{month:'2026-10',day:'2026-10-10',used:NaN,dailyUsed:0});assert.equal((await (await handleRainbowInObject(request(),env,corrupt,{now,fetcher})).json()).reason,'storage_unavailable');
const noStorage={get:async()=>undefined,put:async()=>{throw Error('write failed');}};assert.equal((await (await handleRainbowInObject(request(),env,noStorage,{now,fetcher})).json()).reason,'storage_unavailable');assert.equal(calls,1);
const rollover=memory();await rollover.put('rainbow:budget',{month:'2026-09',used:4500,day:'2026-09-30',dailyUsed:150});await handleRainbowInObject(request(),env,rollover,{now,fetcher});assert.equal(rollover.map.get('rainbow:budget').used,1);
for(const change of [d=>{d.latitude=0;},d=>{d.forecast[0].precipRate=null;},d=>{d.forecast[0].precipRate=-1;},d=>{d.forecast.splice(4,1);},d=>{d.forecast[0].timestampEnd++;},d=>{d.forecast=d.forecast.slice(0,20);}]){const d=fixture();change(d);assert.throws(()=>normalizeRainbow(d,loc,now));}
assert.throws(()=>normalizeRainbow(fixture(now-5*3600000),loc,now));

// Exercise the actual Worker + serialized DO boundary, not a standalone quota mock.
let source=await readFile(new URL('../../monitor-global-worker-7_7_0.js',import.meta.url),'utf8');
source=source.replace(/from "(\.\/[^"\n]+)"/g,(_,p)=>'from '+JSON.stringify(new URL('../../'+p.slice(2),import.meta.url).href));
const {default:worker,EarthquakeAlertDelivery}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const nativeFetch=globalThis.fetch,nativeNow=Date.now;Date.now=()=>now;
let parallelCalls=0;globalThis.fetch=async(url,options)=>{assert(String(url).startsWith('https://api.rainbow.ai/'));parallelCalls++;await new Promise(r=>setTimeout(r,15));return fetcher(url,options);};
const persisted=memory();let object=new EarthquakeAlertDelivery({storage:persisted},env);
const bound={...env,EARTHQUAKE_ALERTS:{idFromName:name=>{assert.equal(name,'global-rainbow-nowcast-v1');return name;},get:()=>({fetch:r=>object.fetch(r)})}};
const concurrent=await Promise.all(Array.from({length:20},()=>worker.fetch(request(),bound)));
assert.equal(parallelCalls,1);assert(concurrent.every(r=>r.ok));assert.equal(persisted.map.get('rainbow:budget').used,1);
object=new EarthquakeAlertDelivery({storage:persisted},env);await worker.fetch(request(),bound);assert.equal(parallelCalls,1);
assert.equal((await worker.fetch(new Request(request().url,{method:'POST'}),bound)).status,405);assert.equal(parallelCalls,1);
globalThis.fetch=nativeFetch;Date.now=nativeNow;

const ctx={window:{}};vm.createContext(ctx);vm.runInContext(await readFile(new URL('../../js/rainbow-nowcast.js',import.meta.url),'utf8'),ctx);
const summarize=ctx.window.RainbowNowcast.summarize;
const summary=summarize(result,loc,now);assert.equal(summary.status,'now');assert.equal(summary.rate,12);assert.match(summary.header,/forte.*agora/);assert.equal(summary.stopMinutes,25);assert(summary.amount>4&&summary.amount<6); // mm/h integrated over real minute intervals.
const later=normalizeRainbow({...fixture(),forecast:fixture().forecast.map((p,i)=>({...p,precipRate:i>=10&&i<30?4:0}))},loc,now);
assert.equal(summarize(later,loc,now).status,'soon');assert.equal(summarize(later,loc,now).arrivalMinutes,10);
const dry=normalizeRainbow({...fixture(),forecast:fixture().forecast.map(p=>({...p,precipRate:0}))},loc,now);assert.equal(summarize(dry,loc,now).status,'dry');
const noEnd={...result,forecast:result.forecast.map(p=>({...p,rate:8}))};assert.equal(summarize(noEnd,loc,now).stopMinutes,null);
const interruption={...result,forecast:result.forecast.map((p,i)=>({...p,rate:i>=10&&i<15||i>=30?0:12}))};assert.equal(summarize(interruption,loc,now).stopMinutes,30);
for(const bad of [{...result,expiresAt:now},{...result,loc:{lat:0,lng:0}},{...result,at:now+120000},{...result,forecast:result.forecast.filter((_,i)=>i!==10)}])assert.equal(summarize(bad,loc,now),null);
console.log('PASS: persistent global/monthly/daily caps, reservations count failures, concurrency/restarts, cache, no credential leakage, validation, now/arrival/end/dry forecasts and mm/h integration');
