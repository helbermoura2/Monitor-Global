/* Presentation stay starts after actual camera arrival, bounded even on failure. */
(function(){'use strict';let active=null,timer=null;
function limitMs(item){return item?.type==='tsunami'?60000:20000;}
function clear(){clearTimeout(timer);timer=null;active=null;}
function expire(context){if(active!==context||eventoSelecionadoId!==context.id)return;if(document.hidden){timer=null;return;}
 if(context.entryPending&&window.EventCamera?.owns(context.id)&&Date.now()-context.entryStarted<180000){timer=setTimeout(()=>expire(context),250);return;}
 window.VolcanoPriority?.finishPresentation?.(context.id);clear();runAutoCycle(true);
}
function arm(context){clearTimeout(timer);timer=setTimeout(()=>expire(context),Math.max(1,context.deadline-Date.now()));}
function begin(item,mode){if(mode==='quake'){clear();return;}const ms=limitMs(item);if(active?.id===item.id&&active.mode===mode&&active.ms>=ms)return;clear();const context=active={id:item.id,mode,ms,startedAt:Date.now(),deadline:Date.now()+ms,entryPending:false};arm(context);}
function delayEntry(id,ms){if(active?.id!==id)return;const context=active;context.entryPending=true;context.entryStarted=Date.now();context.startedAt=Date.now();context.deadline=context.startedAt+context.ms+ms;arm(context);}
function arrived(id){if(active?.id!==id||!active.entryPending)return;const context=active;context.entryPending=false;context.startedAt=Date.now();context.deadline=context.startedAt+context.ms;arm(context);}
function extendStay(id,ms){if(active?.id!==id||!Number.isFinite(ms)||ms<=active.ms)return;const context=active,stay=Math.min(180000,ms);if(stay<=context.ms)return;context.deadline+=stay-context.ms;context.ms=stay;arm(context);}
function wait(ms){return active?.id===eventoSelecionadoId?Math.min(ms,Math.max(1,active.deadline-Date.now())):ms;}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active&&!timer)arm(active);});
window.PresentationLimits={begin,clear,wait,delayEntry,arrived,extendStay,limitMs,state:()=>active};
})();
