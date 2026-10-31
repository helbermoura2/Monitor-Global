/* Native, continuous out / globe travel / in. No per-leg teleports or offsets. */
(function(){'use strict';let lastId=null,token=0,trip=null,stageTimer=null,stageEnd=null,motionEnd=null;const arrivalEffects=new Map(),worldEffects=new Map();
function clearStage(){clearTimeout(stageTimer);clearTimeout(motionEnd);motionEnd=null;stageTimer=null;if(stageEnd){map.off?.('moveend',stageEnd);stageEnd=null;}}
function cancel(keepId=null,stopCamera=true){const wasMoving=trip&&!trip.finished;clearStage();window.MapRenderBudget?.finish();if(trip?.id!==keepId)worldEffects.delete(trip?.id);token++;trip=null;if(wasMoving&&stopCamera)map.stop();for(const id of arrivalEffects.keys())if(id!==keepId)arrivalEffects.delete(id);}
function worldEffect(effect){try{effect();}catch(error){console.warn('[som na visão global]',error);}}
function releaseWorld(id){if(trip?.id!==id||eventoSelecionadoId!==id)return;trip.worldReady=true;const entry=worldEffects.get(id);worldEffects.delete(id);if(entry&&entry.until>Date.now())worldEffect(entry.effect);}
function afterWorldView(id,effect){
 if(id==null||typeof effect!=='function')return false;
 for(const [key,entry]of worldEffects)if(entry.until<=Date.now())worldEffects.delete(key);
 if(trip?.id===id&&trip.worldReady&&eventoSelecionadoId===id){worldEffect(effect);return true;}
 worldEffects.set(id,{effect,until:Date.now()+15*60000});if(worldEffects.size>32)worldEffects.delete(worldEffects.keys().next().value);return true;
}
function worldZoom(latitude){if(window.GlobePreview?.state().testing)return GlobePreview.worldZoom(latitude);const width=map.getContainer().clientWidth||window.innerWidth;return Math.max(map.getMinZoom(),Math.min(1.1,Math.log2(width/512)));}
function durationFor(id){return lastId!==null&&lastId!==id?18000:6000;}
const zero=()=>({top:0,right:0,bottom:0,left:0});
function enter(id,camera,arrive){
 if(trip?.id===id&&!trip.finished){trip.camera=camera;trip.arrive=arrive;return Math.max(0,trip.endsAt-Date.now());}
 const ms=durationFor(id);cancel(id);window.MapRenderBudget?.begin(map);const generation=token;lastId=id;const journey=trip={id,camera,arrive,endsAt:Date.now()+ms,finished:false,stage:'entry'};
 clearTimeout(window.__mgRecenterT);clearTimeout(window.__mgRecenterAlertT);map.stop();userInteractingWithGlobe=true;
 window.PresentationLimits?.delayEntry?.(id,ms);
 const valid=()=>token===generation&&trip===journey&&eventoSelecionadoId===id;
 const target=()=>({...journey.camera,center:journey.camera.anchor||journey.camera.center,padding:journey.camera.anchor?SeismicFocus.padding():journey.camera.padding||zero()});
 function leg(name,options,next,custom){
  if(!valid())return;clearStage();journey.stage=name;const started=Date.now(),deadline=started+6000;
  // Wait for the renderer to finish a leg. A delayed frame must not be cut off
  // by a wall-clock timer starting another angle at the same instant.
  const finish=()=>{
   if(!valid())return;clearTimeout(stageTimer);
   if(window.document?.hidden){stageTimer=null;return;}
   const left=deadline-Date.now();
   if(left>0){stageTimer=setTimeout(finish,left);return;}
   if(map.isMoving?.()){stageTimer=setTimeout(finish,100);return;}
   clearStage();next();
  };
  stageEnd=finish;map.on?.('moveend',stageEnd);
  stageTimer=setTimeout(finish,6000);
  if(custom)custom();else {
   const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches,clock=()=>typeof performance==='undefined'?Date.now():performance.now();let last=clock(),visual=0,finishing=false;
   // Native wall-clock easing skips straight ahead after a long task. Advance
   // the visual clock by at most 50ms per rendered step, extending the journey
   // instead of teleporting to a distant angle when a frame is delayed.
   map.easeTo({...options,bearing:0,pitch:0,duration:reduced?0:86400000,essential:true,easing:()=>{
    const now=clock();visual+=Math.max(0,Math.min(50,now-last));last=now;const t=Math.min(1,visual/6000);
    if(t===1&&!finishing){finishing=true;motionEnd=setTimeout(()=>{motionEnd=null;if(valid()&&journey.stage===name)map.stop();},0);}
    return t*t*(3-2*t);
   }});
  }
 }
 const done=()=>{if(!valid())return;journey.finished=true;journey.endsAt=Date.now();window.PresentationLimits?.arrived?.(id);window.MapRenderBudget?.finish();releaseWorld(id);const effect=arrivalEffects.get(id);arrivalEffects.delete(id);effect?.();};
 const approach=()=>{
  const camera=target();
  // At world zoom the renderer may constrain the centre near the poles.
  // After travelling, zoom around the destination's actual screen position
  // instead of interpolating that constrained centre while descending.
  if(ms!==6000)camera.around=camera.center;
  leg('approach',camera,done,journey.arrive);
 };
 if(ms===6000){approach();return ms;}
 const current=map.getCenter(),center=Array.isArray(current)?current:[current.lng,current.lat];
 const world=worldZoom(center[1]),zoom=Math.min(world,map.getZoom?.()??world,Number(camera.zoom)||world);
 // Keep the present optical centre for the outward leg. Native padding stays
 // continuous: never feed an offset through globe/Mercator latitude conversion.
 const padding=map.getPadding?.()||zero();
 leg('out',{center,zoom,padding},()=>{releaseWorld(id);leg('travel',{...target(),zoom},approach);});
 return ms;
}
window.EventStore?.subscribe((reason,p)=>{if(reason==='select'&&p.id!==lastId)cancel();});
window.addEventListener('pagehide',()=>{cancel();worldEffects.clear();});
window.addEventListener('load',()=>{if(!map)return;for(const name of ['mousedown','dragstart','wheel','touchstart'])map.on(name,e=>{if(e?.originalEvent)cancel(null,false);});},{once:true});
window.document?.addEventListener('visibilitychange',()=>{if(!document.hidden&&trip&&!trip.finished&&stageEnd&&!stageTimer)stageTimer=setTimeout(stageEnd,0);});
window.EventCamera={enter,durationFor,cancel,worldZoom,afterWorldView,afterArrival:(id,effect)=>arrivalEffects.set(id,effect),owns:id=>trip?.id===id&&!trip.finished,state:()=>trip?{id:trip.id,stage:trip.stage,finished:trip.finished}:null};
})();
