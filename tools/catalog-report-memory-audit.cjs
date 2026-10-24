// Offline replay of the actual merge/preservation functions, with fresh regional
// snapshots on every round. Requires --expose-gc. No feeds, camera or Telegram.
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const arg=name=>process.argv.find(a=>a.startsWith('--'+name+'='))?.split('=').slice(1).join('=');
if(!global.gc)throw Error('Run node --expose-gc tools/catalog-report-memory-audit.cjs');
const sourcePath=arg('source')||'js/sismo-fontes.js',source=fs.readFileSync(sourcePath,'utf8');
const events=Number(arg('events')||200),rounds=Number(arg('rounds')||960);
if(!Number.isInteger(events)||events<1||events>2000||!Number.isInteger(rounds)||rounds<1||rounds>2000)throw Error('Invalid replay size');
const ctx={window:{},haversine:(a,b,c,d)=>Math.hypot(a-c,b-d)*111,SISMO_DEDUPE_RAIO_KM:90,SISMO_DEDUPE_TOL_MS:120000,SISMO_MAG_DIVERGENCIA_TOL:.3,SISMO_MAG_DIVERGENCIA_FORTE:1};
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('const SISMO_SOURCES'),source.indexOf('function normalizarSismoGeoJSON'))+source.slice(source.indexOf('// Prefer published solutions'),source.indexOf('/* ═══════════════ AFAD')),ctx);
const catalogue=new Array(events),samples=[],started=Date.now(),sources=['GEONET','JMA','BMKG','CSN-Chile','OSC-BOL'];
function sample(round){global.gc();samples.push({round,heapBytes:process.memoryUsage().heapUsed,reports:catalogue.reduce((n,q)=>n+(q?.reports.length||0),0),maxReportsPerEvent:Math.max(0,...Array.from(catalogue,q=>q?.reports.length||0))});}
sample(0);
for(let round=1;round<=rounds;round++){
 for(let i=0;i<events;i++){
  const source=sources[i%sources.length];
  // JSON round-trip models each network response's distinct object/string data.
  const raw=JSON.parse(JSON.stringify({type:'earthquake',id:source+'-regional-'+i,source,time:1792470038737-i*600000,coords:[165+(i%5)*.1,-14],mag:4.3+(round%2)*.1,depth:10,depthReported:10,place:'Localidade regional de teste '+i,quality:'A',detailUrl:'https://source.example/quake/'+i}));
  const current=ctx.mergeEarthquakeReports([raw])[0];
  catalogue[i]=ctx.sismoPreserveMatchedReports(current,catalogue[i]);
 }
 if(round%120===0||round===rounds)sample(round);
}
console.log(JSON.stringify({method:'Offline catalogue replay; Node heap after explicit GC. Not a phone/GPU or wall-clock browser benchmark.',sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),events,rounds,equivalentFeedHours:rounds*45/3600,elapsedMs:Date.now()-started,samples},null,2));
