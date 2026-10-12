import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let stamp=Date.parse('2026-10-12T15:00:00Z');const RealDate=Date;
globalThis.Date=class extends RealDate{constructor(...a){super(...(a.length?a:[stamp]));}static now(){return stamp;}};
const workerURL=new URL('../../monitor-global-worker-7_7_0.js',import.meta.url);
let source=await readFile(workerURL,'utf8');source=source.replace(/from "(\.\/[^"\n]+)"/g,(_,p)=>'from '+JSON.stringify(new URL(p,workerURL).href));
source=source.replace('async function renderDailySummaryPng(quakes = null) {','async function renderDailySummaryPng(quakes = null) { globalThis.__summaryRender=structuredClone(quakes);return {png:new Uint8Array([137,80,78,71])};');
const {DailySummaryDelivery}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
class Store{data=new Map();queue=Promise.resolve();async get(k){return structuredClone(this.data.get(k));}async put(k,v){this.data.set(k,structuredClone(v));}transaction(fn){const p=this.queue.then(()=>fn(this));this.queue=p.catch(()=>{});return p;}}
const storage=new Store();await storage.put('delivery',{status:'sent'});await storage.put('history',{status:'sent',format:'photo',messageId:47,events:[]});
let phase=0,partial=false,timeout=false;const edits=[],queries=[],previews=[];
globalThis.fetch=async(input,options)=>{
 const u=new URL(String(input));
 if(u.hostname==='api.telegram.org'){
  assert(u.pathname.endsWith('/editMessageMedia'));const body=Object.fromEntries(options.body);edits.push(body);
  if(timeout)throw Error('ambiguous timeout');return Response.json({ok:true,result:{message_id:47}});
 }
 if(u.hostname==='servicodados.ibge.gov.br')return Response.json(JSON.parse(await readFile(new URL('./fixtures/brazil-epicenter-sp.json',import.meta.url),'utf8')));
 queries.push(u);
 if(u.hostname==='moho.iag.usp.br')return new Response('#EventID|Time|Latitude|Longitude|Depth/km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType\n'+(phase?'usp-br|2026-10-10T20:41:54|-20.71|-47.66|4|USP||USP|usp-br|mR|'+(phase===1?'3.4':'3.2')+'|USP|São Paulo|earthquake\n':''));
 if(u.hostname==='geofon.gfz.de')return new Response('# empty');
 if(u.hostname==='www.seismicportal.eu'){if(partial)throw Error('catalog offline');return Response.json({features:[]});}
 assert(u.hostname==='earthquake.usgs.gov');
 return Response.json({features:u.searchParams.has('minlatitude')?[]:[{id:'world',properties:{mag:6,place:'Japan',time:Date.parse('2026-10-10T12:00:00Z'),net:'us'},geometry:{coordinates:[140,35,10]}}]});
};
const env={TELEGRAM_BOT_TOKEN:'mock',TELEGRAM_CHAT_ID:'mock',TTS_USAGE:{async put(...args){previews.push(args);}}};
let object=new DailySummaryDelivery({storage},env);
const run=(day='2026-10-10')=>object.fetch(new Request('https://summary.internal/refresh-brazil?day='+day));
assert.equal((await run()).status,200);assert.equal(edits.length,0); // no Brazil: no invented addition
stamp+=1800001;phase=1;
await Promise.all(Array.from({length:10},()=>run()));assert.equal(edits.length,1);
assert.equal(edits[0].message_id,'47');const media=JSON.parse(edits[0].media);
assert(media.caption.includes('10/10/2026'));assert(media.caption.includes('🇧🇷 Brasil: 1 sismo · maior M3,4'));
assert.equal(__summaryRender.brazilEvents.length,1);assert.equal(__summaryRender.brazilEvents[0].place,'Nuporanga/SP, Brasil');
assert.equal(__summaryRender.events.length,2);assert.equal(previews[0][0],'telegram-history-preview:2026-10-10');
assert.equal((await storage.get('history')).status,'sent');assert.equal((await storage.get('history')).messageId,47);
for(const u of queries){assert.equal(u.searchParams.get('starttime'),'2026-10-10T03:00:00.000Z');assert.equal(u.searchParams.get('endtime'),'2026-10-11T03:00:00.000Z');}
await run();assert.equal(edits.length,1);
stamp+=1800001;await run();assert.equal(edits.length,1); // unchanged fingerprint
stamp+=1800001;phase=2;timeout=true;assert.equal((await run()).status,502);assert.equal(edits.length,2);
object=new DailySummaryDelivery({storage},env);await run();assert.equal(edits.length,2); // restart retains throttle
stamp+=300001;timeout=false;await run();assert.equal(edits.length,3);assert.equal(edits[2].message_id,'47');assert(JSON.parse(edits[2].media).caption.includes('maior M3,2'));
const fingerprint=(await storage.get('history')).brazilFingerprint;
stamp+=1800001;partial=true;assert.equal((await run()).status,502);assert.equal(edits.length,3);assert.equal((await storage.get('history')).brazilFingerprint,fingerprint);
assert.equal((await run('2026-10-01')).status,400);
await storage.put('delivery',{status:'sending'});assert.equal((await run()).status,200);assert.equal(edits.length,3);
await storage.put('delivery',{status:'sent'});await storage.put('history',{format:'photo',events:[]});assert.equal((await run()).status,200);assert.equal(edits.length,3); // never guesses a missing Telegram message ID
console.log('PASS: delayed Brazil events revise the original daily photo, explicit BRT day, below-top-five inclusion, concurrent claim, persistent retry, same-ID magnitude revisions, unchanged suppression, partial-source protection and no duplicate send. Telegram mocked.');
