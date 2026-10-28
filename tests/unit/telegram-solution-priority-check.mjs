import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const workerURL = new URL('../../monitor-global-worker-7_7_0.js', import.meta.url);
let source = await readFile(workerURL, 'utf8');
source = source.replace(/from "(\.\/[^\"]+)"/g, (_, path) => 'from '+JSON.stringify(new URL(path, workerURL).href));
// Rendering is separately tested; capture the revised event supplied to the card generator.
source = source.replace('async function renderAlertCardPng(ev) {', 'async function renderAlertCardPng(ev) { ev.imageTsunami ||= await queryImageTsunami(ev); globalThis.rendered.push(structuredClone(ev)); return globalThis.__testHdPng.slice();');
source = source.replaceAll('queryImageExposure(ev, env)', 'Promise.resolve(ev.id === "late-population" ? (globalThis.__testExposure || {status: "unavailable"}) : {status: "unavailable"})');
source = source.replaceAll('queryImageShaking(ev)', 'Promise.resolve(ev.id === "late-population" ? (globalThis.__testShaking || {status: "unavailable"}) : {status: "unavailable"})');
source += '\nexport {runTelegramM6Alerts, telegramFlushRevisionNotices};';
const {EarthquakeAlertDelivery, runTelegramM6Alerts, telegramFlushRevisionNotices} = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
globalThis.rendered=[];
globalThis.__testHdPng=new Uint8Array(48);
__testHdPng.set([137,80,78,71,13,10,26,10]);
new DataView(__testHdPng.buffer).setUint32(16,1080);
new DataView(__testHdPng.buffer).setUint32(20,1920);
const now=Date.now(), messages=[], queried=[];
let clock=now; Date.now=()=>clock;
const quake=(id,mag,net='pt',time=now-60000)=>({id,properties:{mag,net,place:'Vanuatu',time,type:'earthquake',status:'reviewed'},geometry:{coordinates:[168.18,-15.48,10]}});
let world=[],details=new Map(),editMode='ok',photoMode='ok',replyMode='ok',nextID=100;
globalThis.fetch=async(input,options)=>{
 const url=new URL(input);
 // These regressions isolate USGS/Brazil; supplemental global catalogs have their own fixtures.
 if(url.searchParams.has('minmagnitude')&&!url.searchParams.has('minlatitude')&&['www.seismicportal.eu','geofon.gfz-potsdam.de'].includes(url.hostname))return url.searchParams.get('format')==='text'?new Response('#EventID|Time\n'):Response.json({features:[]});
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
class Store {
 data=new Map();
 async get(key){if(Array.isArray(key))return new Map(key.filter(k=>this.data.has(k)).map(k=>[k,structuredClone(this.data.get(k))]));return structuredClone(this.data.get(key));}
 async put(key,value){if(typeof key==='object'){assert(Object.keys(key).length<=128);for(const [k,v] of Object.entries(key))await this.put(k,v);return;}assert(Buffer.byteLength(String(value))<2*1024*1024,'Chave+valor combinados devem caber no limite de 2 MB por linha das classes SQLite de Durable Object');this.data.set(key,structuredClone(value));}
 async delete(key){for(const k of Array.isArray(key)?key:[key])this.data.delete(k);}
}
const storage=new Store(),kv=new Store();
const env={TELEGRAM_BOT_TOKEN:'fake-test-token',TELEGRAM_CHAT_ID:-100123,TTS_USAGE:kv};
let object=new EarthquakeAlertDelivery({storage},env);
env.EARTHQUAKE_ALERTS={idFromName:name=>name,get:name=>({fetch:request=>name==='kv-operation-metrics-v1'?Promise.resolve(Response.json({ok:true})):object.fetch(request)})};
const run=(advance=31000)=>{clock+=advance;return runTelegramM6Alerts(new Request('https://worker.test/telegram-m6-check'),env)};

const seismic=quake('us6000u3jl',6.3,'us'),rapid=quake('pt26293000',6.6,'pt');
Object.assign(seismic.properties,{updated:200,magType:'mww',ids:',us6000u3jl,pt26293000,'});Object.assign(rapid.properties,{updated:100,magType:'Mi'});
world=[rapid,seismic];await run();
assert.equal(messages.length,1);assert.equal(messages[0].method,'sendPhoto');assert(messages[0].caption.includes('M6,3'));
// Missing USGS core data and changing PT estimates must not edit the primary card.
for(let i=0;i<6;i++){world=i%2?[rapid,seismic]:[rapid];rapid.properties.mag=6.6+i/10;rapid.properties.updated=300+i;await run();}
assert.equal(messages.length,1,'Secondary PT estimates cannot repeatedly edit or announce a revision');
object=new EarthquakeAlertDelivery({storage},env);await run();assert.equal(messages.length,1,'Policy survives object eviction/restart');
// A real newer US revision is still delivered once, including a downward revision.
world=[rapid,{...seismic,properties:{...seismic.properties,mag:6.2,updated:400}}];await run();assert.equal(messages.length,2);assert.equal(messages.at(-1).method,'editMessageMedia');assert(messages.at(-1).caption.includes('Atual: *M6,2*'));
await run();assert.equal(messages.length,3);assert.equal(messages.at(-1).method,'sendMessage');assert(messages.at(-1).caption.includes('Agora: *M6,2*'));
world=[rapid,seismic];await run();await run();assert.equal(messages.length,3,'An older US snapshot must not undo the newer revision');
// A queued notice persisted by the old code must not publish a rejected PT switch.
const before={id:'us6000u3jl',provider:'USGS',source:'US',mag:6.2,reviewed:true},after={...before,id:'pt26293000',source:'PT',mag:6.6};
const root={...before,currentEvent:before,messageId:101,pendingNotice:{before,after,at:clock-60000}};
await telegramFlushRevisionNotices(new Request('https://worker.test/telegram-m6-check'),env,[root]);assert.equal(messages.length,3);assert.equal(root.pendingNotice,undefined);
console.log('PASS: one initial photo, PT/US ordering, PT changes/outages/restart stay silent, genuine US revision delivered once, stale US snapshot ignored, old queued PT notice suppressed. Telegram entirely mocked.');
