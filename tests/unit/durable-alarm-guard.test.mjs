import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const source=(await readFile(new URL('../../monitor-global-worker-7_7_0.js',import.meta.url),'utf8')).replace(/from "(\.\/[^"\n]+)"/g,(_,p)=>'from '+JSON.stringify(new URL('../../'+p.slice(2),import.meta.url).href));
const {EarthquakeAlertDelivery}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const oldNow=Date.now,oldFetch=globalThis.fetch,oldError=console.error;
afterEach(()=>{Date.now=oldNow;globalThis.fetch=oldFetch;console.error=oldError;});
function disk(){const values=new Map(),alarms=[],writes=[];return {values,alarms,writes,get:async key=>structuredClone(values.get(key)),put:async(key,value)=>{writes.push(key);values.set(key,structuredClone(value));},delete:async key=>values.delete(key),list:async()=>new Map(),setAlarm:async at=>alarms.push(at),getAlarm:async()=>alarms.at(-1)||null,deleteAlarm:async()=>alarms.push(null)};}
const object=storage=>new EarthquakeAlertDelivery({storage},{});
function clock(){const now=Date.parse('2026-10-18T05:00:00Z');Date.now=()=>now;console.error=()=>{};globalThis.fetch=async()=>{throw Error('Cleanup must not fetch feeds or send alerts');};return now;}
test('healthy cleanup does not create a periodic alarm or write a zero counter on every invocation',async()=>{
 clock();const storage=disk(),item=object(storage);await item.alarm();await item.alarm();assert.deepEqual(storage.alarms,[]);assert.deepEqual(storage.writes,[]);
});
test('consecutive cleanup failures persist across restarts, use requested backoff, and stop at ten',async()=>{
 const now=clock(),storage=disk();storage.list=async()=>{throw Error('SQLite unavailable');};
 const delays=[5,15,30,60,120,120,120,120,120];
 for(let count=1;count<=10;count++){
  await assert.doesNotReject(object(storage).alarm());assert.equal(storage.values.get('consecutiveFailures'),count);
  assert.equal(storage.alarms.at(-1),count===10?null:now+delays[count-1]*60000);
 }
});
test('a successful cleanup resets the counter and preserves the existing expiry schedule after reactivation',async()=>{
 const now=clock(),storage=disk();storage.values.set('consecutiveFailures',10);
 storage.values.set('population-state',{until:now+120000,value:{status:'pending'}});
 await object(storage).alarm();assert.equal(storage.values.get('consecutiveFailures'),0);assert.equal(storage.alarms.at(-1),now+121000);assert.equal(storage.alarms.length,1);
});
test('ten failures cancel an alarm scheduled by an earlier successful cleanup helper',async()=>{
 const now=clock(),storage=disk();storage.values.set('consecutiveFailures',9);
 storage.list=async()=>new Map([['tg-history-store:meta:existing',{until:now+3600000,parts:1}]]);
 const read=storage.get;storage.get=async key=>{if(key==='population-state')throw Error('storage failure');return read(key);};
 await object(storage).alarm();assert(storage.alarms.includes(now+3601000));assert.equal(storage.alarms.at(-1),null);assert.equal(storage.values.get('consecutiveFailures'),10);
});
test('unavailable counter storage uses the two-hour ceiling and scheduling failure does not escape into native retries',async()=>{
 const now=clock(),storage=disk();storage.get=async()=>{throw Error('quota exceeded');};storage.put=async()=>{throw Error('quota exceeded');};
 await assert.doesNotReject(object(storage).alarm());assert.equal(storage.alarms.at(-1),now+7200000);
 storage.setAlarm=async()=>{throw Error('quota exceeded');};await assert.doesNotReject(object(storage).alarm());
});
test('cleanup uses the same queue as requests so concurrent alarms cannot lose a failure increment',async()=>{
 clock();const storage=disk();let release,entered=0;storage.list=async()=>{entered++;if(entered===1)await new Promise(resolve=>release=resolve);throw Error('storage failure');};
 const item=object(storage),first=item.alarm(),second=item.alarm();while(!release)await new Promise(resolve=>setImmediate(resolve));assert.equal(entered,1);release();await Promise.all([first,second]);assert.equal(storage.values.get('consecutiveFailures'),2);assert.equal(entered,2);
});
