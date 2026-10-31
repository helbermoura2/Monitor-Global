const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function engine(){
 let now=0,serial=0,moving=false,center=[-47,-23],zoom=8;const timers=new Map(),listeners=new Set(),calls=[],pad={top:80,bottom:0,left:0,right:300};
 const c={window:null,Date:{now:()=>now},matchMedia:()=>({matches:false}),eventoSelecionadoId:'first',userInteractingWithGlobe:false,addEventListener(){},SeismicFocus:{padding:()=>pad},
 setTimeout(fn,ms=0){const id=++serial;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),
 map:{stop(){},on:(name,fn)=>listeners.add(fn),off:(name,fn)=>listeners.delete(fn),isMoving:()=>moving,getCenter:()=>({lng:center[0],lat:center[1]}),getZoom:()=>zoom,getMinZoom:()=>0,getPadding:()=>pad,getContainer:()=>({clientWidth:1280}),jumpTo(){throw Error('Camera must never teleport');},flyTo(){throw Error('Use the continuous native itinerary');},easeTo:o=>{calls.push(o);center=o.center;zoom=o.zoom;}}};
 c.window=c;vm.runInNewContext(fs.readFileSync('js/event-camera.js','utf8'),c);
 function advance(ms){const end=now+ms;while(true){const job=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!job)break;timers.delete(job[0]);now=job[1].at;job[1].fn();}now=end;}
 c.EventCamera.enter('first',{center,anchor:center,zoom:8});advance(6000);calls.length=0;
 return {c,calls,pad,advance,moving:value=>moving=value,end(){for(const fn of [...listeners])fn();},listeners};
}
test('out / world travel / approach preserve native optical framing with no snaps',()=>{
 const s=engine();s.c.eventoSelecionadoId='california';s.c.EventCamera.enter('california',{center:[-122,38],anchor:[-122,38],zoom:10});
 assert.deepEqual(JSON.parse(JSON.stringify(s.calls[0].center)),[-47,-23]);assert.equal(s.calls[0].zoom,1.1);assert.deepEqual(s.calls[0].padding,s.pad);
 s.advance(6000);assert.deepEqual(JSON.parse(JSON.stringify(s.calls[1].center)),[-122,38]);assert.equal(s.calls[1].zoom,1.1);
 s.advance(6000);assert.deepEqual(s.calls[2].center,s.calls[1].center);assert.equal(s.calls[2].zoom,10);assert.ok(s.calls.every(c=>!('offset' in c)));s.advance(6000);assert.equal(s.c.EventCamera.owns('california'),false);
});
test('a delayed renderer finishes its leg before another angle is requested',()=>{
 const s=engine();s.c.eventoSelecionadoId='late';s.c.EventCamera.enter('late',{center:[-155,19],anchor:[-155,19],zoom:9});s.moving(true);s.advance(6500);assert.equal(s.calls.length,1);assert.equal(s.c.EventCamera.state().stage,'out');
 s.moving(false);s.end();assert.equal(s.calls.length,2);assert.equal(s.c.EventCamera.state().stage,'travel');s.advance(6000);assert.equal(s.calls.length,3);s.advance(6000);assert.equal(s.c.EventCamera.owns('late'),false);
});
test('target revisions are used at distance; cancellation removes pending stages',()=>{
 const s=engine();s.c.eventoSelecionadoId='revised';s.c.EventCamera.enter('revised',{center:[-100,50],zoom:8});s.advance(2000);s.c.EventCamera.enter('revised',{center:[-105,54],zoom:9});s.advance(4000);assert.deepEqual(JSON.parse(JSON.stringify(s.calls[1].center)),[-105,54]);
 s.c.EventCamera.cancel();const before=s.calls.length;s.advance(18000);s.end();assert.equal(s.calls.length,before);assert.equal(s.listeners.size,0);
});

test('long tasks advance the visual clock by a bounded step rather than skipping angles',()=>{
 const s=engine();s.c.eventoSelecionadoId='hiccup';s.c.EventCamera.enter('hiccup',{center:[-155,19],anchor:[-155,19],zoom:8});s.moving(true);const easing=s.calls[0].easing;assert.equal(easing(0),0);s.advance(2000);const first=easing(.33);assert.ok(first<.001);s.advance(2000);const second=easing(.66);assert.ok(second-first<.001);assert.equal(s.calls.length,1);s.c.EventCamera.cancel();
});

test('polar descent uses the native destination anchor only after world travel',()=>{
 const s=engine();s.c.eventoSelecionadoId='polar';s.c.EventCamera.enter('polar',{center:[27,67.25],zoom:10});
 assert.equal(s.calls[0].around,undefined);
 s.advance(6000);assert.equal(s.calls[1].around,undefined);
 s.advance(6000);assert.deepEqual(JSON.parse(JSON.stringify(s.calls[2].around)),[27,67.25]);
 assert.equal(s.calls[2].padding.top,0);assert.ok(!('offset' in s.calls[2]));
 s.advance(6000);assert.equal(s.c.EventCamera.owns('polar'),false);
});

test('an initial six-second entry can still pan to a different destination',()=>{
 const s=engine();s.c.EventCamera.enter('first',{center:[27,67.25],zoom:10});
 assert.equal(s.calls[0].around,undefined);assert.deepEqual(JSON.parse(JSON.stringify(s.calls[0].center)),[27,67.25]);
});

test('globe anchoring runs on the native camera clone after zoom and restores the previous hook',()=>{
 const s=engine(),point={x:400,y:260},previous=()=>({roll:2});
 s.c.GlobePreview={state:()=>({testing:true}),worldZoom:()=>1.1};
 s.c.map.project=()=>point;s.c.map.transformCameraUpdate=previous;
 s.c.eventoSelecionadoId='globe-polar';s.c.EventCamera.enter('globe-polar',{center:[27,67.25],zoom:10});
 assert.equal(s.c.map.transformCameraUpdate,previous);s.advance(12000);
 assert.equal(s.calls[2].around,undefined);const update=s.c.map.transformCameraUpdate;
 const transform={center:{lng:27,lat:65},zoom:8.5,setLocationAtPoint(location,screen){assert.deepEqual(JSON.parse(JSON.stringify(location)),{lng:27,lat:67.25});assert.equal(screen,point);this.center={lng:27,lat:67.2};}};
 const result=update(transform);assert.equal(result.center,transform.center);assert.equal(result.zoom,8.5);assert.equal(result.roll,2);
 s.advance(6000);assert.equal(s.c.map.transformCameraUpdate,previous);
});
test('cancelling a globe descent releases its anchor before manual interaction',()=>{
 const s=engine();s.c.GlobePreview={state:()=>({testing:true}),worldZoom:()=>1.1};s.c.map.project=()=>({x:400,y:260});
 s.c.eventoSelecionadoId='cancel-polar';s.c.EventCamera.enter('cancel-polar',{center:[27,67.25],zoom:10});s.advance(12000);
 assert.equal(typeof s.c.map.transformCameraUpdate,'function');s.c.EventCamera.cancel(null,false);
 assert.equal(s.c.map.transformCameraUpdate,undefined);s.advance(6000);assert.equal(s.c.EventCamera.state(),null);
});
