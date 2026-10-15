const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
for(const globe of [false,true])test(`align destination before descending (${globe?'globe':'flat'})`,()=>{
 let now=0,approaches=0;const timers=[],calls=[],padding={top:120,bottom:30,left:330,right:380};let center={lng:-80,lat:-55},descentOrigin;
 const c={Date:{now:()=>now},setTimeout:(fn,ms)=>{const t={fn,at:now+ms};timers.push(t);return t;},clearTimeout:t=>{if(t)t.cancelled=true;},matchMedia:()=>({matches:false}),eventoSelecionadoId:'first',userInteractingWithGlobe:false,
 map:{stop(){},jumpTo:o=>{center={lng:o.center[0],lat:o.center[1]};},getCenter:()=>center,getContainer:()=>({clientWidth:1280}),getMinZoom:()=>0,easeTo:o=>{if(o.zoom===10)descentOrigin=[center.lng,center.lat];calls.push(o);center={lng:o.center[0],lat:o.center[1]};}},window:{addEventListener(){},GlobePreview:{state:()=>({testing:globe}),worldZoom:()=>1.6,availableRadius:()=>({padding})}}};
 vm.runInNewContext(fs.readFileSync('js/event-camera.js','utf8'),c);
 c.map.flyTo=o=>{approaches++;c.map.easeTo(o);};
 // The browser's window properties are global names.
 c.GlobePreview=c.window.GlobePreview;
 function advance(ms){now+=ms;for(const t of timers)if(!t.done&&!t.cancelled&&t.at<=now){t.done=true;t.fn();}}
 c.window.EventCamera.enter('first',{center:[-80,-55],zoom:8});advance(6000);calls.length=0;approaches=0;
 c.eventoSelecionadoId='polar';let effects=0;c.window.EventCamera.afterArrival('polar',()=>effects++);
 const destination=[27,67.25];c.window.EventCamera.enter('polar',{center:destination,zoom:10});
 assert.equal(calls[0].center[1],-55,'outward leg must not slide toward the equator');
 assert.deepEqual(calls[0].padding,globe?padding:0,'whole-globe leg uses the visible space between panels');
 advance(6000);assert.deepEqual(calls[1].center,destination,'travel reaches full latitude before descent');
 center.lng-=.05; // Renderer has not quite reached its last pan frame.
 advance(6000);assert.deepEqual(calls[2].center,calls[1].center,'descent keeps exactly the same center');assert.equal(calls[2].zoom,10);assert.equal(calls[2].padding,0,'event approach restores the event camera framing');assert.equal(effects,0);
 assert.deepEqual(descentOrigin,destination,'finish residual at world scale before descending');
 assert.equal(approaches,1,'use a flight approach to resolve world-view latitude constraints at distance');
 advance(6000);assert.equal(effects,1);
});
