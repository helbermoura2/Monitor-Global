/* Priority for confirmed volcanic escalation; M5+ presentations always win. */
(function(){
'use strict';
const pending=new Map();
let retry=null,dispatchId=null,presentingId=null,presentationUntil=0;
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function evidence(item){
 const text=normalize([item.eruptionStatus,item.vulcanicActivity,item.activityStatus,item.ashStatus,item.detail,item.vonaRemarks].filter(Boolean).join('. '));
 // Ignore negated/historical statements rather than treating every mention as activity.
 const current=text.split(/[.!;,\n]+/).filter(s=>!/(?:no|not|without|sem|nao|nenhum|nenhuma)\b.{0,65}(?:erupt|erup|lava|ash|cinza|explosi|explod|explosao)|(?:last erupted|ultima erupcao|historical|historico|possible|potential|could|might|possivel)|(?:erupt|erup|lava).{0,50}(?:ceased|stopped|ended|paused|encerr|cessou|interromp)|(?:old|cooled|solidified) lava/.test(s)).join('. ');
 const lava=/\blava\b/.test(current),ash=/ash (?:emission|plume|cloud)|emiss.{0,18}(?:ash|cinza)|(?:pluma|nuvem).{0,18}cinza/.test(current);
 const erupting=/erupt(?:ion|ing|ive)|erupcao|eruptiv/.test(current);
 const aviation={green:0,yellow:1,orange:2,red:3}[normalize(item.aviationColor)]||0;
 const alert={normal:0,advisory:1,watch:2,warning:3}[normalize(item.usgsAlertLevel)]||0;
 const gdacs={green:0,orange:2,red:3}[normalize(item.gdacsAlertLevel)]||0;
 const explosive=/explos(?:ion|ao|iv[aeo]\b)|explod/.test(current);
 return {lava,ash,erupting,explosive,notice:String(item.noticeId||item.time||''),level:Math.max(aviation,alert,gdacs),start:String(item.eruptionStart||'')};
}
function capture(alerts){return new Map((alerts||[]).filter(a=>a.type==='volcano').map(a=>[a.id,a._volcanoPriorityEvidence||evidence(a)]));}
function escalation(old,next){
 if(next.explosive&&(!old.explosive||(next.notice&&old.notice&&next.notice!==old.notice&&(!Number.isFinite(Number(next.notice))||!Number.isFinite(Number(old.notice))||Number(next.notice)>Number(old.notice)))))return 'Explosão reportada pela fonte';
 if(next.level>old.level)return 'Elevação do nível de alerta';
 if(next.lava&&!old.lava)return 'Lava reportada pela fonte';
 if(next.erupting&&!old.erupting)return 'Atividade eruptiva reportada';
 if(next.ash&&!old.ash)return 'Emissão de cinzas reportada';
 if(next.erupting&&old.start&&next.start&&old.start!==next.start)return 'Novo início de atividade eruptiva';
 return '';
}
function acceptsUrgent(item,previous){
 const next=evidence(item);
 return previous?Boolean(escalation(previous._volcanoPriorityEvidence||evidence(previous),next)):
  Boolean(next.lava||next.ash||next.erupting||next.explosive||next.level>=3);
}
function enqueue(item,reason){if(!item?.coords)return;pending.set(item.id,{reason,arrived:Date.now(),level:evidence(item).level});}
function observe(before,alerts,ready){
 for(const item of alerts||[]){if(item.type!=='volcano')continue;const next=evidence(item);item._volcanoPriorityEvidence=next;if(!ready||!before.has(item.id))continue;const reason=escalation(before.get(item.id),next);if(!reason)continue;
  item._volcanoEscalation=reason;item._deltaTxt=reason;item._updatedAt=Date.now();
  if(typeof marcarAtualizadoNoTopo==='function')marcarAtualizadoNoTopo(item.id,reason,180000);
  enqueue(item,reason);
  try{showToast('🌋 '+item.place+' · '+reason,'warning');notificarNavegador('🌋 '+item.place,reason);}catch(e){console.warn('[prioridade vulcânica]',e);}
 }
}
function canInterrupt(item){
 const current=globalEvents.find(e=>e.id===eventoSelecionadoId);
 return item?.type==='volcano'&&item.id===dispatchId&&!(Number(current?.mag)>=5);
}
function arm(){if(document.hidden||retry||!pending.size)return;retry=setTimeout(()=>{retry=null;focus();},2000);}
function focus(){
 if(document.hidden)return false;
 if(!pending.size)return false;
 // A strong arrival/revision takes the camera before any volcano in this queue.
 if(typeof focusNextNewCameraQuake==='function'&&focusNextNewCameraQuake(5)){arm();return true;}
 const current=globalEvents.find(e=>e.id===eventoSelecionadoId);
 const strong=Number(current?.mag)>=5;
 const live=window.__mgLiveQuakeId===eventoSelecionadoId&&Date.now()<(window.__mgLiveQuakeUntil||0);
 if(!map||(strong&&(getAutoCycleProtectionRemaining()>0||live))){arm();return false;}
 if(presentationActive()){arm();return false;}
 for(const [id,entry] of pending)if(!globalAlerts.some(a=>a.id===id))pending.delete(id);
 const next=[...pending].sort((a,b)=>b[1].level-a[1].level||a[1].arrived-b[1].arrived)[0];
 if(!next){clearTimeout(retry);retry=null;return false;}
 const item=globalAlerts.find(a=>a.id===next[0]);
 dispatchId=item.id;window.__mgSoftCycle=false;
 try{showAlertDetails(item,true);}finally{dispatchId=null;}
 if(eventoSelecionadoId===item.id){try{playAlertTone('volcano');}catch(e){console.warn('[som vulcânico]',e);}presentingId=item.id;presentationUntil=Date.now()+(window.PresentationLimits?.limitMs(item)||(evidence(item).lava?45000:40000));pending.delete(item.id);clearTimeout(retry);retry=null;arm();return true;}
 arm();return false;
}
function presentationActive(){return eventoSelecionadoId===presentingId&&Date.now()<presentationUntil;}
function protectionRemaining(){return presentationActive()?Math.max(0,presentationUntil-Date.now()):0;}
function finishPresentation(id){if(presentingId===id)presentationUntil=0;}
window.VolcanoPriority={dispatching:item=>dispatchId===item?.id,finishPresentation,protectionRemaining,presentationActive,capture,evidence,escalation,acceptsUrgent,enqueue,observe,focus,canInterrupt};
})();
