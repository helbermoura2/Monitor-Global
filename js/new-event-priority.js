/* Chegadas reais aguardam em fila; a rotação só retoma depois da apresentação. */
(function(){'use strict';
const pending=new Map(),presented=new Set();let retry=null,dispatchId=null;
function eligible(item){
 return item&&item.id!=null&&item.type!=='earthquake'&&!/^MODELO LOCAL$/i.test(item.source||'')&&!['forecast','river','bulletin'].includes(item.hazardNature)&&
  isWithinAutoCycleAge(item)&&(!Number.isFinite(item.expiresAt)||item.expiresAt>Date.now())&&
  (!Number.isFinite(item.fimTs)||item.fimTs>Date.now())&&(!Number.isFinite(item.inicioTs)||item.inicioTs<=Date.now())&&
  (Array.isArray(item.coords)&&item.coords.length>=2&&item.coords.slice(0,2).every(Number.isFinite)||item.hazardNature==='warning'&&!item.coords);
}
function arm(){if(document.hidden||retry||!pending.size)return;retry=setTimeout(()=>{retry=null;focus();if(pending.size)arm();},2000);}
function queue(items){for(const item of items||[]){if(!eligible(item)||presented.has(item.id))continue;if(!pending.has(item.id))pending.set(item.id,{arrived:Date.now(),ref:item});}arm();}
function dispatching(item){return dispatchId===item?.id;}
function markPresented(item){if(!item)return;pending.delete(item.id);presented.add(item.id);if(presented.size>5000)presented.delete(presented.values().next().value);}
function reconcile(){for(const [id,entry] of [...pending]){let item=globalAlerts.find(a=>a.id===id);if(!item&&entry.ref?.id!==id&&globalAlerts.includes(entry.ref)){pending.delete(id);item=entry.ref;if(!pending.has(item.id))pending.set(item.id,entry);}if(!eligible(item)||presented.has(item?.id))pending.delete(item?.id??id);}}
function hasPending(){reconcile();return pending.size>0;}
function focusAlert(){
 if(document.hidden)return false;
 reconcile();if(!pending.size||!map)return false;
 const active=window.PresentationLimits?.state();
 if(getAutoCycleProtectionRemaining()>0||active?.mode==='priority'&&active.id===eventoSelecionadoId&&active.deadline>Date.now()){arm();return false;}
 const entries=[...pending].map(([id,entry])=>({item:globalAlerts.find(a=>a.id===id),...entry}));
 entries.sort((a,b)=>(Number(b.item.sev)||0)-(Number(a.item.sev)||0)||a.arrived-b.arrived);
 const item=entries[0].item;dispatchId=item.id;window.__mgSoftCycle=false;
 try{showAlertDetails(item,true);}finally{dispatchId=null;}
 if(eventoSelecionadoId===item.id){markPresented(item);return true;}
 arm();return false;
}
function focus(){
 if(typeof focusNextNewCameraQuake==='function'&&focusNextNewCameraQuake(5))return true;
 if(window.VolcanoPriority?.focus())return true;
 if(typeof focusNextNewCameraQuake==='function'&&focusNextNewCameraQuake())return true;
 return focusAlert();
}
window.NewEventPriority={queue,focus,focusAlert,hasPending,dispatching,markPresented};
})();
