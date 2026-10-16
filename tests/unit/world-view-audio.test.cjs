const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fn(source,name){const i=source.indexOf('function '+name+'(');assert(i>=0,name);return source.slice(i,source.indexOf('\n}',i)+2);}
function setup(){
 let now=0,next=0,ready=true;const timers=new Map(),listeners={},sounds=[],voices=[],selection=[];
 const c={window:null,Date:{now:()=>now},Math,Map,Number,Set,console,eventoSelecionadoId:'first',userInteractingWithGlobe:false,
  setTimeout(f,ms=0){const id=++next;timers.set(id,{f,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),
  matchMedia:()=>({matches:false}),addEventListener:(n,f)=>listeners[n]=f,
  EventStore:{subscribe:f=>selection.push(f)},somAtivo:true,somMutedTypes:new Set(),SOM_SISMO_MIN:3,minMagnitude:0,pendingSounds:[],
  isAudioUnlocked:true,audioContext:{state:'running'},speakAlertTimeoutId:null,ensureAudio:()=>ready,
  agendarSom:f=>f(),tone:(...args)=>sounds.push({at:now,args}),noise:()=>{},speakAlert:(...args)=>voices.push({at:now,args}),
  map:{stop(){},getContainer:()=>({clientWidth:1280}),getMinZoom:()=>0,getCenter:()=>({lng:10,lat:20}),easeTo(){},flyTo(){},jumpTo(){},on(){}}};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('js/event-camera.js','utf8'),c);
 const audio=fs.readFileSync('js/audio.js','utf8');vm.runInContext(['queuePendingSound','flushPendingSounds','playEarthquakePresentationSound','playEarthquakeSound','playAlertTone','agendarFala'].map(n=>fn(audio,n)).join('\n'),c);
 function advance(ms){const end=now+ms;while(true){const pending=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!pending)break;timers.delete(pending[0]);now=pending[1].at;pending[1].f();}now=end;}
 function select(id){c.eventoSelecionadoId=id;for(const f of selection)f('select',{id});}
 c.EventCamera.enter('first',{center:[10,20],zoom:8});advance(6000);
 return {c,advance,select,sounds,voices,ready:v=>ready=v,listeners};
}
const quake={id:'new',mag:6.4,place:'Local',depth:10};
test('quake sound waits for the whole-world leg and voice follows it; arrival effects stay at 18 seconds',()=>{
 const s=setup(),start=s.c.Date.now();s.select(quake.id);s.c.EventCamera.enter(quake.id,{center:[140,35],zoom:9});let card=0;s.c.EventCamera.afterArrival(quake.id,()=>card++);
 assert.equal(s.c.playEarthquakePresentationSound(quake),true);s.advance(5999);assert.equal(s.sounds.length,0);assert.equal(s.voices.length,0);
 s.advance(1);assert(s.sounds.length>0);assert.equal(s.sounds[0].at-start,6000);assert.equal(card,0);
 s.advance(1450);assert.equal(s.voices.length,1);assert.equal(s.voices[0].at-start,7450);s.advance(10550);assert.equal(card,1);
});
test('volcano tone waits for the world view and repeated camera target updates do not replay it',()=>{
 const s=setup();s.select('volcano');s.c.EventCamera.enter('volcano',{center:[120,10],zoom:6});s.c.playAlertTone('volcano','volcano');s.advance(2000);s.c.EventCamera.enter('volcano',{center:[121,11],zoom:7});s.advance(3999);assert.equal(s.sounds.length,0);s.advance(1);assert.equal(s.sounds.length,1);s.advance(12000);assert.equal(s.sounds.length,1);
});
test('interrupted travel cancels its sound and event-bound voice',()=>{
 const s=setup();s.select('new');s.c.EventCamera.enter('new',{center:[140,35],zoom:9});s.c.playEarthquakePresentationSound(quake);s.advance(5000);s.select('other');s.advance(20000);assert.equal(s.sounds.length,0);
 s.select('new');s.c.EventCamera.enter('new',{center:[140,35],zoom:9});s.c.playEarthquakePresentationSound(quake);s.advance(6000);s.select('other');s.advance(2000);assert.equal(s.voices.length,0);
});
test('a waiting quake keeps its own sound until its camera presentation starts',()=>{
 const s=setup();s.c.playEarthquakePresentationSound(quake);s.select('priority');s.c.EventCamera.enter('priority',{center:[30,30],zoom:9});s.advance(18000);assert.equal(s.sounds.length,0);
 s.select('new');s.c.EventCamera.enter('new',{center:[140,35],zoom:9});s.advance(5999);assert.equal(s.sounds.length,0);s.advance(1);assert(s.sounds.length>0);
});
test('mute, threshold and autoplay stay in force; unlocked stale sounds are discarded',()=>{
 const s=setup();s.c.somMutedTypes.add('quake');assert.equal(s.c.playEarthquakePresentationSound(quake),false);s.c.somMutedTypes.clear();s.c.minMagnitude=7;assert.equal(s.c.playEarthquakePresentationSound(quake),false);s.c.minMagnitude=0;
 s.ready(false);s.select('new');s.c.EventCamera.enter('new',{center:[140,35],zoom:9});s.c.playEarthquakePresentationSound(quake);assert.equal(s.c.pendingSounds.length,0);s.advance(6000);assert.equal(s.c.pendingSounds.length,1);assert.equal(s.c.pendingSounds[0].eventId,'new');s.select('other');s.ready(true);s.c.flushPendingSounds();s.advance(2000);assert.equal(s.sounds.length,0);
});
test('initial direct approach releases at arrival, while manual replay stays immediate',()=>{
 const s=setup();s.select('first');s.c.EventCamera.enter('first',{center:[10,20],zoom:9});s.c.playEarthquakePresentationSound({...quake,id:'first'});s.advance(5999);assert.equal(s.sounds.length,0);s.advance(1);assert(s.sounds.length>0);
 const n=s.sounds.length;s.c.playEarthquakeSound(6.4,'Manual',10,0,true);assert(s.sounds.length>n);
});

test('audio failure does not block the camera travelling to its destination',()=>{
 const s=setup();s.c.console={warn(){}};let approached=0;s.c.map.flyTo=()=>approached++;s.select('new');s.c.EventCamera.afterWorldView('new',()=>{throw Error('Audio unavailable');});s.c.EventCamera.enter('new',{center:[140,35],zoom:9});s.advance(18000);assert.equal(approached,1);
});
