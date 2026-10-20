const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('js/sismo-fontes.js','utf8'),ctx={window:{},haversine:(a,b,c,d)=>Math.hypot(a-c,b-d)*111,SISMO_DEDUPE_RAIO_KM:90,SISMO_DEDUPE_TOL_MS:120000,SISMO_MAG_DIVERGENCIA_TOL:.3,SISMO_MAG_DIVERGENCIA_FORTE:1};
vm.createContext(ctx);vm.runInContext(src.slice(src.indexOf('const SISMO_SOURCES'),src.indexOf('function normalizarSismoGeoJSON'))+src.slice(src.indexOf('// Prefer published solutions'),src.indexOf('/* ═══════════════ AFAD')),ctx);
const merge=(rows,previous=[])=>ctx.mergeEarthquakeReports(rows,previous);
const base={type:'earthquake',time:1792470038737,coords:[165.5892,-13.9906],depth:16,source:'USGS',isPreliminary:false,quality:'B'};
const seismic={...base,id:'USGS-us6000u3jl',sourceEventId:'us6000u3jl',sourceNetwork:'us',mag:6.3,magnitudeType:'mww',sourceUpdatedAt:1792477739943,sourceAliases:['us6000u3jl','attn6uqd','pt26293000']};
const tsunami={...base,id:'USGS-pt26293000',sourceEventId:'pt26293000',sourceNetwork:'pt',mag:6.6,magnitudeType:'mi',time:1792470037000,coords:[165.713,-13.869],depth:10,sourceUpdatedAt:1792470573579,sourceAliases:['usauto6000u3jl','attn6uqj','pt26293000']};
test('Vanuatu: reviewed seismic M6.3 wins over the older PTWC Mi6.6 in either order and channel',()=>{
 for(const rows of [[seismic,tsunami],[tsunami,seismic],[{...seismic,source:'USGS-RT'},tsunami]]){
  const r=merge(rows);assert.equal(r.length,1);assert.equal(r[0].mag,6.3);assert.equal(r[0].depth,16);assert.equal(r[0].sourceEventId,'us6000u3jl');assert.equal(r[0].magnitudes.length,1);assert.equal(r[0].magnitudes[0].mag,6.3);assert.equal(r[0].magnitudeSpread,0);
 }
});
test('alternating full/fast/stale catalogues never recreate 6.3→6.6 phantom revisions',()=>{
 let previous=merge([tsunami,seismic]);
 for(let i=0;i<12;i++){previous=merge(i%3===0?[tsunami]:i%3===1?[{...seismic,source:'USGS-RT'}]:[tsunami,seismic],previous);assert.equal(previous[0].mag,6.3);assert.equal(previous[0].reports.length,2);}
});
test('genuine newer revisions can lower or raise magnitude; older snapshots cannot undo them',()=>{
 const newer={...seismic,mag:6.2,sourceUpdatedAt:seismic.sourceUpdatedAt+10000};
 let previous=merge([tsunami,newer],merge([seismic]));assert.equal(previous[0].mag,6.2);
 previous=merge([seismic,tsunami],previous);assert.equal(previous[0].mag,6.2);
 previous=merge([{...newer,mag:6.7,sourceUpdatedAt:newer.sourceUpdatedAt+10000}],previous);assert.equal(previous[0].mag,6.7);
});
test('equal-ranked agencies select deterministically and still disclose divergent values',()=>{
 const emsc={...base,source:'EMSC',sourceEventId:'e1',mag:6.3},gfz={...base,source:'GEOFON',sourceEventId:'g1',mag:6.6};
 for(const rows of [[emsc,gfz],[gfz,emsc]]){const r=merge(rows)[0];assert.equal(r.source,'EMSC');assert.equal(r.mag,6.3);assert.equal(r.magnitudes.length,2);assert.equal(r.magnitudeSpread,.3);assert.equal(r.sourceSummary,'EMSC · GEOFON');}
});
test('native IDs do not revive unrelated old events, and magnitude is not a tie breaker',()=>{
 assert.equal(merge([],merge([seismic])).length,0);
 const other={...seismic,sourceEventId:'us-different',sourceAliases:[],id:'other',time:seismic.time+600000,coords:[150,-20],mag:5};
 const r=merge([other],merge([seismic]));assert.equal(r.length,1);assert.equal(r[0].sourceEventId,'us-different');
 const updated={...seismic,mag:6.1,sourceUpdatedAt:seismic.sourceUpdatedAt+1};assert.equal(merge([seismic,updated])[0].mag,6.1);
});

test('USGS auto-ID alias links a stale PTWC solution to the reviewed seismic native ID',()=>{
 const reviewed={...seismic,sourceAliases:['us6000u3jl','attn6uqd']};
 const previous=merge([reviewed]);const r=merge([tsunami],previous);assert.equal(r[0].mag,6.3);assert.equal(r[0].reports.length,2);
});

test('normalizer preserves native network, magnitude scale, aliases and revision time',()=>{
 ctx.minMagnitude=0;ctx.traduzirEIdentificar=()=>({nome:'Vanuatu'});ctx.getFlagByCoords=()=>'';
 vm.runInContext(src.slice(src.indexOf('function normalizarSismoGeoJSON'),src.indexOf('async function fetchFdsnGeoJSON')),ctx);
 const row=ctx.normalizarSismoGeoJSON([{id:'us6000u3jl',geometry:{coordinates:[165.5892,-13.9906,16]},properties:{net:'us',magType:'mww',ids:',us6000u3jl,pt26293000,',status:'reviewed',updated:1792477739943,mag:6.3,time:1792470038737}}],'USGS',{mag:(f,p)=>p.mag,time:(f,p)=>p.time})[0];
 assert.equal(row.sourceNetwork,'us');assert.equal(row.magnitudeType,'mww');assert.equal(row.sourceUpdatedAt,1792477739943);assert.equal(row.sourceAliases.join(','),'us6000u3jl,pt26293000');
});
