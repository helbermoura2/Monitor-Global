import test from 'node:test';import assert from 'node:assert/strict';
import {brasiliaDay,historySnapshot,handleTvHistory} from '../../worker/tv-history.mjs';
const now=Date.parse('2026-10-25T22:00:00Z');
const quake=(id,mag,time)=>({id,properties:{mag,time,updated:time,type:'earthquake',place:'Vanuatu'},geometry:{coordinates:[165,-14,10]}});
test('daily ranking uses Brasília midnight, largest magnitude first and at most five, including events older than six hours',()=>{
 const input=[quake('yesterday',9,Date.parse('2026-10-25T02:59:59Z')),...[3,6,5,4,7,2.6].map((mag,i)=>quake('q'+i,mag,Date.parse('2026-10-25T03:10:00Z')+i*1000))];
 const body=historySnapshot(input,'daily',now);assert.equal(body.day,'2026-10-25');assert.deepEqual(body.alerts.map(a=>a.magnitude),[7,6,5,4,3]);assert.equal(body.alerts[0].eventTime,Date.parse('2026-10-25T03:10:00Z')+4000);
 assert.equal(brasiliaDay(Date.parse('2026-10-25T02:59:59Z')),'2026-10-24');assert.equal(brasiliaDay(Date.parse('2026-10-25T03:00:00Z')),'2026-10-25');
});
test('replay recovers the newest M6+ origin within 72h, not the largest or most recently updated old origin',()=>{
 const body=historySnapshot([quake('large',8,now-48*3600000),quake('new',6.1,now-12*3600000),quake('small',5.9,now-1000),quake('old',9,now-73*3600000)],'replay',now);
 assert.deepEqual(body.alerts.map(a=>a.id),['USGS:new']);assert.equal(body.sources.tsunami,false);assert.equal(body.alerts[0].tsunamiSummary,'');
});
test('history is shared/cacheable, rolls over at local midnight, and outages remain explicit',async()=>{
 const storage=new Map(),cache={match:async key=>storage.get(key.url)?.clone(),put:async(key,value)=>storage.set(key.url,value)};let calls=0;
 const fetcher=async url=>{calls++;assert.equal(url.searchParams.get('limit'),'5');assert.equal(url.searchParams.get('starttime'),'2026-10-25T03:00:00.000Z');return Response.json({features:[quake('test',3,now-1000)]});};
 const request=new Request('https://test/tv-alerts?view=daily');
 const first=await handleTvHistory(request,{view:'daily',now,cache,fetcher});assert.equal(first.status,200);
 await handleTvHistory(request,{view:'daily',now:now+1000,cache,fetcher});assert.equal(calls,1);
 const failed=await handleTvHistory(request,{view:'daily',now:now+300001,cache,fetcher:async()=>{throw Error('offline');}});assert.equal(failed.status,503);assert.equal(failed.headers.get('Cache-Control'),'no-store');
 assert.equal((await handleTvHistory(new Request(request,{method:'POST'}),{view:'daily',now,cache,fetcher})).status,405);assert.equal(calls,1);
 const tomorrow=Date.parse('2026-10-26T03:00:00Z');
 const next=await handleTvHistory(request,{view:'daily',now:tomorrow,cache,fetcher:async url=>{calls++;assert.equal(url.searchParams.get('starttime'),'2026-10-26T03:00:00.000Z');return Response.json({features:[]});}});
 assert.deepEqual((await next.json()).alerts,[]);assert.equal(calls,2);
});
test('simultaneous history requests share one provider lookup even without Cache API',async()=>{
 let calls=0,finish;const gate=new Promise(resolve=>finish=resolve);
 const fetcher=async()=>{calls++;await gate;return Response.json({features:[]});};
 const requests=Array.from({length:12},()=>handleTvHistory(new Request('https://test/tv-alerts?view=replay'),{view:'replay',now,cache:null,fetcher}));
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(calls,1);finish();
 const responses=await Promise.all(requests);assert(responses.every(r=>r.status===200));
});
test('midnight summary includes only the previous Brasília day, with an exclusive end boundary',async()=>{
 const midnight=Date.parse('2026-10-26T03:00:00Z'),start=midnight-86400000;
 const features=[quake('before',9,start-1),quake('first',6,start),quake('last',5,midnight-1),quake('today',8,midnight)];
 const summary=historySnapshot(features,'completed',midnight);assert.equal(summary.day,'2026-10-25');assert.equal(summary.complete,true);
 assert.deepEqual(summary.alerts.map(a=>a.id),['USGS:first','USGS:last']);
 let calls=0;const r=await handleTvHistory(new Request('https://test/tv-alerts?view=completed'),{view:'completed',now:midnight,cache:null,fetcher:async url=>{
  calls++;assert.equal(url.searchParams.get('starttime'),'2026-10-25T03:00:00.000Z');assert.equal(url.searchParams.get('endtime'),'2026-10-26T02:59:59.999Z');assert.equal(url.searchParams.get('limit'),'5');return Response.json({features});
 }});assert.equal(r.status,200);assert.equal((await r.json()).complete,true);assert.equal(calls,1);
 const recovery=historySnapshot(features,'completed',midnight+14*3600000);assert.equal(recovery.day,'2026-10-25');assert.deepEqual(recovery.alerts.map(a=>a.id),['USGS:first','USGS:last']);
});
