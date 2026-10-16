/* A fixed deadline for automatic presentations, independent of camera/feed timers. */
(function(){
'use strict';
let active=null,timer=null;
function limitMs(item){return item?.type==='tsunami'?60000:20000;}
function clear(){clearTimeout(timer);timer=null;active=null;}
function begin(item,mode){
 if(mode==='quake'){clear();return;}
 const ms=limitMs(item);
 if(active?.id===item.id&&active.mode===mode&&active.ms===ms)return;
 clear();const context=active={id:item.id,mode,ms,startedAt:Date.now(),deadline:Date.now()+ms};
 timer=setTimeout(()=>{
  if(active!==context||eventoSelecionadoId!==context.id)return;
  window.VolcanoPriority?.finishPresentation?.(context.id);
  clear();runAutoCycle(true);
 },ms);
}
function delayEntry(id,ms){
 if(active?.id!==id)return;
 clearTimeout(timer);const context=active;context.startedAt=Date.now();context.deadline=context.startedAt+context.ms+ms;
 timer=setTimeout(()=>{if(active!==context||eventoSelecionadoId!==id)return;window.VolcanoPriority?.finishPresentation?.(id);clear();runAutoCycle(true);},context.deadline-Date.now());
}
function wait(ms){return active?.id===eventoSelecionadoId?Math.min(ms,Math.max(1,active.deadline-Date.now())):ms;}
window.PresentationLimits={begin,clear,wait,delayEntry,limitMs,state:()=>active};
})();
