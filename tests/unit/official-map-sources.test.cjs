const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(fetch){const c={URL,URLSearchParams,AbortController,Date,Math,Map,Object,Number,String,Promise,setTimeout,clearTimeout,fetch,console};c.window=c;vm.createContext(c);for(const f of ['rupture-shaking-model','official-map-sources','seismic-impact-model'])vm.runInContext(fs.readFileSync('js/'+f+'.js','utf8'),c);return c;}
const q={id:'USGS-us-qa',source:'USGS',time:1791836436000,mag:6.1,coords:[37,37]},g={nx:2,ny:2,x0:36,x1:38,y0:36,y1:38,values:[3,4,5,6]};
const origin={time:q.time,mag:q.mag,lng:37,lat:37};
const raw={type:'FeatureCollection',features:[{geometry:{type:'Polygon',coordinates:[[[36.8,36.8,1],[37.2,37.2,1],[37.2,37.2,15],[36.8,36.8,1]]]}}]};
const row=(source,id='source-qa')=>({...origin,source,eventId:id,version:source+'-v1',path:source+'/'+id+'.json'});
test('regional sources match a unique origin, retain published intensity and attribute their rupture',async()=>{
 const entry=row('eu');let calls=0;const c=setup(async url=>{calls++;return new Response(JSON.stringify(String(url).includes('index.json')?{events:[entry]}:{status:'available',source:'eu',eventId:entry.eventId,version:entry.version,method:'eu-shakemap-grid',origin,grid:g,ruptureRaw:raw}));});
 const d=await c.OfficialMapSources.query(q,new AbortController().signal);assert.equal(d.method,'eu-shakemap-grid');assert.deepEqual(Array.from(d.grid.values),[3,4,5,6]);assert.equal(d.rupture.features[0].properties.provider,'ShakeMap-EU');assert.equal(calls,2);
});
test('ambiguous nearby earthquakes cannot borrow a regional map',async()=>{
 const c=setup(async url=>{if(!String(url).includes('index.json'))throw Error('no association');return new Response(JSON.stringify({events:[row('eu','event-a'),row('eu','event-b')]}));});
 assert.equal(await c.OfficialMapSources.query(q,new AbortController().signal),null);
});
test('failed national product continues to a matching European product',async()=>{
 const a=row('ingv'),b=row('eu');const c=setup(async url=>{url=String(url);if(url.includes('index.json'))return new Response(JSON.stringify({events:[a,b]}));if(url.includes('/ingv/'))throw Error('temporary');return new Response(JSON.stringify({status:'available',source:'eu',eventId:b.eventId,version:b.version,origin,grid:g}));});assert.equal((await c.OfficialMapSources.query(q,new AbortController().signal)).source,'eu');
});
test('standalone USGS rupture needs no intensity grid and creates no fictitious intensity bands',async()=>{
 const c=setup(async url=>new Response(JSON.stringify(String(url).includes('/query')?{id:'us-qa',geometry:{coordinates:[37,37]},properties:{time:q.time,mag:q.mag,products:{shakemap:[{code:'us-qa',updateTime:7,contents:{'download/rupture.json':{url:'https://earthquake.usgs.gov/rupture.json'}}}]}}}:String(url).includes('index.json')?{events:[]}:raw)));
 const d=await c.OfficialMapSources.query(q,new AbortController().signal);assert.equal(d.status,'rupture-only');assert.equal(d.grid,undefined);assert.equal(d.rupture.features.length,1);assert.deepEqual(Array.from(c.SeismicImpactModel.bands({shaking:d},[])),[]);
});
test('nodal/point solutions never become finite rupture; wrong origins are rejected',async()=>{
 for(const mode of ['point','wrong']){const c=setup(async url=>new Response(JSON.stringify(String(url).includes('index.json')?{events:[]}:String(url).includes('/query')?{id:'us-qa',geometry:{coordinates:[37,37]},properties:{time:q.time+(mode==='wrong'?3600000:0),mag:q.mag,products:{shakemap:[{contents:{'download/rupture.json':{url:'https://earthquake.usgs.gov/rupture.json'}}}]}}}:{type:'FeatureCollection',features:[{geometry:{type:'Point',coordinates:[37,37]}}]})));assert.equal(await c.OfficialMapSources.query(q,new AbortController().signal),null);}
});
test('all compact real maps meet shared renderer limits',()=>{const c=setup(()=>{}),index=JSON.parse(fs.readFileSync('data/official-shaking/index.json'));for(const r of index.events){const d=JSON.parse(fs.readFileSync('data/official-shaking/'+r.path));assert.equal(c.RuptureShakingModel.valid(d.grid),true,r.eventId);assert.equal(c.OfficialMapSources.matches({time:r.time,mag:r.mag,coords:[r.lng,r.lat]},d.origin),true);}});
