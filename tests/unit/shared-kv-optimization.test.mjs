import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {handleSharedVoice,pruneVoiceCache} from '../../shared-voice-cache.mjs';
import {handlePopulationExposure,expirePopulation} from '../../population-exposure-worker.mjs';
import {withKvUsage,handleKvUsageObject,handleKvUsageRead,kvFamily} from '../../kv-operation-metrics.mjs';
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const source=(await readFile(new URL('../../monitor-global-worker-7_7_0.js',import.meta.url),'utf8')).replace(/from "(\.\/[^"\n]+)"/g,(_,p)=>'from '+JSON.stringify(new URL('../../'+p.slice(2),import.meta.url).href));
const {default:worker,EarthquakeAlertDelivery}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function store(data=new Map()) {return {data,writes:[],get:async k=>structuredClone(data.get(k)),put:async function(k,v){this.writes.push(k);data.set(k,structuredClone(v));},delete:async k=>data.delete(k),list:async({prefix='',limit=1000}={})=>new Map([...data].filter(([k])=>k.startsWith(prefix)).slice(0,limit)),setAlarm:async()=>{}};}
function fixture(){const items=new Map(),jobs=[];let reads=0,writes=0;const env={AWS_ACCESS_KEY_ID:'fake',AWS_SECRET_ACCESS_KEY:'fake',TTS_USAGE:{get:async()=>{reads++;return '100';},put:async()=>{writes++;throw Error('No KV writes permitted');}}};env.EARTHQUAKE_ALERTS={idFromName:n=>n,get:n=>{if(!items.has(n)){const storage=store();items.set(n,{storage,object:new EarthquakeAlertDelivery({storage,waitUntil:p=>jobs.push(p)},env)});}return {fetch:r=>items.get(n).object.fetch(r)};}};return {env,items,jobs,get reads(){return reads;},get writes(){return writes;},async flush(){while(jobs.length)await Promise.all(jobs.splice(0));},restart(){for(const i of items.values())i.object=new EarthquakeAlertDelivery({storage:store(i.storage.data),waitUntil:p=>jobs.push(p)},env);}};}
const population=(lat,extra='')=>new Request(`https://worker.test/population-exposure?lat=${lat}&lng=-73&mag=5&depth=10&time=1000000${extra}`);
const voice=text=>new URL('https://worker.test/tts?text='+encodeURIComponent(text));
const credentials={AWS_ACCESS_KEY_ID:'fake',AWS_SECRET_ACCESS_KEY:'fake'};

test('13 pending population polls persist tasks once, survive object restart and make zero KV writes',async()=>{
 const f=fixture(),originalFetch=globalThis.fetch,originalNow=Date.now;let now=originalNow(),posts=0,gets=0,done=false;Date.now=()=>now;
 globalThis.fetch=async(url,options={})=>{assert(String(url).startsWith('https://api.worldpop.org/'));if(options.method==='POST'){posts++;return Response.json({status:'created',taskid:'task-'+posts});}gets++;return Response.json(done?{status:'finished',data:{total_population:10}}:{status:'processing'});};
 try {
  const rs=await Promise.all(Array.from({length:20},()=>worker.fetch(population(-41),f.env)));for(const r of rs)assert.equal((await r.json()).status,'pending');assert.equal(posts,3);
  const item=[...f.items].find(([k])=>k.startsWith('population-exposure-v2:'))[1];
  for(let i=0;i<12;i++){now+=10000;assert.equal((await(await worker.fetch(population(-41),f.env)).json()).status,'pending');}
  assert.equal(item.storage.writes.filter(k=>k==='population-state').length,1);assert.equal(f.reads,0);assert.equal(f.writes,0);assert.equal(posts,3);
  f.restart();now+=11000;done=true;assert.equal((await(await worker.fetch(population(-41),f.env)).json()).status,'available');assert.equal(posts,3);assert(gets>0);
  await f.flush();const stats=await(await handleKvUsageRead(new Request('https://worker.test/kv-usage',{headers:{Authorization:'Bearer secret'}}),{...f.env,KV_METRICS_READ_TOKEN:'secret'})).json();assert.equal(stats.available,false);assert.equal(f.items.has('kv-operation-metrics-v1'),true);assert.equal([...f.items.get('kv-operation-metrics-v1').storage.data].length,0);
 }finally{globalThis.fetch=originalFetch;Date.now=originalNow;}
});

