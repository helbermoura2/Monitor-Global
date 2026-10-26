import test from 'node:test';import assert from 'node:assert/strict';import {tvSnapshot,handleTvAlerts} from '../../worker/tv-alerts.mjs';
const now=Date.now(),quake=(mag=6.9)=>({id:'us-test',properties:{mag,time:now-60000,updated:now,type:'earthquake',place:'197 km WNW of Port-Olry, Vanuatu'},geometry:{coordinates:[165,-14,10]}});
test('TV feed is independent of Telegram and only exposes seismic/official tsunami data',()=>{
 const body=tvSnapshot({features:[quake(),quake(5.8),quake(2),quake(null)]},{ok:true,items:[]},now);assert.equal(body.version,'tv-alerts-v1');assert.equal(body.alerts.length,2);assert(body.alerts[0].title.includes('M6,9'));assert(body.alerts.some(a=>!a.eligible&&a.magnitude===5.8));assert.deepEqual(body.sources,{earthquake:true,tsunami:true});assert(!JSON.stringify(body).includes('TELEGRAM'));
});
test('regional ending is explicit and a different coast never becomes globally safe',()=>{
 const a={id:'pt',type:'tsunami',official:true,source:'PTWC',feedKey:'PTWC-Pacific',time:now,originTime:now-60000,officialEventId:'PHEB:q',coords:[165,-14],hazardNature:'warning',affectedAreas:[{name:'Vanuatu',category:'Warning'}]};
 const before=tvSnapshot({features:[]},{ok:true,items:[a]},now),after=tvSnapshot({features:[]},{ok:true,items:[{...a,id:'pt-2',cancelled:true,hazardNature:'bulletin',affectedAreas:[{name:'Vanuatu',category:'Cancellation'}]}]},now);assert.equal(before.alerts[0].id,after.alerts[0].id);assert.notEqual(before.alerts[0].version,after.alerts[0].version);assert.equal(after.alerts[0].state,'ended');assert.equal(after.alerts[0].eligible,false);assert.match(after.alerts[0].detail,/Apenas para as costas citadas/);
 const failed=tvSnapshot({ok:false,features:[]},{ok:false,items:[]},now);assert.deepEqual(failed.sources,{earthquake:false,tsunami:false});assert.deepEqual(failed.alerts,[]);
});
test('conditional reads avoid retransmission, unsupported methods cannot trigger writes',async()=>{
 let calls=0;const snapshot=tvSnapshot({features:[quake()]},{ok:true,items:[]},now),read=async()=>{calls++;return snapshot;};
 const request=new Request('https://internal/tv-alerts'),first=await handleTvAlerts(request,{read,now,cache:null});assert.equal(first.status,200);const second=await handleTvAlerts(new Request(request,{headers:{'If-None-Match':first.headers.get('ETag')}}),{read,now,cache:null});assert.equal(second.status,304);assert.equal(calls,1);assert.equal(await second.text(),'');assert.equal((await handleTvAlerts(new Request(request,{method:'POST'}),{read,now,cache:null})).status,405);
});
test('only a precise unambiguous official association adds the tsunami indication to a quake',()=>{
 const warning={id:'p1',type:'tsunami',official:true,source:'PTWC',feedKey:'PTWC-Pacific',time:now,originTime:now-60000,coords:[165,-14],hazardNature:'warning',affectedAreas:[{name:'Vanuatu',category:'Warning'}]};
 const q=quake();const body=tvSnapshot({features:[q]},{ok:true,items:[warning]},now);const eq=body.alerts.find(a=>a.kind==='earthquake'),ts=body.alerts.find(a=>a.kind==='tsunami');
 assert.match(eq.tsunamiSummary,/Vanuatu/);assert.equal(ts.relatedQuakeId,eq.id);assert.equal(eq.depth,10);assert.equal(ts.source,'PTWC');
 const summary=w=>tvSnapshot({features:[q]},{ok:true,items:[w]},now).alerts.find(a=>a.kind==='earthquake').tsunamiSummary;
 assert.equal(summary({...warning,originTime:undefined}),'');assert.equal(summary({...warning,coords:[80,20]}),'');assert.equal(summary({...warning,coordinateRole:'warning-area'}),'');
 assert.equal(summary({...warning,cancelled:true}),'');
 const ambiguous=tvSnapshot({features:[q,{...q,id:'second'}]},{ok:true,items:[warning]},now);assert(ambiguous.alerts.filter(a=>a.kind==='earthquake').every(a=>!a.tsunamiSummary));
 const offline=tvSnapshot({features:[q]},{ok:false,items:[warning]},now);assert.equal(offline.alerts.find(a=>a.kind==='earthquake').tsunamiSummary,'');
});
test('a regional no-threat product cannot erase another coast warning',()=>{
 const base={type:'tsunami',official:true,source:'PTWC',time:now,originTime:now-60000,coords:[165,-14]};
 const warning={...base,id:'warn',feedKey:'PTWC-Pacific',hazardNature:'warning',affectedAreas:[{name:'Vanuatu',category:'Warning'}]};
 const clear={...base,id:'safe',source:'NTWC',feedKey:'NTWC',hazardNature:'bulletin',affectedAreas:[{name:'Alaska',category:'No threat'}]};
 const a=tvSnapshot({features:[quake()]},{ok:true,items:[warning,clear]},now);
 assert.equal(a.alerts.filter(x=>x.kind==='tsunami').length,2);const q=a.alerts.find(x=>x.kind==='earthquake');assert.match(q.tsunamiSummary,/Vanuatu/);assert(!q.tsunamiSummary.includes('Alasca'));assert.equal(a.alerts.find(x=>x.state==='noThreat').eligible,true);assert.match(a.alerts.find(x=>x.state==='noThreat').title,/Alasca/);
});

