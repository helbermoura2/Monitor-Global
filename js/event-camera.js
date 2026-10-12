/* Every event-to-event trip leaves the surface before approaching its destination. */
(function(){'use strict';let lastId=null,token=0,timers=[],trip=null;
function cancel(){token++;for(const t of timers)clearTimeout(t);timers=[];trip=null;}
function worldZoom(){const width=map.getContainer().clientWidth||window.innerWidth;return Math.max(map.getMinZoom(),Math.min(1.1,Math.log2(width/512)));}
function durationFor(id){return lastId!==null&&lastId!==id?18000:6000;}
function enter(id,camera,arrive){
 if(trip?.id===id&&Date.now()<trip.endsAt){trip.camera=camera;trip.arrive=arrive;return Math.max(0,trip.endsAt-Date.now());}
 const ms=durationFor(id);cancel();const generation=token;lastId=id;const journey=trip={id,camera,arrive,endsAt:Date.now()+ms};
 clearTimeout(window.__mgRecenterT);clearTimeout(window.__mgRecenterAlertT);map.stop();userInteractingWithGlobe=true;
 window.PresentationLimits?.delayEntry?.(id,ms);
 const valid=()=>token===generation&&eventoSelecionadoId===id;
 const ease=o=>{if(valid())map.easeTo({...o,bearing:0,pitch:0,padding:0,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:6000,essential:true,easing:t=>t*t*(3-2*t)});};
 const final=()=>{if(!valid())return;if(journey.arrive)journey.arrive();else ease(journey.camera);};
 if(ms===6000){final();return ms;}
 const current=map.getCenter(),zoom=worldZoom();
 ease({center:[current.lng,Math.max(-25,Math.min(25,current.lat))],zoom});
 timers.push(setTimeout(()=>{const c=journey.camera.center,target=Array.isArray(c)?c:[c.lng,c.lat];ease({center:[target[0],Math.max(-25,Math.min(25,target[1]))],zoom});},6000));
 timers.push(setTimeout(final,12000));return ms;
}
window.EventStore?.subscribe((reason,p)=>{if(reason==='select'&&p.id!==lastId)cancel();});
window.addEventListener('pagehide',cancel);
window.EventCamera={enter,durationFor,cancel,worldZoom,owns:id=>trip?.id===id&&Date.now()<trip.endsAt};
})();