test('WorldPop cache upgrades to official PAGER after five minutes without recalculating population',async()=>{
 const originalFetch=globalThis.fetch,originalNow=Date.now;let now=originalNow(),official=false,posts=0,usgs=0;Date.now=()=>now;const storage=store();
 const xml='<pager>'+[[.5,1.5,0],[1.5,2.5,100],[2.5,3.5,200],[3.5,4.5,300],[4.5,5.5,40],[5.5,6.5,10],[6.5,7.5,5],[7.5,8.5,0],[8.5,9.5,0],[9.5,10.5,0]].map(([min,max,pop])=>`<exposure dmin="${min}" dmax="${max}" exposure="${pop}" rangeInsideMap="1"/>`).join('')+'</pager>';
 globalThis.fetch=async(url,options={})=>{if(String(url).includes('fdsnws')){usgs++;return Response.json({geometry:{coordinates:[-73,-42,10]},properties:{mag:5,time:1000000,products:official?{losspager:[{updateTime:123,preferredWeight:100,contents:{'pager.xml':{url:'https://earthquake.usgs.gov/product/losspager/id/pager.xml'}}}]}:{}}});}if(String(url).includes('pager.xml'))return new Response(xml);assert.equal(options.method,'POST');posts++;return Response.json({status:'finished',data:{total_population:100}});};
 try{const r=()=>handlePopulationExposure(population(-42,'&eventId=us-test-optimization'),{},storage);assert.equal((await(await r()).json()).method,'worldpop');official=true;now+=299000;assert.equal((await(await r()).json()).method,'worldpop');assert.equal(usgs,1);now+=2000;assert.equal((await(await r()).json()).method,'pager');assert.equal(posts,3);assert.equal(usgs,2);await expirePopulation(storage,now+301000);assert.equal(await storage.get('population-state'),undefined);}finally{globalThis.fetch=originalFetch;Date.now=originalNow;}
});

test('concurrent real Worker voice requests share one synthesis and preserve migrated monthly quota on restart',async()=>{
 const f=fixture(),originalFetch=globalThis.fetch;let syntheses=0;const bytes=new Uint8Array(125000).fill(37);
 globalThis.fetch=async(url)=>{assert.equal(String(url),'https://polly.us-east-1.amazonaws.com/v1/speech');syntheses++;return new Response(bytes);};
 try{const responses=await Promise.all(Array.from({length:20},()=>worker.fetch(new Request(voice('Alerta de teste.')),f.env)));for(const r of responses){assert.equal(r.status,200);assert.equal((await r.arrayBuffer()).byteLength,bytes.length);}assert.equal(syntheses,1);assert.equal(f.reads,1);assert.equal(f.writes,0);
  const s=f.items.get('global-shared-voice-v1').storage;assert.equal((await s.get('voice-quota')).used,100+'Alerta de teste.'.length);f.restart();const r=await worker.fetch(new Request(voice('Alerta de teste.')),f.env);assert.equal(r.headers.get('X-Monitor-Voice-Cache'),'hit');assert.equal(syntheses,1);await f.flush();
 }finally{globalThis.fetch=originalFetch;}
});

test('voice budget fails closed on KV errors, invalid existing quota and exhausted limit',async()=>{
 let calls=0;const synth=async()=>{calls++;return new Response('mp3');};
 for(const old of ['299999','invalid']){const r=await handleSharedVoice(voice('aviso'),{...credentials,TTS_USAGE:{get:async()=>old}},store(),synth,{voice:'Camila'});assert(r.status>=400);}
 const r=await handleSharedVoice(voice('aviso'),{...credentials,TTS_USAGE:{get:async()=>{throw Error('quota');}}},store(),synth,{voice:'Camila'});assert.equal(r.status,503);
 const s=store();await s.put('voice-quota',{month:new Date().toISOString().slice(0,7),used:null});assert.equal((await handleSharedVoice(voice('aviso'),credentials,s,synth,{voice:'Camila'})).status,503);assert.equal(calls,0);
});

