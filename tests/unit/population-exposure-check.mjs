import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {handlePopulationExposure,intensityAt,exposureRadii,circleGeometry,parsePagerXML,worldPopResult} from '../../population-exposure-worker.mjs';
if(!globalThis.crypto)Object.defineProperty(globalThis,"crypto",{value:webcrypto});
assert(Math.abs(intensityAt(5,10,0)-5.97)<0.15);
assert.equal(intensityAt(5,0,20),intensityAt(5,10,20));
const radii=exposureRadii(5,10);assert(radii[0].radiusKm>radii[1].radiusKm);assert(radii[1].radiusKm>radii[2].radiusKm);
assert(exposureRadii(3,50).every(r=>r.radiusKm===0));
for(const [lat,lng] of [[-38,-73],[0,179.8],[0,-179.8],[84,170]]){
 const shape=circleGeometry(lat,lng,100);const polygons=shape.type==='Polygon'?[shape.coordinates]:shape.coordinates;
 for(const polygon of polygons){const ring=polygon[0];assert.deepEqual(ring[0],ring.at(-1));assert(ring.every(p=>p[0]>=-180-1e-8&&p[0]<=180+1e-8&&Math.abs(p[1])<=90));for(let i=1;i<ring.length;i++)assert(Math.abs(ring[i][0]-ring[i-1][0])<=180);}
 if(Math.abs(lng)>179)assert.equal(shape.type,'MultiPolygon');
}
// Fixture derivada do formato mostrado nos testes oficiais do USGS; números sintéticos.
const xml='<pager>'+[[.5,1.5,0],[1.5,2.5,100],[2.5,3.5,200],[3.5,4.5,300],[4.5,5.5,40],[5.5,6.5,10],[6.5,7.5,5],[7.5,8.5,0],[8.5,9.5,0],[9.5,10.5,0]].map(([min,max,pop])=>`<exposure dmin="${min}" dmax="${max}" exposure="${pop}" rangeInsideMap="1"/>`).join('')+'</pager>';
assert.deepEqual(parsePagerXML(xml).ranges.map(r=>r.population),[555,55,15]);assert.equal(parsePagerXML(xml).partial,false);
assert.throws(()=>parsePagerXML('<html>unavailable</html>'));
assert.throws(()=>parsePagerXML('<pager><exposure dmin="2" dmax="4" exposure="2"/><exposure dmin="3" dmax="5" exposure="1"/></pager>'));
assert.equal(worldPopResult({status:'finished',error:false,data:{total_population:0}}).population,0);
assert.equal(worldPopResult({error:true,data:{total_population:0}}).state,'failed');
assert.equal(worldPopResult({taskid:'abc',status:'created'}).state,'pending');
assert.equal(worldPopResult({status:'finished',data:{total_population:null}}).state,'pending');
const kv=new Map(),env={TTS_USAGE:{get:async key=>kv.has(key)?JSON.parse(kv.get(key)):null,put:async(key,value)=>kv.set(key,value)}};
const request=(extra='')=>new Request('https://example.test/population-exposure?lat=-38&lng=-73&mag=5&depth=10&time=1000000'+extra);
let calls=0;
globalThis.fetch=async(url,options)=>{
 calls++;assert.equal(options.method,'POST');const body=JSON.parse(options.body);assert.equal(body.year,2020);assert.equal(JSON.parse(body.geojson).type,'FeatureCollection');
 return new Response(JSON.stringify({status:'finished',data:{total_population:[555,55,15][calls-1]}}));
};
const first=await Promise.all([handlePopulationExposure(request(),env),handlePopulationExposure(request(),env)]);
assert.equal(calls,3);const body=await first[0].json();assert.equal(body.method,'worldpop');assert.deepEqual(body.ranges.map(r=>r.population),[555,55,15]);assert.equal(body.year,2020);
await handlePopulationExposure(request(),env);assert.equal(calls,3);
// Qualquer mudança de magnitude tem outro resultado/cache.
globalThis.fetch=async()=>new Response('unavailable',{status:503});
const failed=await (await handlePopulationExposure(new Request(request().url.replace('mag=5','mag=5.1')),env)).json();assert.equal(failed.status,'unavailable');assert(!('ranges'in failed));
assert.equal((await handlePopulationExposure(new Request('https://example.test/population-exposure'),env)).status,400);
assert.equal((await handlePopulationExposure(new Request(request().url,{method:'POST'}),env)).status,405);
assert.equal((await (await handlePopulationExposure(new Request(request().url.replace('mag=5','mag=2')),env)).json()).status,'unsupported');
// PAGER tem preferência e nunca chama WorldPop quando existe um produto compatível.
let pagerCalls=0;
globalThis.fetch=async url=>{
 pagerCalls++;
 if(String(url).includes('fdsnws'))return new Response(JSON.stringify({geometry:{coordinates:[-73,-38,10]},properties:{mag:5,time:1000000,products:{losspager:[{updateTime:123,preferredWeight:100,contents:{'pager.xml':{url:'https://earthquake.usgs.gov/product/losspager/id/pager.xml'}}}]}}}));
 assert(String(url).includes('pager.xml'));return new Response(xml);
};
const pager=await(await handlePopulationExposure(request('&eventId=us-test'),env)).json();assert.equal(pager.method,'pager');assert.equal(pagerCalls,2);assert.deepEqual(pager.ranges.map(r=>r.population),[555,55,15]);
// Tarefas assíncronas são reutilizadas; consulta ao progresso não cria outro POST.
let posts=0;globalThis.fetch=async(url,options={})=>{if(options.method==='POST'){posts++;return new Response(JSON.stringify({status:'created',taskid:'task-'+posts}));}return new Response(JSON.stringify({status:'finished',data:{total_population:10}}));};
const pendingRequest=new Request(request().url.replace('lat=-38','lat=-39'));
assert.equal((await(await handlePopulationExposure(pendingRequest,env)).json()).status,'pending');assert.equal(posts,3);
assert.equal((await(await handlePopulationExposure(pendingRequest,env)).json()).status,'pending');assert.equal(posts,3);
const originalNow=Date.now;Date.now=()=>originalNow()+11000;
const done=await(await handlePopulationExposure(pendingRequest,env)).json();Date.now=originalNow;assert.equal(done.status,'available');assert.equal(posts,3);
// O cliente rejeita dados inconsistentes e escapa textos remotos.
const doc={addEventListener(){},getElementById(){return null}},context={document:doc,window:{},formatarPessoasHeadline:n=>String(n),AbortController,setTimeout,clearTimeout,Date};vm.createContext(context);vm.runInContext(readFileSync(new URL('../../js/population-exposure.js',import.meta.url),'utf8'),context);
const html=context.window.renderExposicaoPopulacionalHTML({...body,note:'<img src=x onerror=alert(1)>'});assert(html.includes('&lt;img'));assert(!html.includes('<img'));assert(html.includes('MMI III+'));assert.equal(context.window.renderExposicaoPopulacionalHTML({...body,ranges:[{population:null}]}),'');
console.log('PASS: radii, antimeridian, PAGER schema/cumulative exposure, WorldPop results and tasks, cache/dedup, revisions, failures, parameter validation, safe UI');
