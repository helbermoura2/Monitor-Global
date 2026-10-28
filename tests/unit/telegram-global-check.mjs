// All providers, images and Telegram transport are mocked. No real messages.
import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const workerURL=new URL('../../monitor-global-worker-7_7_0.js',import.meta.url);let source=await readFile(workerURL,'utf8');
source=source.replace(/from "(\.\/[^\"]+)"/g,(_,p)=>'from '+JSON.stringify(new URL(p,workerURL).href));
source=source.replace('async function renderAlertCardPng(ev) {','async function renderAlertCardPng(ev) { ev.imageTsunami ||= await queryImageTsunami(ev); return globalThis.__globalPng.slice();');
source=source.replaceAll('queryImageExposure(ev, env)','Promise.resolve({status:"unavailable"})').replaceAll('queryImageShaking(ev)','Promise.resolve({status:"unavailable"})');source+='\nexport {runTelegramM6Alerts};';
const {EarthquakeAlertDelivery,runTelegramM6Alerts}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
globalThis.__globalPng=new Uint8Array(48);__globalPng.set([137,80,78,71,13,10,26,10]);new DataView(__globalPng.buffer).setUint32(16,1080);new DataView(__globalPng.buffer).setUint32(20,1920);
let clock=Date.parse('2026-10-28T03:20:00Z'),active=false,usMag=5.6,gfzMag=6.09,gfzFail=false;Date.now=()=>clock;let origin=clock-60000;const messages=[];
const quake=(id,mag,emsc=false)=>({id,properties:{mag,time:emsc?new Date(origin).toISOString():origin,updated:clock-1000,lastupdate:new Date(clock-1000).toISOString(),status:'reviewed',net:'us',type:'earthquake',evtype:'ke',place:'Vanuatu',source_id:'2081625'},geometry:{coordinates:[165.8,-14.06,10]}});
globalThis.fetch=async(input,options)=>{
 const u=new URL(input);
 if(u.hostname==='api.telegram.org'){const body=options.body instanceof FormData?Object.fromEntries(options.body):JSON.parse(options.body);const media=body.media?JSON.parse(body.media):null;messages.push({method:u.pathname.split('/').at(-1),caption:media?.caption||body.caption||body.text});return Response.json({ok:true,result:{message_id:101,chat:{id:-1001}}});}
 if(u.searchParams.has('minlatitude'))return u.searchParams.get('format')==='text'?new Response('# empty'):Response.json({features:[]});
 if(u.hostname==='earthquake.usgs.gov'){const f=quake('us7000ttlt',usMag);return u.searchParams.has('eventid')?Response.json(f):Response.json({features:active&&usMag>=6?[f]:[]});}
 if(u.hostname==='www.seismicportal.eu')return Response.json({features:active?[quake('20261028_0000049',5.6,true)]:[]});
 if(u.hostname==='geofon.gfz-potsdam.de'){if(gfzFail)throw Error('offline');const header='#EventID|Time|Latitude|Longitude|Depth/km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType\n';return new Response(header+(active?['gfz2026vciw',new Date(origin).toISOString(),-14.06,165.8,10,'','','','','mb',gfzMag,'','Vanuatu','earthquake'].join('|'):''));}
 return new Response('',{status:503});
};
class Store{data=new Map();async get(k){if(Array.isArray(k))return new Map(k.filter(x=>this.data.has(x)).map(x=>[x,structuredClone(this.data.get(x))]));return structuredClone(this.data.get(k));}async put(k,v){if(typeof k==='object'){for(const[a,b]of Object.entries(k))await this.put(a,b);return;}this.data.set(k,structuredClone(v));}async delete(k){for(const x of Array.isArray(k)?k:[k])this.data.delete(x);}}
const storage=new Store(),kv=new Store(),env={TELEGRAM_BOT_TOKEN:'fake-test',TELEGRAM_CHAT_ID:-1001,TTS_USAGE:kv};let object=new EarthquakeAlertDelivery({storage},env);env.EARTHQUAKE_ALERTS={idFromName:n=>n,get:n=>({fetch:r=>n==='kv-operation-metrics-v1'?Promise.resolve(Response.json({ok:true})):object.fetch(r)})};
const run=async()=>{clock+=61000;return runTelegramM6Alerts(new Request('https://worker.test/telegram-m6-check'),env);};
await run();active=true;let result=await run();assert.equal(result.sent.length,1);assert.equal(result.sent[0].mag,6.09);assert.equal(messages.filter(m=>m.method==='sendPhoto').length,1);assert(messages[0].caption.includes('GEOFON'));assert(messages[0].caption.includes('M6,1'));
await run();assert.equal(messages.length,1,'stable agencies do not duplicate the event');
gfzMag=6.2;result=await run();assert(messages.at(-1).caption.includes('Revisão da fonte'));await run();assert(messages.some(m=>m.method==='sendMessage'&&m.caption.includes('Revisão da fonte')));
usMag=6;result=await run();assert.equal(result.sent.length,0);assert.equal(messages.filter(m=>m.method==='sendPhoto').length,1);assert(messages.at(-1).caption.includes('Nova estimativa'));
await run();assert(messages.some(m=>m.method==='sendMessage'&&m.caption.includes('Nova estimativa de outra rede')));const size=messages.length;await run();assert.equal(messages.length,size);
gfzFail=true;await run();assert.equal(messages.length,size,'source outage must not invent a new notice');
object=new EarthquakeAlertDelivery({storage},env);await run();assert.equal(messages.length,size,'deduplication survives coordinator restart');
origin=clock-3600000;usMag=5.6;gfzMag=6.09;gfzFail=false;const freshStorage=new Store(),freshKv=new Store(),freshEnv={...env,TTS_USAGE:freshKv};const freshObject=new EarthquakeAlertDelivery({storage:freshStorage},freshEnv);freshEnv.EARTHQUAKE_ALERTS={idFromName:n=>n,get:n=>({fetch:r=>n==='kv-operation-metrics-v1'?Promise.resolve(Response.json({ok:true})):freshObject.fetch(r)})};clock+=61000;const old=await runTelegramM6Alerts(new Request('https://worker.test/telegram-m6-check'),freshEnv);assert.equal(old.sent.length,0,'first initialization does not announce old global backlog');assert.equal(messages.length,size);
assert(storage.data.has('telegram-global-baseline:GEOFON'));assert(!kv.data.has('telegram-global-baseline:GEOFON'),'global baselines stay in existing Durable storage');
console.log('PASS: GEOFON M6.1 with USGS below cutoff sends once, agency upgrade edits the original, labels another estimate, outages/restart do not duplicate; no real Telegram calls.');
