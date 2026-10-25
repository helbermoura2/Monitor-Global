/* Presentation stay starts after actual camera arrival, bounded even on failure. */
(function(){'use strict';let active=null,timer=null;
function threat(item){return window.TsunamiRegional?.hasThreat(item)??(item?.hazardNature==='warning'&&!item.cancelled);}
function limitMs(item,mode){return item?.type==='tsunami'?(mode==='manual'||threat(item)?60000:10000):20000;}
function reconcile(item){
 if(!active||item?.type!=='tsunami'||item._tsunamiStale||item.retained)return;const ref=active.tsunamiRef;if(!ref)return;
 const same=item.id===active.id||(item.feedKey||item.source)===(ref.feedKey||ref.source)&&window.TsunamiLink?.sameEvent(ref,item);if(!same||Number.isFinite(ref.time)&&Number.isFinite(item.time)&&item.time<ref.time)return;
 if(Number.isFinite(item.time))ref.time=item.time;
 const migrated=active.id!==item.id&&eventoSelecionadoId===item.id;if(migrated)active.id=item.id;
 if(threat(item)){if(migrated)arm(active);return;}
 if(active.allowExtend){window.CinematicCard?.stop();window.TsunamiPresentation?.stop();if(typeof stopTsunamiWave==='function')stopTsunamiWave();}active.allowExtend=false;
 if(active.mode==='manual'){if(migrated)arm(active);return;}
 active.downgraded=true;active.entryPending=false;active.ms=Math.min(active.ms,10000);active.deadline=Math.min(active.deadline,Date.now()+10000);arm(active);
}
function clear(){clearTimeout(timer);timer=null;active=null;}
function expire(context){if(active!==context||eventoSelecionadoId!==context.id)return;if(document.hidden){timer=null;return;}
 if(context.entryPending&&window.EventCamera?.owns(context.id)&&Date.now()-context.entryStarted<180000){timer=setTimeout(()=>expire(context),250);return;}
 window.VolcanoPriority?.finishPresentation?.(context.id);clear();runAutoCycle(true);
}
function arm(context){clearTimeout(timer);timer=setTimeout(()=>expire(context),Math.max(1,context.deadline-Date.now()));}
function begin(item,mode){if(mode==='quake'){clear();return;}const ms=limitMs(item,mode);if(active?.id===item.id&&active.mode===mode&&active.ms>=ms){reconcile(item);return;}clear();const context=active={id:item.id,mode,ms,startedAt:Date.now(),deadline:Date.now()+ms,entryPending:false,downgraded:false,allowExtend:item.type!=='tsunami'||threat(item),tsunamiRef:item.type==='tsunami'?{id:item.id,type:item.type,feedKey:item.feedKey,source:item.source,officialEventId:item.officialEventId,time:item.time,originTime:item.originTime,coords:item.coords?.slice(),coordinateRole:item.coordinateRole}:null};arm(context);}
function delayEntry(id,ms){if(active?.id!==id||active.downgraded)return;const context=active;context.entryPending=true;context.entryStarted=Date.now();context.startedAt=Date.now();context.deadline=context.startedAt+context.ms+ms;arm(context);}
function arrived(id){if(active?.id!==id||!active.entryPending)return;const context=active;context.entryPending=false;context.startedAt=Date.now();context.deadline=context.startedAt+context.ms;arm(context);}
function extendStay(id,ms){if(active?.id!==id||!Number.isFinite(ms)||ms<=active.ms)return;const context=active;if(!context.allowExtend)return;const stay=Math.min(180000,ms);if(stay<=context.ms)return;context.deadline+=stay-context.ms;context.ms=stay;arm(context);}
function wait(ms){return active?.id===eventoSelecionadoId?Math.min(ms,Math.max(1,active.deadline-Date.now())):ms;}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active&&!timer)arm(active);});
window.PresentationLimits={begin,clear,wait,delayEntry,arrived,extendStay,limitMs,reconcile,state:()=>active};
})();
