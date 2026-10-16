const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('background discovery does not cancel foreground products and survives foreground cancellation',async()=>{
 const requests=[],c={URL,AbortController,Date,Map,Object,Number,String,Promise,setTimeout,clearTimeout,WORKER_PROXY:()=> 'https://worker.example/',window:{addEventListener(){},RuptureShakingModel:{valid:()=>true}},fetch:(u,{signal})=>new Promise((resolve,reject)=>{requests.push({u,signal,resolve});signal.addEventListener('abort',()=>reject(Error('aborted')));})};vm.runInNewContext(fs.readFileSync('js/rupture-shaking.js','utf8'),c);
 const q=id=>({id,source:'QA',coords:[37,37],mag:5.5,time:Date.now()});const a=c.window.RuptureShaking.query(q('foreground')),b=c.window.RuptureShaking.query(q('background'),{background:true});assert.equal(requests.length,2);assert.equal(requests[0].signal.aborted,false);c.window.RuptureShaking.cancel();assert.equal(requests[0].signal.aborted,true);assert.equal(requests[1].signal.aborted,false);requests[1].resolve({ok:true,json:async()=>({status:'available',method:'usgs-shakemap-grid',grid:{},version:'qa'})});assert.equal(await a,null);assert.equal((await b).version,'qa');
});

function client(fetch){const c={URL,AbortController,Date,Map,Object,Number,String,Promise,setTimeout,clearTimeout,WORKER_PROXY:()=> 'https://worker.example/',window:{addEventListener(){}},fetch};vm.createContext(c);vm.runInContext(fs.readFileSync('js/rupture-shaking-model.js','utf8'),c);c.window.RuptureShakingModel=c.RuptureShakingModel;vm.runInContext(fs.readFileSync('js/rupture-shaking.js','utf8'),c);return c.window.RuptureShaking;}
const grid={nx:2,ny:2,x0:0,x1:2,y0:0,y1:2,values:[3,4,5,6]};
const published={status:'available',method:'usgs-shakemap-finite',eventId:'us-test',version:'us-test-7',grid};
const geometry={type:'FeatureCollection',features:[{geometry:{type:'Polygon',coordinates:[[[0,0,0],[1,1,0],[1,1,10],[0,0,0]]]}}]};
const details=url=>({id:'us-test',properties:{products:{shakemap:[{code:'us-test',updateTime:7,contents:{'download/rupture.json':{url}}}]}}});
test('geometry uses the exact published product, is cached and never replaces official shaking',async()=>{
 const calls=[],api=client(async u=>{calls.push(String(u));return new Response(JSON.stringify(calls.length===1?published:calls.length===2?details('https://earthquake.usgs.gov/rupture.json'):geometry));});
 const q={id:'real',source:'USGS',coords:[1,1],mag:6,time:Date.now()};const data=await api.query(q);assert.equal(data.grid.values[3],6);assert.equal(data.rupture.features.length,1);assert.equal(data.rupture.features[0].geometry.coordinates[1].length,2);assert.equal((await api.query(q)),data);assert.equal(calls.length,3);
});
test('missing, mismatched and untrusted fault geometry preserve the official intensity grid',async()=>{
 for(const mode of ['mismatch','host','failure']){let calls=0;const api=client(async u=>{calls++;if(calls===1)return new Response(JSON.stringify(published));if(mode==='failure')throw Error('Offline');const d=details(mode==='host'?'https://other.example/rupture.json':'https://earthquake.usgs.gov/rupture.json');if(mode==='mismatch')d.properties.products.shakemap[0].updateTime=8;return new Response(JSON.stringify(d));});
  const data=await api.query({id:mode,coords:[1,1],mag:6,time:Date.now()});assert.equal(data.method,'usgs-shakemap-finite');assert.equal(data.rupture,undefined);assert.equal(calls,2);
 }
});
test('cancelling selection during geometry loading cannot populate the cache later',async()=>{
 let loading;const ready=new Promise(r=>loading=r);let calls=0;const api=client(async (u,{signal})=>{calls++;if(calls===1)return new Response(JSON.stringify(published));loading();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('Abort'))));});const q={id:'cancel',coords:[1,1],mag:6,time:Date.now()},pending=api.query(q);await ready;api.cancel();assert.equal(await pending,null);assert.equal(api.get(q),null);
});
