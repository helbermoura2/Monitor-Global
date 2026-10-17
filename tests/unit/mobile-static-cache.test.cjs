const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function worker(){
 const handlers={},buckets=new Map();let fetches=0;
 const caches={open:async name=>{if(!buckets.has(name))buckets.set(name,new Map());const data=buckets.get(name);const key=r=>typeof r==='string'?new URL(r,'https://site.test/').href:r.url;return {match:async r=>data.get(key(r))?.clone(),put:async(r,res)=>data.set(key(r),res.clone()),keys:async()=>[...data.keys()].map(url=>new Request(url)),delete:async r=>data.delete(key(r)),add:async()=>{}}},keys:async()=>[...buckets.keys()],delete:async k=>buckets.delete(k)};
 vm.runInNewContext(fs.readFileSync('sw-monitor.js','utf8'),{URL,Promise,self:{location:{origin:'https://site.test'},addEventListener:(n,f)=>handlers[n]=f},caches,fetch:async()=>{fetches++;return new Response('asset '+fetches)}});
 async function get(path,options){const waits=[];let response;handlers.fetch({request:new Request('https://site.test'+path,options),respondWith:p=>response=p,waitUntil:p=>waits.push(p)});const r=response?await response:null;await Promise.all(waits);return r;}
 return {get,buckets,fetches:()=>fetches};
}
test('versioned assets reuse a response; changing the version fetches new content',async()=>{
 const w=worker();assert.equal(await (await w.get('/js/test.js?v=1')).text(),'asset 1');assert.equal(await (await w.get('/js/test.js?v=1')).text(),'asset 1');assert.equal(w.fetches(),1);
 assert.equal(await (await w.get('/js/test.js?v=2')).text(),'asset 2');
});
test('live JSON, unversioned scripts and no-store bypass static storage',async()=>{
 const w=worker();for(const path of ['/data/events.json?v=1','/api/feed?v=1','/js/test.js'])assert.equal(await w.get(path),null);
 assert.equal(await w.get('/js/test.js?v=1',{cache:'no-store'}),null);assert.equal(w.buckets.size,0);
});
test('static storage stays bounded after many asset versions',async()=>{
 const w=worker();for(let i=0;i<245;i++)await w.get('/js/test.js?v='+i);const data=[...w.buckets.values()][0];assert.equal(data.size,240);assert.ok(!data.has('https://site.test/js/test.js?v=0'));
});
