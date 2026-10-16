/* Published ShakeMaps get a short automatic visit, below genuine arrivals. */
(function(){'use strict';
const checked=new Map(),pending=new Map();let baseline=null,busy=false,retry=null,dispatch=null,active=null;
const signature=q=>[q.coords,q.mag,q.time].join('|');
function eligible(q){return q&&Number(q.mag)>=5.5&&Array.isArray(q.coords)&&q.coords.length>=2&&q.coords.slice(0,2).every(Number.isFinite)&&isWithinAutoCycleAge(q);}
function reconcile(){for(const [id,e]of pending){const q=globalEvents.find(q=>q.id===id);if(!eligible(q)||signature(q)!==e.signature)pending.delete(id);}}
function arm(){if(document.hidden||retry||!pending.size)return;retry=setTimeout(()=>{retry=null;focus();arm();},2000);}
function automatic(){
 const quake=globalEvents.find(q=>q.id===eventoSelecionadoId),p=window.PresentationLimits?.state();
 return quake?window.__mgQuakePresentationMode==='auto':p?.id===eventoSelecionadoId&&p.mode==='auto';
}
function focus(){
 if(document.hidden||window.EventReplay?.isActive()||!map||!automatic()||window.SeismicScenarioDemo?.isActive()||window.TsunamiMap?.isPreview()||window.TsunamiPresentation?.ownsCamera(eventoSelecionadoId))return false;
 reconcile();if(!pending.size)return false;
 if(window.NewEventPriority?.focus())return true;
 if(pendingNewCameraQuakes.size||window.NewEventPriority?.hasPending()||window.VolcanoPriority?.presentationActive()||getAutoCycleProtectionRemaining()>0)return false;
 if(active?.id===eventoSelecionadoId&&active.until>Date.now()||window.EventCamera?.owns(eventoSelecionadoId)||map.isMoving?.())return false;
 const entry=[...pending.values()].sort((a,b)=>Number(b.mag)-Number(a.mag)||a.at-b.at)[0];
 const index=globalEvents.findIndex(q=>q.id===entry.id);if(index<0)return false;
 dispatch=entry;window.__mgSoftCycle=true;window.__mgRotationDisplay=true;
 try{showEventDetails(index,false);}finally{dispatch=null;window.__mgRotationDisplay=false;}
 if(eventoSelecionadoId!==entry.id)return false;
 pending.delete(entry.id);active={id:entry.id,until:Date.now()+(window.SeismicPaintTour?.remaining()||20000)};
 return true;
}
async function scan(){
 if(busy||document.hidden||!window.__mgMapReady||typeof globalEvents==='undefined'||typeof isFirstLoad!=='undefined'&&isFirstLoad&&Date.now()-(window.__mgPageLoadAt||0)<60000)return;
 const quakes=globalEvents.filter(eligible);if(!quakes.length)return;
 // Existing products on reload are a baseline, not a batch of new arrivals.
 if(!baseline)baseline=new Set(quakes.map(q=>q.id));
 const now=Date.now(),q=quakes.filter(q=>(checked.get(q.id)?.due||0)<=now).sort((a,b)=>(checked.get(a.id)?.due||0)-(checked.get(b.id)?.due||0)||b.time-a.time)[0];
 if(!q)return;busy=true;const sig=signature(q),previous=checked.get(q.id);
 try{
  const shaking=await window.RuptureShaking.query(q,{background:true});
  const current=globalEvents.find(e=>e.id===q.id);if(!eligible(current)||signature(current)!==sig)return;
  const version=shaking?.version||null;
  checked.delete(q.id);checked.set(q.id,{version:version||previous?.version||null,due:Date.now()+(shaking?.status==='available'?300000:60000)});
  if(checked.size>64)checked.delete(checked.keys().next().value);
  if(version&&version!==previous?.version&&(!baseline.has(q.id)||previous)&&(shaking.grid?.values?.some(v=>v!==null&&v>=1.5)||shaking.rupture?.features?.length)){
   // A live/manual presentation already showing this quake does not need a replay.
   if(q.id!==eventoSelecionadoId||automatic())pending.set(q.id,{id:q.id,mag:q.mag,signature:sig,shaking,at:Date.now()});
   if(pending.size>8)pending.delete(pending.keys().next().value);
   focus();arm();
  }
 }finally{busy=false;}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(retry);retry=null;}else arm();});
window.addEventListener('pagehide',()=>clearTimeout(retry));
window.OfficialMapPriority={scan,focus,presentationFor:id=>dispatch?.id===id?dispatch:null,pending:()=>{reconcile();return [...pending.keys()];}};
window.PeriodicScheduler.every('official-map-discovery',scan,15000,15000,'feeds');
})();
