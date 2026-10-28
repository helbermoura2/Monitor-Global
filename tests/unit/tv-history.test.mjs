import test from 'node:test';import assert from 'node:assert/strict';
import {brasiliaDay,historySnapshot,handleTvHistory as realHandleTvHistory} from '../../worker/tv-history.mjs';
const handleTvHistory=(request,options)=>realHandleTvHistory(request,{supplemental:async()=>({sources:[]}),...options});
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
 const request=new Request('https://test/tv-alerts?policy=telegram-v1&view=daily');
 const first=await handleTvHistory(request,{regional:async()=>({features:[]}),view:'daily',now,cache,fetcher});assert.equal(first.status,200);
 await handleTvHistory(request,{regional:async()=>({features:[]}),view:'daily',now:now+1000,cache,fetcher});assert.equal(calls,1);
 const failed=await handleTvHistory(request,{regional:async()=>({features:[]}),view:'daily',now:now+300001,cache,fetcher:async()=>{throw Error('offline');}});assert.equal(failed.status,503);assert.equal(failed.headers.get('Cache-Control'),'no-store');
 assert.equal((await handleTvHistory(new Request(request,{method:'POST'}),{view:'daily',now,cache,fetcher})).status,405);assert.equal(calls,1);
 const tomorrow=Date.parse('2026-10-26T03:00:00Z');
 const next=await handleTvHistory(request,{regional:async()=>({features:[]}),view:'daily',now:tomorrow,cache,fetcher:async url=>{calls++;assert.equal(url.searchParams.get('starttime'),'2026-10-26T03:00:00.000Z');return Response.json({features:[]});}});
 assert.deepEqual((await next.json()).alerts,[]);assert.equal(calls,2);
});
test('simultaneous history requests share one provider lookup even without Cache API',async()=>{
 let calls=0,finish;const gate=new Promise(resolve=>finish=resolve);
 const fetcher=async()=>{calls++;await gate;return Response.json({features:[]});};
 const requests=Array.from({length:12},()=>handleTvHistory(new Request('https://test/tv-alerts?policy=telegram-v1&view=replay'),{regional:async()=>({features:[]}),view:'replay',now,cache:null,fetcher}));
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(calls,1);finish();
 const responses=await Promise.all(requests);assert(responses.every(r=>r.status===200));
});
test('midnight summary includes only the previous Brasília day, with an exclusive end boundary',async()=>{
 const midnight=Date.parse('2026-10-26T03:00:00Z'),start=midnight-86400000;
 const features=[quake('before',9,start-1),quake('first',6,start),quake('last',5,midnight-1),quake('today',8,midnight)];
 const summary=historySnapshot(features,'completed',midnight);assert.equal(summary.day,'2026-10-25');assert.equal(summary.complete,true);
 assert.deepEqual(summary.alerts.map(a=>a.id),['USGS:first','USGS:last']);
 let calls=0;const r=await handleTvHistory(new Request('https://test/tv-alerts?policy=telegram-v1&view=completed'),{regional:async()=>({features:[]}),view:'completed',now:midnight,cache:null,fetcher:async url=>{
  calls++;assert.equal(url.searchParams.get('starttime'),'2026-10-25T03:00:00.000Z');assert.equal(url.searchParams.get('endtime'),'2026-10-26T02:59:59.999Z');assert.equal(url.searchParams.get('limit'),'5');return Response.json({features});
 }});assert.equal(r.status,200);assert.equal((await r.json()).complete,true);assert.equal(calls,1);
 const recovery=historySnapshot(features,'completed',midnight+14*3600000);assert.equal(recovery.day,'2026-10-25');assert.deepEqual(recovery.alerts.map(a=>a.id),['USGS:first','USGS:last']);
});

test('summary and recovered replay include small Brazilian events and merge cross-network duplicates',async()=>{
 const local={id:'USP-local',provider:'USP',brazil:true,properties:{mag:1.2,time:now-1000,updated:now,type:'earthquake',place:'São Paulo, Brasil',net:'USP'},geometry:{coordinates:[-46.6,-23.5,3]}};
 const regional=async()=>({features:[local],catalogs:{USP:true,USGS:true,USGS_BR:true,EMSC:false,GEOFON:true}});
 const request=new Request('https://test/tv-alerts?policy=telegram-v1&view=replay');
 const replay=await(await handleTvHistory(request,{view:'replay',now,cache:null,regional,fetcher:async()=>Response.json({features:[quake('global',6.4,now-60000)]})})).json();
 assert.equal(replay.alerts.length,1);assert.equal(replay.alerts[0].magnitude,1.2);assert.equal(replay.alerts[0].countryCode,'br');
 const duplicate={...local,id:'us-local',provider:'USGS',properties:{...local.properties,net:'US'}};
 const summary=await(await handleTvHistory(request,{view:'daily',now,cache:null,regional,fetcher:async url=>{assert.equal(url.searchParams.get('minmagnitude'),'0.1');return Response.json({features:[duplicate]});}})).json();
 assert.equal(summary.alerts.length,1);assert.equal(summary.alerts[0].magnitude,1.2);assert.equal(summary.sources.catalogs.EMSC,false);
});

test('replay and daily summary include a supplemental global M6+ absent from the USGS M6 catalog',async()=>{
 const supplemental=async()=>({sources:[{provider:'GEOFON',ok:true,events:[{id:'GEOFON-gfz',provider:'GEOFON',globalMultiSource:true,source:'GEOFON',mag:6.09,timeIso:new Date(now-30000).toISOString(),lat:-14,lon:165,depth:10,place:'Vanuatu'}]}]});
 for(const view of ['replay','daily']){
  const body=await(await handleTvHistory(new Request('https://test/tv-alerts?policy=telegram-v1&view='+view),{view,now,cache:null,supplemental,regional:async()=>({features:[],catalogs:{USGS:true}}),fetcher:async()=>Response.json({features:[quake('older',6,now-3600000)]})})).json();
  assert.equal(body.alerts[0].provider,'GEOFON');assert.equal(body.alerts[0].magnitude,6.09);assert.equal(body.sources.catalogs.GEOFON_GLOBAL,true);
 }
});
