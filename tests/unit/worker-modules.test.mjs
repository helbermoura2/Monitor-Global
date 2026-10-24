import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {handleAfadEarthquakes,handleIngvEarthquakes,handleJmaEarthquakes,handleFunvisisEarthquakes} from '../../worker/seismic-providers.mjs';
import {clampFdsnParams} from '../../worker/fdsn-policy.mjs';
import {createTelegramTransport} from '../../worker/telegram-transport.mjs';
const originalFetch=globalThis.fetch;afterEach(()=>{globalThis.fetch=originalFetch;});
const url=path=>new URL('https://worker.test'+path);
test('AFAD adapter keeps its envelope, valid records, limit and CORS',async()=>{
 globalThis.fetch=async()=>Response.json({data:[{eventID:1,magnitude:3.2,latitude:38,longitude:35,depth:8},{eventID:2,magnitude:2,latitude:40,longitude:34}]});
 const response=await handleAfadEarthquakes(url('/afad-earthquakes?limit=1')),body=await response.json();
 assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'*');assert.equal(body.source,'AFAD');assert.equal(body.events.length,1);assert.deepEqual(body.events[0],{id:'1',place:'Turquia',mag:3.2,lat:38,lon:35,depth:8,time:null});
});
test('provider failures retain error status and INGV keeps its provider limits',async()=>{
 let requested;globalThis.fetch=async input=>{requested=new URL(input);return new Response('down',{status:503});};
 const response=await handleIngvEarthquakes(url('/ingv-earthquakes?minmagnitude=0.1'));assert.equal(response.status,502);assert.equal((await response.json()).source,'INGV');assert.equal(requested.searchParams.get('minmagnitude'),'1.5');assert.equal(requested.searchParams.get('limit'),'500');
 const q=url('/fdsnws/event/1/query?minmagnitude=0.1&limit=1000');q.hostname='webservices.ingv.it';clampFdsnParams(q);assert.equal(q.searchParams.get('limit'),'500');
});
test('JMA and FUNVISIS keep their different response shapes',async()=>{
 globalThis.fetch=async input=>String(input).includes('jma.go.jp')?new Response('<feed><entry><title>Japan</title><updated>2026-10-17T00:00:00Z</updated><summary>M=4.2 Latitude=35 Longitude=140 Depth=10</summary></entry></feed>'):Response.json({sismos:[{id:'ve',mag:'2,5',lat:10,lon:-66,date:'17/10/2026',time:'00:00',depth:'12 km'}]});
 const japan=await (await handleJmaEarthquakes()).json();assert.equal(japan[0].mag,4.2);assert.equal(japan[0].depth,10);
 const venezuela=await (await handleFunvisisEarthquakes(url('/funvisis-earthquakes'))).json();assert.equal(venezuela.source,'FUNVISIS');assert.equal(venezuela.events[0].mag,2.5);assert.equal(venezuela.events[0].depth,12);
});
function transport(){return createTelegramTransport({renderAlertCardPng:async()=>new Uint8Array([137,80,78,71]),queryImageExposure:async()=>({status:'unavailable'}),telegramCaption:()=>'*Alerta*',enrichBrazilEpicenter:async()=>{},originalImageButton:()=>({inline_keyboard:[]})});}
test('Telegram photo uses the injected renderer and retains multipart/caption rules',async()=>{
 let sent;globalThis.fetch=async(input,options)=>{sent={url:String(input),body:options.body};return Response.json({ok:true,result:{message_id:7}});};
 const ev={id:'test'},response=await transport().telegramSendPhoto({TELEGRAM_BOT_TOKEN:'fake',TELEGRAM_CHAT_ID:'chat'},ev,'x'.repeat(1100));
 assert.equal(response.result.message_id,7);assert.match(sent.url,/\/sendPhoto$/);assert.equal(sent.body.get('caption').length,1024);assert.equal(sent.body.get('parse_mode'),'Markdown');assert.equal(sent.body.get('photo').type,'image/png');assert.equal(ev.imageExposure.status,'unavailable');
});
test('transport distinguishes explicit rejection from an ambiguous network failure without retrying',async()=>{
 const api=transport(),env={TELEGRAM_BOT_TOKEN:'fake',TELEGRAM_CHAT_ID:'chat'};let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({ok:false,description:'rejected'},{status:400});};
 await assert.rejects(api.telegramSendMessage(env,'alert'),e=>e.telegramRejected===true);assert.equal(calls,1);
 await assert.rejects(api.telegramDailyRequest(env,'sendPhoto',new FormData()),e=>e.definitelyRejected===true);
 globalThis.fetch=async()=>{throw Error('timeout')};await assert.rejects(api.telegramSendMessage(env,'alert'),e=>e.telegramRejected!==true);await assert.rejects(api.telegramDailyRequest(env,'sendPhoto',new FormData()),e=>e.definitelyRejected!==true);
});
test('service modules do not depend back on the entrypoint and have no import cycles',async()=>{
 const dir=new URL('../../worker/',import.meta.url),graph=new Map();
 for(const name of await readdir(dir)){const source=await readFile(new URL(name,dir),'utf8');assert.doesNotMatch(source,/from\s+["'][^"']*monitor-global-worker/);graph.set(name,[...source.matchAll(/from\s+["']\.\/([^"']+)["']/g)].map(m=>m[1]));}
 function visit(name,path=[]){assert(!path.includes(name),'Import cycle: '+[...path,name].join(' -> '));for(const next of graph.get(name)||[])visit(next,[...path,name]);}for(const name of graph.keys())visit(name);
});

test('AFAD uses its official 36-hour catalogue and preserves Turkey origin time',async()=>{
 const calls=[];globalThis.fetch=async input=>{const u=new URL(input);calls.push(u);return Response.json([{eventID:'official-1',magnitude:'1.1',latitude:'40.14',longitude:'28.25',depth:'7',date:'2026-10-24T18:46:46',location:'Bursa'}]);};
 const body=await(await handleAfadEarthquakes(url('/afad-earthquakes?limit=200'))).json();
 assert.equal(calls.length,1);assert.equal(calls[0].hostname,'deprem.afad.gov.tr');assert.equal(calls[0].searchParams.get('limit'),'200');assert.equal(calls[0].searchParams.get('orderby'),'timedesc');
 const start=Date.parse(calls[0].searchParams.get('start')),end=Date.parse(calls[0].searchParams.get('end'));assert.equal(end-start,36*3600000);
 assert.equal(body.events[0].time,'2026-10-24T18:46:46+03:00');assert.equal(Date.parse(body.events[0].time),Date.parse('2026-10-24T15:46:46Z'));
});

test('AFAD retains its community fallback when the official service fails',async()=>{
 const calls=[];globalThis.fetch=async input=>{calls.push(String(input));return calls.length===1?new Response('down',{status:503}):Response.json({data:[{eventID:42,magnitude:3.2,latitude:38,longitude:35,depth:8,date_time:'2026-10-24T15:46:46Z'}]});};
 const body=await(await handleAfadEarthquakes(url('/afad-earthquakes?limit=1'))).json();assert.equal(calls.length,2);assert.match(calls[1],/api\.orhanaydogdu\.com\.tr/);assert.equal(body.events[0].time,'2026-10-24T15:46:46Z');
});
