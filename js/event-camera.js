/* Every event-to-event trip leaves the surface before approaching its destination. */
(function(){'use strict';let lastId=null,token=0,timers=[],trip=null;const arrivalEffects=new Map();
function cancel(keepId=null){token++;for(const t of timers)clearTimeout(t);timers=[];trip=null;for(const id of arrivalEffects.keys())if(id!==keepId)arrivalEffects.delete(id);}
function worldZoom(latitude){if(window.GlobePreview?.state().testing)return GlobePreview.worldZoom(latitude);const width=map.getContainer().clientWidth||window.innerWidth;return Math.max(map.getMinZoom(),Math.min(1.1,Math.log2(width/512)));}
function durationFor(id){return lastId!==null&&lastId!==id?18000:6000;}
function enter(id,camera,arrive){
 if(trip?.id===id&&Date.now()<trip.endsAt){trip.camera=camera;trip.arrive=arrive;return Math.max(0,trip.endsAt-Date.now());}
 const ms=durationFor(id);cancel(id);const generation=token;lastId=id;const journey=trip={id,camera,arrive,endsAt:Date.now()+ms};
 clearTimeout(window.__mgRecenterT);clearTimeout(window.__mgRecenterAlertT);map.stop();userInteractingWithGlobe=true;
 window.PresentationLimits?.delayEntry?.(id,ms);
 const valid=()=>token===generation&&eventoSelecionadoId===id;
 const ease=(o,approach=false)=>{if(valid())map[approach?'flyTo':'easeTo']({...o,bearing:0,pitch:0,padding:!approach&&window.GlobePreview?.state().testing?GlobePreview.availableRadius().padding:0,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:6000,essential:true,curve:1.42,easing:t=>t*t*(3-2*t)});};
 const final=()=>{
  if(!valid())return;
  // A timer can run before the renderer's last pan frame. Finish that tiny
  // residual at world scale, so it cannot turn into a large slide at close zoom.
  if(ms===18000)map.jumpTo({center:journey.camera.center});
  // flyTo spends the geographical correction high above the destination,
  // including the latitude limits imposed by Mercator at whole-world zoom.
  if(journey.arrive)journey.arrive();else ease(journey.camera,true);
 };
 timers.push(setTimeout(()=>{if(!valid())return;const effect=arrivalEffects.get(id);arrivalEffects.delete(id);effect?.();},ms));
 if(ms===6000){final();return ms;}
 // Align with the real destination while still high above the surface. Clamping
 // its latitude made high-latitude events slide sideways during the descent.
 const current=map.getCenter(),latitude=c=>Array.isArray(c)?c[1]:c.lat;
 const zoom=window.GlobePreview?.state().testing?Math.min(worldZoom(current.lat),worldZoom(latitude(camera.center))):worldZoom();
 ease({center:[current.lng,current.lat],zoom});
 timers.push(setTimeout(()=>ease({center:journey.camera.center,zoom}),6000));
 timers.push(setTimeout(final,12000));return ms;
}
window.EventStore?.subscribe((reason,p)=>{if(reason==='select'&&p.id!==lastId)cancel();});
window.addEventListener('pagehide',()=>cancel());
window.addEventListener('load',()=>{if(!map)return;for(const name of ['mousedown','dragstart','wheel','touchstart'])map.on(name,e=>{if(e?.originalEvent)cancel();});},{once:true});
window.EventCamera={enter,durationFor,cancel,worldZoom,afterArrival:(id,effect)=>arrivalEffects.set(id,effect),owns:id=>trip?.id===id&&Date.now()<trip.endsAt};
})();
