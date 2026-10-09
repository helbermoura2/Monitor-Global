import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const workerURL = new URL('../../monitor-global-worker-7_7_0.js', import.meta.url);
let source = await readFile(workerURL, 'utf8');
source = source.replace(/from "(\.\/[^\"]+)"/g, (_, path) => 'from '+JSON.stringify(new URL(path, workerURL).href));
source = source.replaceAll('queryImageExposure(ev, env)', 'Promise.resolve({status: "unavailable"})');
source += '\nexport {runTelegramM6Alerts, telegramIsBrazil, telegramBrazilEvents};';
const {EarthquakeAlertDelivery, runTelegramM6Alerts, telegramIsBrazil, telegramBrazilEvents} = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
for (const [lat,lon] of [[-15.79,-47.88],[-8.05,-34.9],[-3.73,-38.53],[-23.55,-46.63],[-5.8,-35.2]]) assert(telegramIsBrazil(lat,lon));
for (const [lat,lon] of [[-17.8,-63.18],[-25.3,-57.6],[-34.6,-58.4],[-12.05,-77.04],[4.7,-74.07],[0,-40]]) assert(!telegramIsBrazil(lat,lon));
const now=Date.now();
const quake=(id,mag=1.9,lat=-15.79,lon=-47.88,time=now-60000,type='earthquake')=>({id,properties:{mag,place:'Brasília',time,type,status:'reviewed'},geometry:{coordinates:[lon,lat,10]}});
let feeds={USP:[],USGS:[],EMSC:[],GEOFON:[]},world=[],failed=new Set(),sendMode='ok',messages=[];
const text=features=>'#EventID|Time|Latitude|Longitude|Depth/km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType\n'+features.map(f=>[f.id,new Date(f.properties.time).toISOString().replace('Z',''),f.geometry.coordinates[1],f.geometry.coordinates[0],10,'USP','','','','ML',f.properties.mag,'',f.properties.place,f.properties.type].join('|')).join('\n');
globalThis.fetch=async(input,opts)=>{
 const url=new URL(input);
 if(url.hostname==='api.telegram.org'){
  const caption=opts.body instanceof FormData?opts.body.get('caption'):JSON.parse(opts.body).text;
  messages.push({caption,path:url.pathname});
  if(sendMode==='timeout')throw Error('simulated timeout');
  return Response.json({ok:sendMode==='ok',description:'simulated rejection'}, {status:sendMode==='ok'?200:429});
 }
 if (['server.arcgisonline.com','static-maps.yandex.ru'].includes(url.hostname)) return new Response('', {status:503});
 const provider=url.hostname==='moho.iag.usp.br'?'USP':url.hostname==='earthquake.usgs.gov'?'USGS':url.hostname==='www.seismicportal.eu'?'EMSC':'GEOFON';
 if(failed.has(provider))throw Error('simulated catalog outage');
 if(url.searchParams.has('minmagnitude'))return Response.json({features:world});
 assert.equal(url.searchParams.has('minmagnitude'),false);
 assert.equal(url.searchParams.get('minlatitude'),'-34');
 assert(Date.parse(url.searchParams.get('starttime'))<=Date.now()-71*3600000);
 return ['USP','GEOFON'].includes(provider)?new Response(text(feeds[provider])):Response.json({features:feeds[provider]});
};
class Store{data=new Map();async get(key){return structuredClone(this.data.get(key))}async put(key,value){this.data.set(key,structuredClone(value))}}
const storage=new Store(),kv=new Store();
const env={TELEGRAM_BOT_TOKEN:'test-fake-token',TELEGRAM_CHAT_ID:'test-channel',TTS_USAGE:kv};
let object=new EarthquakeAlertDelivery({storage},env);
env.EARTHQUAKE_ALERTS={idFromName:name=>name,get:()=>({fetch:request=>object.fetch(request)})};
const request=new Request('https://worker.test/telegram-m6-check');
const run=()=>runTelegramM6Alerts(request,env);
// Baseline silently absorbs old Brazilian records, preserves legacy M6 history.
await kv.put('telegram-m6-sent-ids',JSON.stringify({items:[{id:'known-global'}]}));
feeds.USP=[quake('existing')]; world=[quake('known-global',6.1,35,140)]; failed.add('GEOFON');
let result=await run();assert.equal(messages.length,0);assert.deepEqual(result.brazil.failedSources,['GEOFON']);
assert.equal(result.brazil.allMagnitudes,true);
// Newly registered low and zero magnitudes, including a publication delayed 32 hours.
feeds.USP.push(quake('late',1.2,-15.79,-47.88,now-32*3600000),quake('zero',0,-8.05,-34.9,now-180000));
feeds.USGS=[quake('small',1.9,-23.55,-46.63),quake('neighbor',4.2,-25.3,-57.6),quake('blast',2.2,-15.79,-47.88,now,'quarry blast'),quake('missing',null)];
world.push(quake('world-five',5.9,35,140),quake('world-six',6.2,35,140,now-300000));
// fetchUsgsM6Recent filters world-five itself, even with a malformed upstream response.
result=await run();assert.equal(messages.length,4);assert.equal(result.sent.length,4);
assert(messages.some(m=>m.caption.includes('M0.0')));assert(messages.some(m=>m.caption.includes('M1.9')));
assert(messages.filter(m=>m.caption.includes('Sismo no Brasil')).length===3);
// Restart and ten concurrent cron/manual calls cannot send the records again.
object=new EarthquakeAlertDelivery({storage},env);
await Promise.all(Array.from({length:10},run));assert.equal(messages.length,4);
// Same quake from another provider is one notification; nearby distinct USP quakes survive.
feeds.EMSC=[quake('alias',1.9,-23.55,-46.63)];
feeds.USP.push(quake('separate-a',2,-5.8,-35.2,now-20000),quake('separate-b',2,-5.8,-35.2,now-10000));
await run();assert.equal(messages.length,6);
// A recovering source establishes its own baseline rather than dumping its old backlog.
failed.delete('GEOFON');feeds.GEOFON=[quake('recovered-old',2.1,-3.73,-38.53,now-3600000)];
await run();assert.equal(messages.length,6);
feeds.GEOFON.push(quake('recovered-new',1,-3.73,-38.53,now-120000));
await run();assert.equal(messages.length,7);
// M6 in Brazil is included once although it exists in both USGS queries.
const brazilSix=quake('brazil-six',6,-15.79,-47.88,now-900000);
world.push(brazilSix);feeds.USGS.push(brazilSix);await run();assert.equal(messages.length,8);
// Ambiguous timeout is never followed by a duplicate text or automatic resend.
sendMode='timeout';feeds.USP.push(quake('uncertain',1.5,-8.05,-34.9,now-600000));
await run();assert.equal(messages.length,9);await run();assert.equal(messages.length,9);
assert([...kv.data.values()].some(v=>String(v).includes('"status":"uncertain"')));
// Definite Telegram rejection is retried on a later poll, not silently discarded.
sendMode='rejected';feeds.USP.push(quake('retry',1.4,-8.05,-34.9,now-1200000));
await run();assert.equal(messages.length,11);sendMode='ok';await run();assert.equal(messages.length,12);
const emsc = quake('emsc-real',2.1); delete emsc.properties.type; delete emsc.properties.place; emsc.properties.evtype='ke'; emsc.properties.flynn_region='BRAZIL'; emsc.geometry.coordinates[2]=-10;
assert.equal(telegramBrazilEvents({features:[emsc]},'EMSC','json')[0].depth,10);
assert.equal(telegramBrazilEvents({features:[emsc]},'EMSC','json')[0].place,'BRAZIL');
emsc.properties.evtype='kx'; assert.equal(telegramBrazilEvents({features:[emsc]},'EMSC','json').length,0);
assert.equal(telegramBrazilEvents({features:[quake('bad',null)]},'USGS','geojson').length,0);
assert.equal(telegramBrazilEvents('id|invalid|x|y|||||||1||Brasil|earthquake','USP','text').length,0);
console.log('PASS: national boundaries, no minimum magnitude, all four sources, silent baseline, late publication, neighbor/blast rejection, preserved global M6, no duplicate Brazil M6, provider recovery, durable restart/concurrency, timeout suppression and rejection retry. All Telegram requests mocked.');