test('provider failure reserves characters once and pauses retries; missing credentials do not spend quota',async()=>{
 const s=store(),env={...credentials,TTS_USAGE:{get:async()=>null}};let calls=0;const synth=async()=>{calls++;throw Error('provider');};
 assert.equal((await handleSharedVoice(voice('aviso'),env,s,synth,{voice:'Camila'})).status,502);assert.equal((await handleSharedVoice(voice('aviso'),env,s,synth,{voice:'Camila'})).status,503);assert.equal(calls,1);assert.equal((await s.get('voice-quota')).used,5);
 const missing=store();assert.equal((await handleSharedVoice(voice('aviso'),{},missing,synth,{voice:'Camila'})).status,501);assert.equal(missing.writes.length,0);
});

test('voice cache expires, distinguishes voices and bounds stored clips to 64',async()=>{
 const s=store(),env={...credentials,TTS_USAGE:{get:async()=>null}},synth=async()=>new Response('mp3'),now=Date.now();
 for(let i=0;i<66;i++)assert.equal((await handleSharedVoice(voice('alerta '+i),env,s,synth,{voice:'Camila',now})).status,200);
 assert.equal((await s.get('voice-cache-index')).length,64);assert.equal([...s.data.keys()].filter(k=>k.endsWith(':meta')).length,64);
 const different=await handleSharedVoice(voice('alerta 65'),env,s,synth,{voice:'Vitoria',now});assert.equal(different.headers.get('X-Monitor-Voice-Cache'),'miss');await pruneVoiceCache(s,now+8*86400000);assert.equal((await s.get('voice-cache-index')).length,0);assert.equal([...s.data.keys()].filter(k=>k.startsWith('voice-audio:')).length,0);
});

test('KV metrics classify actual successful and failed operations without counter writes or raw keys',async()=>{
 const storage=store(),jobs=[],env={TTS_USAGE:{get:async k=>{if(k==='private-location')throw Error('fail');return null;},put:async()=>{},list:async()=>({keys:[]})},EARTHQUAKE_ALERTS:{idFromName:n=>n,get:()=>({fetch:r=>handleKvUsageObject(r,storage)})}};
 await withKvUsage(env,async e=>{await e.TTS_USAGE.get('usage-2026-10');await e.TTS_USAGE.put('exposure-private-coordinate','value');await assert.rejects(e.TTS_USAGE.get('private-location'));await e.TTS_USAGE.list();},{waitUntil:p=>jobs.push(p)});await Promise.all(jobs);
 const report=await(await handleKvUsageObject(new Request('https://internal/__kv-usage/read'),storage)).json();assert.equal(report.counts['voice.read.succeeded'],1);assert.equal(report.counts['other.read.failed'],1);assert.equal(report.counts['population.write.succeeded'],1);assert.equal(report.counts['namespaceList.list.attempted'],1);assert(!JSON.stringify(report).includes('private-coordinate'));assert.equal(kvFamily('telegram-history-preview:x'),'telegramSummaryPreview');
 assert.equal((await handleKvUsageRead(new Request('https://worker.test/kv-usage'),env)).status,401);
 assert.equal((await handleKvUsageObject(new Request('https://internal/__kv-usage/record',{method:'POST',body:'null'}),storage)).status,400);
 const body=JSON.stringify({id:crypto.randomUUID(),day:new Date().toISOString().slice(0,10),counts:{'voice.write.attempted':1}});for(let i=0;i<2;i++)assert.equal((await handleKvUsageObject(new Request('https://internal/__kv-usage/record',{method:'POST',body}),storage)).status,200);
 const final=await(await handleKvUsageObject(new Request('https://internal/__kv-usage/read'),storage)).json();assert.equal(final.counts['voice.write.attempted'],1);
});
