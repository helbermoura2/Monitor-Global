/* Reuse arrival deadlines; selecting or rotating an event never renews them. */
(()=>{
 'use strict';
 const badge=document.getElementById('pd-event-status');if(!badge)return;
 const states=new Map();let timer;
 function sync(){
  clearTimeout(timer);const now=Date.now();
  for(const [id,state]of states)if(state.until<=now)states.delete(id);
  for(const [kind,map]of [['new',typeof activeAlertingIds!=='undefined'?activeAlertingIds:new Map()],['updated',typeof activeUpdatedIds!=='undefined'?activeUpdatedIds:new Map()]]){
   for(const [id,until]of map)if(until>now&&(kind==='updated'||!states.has(id)||states.get(id).kind==='new'))states.set(id,{kind,until});
  }
  const state=states.get(window.EventStore?.selectedId);
  badge.hidden=!state;
  badge.textContent=state?(state.kind==='updated'?'ATUALIZADO':'NOVO'):'';
  badge.dataset.kind=state?.kind||'';
  if(states.size)timer=setTimeout(sync,Math.max(1,Math.min(...[...states.values()].map(s=>s.until))-now));
 }
 window.EventStore?.subscribe(sync);sync();
})();
