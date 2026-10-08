const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('thousands of camera frames cause at most one filter change per intensity band',async()=>{
 const calls=[],layers=new Set(),sources=new Map(),host={append(){},getBoundingClientRect:()=>({top:0,bottom:0})};
 const c={window:{},document:{createElement:()=>({style:{},remove(){}}),getElementById:()=>host,body:host},fetch:async()=>({ok:true,json:async()=>({features:[]})}),anelGeodesico:()=>[[0,0],[1,0],[0,1],[0,0]],polygonClipping:{intersection:()=>[]},map:{getLayer:id=>layers.has(id),addLayer:l=>layers.add(l.id),removeLayer:id=>layers.delete(id),getSource:id=>sources.get(id),addSource:id=>sources.set(id,{setData(){}}),removeSource:id=>sources.delete(id),setFilter:(id,f)=>calls.push(f)},console};
 vm.createContext(c);vm.runInContext(fs.readFileSync('js/seismic-impact.js','utf8'),c);const api=c.window.SeismicImpact;api.start({id:'qa',lng:0,lat:0,mag:6,depth:10});for(let i=0;i<8;i++)await Promise.resolve();
 const radius=api.extent(6,10);for(let i=0;i<=1000;i++)api.reveal(radius*i/1000);const afterFelt=calls.length;assert(afterFelt>=48&&afterFelt<=49);
 for(let i=0;i<1000;i++)api.reveal(radius+i);assert.equal(calls.length,afterFelt);api.finish();assert.equal(calls.length,afterFelt+1);assert.equal(calls.at(-1),null);api.stop();assert.equal(c.window.__mgSeismicImpactState,null);
});
