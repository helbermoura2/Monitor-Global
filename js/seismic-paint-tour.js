/* A presentation of estimated shaking, independent of hidden P/S wave rings. */
(function(){'use strict';
let job=null;
const phases=[['epicenter-enter',6000],['epicenter-hold',5000],['paint-opening',12000],['area-hold',5000],['epicenter-return',4000],['epicenter-second-hold',7000],['area-final-opening',10000],['area-final-hold',7000]];
const duration=phases.reduce((n,p)=>n+p[1],0);
function timeline(mag,mode,entryMs=6000){
 const steps=phases.map(p=>p.slice());steps[0][1]=entryMs;
 const base=duration+entryMs-6000;
 if(mode!=='new')return steps;
 const total=Math.max(base,waveHoldMs(mag)),extra=total-base,loops=Math.floor(extra/28000);
 // Keep the requested pauses; repeat focus/area visits during longer new events.
 steps[2][1]+=extra-loops*28000;
 const visits=phases.slice(4).map(p=>p.slice());
 for(let i=0;i<loops;i++)steps.splice(steps.length-4,0,...visits.map(p=>p.slice()));
 return steps;
}
const valid=j=>job===j&&eventoSelecionadoId===j.id;
function stop(){if(job){clearTimeout(job.timer);clearInterval(job.revealTimer);if(job.flipScheduled&&!window.EventDetailsBack?.isOpen())window.fecharViradaCardAlcance?.();}job=null;window.__mgPaintTourState=null;}
function owned(j){return !window.TsunamiPresentation?.ownsCamera(j.id)&&!document.hidden&&!j.paused;}
function move(j,camera,ms){if(!owned(j))return;clearTimeout(window.__mgRecenterT);clearTimeout(window.__mgRecenterAlertT);SeismicFocus.move(j.context,camera,ms);}
function area(j){return window.SeismicFocus.frame(j.context);}
function phase(j,index){
 if(!valid(j)){if(job===j)stop();return;}
 const current=globalEvents.find(q=>q.id===j.id);if(current?.coords){Object.assign(j.context,{lng:current.coords[0],lat:current.coords[1],mag:current.mag,depth:current.depth});window.SeismicImpact?.refresh(j.context);}
 if(index===j.steps.length){window.SeismicImpact?.finish();stop();scheduleNextAutoCycle(250);return;}
 j.index=index;const [name,ms]=j.steps[index];window.__mgPaintTourState={id:j.id,stage:name,until:Date.now()+ms,endsAt:j.endsAt,past:j.past};
 clearInterval(j.revealTimer);
 if(name==='epicenter-enter'&&window.EventCamera)EventCamera.enter(j.id,SeismicFocus.epicenter(j.context,j.focusZoom));
 else if(name==='epicenter-enter'||name==='epicenter-return')move(j,SeismicFocus.epicenter(j.context,j.focusZoom),ms);
 if(name==='paint-opening'){
  move(j,area(j),ms);const begun=Date.now();
  const extent=Math.max(10,SeismicImpactModel.extent(j.context.mag,j.context.depth));
  j.revealTimer=setInterval(()=>{if(!valid(j)){clearInterval(j.revealTimer);return;}SeismicImpact.reveal(extent*Math.min(1,(Date.now()-begun)/ms));},100);
 }
 if(name==='area-hold'){window.SeismicImpact?.finish();}
 if(name==='area-final-opening'){window.SeismicImpact?.finish();move(j,area(j),ms);}
 const expected=Date.now()+ms;
 const advance=()=>{if(!valid(j))return;if(name==='epicenter-enter'&&window.EventCamera?.owns(j.id)){j.timer=setTimeout(advance,100);return;}const delay=Math.max(0,Date.now()-expected);if(delay){j.endsAt+=delay;window.__mgHoldEndsAt=j.endsAt;if(window.__mgRevisionProtectedId===j.id)window.__mgRevisionProtectedUntil=j.endsAt;}phase(j,index+1);};
 j.timer=setTimeout(advance,ms);
}
function start(item,zoom){
 stop();if(!map||!window.SeismicImpact||!window.SeismicFocus)return false;
 clearTimeout(cycleTimeout);window.PresentationLimits?.clear();stopMapCamera();stopWaveFront();stopFeltZone();clearTimeout(window.__mgFeltZoneReturnT);clearTimeout(window.__mgWaveDelayT);clearTimeout(window.__mgRadarDelayT);
 const official=window.OfficialMapPriority?.presentationFor(item.id);
 const context={...(official?{shaking:official.shaking}:{}),id:item.id,lng:item.coords[0],lat:item.coords[1],mag:item.mag,depth:item.depth,keepCamera:true,presentation:true};
 const entryMs=window.EventCamera?.durationFor(item.id)||6000;
 const steps=official?[['epicenter-enter',entryMs],['paint-opening',4000],['area-hold',20000]]:timeline(item.mag,window.__mgQuakePresentationMode,entryMs),total=steps.reduce((n,p)=>n+p[1],0);
 const j=job={id:item.id,steps,context,focusZoom:Math.max(8,Math.min(12,zoom+2)),endsAt:Date.now()+total,past:Date.now()-item.time>30*60000,paused:false};
 window.__mgHoldEndsAt=j.endsAt;if(window.__mgRevisionProtectedId===j.id)window.__mgRevisionProtectedUntil=j.endsAt;
 if(typeof agendarViradaCardAlcance==='function'){j.flipScheduled=true;agendarViradaCardAlcance(context.lat,context.lng,item,entryMs+(official?7000:Number(item.mag)>=8?26000:18000));}
 SeismicImpact.start(context,window.__mgQuakePresentationMode!=='new'||j.past);SeismicImpact.setVisible(true);phase(j,0);scheduleNextAutoCycle(total+250);return true;
}
function ready(c){if(!job||job.id!==c.id||!valid(job))return;const name=job.steps[job.index][0];if(name==='paint-opening'||name==='area-final-opening')move(job,area(job),Math.max(3500,(window.__mgPaintTourState?.until||Date.now())-Date.now()));else if(name==='area-hold'||name==='area-final-hold')move(job,area(job),3500);}
// MapLibre owns native gestures: stop() inside dragstart cancels its handlers.
function pause(stopCamera=true){if(job){job.paused=true;if(stopCamera)map.stop();}}
window.EventStore?.subscribe((reason,p)=>{if(reason==='select'&&job&&p.id!==job.id)stop();});
function install(){if(!map)return;for(const name of ['dragstart','wheel','touchstart'])map.on(name,e=>{if(e?.originalEvent)pause(false);});}
window.addEventListener('load',install,{once:true});window.addEventListener('pagehide',stop);
window.SeismicPaintTour={start,stop,ready,pause,owns:id=>job?.id===id,remaining:()=>job?Math.max(window.EventCamera?.owns(job.id)?1000:0,job.endsAt-Date.now()):0,duration,phases,timeline};
})();
