const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function engine(){
 const workers=[],writes=[],sources=new Map(),layers=new Set(),host={append(){},getBoundingClientRect:()=>({top:0,bottom:0})};
 class FakeWorker{constructor(url){this.url=url;this.requests=[];workers.push(this);}postMessage(m){this.requests.push(m);}terminate(){this.terminated=true;}reply(request=this.requests.at(-1),vertices=0){this.onmessage({data:{id:request.id,vertices,data:{type:'FeatureCollection',features:[]}}});}}
 const c={window:{addEventListener(){}},Worker:FakeWorker,setTimeout,console,document:{createElement:()=>({style:{},remove(){}}),getElementById:()=>host,body:host},map:{getLayer:id=>layers.has(id),addLayer:l=>layers.add(l.id),removeLayer:id=>layers.delete(id),getSource:id=>sources.get(id),addSource:id=>sources.set(id,{setData:d=>writes.push(d)}),removeSource:id=>sources.delete(id),setFilter(){}},polygonClipping:{intersection:()=>[]}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('js/seismic-impact-model.js','utf8'),c);c.window.SeismicImpactModel=c.SeismicImpactModel;vm.runInContext(fs.readFileSync('js/seismic-impact.js','utf8'),c);
 return {api:c.window.SeismicImpact,workers,writes,c};
}
const context=(n=0)=>({id:'q'+n,lng:139+n,lat:36,mag:6,depth:10});
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
test('one pending calculation is shared; completed geometry is reused across IDs',async()=>{
 const {api,workers,writes}=engine();api.start(context());api.start({...context(),id:'same-physical-event'});assert.equal(workers.length,1);assert.equal(workers[0].requests.length,1);
 const m=workers[0].requests[0];assert.deepEqual(Object.keys(m.context).sort(),['depth','lat','lng','mag']);workers[0].reply();await flush();assert.equal(writes.length,1);
 api.start({...context(),id:'another-id'},true);await flush();assert.equal(workers[0].requests.length,1);assert.equal(writes.length,2);
});
test('new physical inputs cancel old work, and late messages/errors never replace the new worker',async()=>{
 const {api,workers,writes,c}=engine();api.start(context());const old=workers[0],oldRequest=old.requests[0];api.start(context(1));assert.equal(old.terminated,true);assert.equal(workers.length,2);
 old.reply(oldRequest);old.onerror({preventDefault(){}});await flush();assert.equal(writes.length,0);assert.equal(workers[1].terminated,undefined);
 workers[1].reply();await flush();assert.equal(writes.length,1);assert.equal(c.window.__mgSeismicImpactState.id,'q1');
 api.refresh({...context(1),depth:40});assert.equal(workers[1].requests.length,2);api.stop();assert.equal(workers[1].terminated,true);workers[1].reply();await flush();assert.equal(writes.length,1);
});
test('footprint cache has a four-entry bound and refuses oversized results',async()=>{
 const {api,workers}=engine();for(let i=0;i<5;i++){api.start(context(i));workers.at(-1).reply();await flush();}
 const worker=workers.at(-1),before=worker.requests.length;api.start(context());assert.equal(worker.requests.length,before+1);worker.reply(undefined,100001);await flush();api.start(context());assert.equal(worker.requests.length,before+2);
});
test('the shared model preserves exact pre-optimization results near Japan, Indonesia, dateline and poles',()=>{
 const crypto=require('node:crypto'),clip=require('../../js/vendor/polygon-clipping.min.js'),reference=require('../fixtures/impact-model-reference.json');
 const c=vm.createContext({polygonClipping:clip});vm.runInContext(fs.readFileSync('js/seismic-impact-model.js','utf8'),c);
 for(const {context,hash} of reference.cases){const data=c.SeismicImpactModel.geometry(context,reference.land),actual=crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');assert.equal(actual,hash,JSON.stringify(context));}
});
test('magnitude, depth, latitude and longitude each invalidate cached geometry',async()=>{
 const {api,workers}=engine();api.start(context());workers.at(-1).reply();await flush();
 for(const field of ['mag','depth','lat','lng']){const revised={...context(),[field]:context()[field]+1};api.start(revised);const w=workers.at(-1),before=w.requests.length;w.reply();await flush();api.start(revised);await flush();assert.equal(w.requests.length,before);}
});
test('aggregate vertex budget evicts old footprints before exceeding 100k vertices',async()=>{
 const {api,workers}=engine();for(let i=0;i<3;i++){api.start(context(i));workers.at(-1).reply(undefined,40000);await flush();}
 const worker=workers.at(-1),before=worker.requests.length;api.start(context());assert.equal(worker.requests.length,before+1);
});
