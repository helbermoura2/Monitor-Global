import test from 'node:test';import assert from 'node:assert/strict';
import {globalEvents,chooseGlobalSolution,consolidateGlobalEvents,createGlobalSupplementCollector} from '../../worker/global-seismic-data.mjs';
const now=Date.parse('2026-10-28T03:20:00Z'),time=new Date(now-60000).toISOString();
const feature=(mag=5.6)=>({id:'20261028_0000049',properties:{mag,time,source_id:'2081625',flynn_region:'VANUATU',lastupdate:new Date(now-30000).toISOString(),evtype:'ke'},geometry:{coordinates:[165.8,-14.06,-10]}});
const text=(mag=6.09,id='gfz2026vciw')=>'#EventID|Time|Latitude|Longitude|Depth/km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType\n'+[id,time,-14.06,165.8,10,'','','','','mb',mag,'','Vanuatu Islands','earthquake'].join('|');
const report=(provider,mag=6,id=provider)=>({id,provider,source:provider==='USGS'?'US':provider,mag,timeIso:time,lat:-14.06,lon:165.8,depth:10,reviewed:true});
test('actual Vanuatu formats preserve agency, raw magnitude, ID and depth; do not invent zeros',()=>{
 const [g]=globalEvents(text(),'GEOFON',now),[e]=globalEvents({features:[feature()]},'EMSC',now);assert.equal(g.mag,6.09);assert.equal(g.provider,'GEOFON');assert.equal(g.id,'GEOFON-gfz2026vciw');assert.equal(e.mag,5.6);assert.equal(e.depth,10);assert.equal(e.providerEventId,'2081625');assert(!e.brazil);
 const missing=feature();missing.properties.mag=null;assert.deepEqual(globalEvents({features:[missing]},'EMSC',now),[]);
 const brazil=feature(6);brazil.geometry.coordinates=[-47,-15,10];assert.deepEqual(globalEvents({features:[brazil]},'EMSC',now),[]);
 const blast=feature(6);blast.properties.evtype='qb';assert.deepEqual(globalEvents({features:[blast]},'EMSC',now),[]);
 assert.throws(()=>globalEvents({},'EMSC',now));assert.throws(()=>globalEvents('not a catalog','GEOFON',now));
});
test('any qualifying agency can trigger, but selection is stable and never chooses the largest number by default',()=>{
 assert.equal(chooseGlobalSolution([report('USGS',5.6),report('GEOFON',6.09),report('EMSC',6.3)]).provider,'GEOFON');
 assert.equal(chooseGlobalSolution([report('USGS',6),report('GEOFON',6.2)]).provider,'USGS');
 assert.equal(chooseGlobalSolution([report('USGS',5.9),{...report('USGS',6.6,'rapid'),source:'PT'}]).mag,5.9,'reviewed seismic solution supersedes rapid tsunami estimate from the same agency');
 const grouped=consolidateGlobalEvents([report('USGS',5.6),report('GEOFON',6.09),report('EMSC',5.6)]);assert.equal(grouped.length,1);assert.equal(grouped[0].provider,'GEOFON');assert.equal(grouped[0].agencyEstimates.length,3);
 const replica={...report('GEOFON',6,'second'),timeIso:new Date(now-60000+38*60000).toISOString()};assert.equal(consolidateGlobalEvents([report('USGS'),replica]).length,2);
 const adjacent={...report('USGS',6,'second'),timeIso:new Date(now-50000).toISOString()};assert.equal(consolidateGlobalEvents([report('USGS'),adjacent,report('GEOFON')]).length,3,'ambiguous nearby quakes must not be merged');
});
test('shared cache deduplicates concurrent TV/Telegram reads, retains failed source without fake freshness and recovers',async()=>{
 let at=now,calls=0,fail=false;const stored=new Map(),cache={match:async k=>stored.get(k.url)?.clone(),put:async(k,v)=>stored.set(k.url,v.clone())};
 const fetcher=async input=>{calls++;const u=new URL(input);assert.equal(u.searchParams.get('minmagnitude'),'5.5');if(fail)throw Error('offline');return u.hostname.includes('seismicportal')?Response.json({features:[feature()]}):new Response(text());};
 const create=()=>createGlobalSupplementCollector({fetcher,clock:()=>at,cache:()=>cache});let read=create();const values=await Promise.all([read(),read(),read()]);assert.equal(calls,2);assert(values.every(v=>v.failedSources.length===0));
 read=create();await read();assert.equal(calls,2,'cold instance reuses edge response');
 at+=61000;fail=true;const stale=await read();assert.equal(calls,4);assert.equal(stale.failedSources.length,2);assert(stale.sources.every(s=>s.events.length===1));await read();assert.equal(calls,4,'failed sources back off');read=create();assert.equal((await read()).failedSources.length,2);assert.equal(calls,4,'negative cache also survives a cold instance');
 at+=61000;fail=false;assert.equal((await read()).failedSources.length,0);assert.equal(calls,6);
});
test('tracked GEOFON revisions below catalog threshold are queried by native ID with bounded fan-out',async()=>{
 const urls=[];const read=createGlobalSupplementCollector({clock:()=>now,cache:()=>null,fetcher:async input=>{const u=new URL(input);urls.push(u);return u.hostname.includes('seismicportal')?Response.json({features:[]}):new Response(u.searchParams.has('eventid')?text(5.2):'#EventID|Time\n');}});
 const tracked=[{...report('GEOFON',6.1,'GEOFON-gfz2026vciw'),providerEventId:'gfz2026vciw'}];const result=await read({tracked});assert.equal(urls.length,3);assert(urls.some(u=>u.searchParams.get('eventid')==='gfz2026vciw'));assert.equal(result.sources.find(s=>s.provider==='GEOFON').events[0].mag,5.2);
});
test('malformed and oversized responses are unavailable, not healthy empty catalogs',async()=>{
 const read=createGlobalSupplementCollector({clock:()=>now,cache:()=>null,fetcher:async input=>String(input).includes('seismicportal')?Response.json({}):new Response('x'.repeat(512001))});assert.equal((await read()).failedSources.length,2);
});
