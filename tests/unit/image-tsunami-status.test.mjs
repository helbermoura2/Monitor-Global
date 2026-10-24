import {test} from 'node:test';import assert from 'node:assert/strict';
import '../../js/tsunami-link.js';import '../../js/quake-tsunami-status.js';
import {queryImageTsunami,imageTsunamiVersion} from '../../image-tsunami-status.mjs';
import {imageRefreshDue} from '../../telegram-image-refresh.mjs';
const now=Date.now(),q={id:'q',type:'earthquake',mag:6.9,coords:[165,-14],time:now-3600000};
const bulletin=(extra={})=>({id:'warning',feedKey:'PTWC-General',source:'PTWC',official:true,type:'tsunami',coords:q.coords,coordinateRole:'earthquake-origin',originTime:q.time,originMag:6.9,officialEventId:'PHEB:abc',time:now-600000,place:'Vanuatu',hazardNature:'warning',warningLevel:'Aviso',sev:4,...extra});
const resolve=(items,previous=null,ok=true)=>QuakeTsunamiStatus.resolve(q,{ok,items,checkedAt:now},previous,[q],now);
test('absence, uncertain association and a different quake never become no-threat',()=>{
 assert.equal(resolve([]).state,'unknown');assert.equal(resolve([bulletin({originTime:q.time+3600000})]).state,'unknown');
 assert.equal(resolve([bulletin({originTime:null})]).state,'unknown');
 assert.equal(resolve([bulletin({coords:[10,20]})]).state,'unknown');
});
test('latest cancellation replaces warning for same official event/product and changes image version',()=>{
 const warning=bulletin(),cancel=bulletin({id:'cancel',time:now-30000,cancelled:true,hazardNature:'bulletin',title:'Tsunami Warning Cancelled',warningLevel:'Encerrado',sev:0});
 const a=resolve([warning]),b=resolve([warning,cancel],a);assert.equal(a.state,'warning');assert.equal(b.state,'cancelled');assert.notEqual(imageTsunamiVersion(a),imageTsunamiVersion(b));assert.equal(b.bulletins.length,1);
 assert.equal(resolve([cancel],a).state,'cancelled');assert.equal(resolve([{...cancel,coords:null,originTime:null}],a).state,'cancelled');
});
test('information does not mean no threat; explicit no-threat remains scoped to bulletin',()=>{
 assert.equal(resolve([bulletin({hazardNature:'bulletin',warningLevel:'Informativo'})]).state,'information');
 assert.equal(resolve([bulletin({detail:'There is no tsunami threat for other coasts; warning remains for Vanuatu.'})]).state,'warning');
 assert.equal(resolve([bulletin({hazardNature:'bulletin',detail:'There is no tsunami threat from this earthquake.'})]).state,'noThreat');
});
test('cancellation from another region/agency cannot clear remaining warning; stale lookup preserves evidence',()=>{
 const a=resolve([bulletin()]);assert.equal(resolve([],a,false).state,'warning');assert.equal(resolve([],a).stale,true);
 assert.equal(resolve([bulletin(),bulletin({id:'other',source:'NTWC',feedKey:'NTWC',time:now-1000,cancelled:true,hazardNature:'bulletin'})]).state,'warning');
 assert.equal(resolve([bulletin({time:now-650000})],a,false).stale,true);
});
test('status query is offline-injectable, small quakes do not query providers and version is stable across check time',async()=>{
 let calls=0;const read=async()=>{calls++;return {ok:true,items:[bulletin()]};};
 const ev={...q,lat:q.coords[1],lon:q.coords[0],timeIso:new Date(q.time).toISOString()};
 const a=await queryImageTsunami(ev,null,read),b=await queryImageTsunami(ev,a,read);assert.equal(a.version,b.version);assert.equal(calls,2);
 await queryImageTsunami({...ev,mag:3},null,read);assert.equal(calls,2);
});
test('active tsunami images remain eligible beyond day one, but not after 72h',()=>{
 const record={id:'q',mag:6.9,timeIso:new Date(now-30*3600000).toISOString(),delivery:'sent',messageType:'photo',messageId:1,cardImageVersion:'hollow-v15-regional',imageExposureCheckedAt:0,imageShakingCheckedAt:0,currentEvent:{imageTsunami:{state:'warning'}}};
 assert(imageRefreshDue(record,now));assert.equal(imageRefreshDue({...record,currentEvent:{imageTsunami:{state:'cancelled'}}},now),false);
 assert.equal(imageRefreshDue({...record,timeIso:new Date(now-73*3600000).toISOString()},now),false);
});

test('out-of-order or missing product cannot revive a cancelled warning or silently clear another warning',()=>{
 const a=resolve([bulletin()]),cancel=bulletin({id:'cancel-new',time:now-1000,cancelled:true,hazardNature:'bulletin',title:'Warning cancelled'}),b=resolve([cancel],a);
 assert.equal(resolve([bulletin()],b).state,'cancelled');assert.equal(resolve([bulletin()],b).stale,true);
 const other=bulletin({id:'ntwc-info',feedKey:'NTWC-General',source:'NTWC',hazardNature:'bulletin',time:now-100});
 assert.equal(resolve([other],a).state,'warning');assert.equal(resolve([other],a).stale,true);
});
