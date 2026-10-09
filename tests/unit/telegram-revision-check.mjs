import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const workerURL = new URL('../../monitor-global-worker-7_7_0.js', import.meta.url);
let source = await readFile(workerURL, 'utf8');
source = source.replace(/from "(\.\/[^\"]+)"/g, (_, path) => 'from '+JSON.stringify(new URL(path, workerURL).href));
// Rendering is separately tested; capture the revised event supplied to the card generator.
source = source.replace('async function renderAlertCardPng(ev) {', 'async function renderAlertCardPng(ev) { globalThis.rendered.push(structuredClone(ev)); return new Uint8Array([137,80,78,71]);');
source = source.replaceAll('queryImageExposure(ev, env)', 'Promise.resolve(globalThis.__testExposure || {status: "unavailable"})');
source += '\nexport {runTelegramM6Alerts};';
const {EarthquakeAlertDelivery, runTelegramM6Alerts} = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
globalThis.rendered=[];
const now=Date.now(), messages=[], queried=[];
let clock=now; Date.now=()=>clock;
const quake=(id,mag,net='pt',time=now-60000)=>({id,properties:{mag,net,place:'Vanuatu',time,type:'earthquake',status:'reviewed'},geometry:{coordinates:[168.18,-15.48,10]}});
let world=[],details=new Map(),editMode='ok',photoMode='ok',replyMode='ok',nextID=100;
globalThis.fetch=async(input,options)=>{
 const url=new URL(input);
 if(url.hostname==='api.telegram.org'){
  const body=options.body instanceof FormData ? Object.fromEntries(options.body) : JSON.parse(options.body);
  const media=body.media?JSON.parse(body.media):null;
  const method=url.pathname.split('/').at(-1);
  messages.push({method,body,caption:media?.caption||body.caption||body.text});
  if(method.startsWith('edit') && editMode==='timeout')throw Error('simulated edit timeout');
  if(method==='sendMessage' && body.reply_parameters && replyMode==='timeout')throw Error('simulated reply timeout');
  if(method==='sendPhoto' && photoMode==='rejected')return Response.json({ok:false,description:'photo rejected'},{status:400});
  if(method.startsWith('edit') && editMode==='not-modified')return Response.json({ok:false,description:'Bad Request: message is not modified'},{status:400});
  return Response.json({ok:true,result:{message_id:++nextID,chat:{id:-100123}}});
 }
 if(url.searchParams.has('eventid')){queried.push(url.searchParams.get('eventid'));return Response.json(details.get(url.searchParams.get('eventid'))||{});}
 if(url.searchParams.has('minmagnitude'))return Response.json({features:world.filter(f=>f.properties.mag>=6)});
 return url.searchParams.get('format')==='text'?new Response(''):Response.json({features:[]});
};
class Store{data=new Map();async get(key){return structuredClone(this.data.get(key))}async put(key,value){assert(Buffer.byteLength(String(value))<128*1024);this.data.set(key,structuredClone(value))}}
const storage=new Store(),kv=new Store();
const env={TELEGRAM_BOT_TOKEN:'fake-test-token',TELEGRAM_CHAT_ID:-100123,TTS_USAGE:kv};
let object=new EarthquakeAlertDelivery({storage},env);
env.EARTHQUAKE_ALERTS={idFromName:name=>name,get:()=>({fetch:request=>object.fetch(request)})};
const run=(advance=31000)=>{clock+=advance;return runTelegramM6Alerts(new Request('https://worker.test/telegram-m6-check'),env)};
world=[quake('initial',6.6)];await run();
assert.equal(messages.length,1);assert.equal(messages[0].method,'sendPhoto');assert(messages[0].caption.includes('sujeita a revisão'));
const original=101;
world=[quake('initial',6.3)];await run();
assert.equal(messages[1].method,'editMessageMedia');assert.equal(Number(messages[1].body.message_id),original);
assert.equal(rendered.at(-1).mag,6.3);assert(messages[1].caption.includes('Inicial: *M6.6* · Atual: *M6.3*'));
assert(messages[1].caption.includes('Revisão da fonte'));
assert.equal(messages.length,2);await run();
assert.equal(messages[2].body.reply_parameters.message_id,original);
assert(messages[2].caption.includes('Agora: *M6.3*'));
await run();assert.equal(messages.length,3);
world=[quake('initial',6.2)];await run();assert.equal(messages.length,4);assert.equal(messages.at(-1).method,'editMessageMedia');
// New ID from another network updates the original instead of adding another photo.
world.push(quake('us-alias',6.1,'us'));await run();assert.equal(messages.length,5);assert.equal(Number(messages.at(-1).body.message_id),original);
assert(messages.at(-1).caption.includes('Nova estimativa'));
await run();assert.equal(messages.length,5); // unchanged PT estimate cannot flip the card back
// Below M6 still fetched by known ID and edits the same card, including a threshold notice.
world=world.filter(f=>f.id!=='us-alias');details.set('us-alias',quake('us-alias',5.9,'us'));await run();
assert(queried.includes('us-alias'));assert.equal(rendered.at(-1).mag,5.9);await run();assert.equal(messages.at(-1).method,'sendMessage');
assert.equal(messages.at(-1).body.reply_parameters.message_id,original);
let count=messages.length;object=new EarthquakeAlertDelivery({storage},env);await Promise.all(Array.from({length:5},run));assert.equal(messages.length,count);
// Close but later aftershock is independent; same network cannot merge nearby distinct IDs.
world.push(quake('aftershock',6.4,'pt',now-60000+45000));await run();assert.equal(messages.at(-1).method,'sendPhoto');
world.push(quake('same-network',6.5,'pt',now-60000+46000));await run();assert.equal(messages.at(-1).method,'sendPhoto');
// Edits retry after ambiguous timeout, without sending a replacement photo or losing the update.
world.find(f=>f.id==='aftershock').properties.mag=6.8;editMode='timeout';await run();count=messages.length;
editMode='not-modified';await run();assert.equal(messages[count].method,'editMessageMedia');await run();assert.equal(messages.at(-1).method,'sendMessage');
editMode='ok';count=messages.length;await run();assert.equal(messages.length,count);
// A reply timeout never repeats a notice or undoes the successful edit.
replyMode='timeout';world.find(f=>f.id==='aftershock').properties.mag=7.1;await run();await run();count=messages.length;replyMode='ok';await run();assert.equal(messages.length,count);
// Text fallback has its own persisted ID and is updated with editMessageText.
photoMode='rejected';world.push(quake('text-alert',6.4,'us',now-3600000));await run();photoMode='ok';
assert.equal(messages.at(-1).method,'sendMessage');const textID=nextID;
world.find(f=>f.id==='text-alert').properties.mag=6.3;await run();assert.equal(messages.at(-1).method,'editMessageText');assert.equal(messages.at(-1).body.message_id,textID);
// Several changes inside 30s produce one final notice; reverting to the old value produces none.
world.push(quake('batch',6.6,'us',now-7200000));await run();
const batch=world.find(f=>f.id==='batch');let notices=messages.filter(m=>m.body.reply_parameters).length;
batch.properties.mag=6.4;await run(0);batch.properties.mag=6.2;await run(0);
assert.equal(messages.filter(m=>m.body.reply_parameters).length,notices);
await run();assert.equal(messages.filter(m=>m.body.reply_parameters).length,notices+1);
assert(messages.at(-1).caption.includes('Agora: *M6.2*'));
notices++;
batch.properties.mag=6.5;await run(0);batch.properties.mag=6.2;await run(0);await run();
assert.equal(messages.filter(m=>m.body.reply_parameters).length,notices);
// Population arrives later: edit the same photo once, without a new alert/revision notice.
globalThis.__testExposure={status:'pending'};world.push(quake('late-population',6.4,'us',clock-10000));await run();
const latePhoto=messages.at(-1),lateID=nextID;assert.equal(latePhoto.method,'sendPhoto');
globalThis.__testExposure={status:'available',method:'pager',ranges:[{population:100},{population:10},{population:0}]};
count=messages.length;await run();assert.equal(messages.length,count+1);assert.equal(messages.at(-1).method,'editMessageMedia');assert.equal(Number(messages.at(-1).body.message_id),lateID);assert.equal(rendered.at(-1).imageExposure.ranges[0].population,100);
count=messages.length;await run();assert.equal(messages.length,count);delete globalThis.__testExposure;
// A layout migration never erases already available population on a slow refresh.
const migrating=JSON.parse(Array.from({length:storage.data.get('telegram-m6-sent-ids:chunks')},(_,i)=>storage.data.get('telegram-m6-sent-ids:part:'+i)).join(''));
const populationRoot=migrating.items.find(r=>r.id==='late-population');populationRoot.cardImageVersion='geo-impact-pop-v2';
storage.data.set('telegram-m6-sent-ids:chunks',1);storage.data.set('telegram-m6-sent-ids:part:0',JSON.stringify(migrating));object=new EarthquakeAlertDelivery({storage},env);
globalThis.__testExposure={status:'pending'};count=messages.length;await run();assert.equal(messages.length,count);
globalThis.__testExposure={status:'available',method:'pager',ranges:[{population:100},{population:10},{population:0}]};await run();assert.equal(messages.length,count+1);assert.equal(Number(messages.at(-1).body.message_id),lateID);delete globalThis.__testExposure;
// Large state remains readable after restart and never exceeds the DO single-value limit.
const state=JSON.parse(Array.from({length:storage.data.get('telegram-m6-sent-ids:chunks')},(_,i)=>storage.data.get('telegram-m6-sent-ids:part:'+i)).join(''));
assert(state.items.find(r=>r.id==='initial').messageId===original);
assert(state.items.find(r=>r.id==='us-alias').aliasOf==='initial');
kv.data.set('telegram-m6-sent-ids',JSON.stringify({items:Array.from({length:1000},(_,i)=>({id:'legacy-'+i,place:'x'.repeat(180)}))}));
const bigStorage=new Store();object=new EarthquakeAlertDelivery({storage:bigStorage},env);world=[];details.clear();await run();
assert(bigStorage.data.get('telegram-m6-sent-ids:chunks')>1);
object=new EarthquakeAlertDelivery({storage:bigStorage},env);await run();
console.log('PASS: revised photo and caption keep original ID; 6.6→6.3, same/cross-network estimates, small changes, below-M6 tracking, aftershocks, text fallback, idempotent edit retry, ambiguous notice suppression, restart/concurrency, chunked persistence. Telegram fully mocked.');
