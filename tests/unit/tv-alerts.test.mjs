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
