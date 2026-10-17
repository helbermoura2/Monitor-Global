const test=require('node:test'),assert=require('node:assert/strict');require('../../js/mobile-map-clusters.js');
const group=globalThis.MobileMapClusters.group;
test('spatial groups retain the selected epicenter and separate event types',()=>{
 const items=[{id:'selected',type:'earthquake',coords:[0,0]},{id:'a',type:'earthquake',coords:[1,1]},{id:'b',type:'earthquake',coords:[1.1,1.1]},{id:'c',type:'wind',coords:[1,1]},{id:'far',type:'earthquake',coords:[120,40]}];
 const r=group(items,'selected',2);assert.deepEqual([...r.hidden],['a','b']);assert.equal(r.groups[0].count,2);assert.ok(!r.hidden.has('selected'));assert.ok(!r.hidden.has('c'));assert.ok(!r.hidden.has('far'));
});
test('points split on approach and invalid coordinates do not create groups',()=>{
 const items=[{id:'a',type:'earthquake',coords:[1,1]},{id:'b',type:'earthquake',coords:[5,5]},{id:'bad',type:'earthquake',coords:null}];
 assert.equal(group(items,null,1).groups.length,1);assert.equal(group(items,null,5).groups.length,0);
});