test('no-threat requires a precise M6+ association and timestamp-only repeats keep the same version',()=>{
 const q=quake(),a={id:'safe',type:'tsunami',official:true,source:'PTWC',feedKey:'PTWC-Pacific',time:now,originTime:now-60000,coords:[165,-14],hazardNature:'bulletin',affectedAreas:[{name:'Vanuatu',category:'No threat'}]};
 const read=(event,bulletin)=>tvSnapshot({features:event?[event]:[]},{ok:true,items:[bulletin]},now).alerts.find(x=>x.kind==='tsunami');
 assert.equal(read(q,a).eligible,true);assert.equal(read(q,{...a,_tsunamiStale:true}).eligible,false);assert.equal(read(null,a).eligible,false);assert.equal(read(quake(5.8),a).eligible,false);assert.equal(read(q,{...a,originTime:undefined}).eligible,false);
 assert.equal(read(q,a).version,read(q,{...a,time:now+1000}).version);
});

test('expanded coverage is opt-in so an older APK never announces the new Brazilian baseline',async()=>{
 const t=now+31000,br={...quake(1.1),id:'br',provider:'USP',brazil:true,tvId:'USP:br',properties:{...quake(1.1).properties,place:'São Paulo, Brasil'}};
 const snapshot=tvSnapshot({features:[quake(),br],catalogs:{USGS:true,USGS_BR:false,USP:true,EMSC:false,GEOFON:true}},{ok:true,items:[]},t,{maxAge:72*3600000});
 const read=async()=>snapshot;
 const legacy=await(await handleTvAlerts(new Request('https://internal/tv-alerts'),{read,now:t,cache:null})).json();assert.equal(legacy.alerts.filter(a=>a.kind==='earthquake').length,1);assert.equal(legacy.sources.catalogs,undefined);
 const expanded=await(await handleTvAlerts(new Request('https://internal/tv-alerts?policy=telegram-v1'),{read,now:t,cache:null})).json();assert.equal(expanded.policy,'telegram-v1');assert.equal(expanded.alerts.filter(a=>a.kind==='earthquake').length,2);assert.equal(expanded.sources.catalogs.USP,true);
});
