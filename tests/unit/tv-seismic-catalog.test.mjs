import test from 'node:test';import assert from 'node:assert/strict';
import {mergeTvCatalog,brazilFeature,createTvCatalog} from '../../worker/tv-seismic-catalog.mjs';
import {tvSnapshot} from '../../worker/tv-snapshot.mjs';
const now=Date.parse('2026-10-26T12:00:00Z');
const quake=(id='us1',mag=6.9)=>({id,properties:{mag,time:now-60000,updated:now,net:'US',type:'earthquake',place:'Vanuatu',status:'reviewed'},geometry:{coordinates:[165,-14,10]}});
const br=(provider='USP',id='1',mag=1.2)=>brazilFeature({id:provider==='USGS'?id:provider+'-'+id,provider,mag,timeIso:new Date(now-50*3600000).toISOString(),lon:-46.6,lat:-23.5,depth:3,source:provider,place:'São Paulo, Brasil',reviewed:true},now);
test('Brazil has no magnitude minimum and late publications retain the origin time',()=>{
 const f=br();const body=tvSnapshot({features:[f],catalogs:{USP:true}},{ok:true,items:[]},now,{maxAge:72*3600000});assert.equal(body.alerts.length,1);assert.equal(body.alerts[0].eligible,true);assert.equal(body.alerts[0].countryCode,'br');assert.equal(body.alerts[0].provider,'USP');assert.equal(body.alerts[0].eventTime,f.properties.time);assert.equal(body.alerts[0].issuedAt,now);
});
test('cross-network association is strict, canonical identity is stable and estimates do not flip back',()=>{
 let rows=mergeTvCatalog([],[br('USP'),br('EMSC')],now);assert.equal(rows.length,1);assert.equal(rows[0].aliases.length,2);const id=rows[0].id;
 const revised=br('EMSC','1',1.6);rows=mergeTvCatalog(rows,[revised],now);assert.equal(rows[0].feature.properties.mag,1.6);rows=mergeTvCatalog(rows,[br('USP'),revised],now);assert.equal(rows[0].feature.properties.mag,1.6);assert.equal(rows[0].id,id);
 assert.equal(mergeTvCatalog([], [br('USP','1'),br('USP','2')],now).length,2);
 const distant=br('EMSC');distant.geometry.coordinates[0]=-45;assert.equal(mergeTvCatalog([],[br(),distant],now).length,2);
 const foreign=br('EMSC');foreign.geometry.coordinates=[-58.4,-34.6,3];const records=mergeTvCatalog([],[foreign],now);assert.equal(records[0].feature.brazil,false);
 const rapid=quake('usauto1',7.2);rapid.properties.net='PT';const reviewed=quake('usreviewed',6.9);rows=mergeTvCatalog([],[rapid,reviewed],now);assert.equal(rows.length,1);assert.equal(rows[0].feature.id,'usreviewed');
});
test('collector shares Brazil reads, exposes independent failures and follows M6 revised below threshold across restart',async()=>{
 let time=now,calls=0,globalCalls=0,individual=0,stored='',writes=0;
 const env={TTS_USAGE:{get:async()=>stored,put:async(k,v)=>{stored=v;writes++;}}};
 const fetcher=async url=>{if(String(url).includes('eventid=')){individual++;return Response.json(quake('us1',5.2));}globalCalls++;return Response.json({features:globalCalls===1?[quake()]:[]});};
 const brazil=async()=>{calls++;return {sources:[{provider:'USP',events:[]}],failedSources:['USGS','EMSC','GEOFON']};};
 const create=()=>createTvCatalog({supplemental:async()=>({sources:[],failedSources:[]}),clock:()=>time,fetcher,brazil,cache:()=>null});let collect=create();
 let result=await collect(env);assert.equal(calls,1);assert.equal(result.catalogs.USP,true);assert.equal(result.catalogs.EMSC,false);assert.equal(result.catalogs.USGS_BR,false);assert.equal(writes,1);
 time+=30000;result=await collect(env);assert.equal(calls,1);assert.equal(individual,1);assert.equal(result.features[0].properties.mag,5.2);assert.equal(result.features[0].tracked,true);
 assert.equal(tvSnapshot(result,{ok:true,items:[]},time,{maxAge:72*3600000}).alerts[0].magnitude,5.2);
 time+=30000;await collect(env);assert.equal(writes,2);time+=30000;await collect(env);assert.equal(writes,2);
 collect=create();await collect(env);assert(individual>=4);assert.equal(writes,2);
});
test('identical official tsunami bulletins do not become new alerts just because the publication time changes',()=>{
 const a={id:'warn',type:'tsunami',official:true,source:'PTWC',feedKey:'PTWC-Pacific',time:now,originTime:now-60000,coords:[165,-14],hazardNature:'warning',affectedAreas:[{name:'Vanuatu',category:'Warning'}]};
 const read=a=>tvSnapshot({features:[quake()]},{ok:true,items:[a]},now).alerts.find(a=>a.kind==='tsunami');assert.equal(read(a).version,read({...a,time:now+1000}).version);assert.notEqual(read(a).version,read({...a,cancelled:true,affectedAreas:[{name:'Vanuatu',category:'Cancellation'}]}).version);
});

