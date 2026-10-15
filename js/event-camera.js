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
 const ease=o=>{if(valid())map.easeTo({...o,bearing:0,pitch:0,padding:0,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:6000,essential:true,easing:t=>t*t*(3-2*t)});};
 const final=()=>{if(!valid())return;if(journey.arrive)journey.arrive();else ease(journey.camera);};
 timers.push(setTimeout(()=>{if(!valid())return;const effect=arrivalEffects.get(id);arrivalEffects.delete(id);effect?.();},ms));
 if(ms===6000){final();return ms;}
 const current=map.getCenter(),zoom=window.GlobePreview?.state().testing?Math.min(worldZoom(Math.max(-25,Math.min(25,current.lat))),worldZoom(Math.max(-25,Math.min(25,(Array.isArray(camera.center)?camera.center[1]:camera.center.lat))))):worldZoom();
 ease({center:[current.lng,Math.max(-25,Math.min(25,current.lat))],zoom});
 timers.push(setTimeout(()=>{const c=journey.camera.center,target=Array.isArray(c)?c:[c.lng,c.lat];ease({center:[target[0],Math.max(-25,Math.min(25,target[1]))],zoom});},6000));
 timers.push(setTimeout(final,12000));return ms;
}
window.EventStore?.subscribe((reason,p)=>{if(reason==='select'&&p.id!==lastId)cancel();});
window.addEventListener('pagehide',()=>cancel());
window.addEventListener('load',()=>{if(!map)return;for(const name of ['dragstart','wheel','touchstart'])map.on(name,e=>{if(e?.originalEvent)cancel();});},{once:true});
window.EventCamera={enter,durationFor,cancel,worldZoom,afterArrival:(id,effect)=>arrivalEffects.set(id,effect),owns:id=>trip?.id===id&&Date.now()<trip.endsAt};
})();
