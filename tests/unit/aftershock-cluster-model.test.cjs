const {test}=require('node:test'),assert=require('node:assert/strict'),{build}=require('../../js/aftershock-cluster-model.js');
const q=(id,x,y=7.5)=>({id,coords:[x,y],mag:4.2});
test('all members are counted once; zoom and selected child separate individuals',()=>{
 const children=Array.from({length:101},(_,i)=>q('child-'+i,-80.6+i*.0001));
 const far=build(children,-80.8,4,'main');assert.equal(far.clusters.length,1);assert.equal(far.clusters[0].members.length,101);assert.equal(far.singles.length,0);
 const selected=build(children,-80.8,4,'child-5');assert.equal(selected.clusters[0].members.length,100);assert.equal(selected.singles[0].id,'child-5');
 const near=build(children,-80.8,10,'main');assert.equal(near.clusters.length,0);assert.equal(near.singles.length,101);assert.equal(children.length,101);
});
test('separate nearby groups stay separate and catalog ordering is deterministic',()=>{
 const children=[q('a',0),q('b',.01),q('c',1),q('d',1.01)];
 const a=build(children,0,7,'main'),b=build([...children].reverse(),0,7,'main');assert.deepEqual(a,b);assert.equal(a.clusters.length,2);assert.deepEqual(a.clusters.map(c=>c.members.length),[2,2]);
});
test('dateline neighbors group without fitting a whole world; latitude stays finite',()=>{
 const result=build([q('a',179.99,85),q('b',-179.99,85)],180,4,'main');assert.equal(result.clusters.length,1);assert(result.clusters[0].bounds[1][0]-result.clusters[0].bounds[0][0]<.1);assert(result.clusters[0].coords.every(Number.isFinite));
});
