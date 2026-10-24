const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/sismo-fontes.js','utf8');
// The pre-index matching loop, reconstructed independently from the unchanged
// full scan contract. Run identical inputs through both implementations.
const start=source.indexOf('        const nearby=[];'),end=source.indexOf('            const g = groups[i];',start);
const reference=source.slice(0,start)+'        for (let i=0;i<groups.length;i++) {\n'+source.slice(end);
function load(code,windowMs=120000){let distances=0;const c={window:{},haversine:(a,b,x,y)=>{distances++;return Math.hypot(a-x,b-y)*111;},SISMO_DEDUPE_RAIO_KM:90,SISMO_DEDUPE_TOL_MS:windowMs,SISMO_MAG_DIVERGENCIA_TOL:.3,SISMO_MAG_DIVERGENCIA_FORTE:1};vm.createContext(c);vm.runInContext(code.slice(code.indexOf('const SISMO_SOURCES'),code.indexOf('function normalizarSismoGeoJSON'))+code.slice(code.indexOf('// Prefer published solutions'),code.indexOf('/* ═══════════════ AFAD')),c);return {merge:r=>JSON.parse(JSON.stringify(c.mergeEarthquakeReports(r))),distances:()=>distances};}
function rows(seed,count){let state=seed;const rand=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/4294967296);return Array.from({length:count},(_,i)=>{const base=Math.floor(i/3),s=['GEONET','USGS','EMSC'][i%3];return {id:s+'-'+base,sourceEventId:String(base),source:s,time:1792470030000-base*270000+Math.floor(rand()*180000),coords:[Math.floor(base/4)%3*50+rand()*.4,-25+rand()*.4],depth:10,mag:3+rand()*3,isPreliminary:i%5===0};});}
test('time indexing preserves full-scan grouping, precedence and insertion-order ties',()=>{
 for(const windowMs of [120000,300000])for(let seed=1;seed<=12;seed++){
  const input=rows(seed,300);assert.deepEqual(load(source,windowMs).merge(input),load(reference,windowMs).merge(input),'seed '+seed);
 }
});
test('sparse 36-hour catalogue skips impossible distance comparisons',()=>{
 const input=rows(123,1200),fast=load(source),slow=load(reference);
 assert.deepEqual(fast.merge(input),slow.merge(input));
 assert(fast.distances()<slow.distances()*.02,JSON.stringify({fast:fast.distances(),slow:slow.distances()}));
});
test('bucket boundaries and a preferred solution moving a group to another bucket stay equivalent',()=>{
 const r=rows(77,180).map((q,i)=>({...q,time:Math.floor(1792470030000/120000)*120000-Math.floor(i/3)*240000+[1,-1,-119999][i%3]}));
 assert.deepEqual(load(source).merge(r),load(reference).merge(r));
});
