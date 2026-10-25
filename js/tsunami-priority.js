/* One finite bulletin presentation; only a recent M6+ may preempt it. */
(function(){'use strict';
 const pending=new Map(),seen=new Map(),presentedEvents=[];let dispatchId=null,retry=null;
 const recent=a=>Number.isFinite(a?.time)&&Date.now()-a.time<=30*60000&&a.time<=Date.now()+300000;
 const threat=a=>!!a&&(window.TsunamiRegional?.hasThreat(a)??(a?.hazardNature==='warning'&&!a.cancelled));
 const signature=a=>JSON.stringify([a.hazardNature,a.cancelled,a.warningLevel,(window.TsunamiRegional?.rows(a)||[]).map(r=>[r.regionLabel,r.state,r.category]).sort()]);
 const eligible=a=>threat(a)&&window.TsunamiLink?.official(a)&&recent(a)&&(!Number.isFinite(a.expiresAt)||a.expiresAt>Date.now());
 function protectionRemaining(){const a=globalAlerts.find(a=>a.id===eventoSelecionadoId),p=window.PresentationLimits?.state();return (threat(a)||p?.mode==='manual')&&window.TsunamiLink?.official(a)&&(!Number.isFinite(a.expiresAt)||a.expiresAt>Date.now())&&p?.id===a.id?Math.max(0,p.deadline-Date.now()):0;}
 function canInterrupt(a){const q=globalEvents.find(q=>q.id===eventoSelecionadoId);return a?.id===dispatchId&&!(Number(q?.mag)>=6&&getAutoCycleProtectionRemaining()>0);}
 function arm(){if(retry||!pending.size||document.hidden)return;retry=setTimeout(()=>{retry=null;focus();},2000);}
 function same(a,b){return a.id===b.id||(a.feedKey||a.source)===(b.feedKey||b.source)&&window.TsunamiLink?.sameEvent(a,b);}
 function markPresented(a){if(!a)return;for(const id of pending.keys()){const b=globalAlerts.find(b=>b.id===id);if(b&&same(a,b))pending.delete(id);}presentedEvents.push({item:{...a,coords:a.coords?.slice()},sev:Number(a.sev)||0,signature:signature(a)});if(presentedEvents.length>64)presentedEvents.shift();}
 function enqueue(items){for(const a of items||[]){if(!eligible(a))continue;const key=[a.id,a.time,signature(a)].join('|');if(seen.has(key))continue;seen.set(key,Date.now());
  if(presentedEvents.some(p=>same(a,p.item)&&(p.signature===signature(a)||a.time<=p.item.time&&(Number(a.sev)||0)<=p.sev)))continue;
  const other=[...pending.keys()].map(id=>globalAlerts.find(b=>b.id===id)).find(b=>b&&same(a,b));
  if(other){if(a.time<=other.time&&(Number(a.sev)||0)<=(Number(other.sev)||0))continue;pending.delete(other.id);}
  pending.set(a.id,key);
 }while(seen.size>256)seen.delete(seen.keys().next().value);arm();}
 function focus(){
  if(document.hidden||!map||window.TsunamiMap?.isPreview()||window.SeismicScenarioDemo?.isActive()||window.CardEffectDemo?.isActive())return false;
  for(const id of pending.keys())if(!eligible(globalAlerts.find(a=>a.id===id)))pending.delete(id);
  if(!pending.size)return false;
  const q=globalEvents.find(q=>q.id===eventoSelecionadoId);
  const cold=((typeof isFirstLoad!=='undefined'&&isFirstLoad)&&Date.now()-(window.__mgPageLoadAt||0)<60000)||Date.now()<(window.__mgColdLoadGraceUntil||0);
  if(cold&&eventoSelecionadoId!=null||Number(q?.mag)>=6&&getAutoCycleProtectionRemaining()>0||protectionRemaining()>0){arm();return false;}
  const a=[...pending.keys()].map(id=>globalAlerts.find(a=>a.id===id)).sort((a,b)=>(b.sev||0)-(a.sev||0)||b.time-a.time)[0];
  if(!a)return false;dispatchId=a.id;window.__mgSoftCycle=false;
  try{showAlertDetails(a,true);}finally{dispatchId=null;}
  if(eventoSelecionadoId===a.id){pending.delete(a.id);window.NewEventPriority?.markPresented(a);arm();return true;}arm();return false;
 }
 window.TsunamiPriority={enqueue,focus,markPresented,canInterrupt,protectionRemaining,dispatching:a=>a?.id===dispatchId,hasPending:()=>pending.size>0};
 window.addEventListener('pagehide',()=>clearTimeout(retry));document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm();});
})();