test('overlapping USGS global and Brazil responses do not alternate rounded solutions or write every poll',async()=>{
 let time=now,writes=0;const global=quake('brus',6.1);global.geometry.coordinates=[-46.6,-23.5,3.14];global.properties.net='us';
 const collect=createTvCatalog({supplemental:async()=>({sources:[],failedSources:[]}),clock:()=>time,cache:()=>null,fetcher:async()=>Response.json({features:[structuredClone(global)]}),brazil:async()=>({sources:[{provider:'USGS',events:[{id:'brus',provider:'USGS',mag:6.1,timeIso:new Date(now-60000).toISOString(),lon:-46.6,lat:-23.5,depth:3,source:'US',place:'São Paulo, Brasil',reviewed:true}]}],failedSources:[]})});
 const env={TTS_USAGE:{get:async()=>null,put:async()=>writes++}};
 const first=await collect(env);time+=120000;const second=await collect(env);
 assert.equal(first.features[0].geometry.coordinates[2],3.14);assert.equal(second.features[0].geometry.coordinates[2],3.14);assert.equal(writes,1);
});

test('Vanuatu 6.0 to 6.1 survives shared catalog and changes the TV version without cutting the country',()=>{
 const first=quake('us7000ttlm',6);first.properties.place='214 km NW of Port-Olry, Vanuatu';
 let records=mergeTvCatalog([],[first],now);const before=tvSnapshot({features:records.map(r=>({...r.feature,tvId:r.id,aliases:r.aliases}))},{ok:true,items:[]},now).alerts[0];
 const revised=structuredClone(first);revised.properties.mag=6.1;revised.properties.updated=now+30000;records=mergeTvCatalog(records,[revised],now+30000);
 const after=tvSnapshot({features:records.map(r=>({...r.feature,tvId:r.id,aliases:r.aliases}))},{ok:true,items:[]},now+30000).alerts[0];
 assert.equal(after.id,before.id);assert.equal(after.magnitude,6.1);assert.equal(after.eligible,true);assert.notEqual(after.version,before.version);assert.equal(after.issuedAt,now+30000);assert.match(after.title,/Vanuatu$/);
});

test('global selection includes GEOFON above six even if USGS is below; changes remain stable and reversible',()=>{
 const gfz=mag=>({id:'GEOFON-gfz2026vciw',provider:'GEOFON',providerEventId:'gfz2026vciw',globalMultiSource:true,properties:{mag,time:now-60000,updated:now,net:'GEOFON',type:'earthquake',place:'Vanuatu',status:'automatic'},geometry:{coordinates:[165,-14,10]}});
 let records=mergeTvCatalog([],[quake('us7000ttlt',5.6),gfz(6.09)],now);assert.equal(records.length,1);const id=records[0].id;
 let a=tvSnapshot({features:records.map(r=>({...r.feature,tvId:r.id,aliases:r.aliases}))},{ok:true,items:[]},now).alerts[0];assert.equal(a.provider,'GEOFON');assert.equal(a.catalog,'GEOFON_GLOBAL');assert(a.eligible);assert.match(a.title,/M6,1/);
 records=mergeTvCatalog(records,[quake('us7000ttlt',6),gfz(6.09)],now+1000);assert.equal(records[0].feature.provider||'USGS','USGS');assert.equal(records[0].id,id);
 records=mergeTvCatalog(records,[quake('us7000ttlt',5.6),gfz(6.09)],now+2000);assert.equal(records[0].feature.provider,'GEOFON','unchanged qualifying alternative is restored after USGS downgrade');
 records=mergeTvCatalog(records,[quake('us7000ttlt',5.6),gfz(5.2)],now+3000);assert.equal(records[0].feature.provider||'USGS','USGS');assert.equal(records[0].feature.properties.mag,5.6);
});

test('a stale USGS frame cannot overwrite a newer stored solution or churn the watch list',()=>{
 const fresh=quake('stable',6.2);fresh.properties.updated=now+1000;let records=mergeTvCatalog([],[fresh],now+1000);const serialized=JSON.stringify(records);
 const old=quake('stable',6);old.properties.updated=now;records=mergeTvCatalog(records,[old],now+2000);assert.equal(records[0].feature.properties.mag,6.2);assert.equal(JSON.stringify(records),serialized);
});
