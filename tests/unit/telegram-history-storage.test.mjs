import test from 'node:test';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';
import {telegramHistoryStorage,persistentHistoryGet,persistentHistoryList,prunePersistentHistory,handlePersistentHistory} from '../../telegram-history-storage.mjs';
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const key=()=> 'telegram-history-m6:'+new Date().toISOString()+':'+crypto.randomUUID();
function store(data=new Map()){return {data,get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v)),delete:async k=>data.delete(k),list:async({prefix='',limit=1000,startAfter=''}={})=>new Map([...data].filter(([k])=>k.startsWith(prefix)&&k>startAfter).sort(([a],[b])=>a.localeCompare(b)).slice(0,limit)),setAlarm:async()=>{}};}
test('new alerts, summary previews and sent markers survive restart without KV writes',async()=>{
 const s=store();let writes=0,reads=0;const legacy={get:async()=>{reads++;return null;},put:async()=>{writes++;throw Error('KV exhausted');}};
 const k=key(),record=JSON.stringify({kind:'m6',place:'São Paulo 🌎'.repeat(15000),status:'sent'}),a=telegramHistoryStorage(s,legacy),summary=telegramHistoryStorage(s,legacy,{summary:true});await a.put(k,record,{metadata:{status:'sent',mag:6.1}});
 const bytes=new Uint8Array(180000).fill(123);await summary.put('telegram-history-preview:2026-10-16',bytes);await summary.put('telegram-daily-summary-sent','{"day":"2026-10-16"}');
 const restarted=store(s.data);assert.equal(await persistentHistoryGet(restarted,k),record);assert.deepEqual(new Uint8Array(await persistentHistoryGet(restarted,'telegram-history-preview:2026-10-16','arrayBuffer')),bytes);assert.equal((await persistentHistoryList(restarted)).keys[0].metadata.mag,6.1);assert.equal(writes,0);assert.equal(reads,0);
 const response=await handlePersistentHistory(new Request('https://internal/__telegram-history/get?key='+encodeURIComponent(k)),restarted);assert.equal((await response.json()).record.status,'sent');
});
test('legacy history remains readable, corrupt persistent chunks fail instead of returning old data',async()=>{
 const s=store(),k=key();let old=0;const wrapper=telegramHistoryStorage(s,{get:async()=>{old++;return 'old';}});assert.equal(await wrapper.get(k),'old');await wrapper.put(k,'current');s.data.delete('tg-history-store:part:'+k+':0');await assert.rejects(wrapper.get(k),/incompleto/);assert.equal(old,1);
});
test('history pages deduplicate by stable keys and expire chunks without touching delivery control',async()=>{
 const s=store(),a=telegramHistoryStorage(s,{});await s.put('delivery',{status:'sent'});const keys=Array.from({length:3},key);
 for(const k of keys)await a.put(k,'record',{metadata:{status:'sent'},expirationTtl:60});
 const page=await persistentHistoryList(s,{limit:2});assert.equal(page.keys.length,2);assert.equal(page.list_complete,false);assert.equal((await persistentHistoryList(s,{limit:2,cursor:page.cursor})).keys.length,1);
 await prunePersistentHistory(s,Date.now()+61000);assert.equal((await persistentHistoryList(s)).keys.length,0);assert.equal([...s.data.keys()].filter(k=>k.startsWith('tg-history-store:part:')).length,0);assert.deepEqual(await s.get('delivery'),{status:'sent'});
});

test('real Worker history and preview remain readable when legacy KV is unavailable',async()=>{
 const {readFile}=await import('node:fs/promises');const source=(await readFile(new URL('../../monitor-global-worker-7_7_0.js',import.meta.url),'utf8')).replace(/from "(\.\/[^"\n]+)"/g,(_,p)=>'from '+JSON.stringify(new URL('../../'+p.slice(2),import.meta.url).href));const {default:worker,EarthquakeAlertDelivery,DailySummaryDelivery}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const storage=store(),daily=store(),k=key(),record={kind:'m6',status:'sent',mag:6.1,at:Date.now()};await telegramHistoryStorage(storage,{}).put(k,JSON.stringify(record),{metadata:record});const png=new Uint8Array(100000).fill(23);await telegramHistoryStorage(daily,{}, {summary:true}).put('telegram-history-preview:2026-10-16',png);
 const env={ADMIN_TOKEN:'admin',TTS_USAGE:{get:async()=>{throw Error('KV unavailable');},list:async()=>{throw Error('KV unavailable');},put:async()=>{throw Error('No KV write');}}};
 const alert=new EarthquakeAlertDelivery({storage},env),summary=new DailySummaryDelivery({storage:daily},env);
 env.EARTHQUAKE_ALERTS={idFromName:n=>n,get:()=>({fetch:r=>alert.fetch(new Request(r))})};env.DAILY_SUMMARY={idFromName:n=>n,get:()=>({fetch:r=>summary.fetch(new Request(r))})};
 const req=p=>new Request('https://worker.test'+p,{headers:{'X-Admin-Token':'admin'}});
 const detail=await worker.fetch(req('/telegram-history-detail?key='+encodeURIComponent(k)),env);assert.equal(detail.status,200);assert.equal((await detail.json()).record.mag,6.1);
 const list=await worker.fetch(req('/telegram-history'),env);assert.equal(list.status,200);const body=await list.json();assert.equal(body.alerts.length,1);assert.equal(body.legacyUnavailable,true);
 const image=await worker.fetch(req('/telegram-history-preview?day=2026-10-16'),env);assert.equal(image.status,200);assert.equal((await image.arrayBuffer()).byteLength,png.length);
 assert.equal((await worker.fetch(new Request('https://worker.test/telegram-history'),env)).status,401);
});
