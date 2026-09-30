const vm=require('node:vm'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
function source(file,start,end){const s=fs.readFileSync(path.join(__dirname,'../../js',file),'utf8');const a=s.indexOf(start);return s.slice(a,s.indexOf(end,a));}
let ready=true;const tones=[],pending=[];const ctx={somAtivo:true,somMutedTypes:new Set(),SOM_SISMO_MIN:3,minMagnitude:0,ensureAudio:()=>ready,queuePendingSound:s=>pending.push(s),agendarSom:fn=>fn(),tone:(...x)=>tones.push(x),noise(){},agendarFala(){}};
vm.createContext(ctx);vm.runInContext(source('audio.js','function playEarthquakeSound','function playAlertTone'),ctx);
assert.equal(ctx.playEarthquakeSound(5.7,'Costa Rica',10),true);assert.equal(tones.length,6);
ctx.somAtivo=false;assert.equal(ctx.playEarthquakeSound(5.7,'Costa Rica',10),false);ctx.somAtivo=true;
ctx.somMutedTypes.add('quake');assert.equal(ctx.playEarthquakeSound(5.7,'Costa Rica',10),false);ctx.somMutedTypes.clear();
ready=false;assert.equal(ctx.playEarthquakeSound(2,'Pequeno',10),false);assert.equal(pending.length,0);assert.equal(ctx.playEarthquakeSound(5.7,'Costa Rica',10),true);assert.equal(pending.length,1);
let now=10000000;const sounds=[],mapCalls=[];const ingest={Date:{now:()=>now},SISMO_NOVO_RECENTE_MS:1800000,SOM_SISMO_MIN:3,minMagnitude:0,globalEvents:[],knownEventIds:new Set(),isFirstLoad:false,activeAlertingIds:new Map(),activeUpdatedIds:new Map(),activeLateIds:new Map(),sismosSonorizados:new Set(),mostrarNovosSismosNoMapa:ev=>mapCalls.push(ev),somJaTocadoParaRegiao:()=>false,registrarSomSismo(){},playEarthquakeSound:(mag,place)=>{sounds.push(mag);return true},console:{log(){},warn(){}},construirIndiceEspacial:list=>({encontrar:(coords,fn)=>list.find(fn),inserir(){}})};
vm.createContext(ingest);
vm.runInContext(source('sismo-fontes.js','function anunciarSismosSuplementares','/* Reforço via USGS'),ingest);
const ev={type:'earthquake',time:now-6*60000,coords:[-85,9],mag:5.7,place:'Costa Rica',depth:0};
assert.equal(ingest.planetReinforcementDedupEAdiciona([ev],'EMSC'),1);assert.deepEqual(sounds,[5.7]);assert.equal(ingest.activeAlertingIds.has(ev.id),true);
assert.equal(ingest.planetReinforcementDedupEAdiciona([{...ev,mag:5.6}],'USGS'),0);assert.equal(sounds.length,1);
const old={...ev,time:now-3600000,coords:[-70,5]};ingest.planetReinforcementDedupEAdiciona([old],'EMSC');assert.equal(sounds.length,1);assert.equal(ingest.activeLateIds.has(old.id),true);
ingest.isFirstLoad=true;ingest.planetReinforcementDedupEAdiciona([{...ev,time:now-60000,coords:[-80,1]}],'USGS');assert.equal(sounds.length,1);
console.log('PASS: M5.7 sound, explicit accepted/blocked/queued result, silent below threshold, 6-minute supplementary arrival, duplicate/revision stays silent, old/initial-load stays silent');

