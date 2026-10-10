const test=require('node:test'),assert=require('node:assert/strict'),T=require('../../js/tsunami-link.js');
const now=Date.now(),q={id:'panama',type:'earthquake',coords:[-80.75,7.54],time:now-3600000,mag:7.7};
const a={id:'warning',type:'tsunami',source:'PTWC',feedKey:'PTWC-WEPA40',official:true,originTime:q.time,originMag:7.6,coords:[-80.8,7.5],time:now,hazardNature:'warning',sev:4};
test('matches origin despite magnitude revision; nearby older quake and remote quake do not match',()=>{
 const old={...q,id:'old',time:q.time-17*3600000},remote={...q,id:'turkey',coords:[30,38]};
 assert.equal(T.match(a,[old,remote,q]).quake.id,q.id);assert.equal(T.match(a,[old,remote]),null);
 assert.equal(T.match({...a,originMag:4},[q]),null);
});
test('missing origin is marked probable only for a unique compatible event; coastal polygons never link',()=>{
 const vague={...a,originTime:null};assert.equal(T.match(vague,[q]).kind,'probable');
 assert.equal(T.match(vague,[q,{...q,id:'aftershock',time:q.time+300000}]),null);
 assert.equal(T.match({...a,coords:null},[q]),null);assert.equal(T.match({...a,coordinateRole:'warning-area'},[q]),null);
 assert.equal(T.match(vague,[{...q,time:now-3*3600000}]),null);
});
test('near simultaneous candidates remain ambiguous instead of guessing',()=>{
 assert.equal(T.match(a,[q,{...q,id:'other',time:q.time+60000}]),null);
});
test('latest cancellation supersedes same product but separate information does not cancel a warning',()=>{
 const info={...a,id:'info',feedKey:'PTWC-General',hazardNature:'bulletin',sev:0};
 assert.equal(T.forQuake(q,[a,info],[q],now).length,2);
 const ended={...a,id:'ended',time:now+1000,cancelled:true,hazardNature:'bulletin',sev:0};
 assert.deepEqual(T.latest([a,info,ended],now).map(x=>x.id).sort(),['ended','info']);
 // No confusion between successive earthquake origins, even at the same epicenter.
 const other={...a,id:'later-event',originTime:q.time+7200000};assert.equal(T.latest([a,other],now).length,2);
 const unknown={...a,originTime:null},unknownEnd={...ended,originTime:null};assert.equal(T.latest([unknown,unknownEnd],now).length,2);
});
test('expired and over-72h bulletins never appear among related products',()=>{
 assert.equal(T.forQuake(q,[{...a,time:now-73*3600000},{...a,expiresAt:now-1}],[q],now).length,0);
});
