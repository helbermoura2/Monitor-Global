const test=require('node:test'),assert=require('node:assert/strict');require('../../js/mobile-map-clusters.js');
const {visibleIds}=globalThis.MobileMapClusters,project=([x,y])=>({x:x+100,y:y+100});
test('distant globe keeps only the selected point without numeric groups',()=>{
 const items=[{id:'selected',coords:[0,0]},{id:'other',coords:[1,1]}];assert.deepEqual([...visibleIds(items,'selected',2,project,200,200)],['selected']);
});
test('close views show individual visible points and exclude invalid or offscreen positions',()=>{
 const items=[{id:'a',coords:[0,0]},{id:'b',coords:[1,1]},{id:'off',coords:[150,0]},{id:'invalid',coords:null}];assert.deepEqual([...visibleIds(items,null,6,project,200,200)],['a','b']);
});
test('dense views cap DOM markers while preserving a selected offscreen event',()=>{
 const items=Array.from({length:600},(_,i)=>({id:String(i),coords:[i/100,0]}));items.push({id:'selected',coords:[150,0]});const ids=visibleIds(items,'selected',8,project,200,200);assert.equal(ids.size,160);assert(ids.has('selected'));assert.equal(items.length,601);
});
test('date line positions are projected in the nearest world copy',()=>{
 let lng;visibleIds([{id:'seam',coords:[-179,0]}],null,7,p=>{lng=p[0];return {x:10,y:10};},200,200,179);assert.equal(lng,181);
});
