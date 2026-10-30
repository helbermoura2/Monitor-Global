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


test('a missing USGS response cannot replace its reviewed value with another agency estimate',()=>{
 const emsc={...base,source:'EMSC',sourceEventId:'e1',mag:6.6,depth:10},gfz={...base,source:'GEOFON',sourceEventId:'g1',mag:6.3};
 let previous=merge([seismic,emsc,gfz])[0];
 for(let i=0;i<12;i++){
  const current=merge(i%2?[seismic,emsc,gfz]:[emsc,gfz])[0];
  if(i%2===0)assert.equal(current.mag,6.6);
  previous=ctx.sismoPreserveMatchedReports(current,previous);assert.equal(previous.mag,6.3);assert.equal(previous.depth,16);assert.equal(previous.reports.length,3);assert.equal(previous.sourceSummary,'USGS · EMSC · GEOFON');
 }
 const newer={...seismic,mag:6.2,sourceUpdatedAt:seismic.sourceUpdatedAt+100};
 previous=ctx.sismoPreserveMatchedReports(merge([newer,emsc])[0],previous);assert.equal(previous.mag,6.2);
 previous=ctx.sismoPreserveMatchedReports(merge([emsc,gfz])[0],previous);assert.equal(previous.mag,6.2);
});
test('an old M6.6 snapshot is corrected once, without hiding the initial correction',()=>{
 const old=merge([tsunami])[0],current=merge([seismic,tsunami])[0];
 const fixed=ctx.sismoPreserveMatchedReports(current,old);assert.equal(old.mag,6.6);assert.equal(fixed.mag,6.3);assert.equal(fixed.depth,16);
 assert.equal(ctx.sismoPreserveMatchedReports(merge([tsunami])[0],fixed).mag,6.3);
});

test('regional reports without sourceEventId replace their snapshot across 1,000 refreshes',()=>{
 for(const source of ['GEONET','JMA','BMKG','CSN-Chile','OSC-BOL','SSN-Mexico']){
  let previous;
  for(let i=0;i<1000;i++){
   const report={...base,source,id:source+'-native-1',mag:4.3+(i%2)*.1,place:'Snapshot '+i};
   const current=merge([report])[0];
   previous=ctx.sismoPreserveMatchedReports(current,previous);
   assert.equal(previous.reports.length,1,source+' refresh '+i);
   assert.equal(previous.reports[0].place,report.place);
   assert.equal(previous.mag,report.mag);
  }
 }
});

test('a new refresh removes already accumulated regional duplicates without losing other reports',()=>{
 const regional={...base,source:'GEONET',id:'GEONET-regional-1',mag:6.3};
 const old={...merge([seismic,regional])[0],reports:[seismic,...Array.from({length:900},()=>({...regional}))]};
 const updated={...regional,mag:6.2,place:'Revised regional solution'};
 const fixed=ctx.sismoPreserveMatchedReports(merge([updated])[0],old);
 assert.equal(fixed.reports.length,2);assert.equal(fixed.mag,6.2);
 assert.equal(fixed.reports.find(r=>r.source==='GEONET').mag,6.2);
 assert.equal(fixed.sourceSummary,'GEONET · USGS');
});

test('report identity is scoped to the agency and preserves distinct native reports',()=>{
 const a={...base,source:'GEONET',id:'same-id',mag:4.3},b={...a,source:'JMA'},c={...a,id:'different-id'};
 const result=merge([a,b,c])[0];assert.equal(result.reports.length,3);
 const next=ctx.sismoPreserveMatchedReports(merge([{...a,mag:4.4}])[0],result);
 assert.equal(next.reports.length,3);assert.equal(next.reports.find(r=>r.source==='GEONET'&&r.id==='same-id').mag,4.4);
});

test('memory counters expose retained report counts without event content',()=>{
 ctx.globalEvents=[{...seismic,reports:[seismic,{...base,id:'secret-event',source:'GEONET',place:'PRIVATE_LOCATION'}]}];
 const stats=ctx.window.SismoReportMemory.stats();
 assert.equal(stats.events,1);assert.equal(stats.reports,2);assert.equal(stats.maxReportsPerEvent,2);
 assert.equal(stats.bySource.USGS,1);assert.equal(stats.bySource.GEONET,1);
 assert.doesNotMatch(JSON.stringify(stats),/secret|PRIVATE|165|14/);
});

test('optional reported depth cannot leak from a lower-priority agency into the selected solution',()=>{
 const other={...base,source:'EMSC',sourceEventId:'e-depth',mag:6.6,depth:10,depthReported:10};
 for(const selected of [seismic,{...seismic,depthReported:null},{...seismic,depthReported:16}])for(const rows of [[other,selected],[selected,other]]){
  const r=merge(rows)[0];assert.equal(r.depth,16);assert.equal(r.depthReported,Object.hasOwn(selected,'depthReported')?selected.depthReported:selected.depth);
 }
});
