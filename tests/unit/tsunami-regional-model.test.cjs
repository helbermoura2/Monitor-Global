const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');require('../../js/tsunami-link.js');const R=require('../../js/tsunami-regional-model.js'),M=require('../../js/tsunami-map-model.js');
const now=Date.now(),q={id:'q',type:'earthquake',coords:[166,-14],time:now-3600000,mag:7};
const a=(extra={})=>({id:'ptwc',feedKey:'PTWC-Pacific',type:'tsunami',official:true,source:'PTWC',coordinateRole:'earthquake-origin',coords:q.coords,originTime:q.time,originMag:7,time:now-600000,hazardNature:'warning',warningLevel:'Ameaça oficial',affectedAreas:[{name:'Vanuatu',category:'0.3 TO 1 METERS'}],...extra});
const safe=a({id:'ntwc',feedKey:'NTWC-Americas',source:'NTWC',hazardNature:'bulletin',warningLevel:'Informativo',affectedAreas:[],coverageAreas:['Alaska','British Columbia','Washington','Oregon','California'].map(name=>({name,category:'No tsunami threat'}))});
test('same quake keeps Vanuatu warning and named no-threat coasts together; never the rest of the world',()=>{
 const b=R.bundle(q,[a(),safe],[q],now);assert.equal(b.groups.length,2);assert.equal(b.rows.length,6);assert(b.hasThreat);assert.equal(b.rows.find(r=>r.region==='Vanuatu').state,'warning');assert(b.rows.filter(r=>r.source==='NTWC').every(r=>r.state==='noThreat'&&!r.active));assert.equal(R.hasThreat(safe),false);assert(!b.rows.some(r=>/restante|mundo/i.test(r.region)));
 const regions=JSON.parse(fs.readFileSync('assets/tsunami/ne-50m-coastal-regions.geojson'));const map=M.buildGroup(b,regions);assert(map.data.features.some(f=>f.properties.name==='Vanuatu'&&f.properties.rank>=2));assert(map.data.features.some(f=>f.properties.name==='Alaska'&&f.properties.rank===1));
});
test('one product cancellation clears its warning only; a different active coast stays active',()=>{
 const cancel=a({id:'ptwc-cancel',time:now-1000,cancelled:true,hazardNature:'bulletin',affectedAreas:[{name:'Vanuatu',category:'Cancellation'}]});
 const other=a({id:'other',feedKey:'PTWC-Other',affectedAreas:[{name:'Fiji',category:'Warning'}]});const b=R.bundle(q,[a(),cancel,safe,other],[q],now);
 assert.equal(b.rows.find(r=>r.region==='Vanuatu').state,'ended');assert(b.rows.find(r=>r.region==='Fiji').active);assert(!b.rows.filter(r=>r.region==='Vanuatu').some(r=>r.active));
});
test('mixed bulletin interprets each area; information and missing scope do not imply safety',()=>{
 const item=a({affectedAreas:[{name:'Vanuatu',category:'Warning'},{name:'Fiji',category:'No tsunami threat'},{name:'Samoa',category:'Information'}]});assert.deepEqual(R.rows(item).map(r=>r.state),['warning','noThreat','information']);assert.equal(R.rows(a({hazardNature:'bulletin',affectedAreas:[]}))[0].scoped,false);assert.equal(R.rows(a({_tsunamiStale:true}))[0].stale,true);assert.equal(R.hasThreat(a({_tsunamiStale:true})),false);
});
test('unrelated quake and warning-area geometry cannot borrow another event bulletin',()=>{
 assert.equal(R.bundle({...q,id:'older',time:q.time-3600000},[a(),safe],[],now).rows.length,0);
 const regional=a({id:'regional',coords:null,originTime:null,coordinateRole:'warning-area'});assert.equal(R.bundle(regional,[a(),safe],[],now).bulletins.length,1);
});
test('shared image shows both authority scopes instead of one global threat label',()=>{
 require('../../js/quake-tsunami-status.js');require('../../js/quake-card-layout.js');const status=QuakeTsunamiStatus.resolve(q,{ok:true,checkedAt:now,items:[a(),safe]},null,[q],now);assert.equal(status.regionalGroups.length,2);
 const texts=[],p={rect(){},dot(){},arc(){},measure:(s,z)=>s.length*z*.5,text:(s,x,y,size)=>texts.push({s,x,y,size})};QuakeCardLayout.drawTsunami(p,status);
 assert(texts.some(r=>r.s==='TSUNAMI · SITUAÇÃO POR REGIÃO'));assert(texts.some(r=>r.s.includes('PTWC')));assert(texts.some(r=>r.s.includes('Vanuatu')));assert(texts.some(r=>r.s.includes('NTWC')));assert(texts.some(r=>r.s.includes('Sem ameaça')));assert(texts.some(r=>r.s.includes('Alasca')));assert(texts.every(r=>r.y+r.size<QuakeCardLayout.TSUNAMI_Y+QuakeCardLayout.TSUNAMI_HEIGHT&&r.x+p.measure(r.s,r.size)<=800));
});
