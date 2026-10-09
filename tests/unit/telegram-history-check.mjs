import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let stamp=Date.parse('2026-10-01T03:06:00Z'),sends=0,queryFail=false,mode='ok';
const RealDate=Date;globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[stamp]))}static now(){return stamp}};
const kvData=new Map();
const kv={async get(k,type){const x=kvData.get(k)?.value;if(x==null)return null;if(type==='arrayBuffer')return new Uint8Array(x).buffer;return x},async put(k,value,opts={}){kvData.set(k,{value:structuredClone(value),metadata:opts.metadata})},async list({prefix}){return {keys:[...kvData].filter(([k])=>k.startsWith(prefix)).map(([name,x])=>({name,metadata:x.metadata})),list_complete:true}}};
class Store{constructor(){this.data=new Map();this.queue=Promise.resolve()}async get(k){return structuredClone(this.data.get(k))}async put(k,v){this.data.set(k,structuredClone(v))}async delete(k){this.data.delete(k)}transaction(fn){const p=this.queue.then(()=>fn(this));this.queue=p.catch(()=>{});return p}}
globalThis.fetch=async(url,opts)=>{
 if(String(url).includes('earthquake.usgs.gov')){if(queryFail)throw Error('query failed');return Response.json({features:[{id:'test',properties:{mag:5.4,place:'231 km WSW of Port McNeill, Canada',time:stamp-3600000,net:'us'},geometry:{coordinates:[-127,50,10]}}]})}
 if(String(url).includes('api.telegram.org')){sends++;if(mode==='timeout')throw Error('timeout');return Response.json({ok:mode==='ok',result:{message_id:42}},{status:mode==='ok'?200:400})}
 throw Error('Unexpected network call '+url);
};
const {default:worker,DailySummaryDelivery}=await import('data:text/javascript;base64,'+Buffer.from((await readFile(new URL('../../monitor-global-worker-7_7_0.js',import.meta.url),'utf8')).replace('"./cge-bulletins-worker.mjs"',JSON.stringify(new URL('../../cge-bulletins-worker.mjs',import.meta.url).href)).replace('"./summary-flags.mjs"', JSON.stringify(new URL('../../summary-flags.mjs', import.meta.url).href))
    .replace('"./summary-typography.mjs"',JSON.stringify(new URL('../../summary-typography.mjs',import.meta.url).href)).replace('"./weather-observations-worker.mjs"',JSON.stringify(new URL('../../weather-observations-worker.mjs',import.meta.url).href)).replace('"./official-weather-alerts-worker.mjs"',JSON.stringify(new URL('../../official-weather-alerts-worker.mjs',import.meta.url).href)).replace('"./seismic-image-data.mjs"',JSON.stringify(new URL('../../seismic-image-data.mjs',import.meta.url).href)).replace('"./tsunami-official-worker.mjs"',JSON.stringify(new URL('../../tsunami-official-worker.mjs',import.meta.url).href)).replace('"./population-exposure-worker.mjs"',JSON.stringify(new URL('../../population-exposure-worker.mjs',import.meta.url).href))).toString('base64'));
const objects=new Map();
const env={TTS_USAGE:kv,ADMIN_TOKEN:'test-admin',TELEGRAM_BOT_TOKEN:'fake',TELEGRAM_CHAT_ID:'fake'};
env.DAILY_SUMMARY={idFromName:day=>day,get:day=>{if(!objects.has(day))objects.set(day,new DailySummaryDelivery({storage:new Store()},env));return {fetch:url=>objects.get(day).fetch(new Request(url))}}};
const admin=path=>new Request('https://worker.test'+path,{headers:{'X-Admin-Token':'test-admin'}});
assert.equal((await worker.fetch(new Request('https://worker.test/telegram-history'),env)).status,401);
assert.equal((await worker.fetch(new Request('https://worker.test/telegram-history?token=test-admin'),env)).status,401);
const run=()=>worker.fetch(admin('/telegram-daily-summary'),env);
await Promise.all(Array.from({length:10},run));assert.equal(sends,1);
let history=await (await worker.fetch(admin('/telegram-history'),env)).json();
const row=history.daily.find(x=>x.day==='2026-09-30');assert.equal(row.status,'sent');assert.equal(row.attempts,1);assert.equal(row.hasPreview,true);
assert(row.events.some(x=>x.stage==='query'));assert(row.events.some(x=>x.stage==='sent'));
assert.equal(JSON.stringify(history).includes('test-admin'),false);assert.equal(JSON.stringify(history).includes('token'),false);
const preview=await worker.fetch(admin('/telegram-history-preview?day=2026-09-30'),env);assert.equal(preview.headers.get('content-type'),'image/png');assert((await preview.arrayBuffer()).byteLength>10000);assert.equal(sends,1);
assert.equal((await worker.fetch(admin('/telegram-history-preview?day=wrong'),env)).status,400);
stamp+=86400000;queryFail=true;
await run();assert.equal(sends,1);queryFail=false;await run();assert.equal(sends,2);
history=await (await worker.fetch(admin('/telegram-history'),env)).json();
assert.equal(history.daily.find(x=>x.day==='2026-10-01').attempts,2);
stamp+=86400000;mode='timeout';await run();assert.equal(sends,3);await run();assert.equal(sends,3);
history=await (await worker.fetch(admin('/telegram-history'),env)).json();assert.equal(history.daily.find(x=>x.day==='2026-10-02').status,'uncertain');
mode='ok';stamp+=12*3600000;await run();assert.equal(sends,3);
const key='telegram-history-m6:'+new Date().toISOString()+':'+crypto.randomUUID();
const alert={kind:'m6',at:Date.now(),status:'sent',mag:6.2,place:'Test region',events:[{at:Date.now(),stage:'sent'}]};
await kv.put(key,JSON.stringify(alert),{metadata:{kind:alert.kind,at:alert.at,status:alert.status,mag:alert.mag,place:alert.place}});
history=await (await worker.fetch(admin('/telegram-history'),env)).json();
assert.equal(history.alerts.length,1);
const detail=await (await worker.fetch(admin('/telegram-history-detail?key='+encodeURIComponent(key)),env)).json();
assert.equal(detail.record.mag,6.2);assert.equal(sends,3);
console.log('PASS: authorization, no URL tokens, concurrent send once, persistent attempt history, real PNG preview without sending, query retry, ambiguous timeout blocked, daytime blocked');

