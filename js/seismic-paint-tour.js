/* A presentation of estimated shaking, independent of hidden P/S wave rings. */
(function(){'use strict';
let job=null;
const phases=[['epicenter-enter',6000],['epicenter-hold',5000],['paint-opening',12000],['area-hold',5000],['epicenter-return',4000],['epicenter-second-hold',7000],['area-final-opening',10000],['area-final-hold',7000]];
const duration=phases.reduce((n,p)=>n+p[1],0);
const valid=j=>job===j&&eventoSelecionadoId===j.id;
function stop(){if(job){clearTimeout(job.timer);clearInterval(job.revealTimer);}job=null;window.__mgPaintTourState=null;}
function owned(j){return !window.TsunamiPresentation?.ownsCamera(j.id)&&!document.hidden&&!j.paused;}
function move(j,camera,ms){if(!owned(j))return;clearTimeout(window.__mgRecenterT);clearTimeout(window.__mgRecenterAlertT);map.stop();map.easeTo({...camera,padding:0,bearing:0,pitch:0,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:ms,essential:true,easing:t=>t*t*(3-2*t)});}
function area(j){return window.SeismicFocus.frame(j.context);}
function phase(j,index){
 if(!valid(j)){if(job===j)stop();return;}
 const current=globalEvents.find(q=>q.id===j.id);if(current?.coords){Object.assign(j.context,{lng:current.coords[0],lat:current.coords[1],mag:current.mag,depth:current.depth});window.SeismicImpact?.refresh(j.context);}
 if(index===phases.length){window.SeismicImpact?.finish();stop();scheduleNextAutoCycle(250);return;}
 j.index=index;const [name,ms]=phases[index];window.__mgPaintTourState={id:j.id,stage:name,until:Date.now()+ms,endsAt:j.endsAt,past:j.past};
 clearInterval(j.revealTimer);
 if(name==='epicenter-enter'||name==='epicenter-return')move(j,{center:centroCompensado(j.context.lng,j.context.lat,j.focusZoom),zoom:j.focusZoom},ms);
 if(name==='paint-opening'){
  move(j,area(j),ms);const begun=Date.now();
  const extent=Math.max(10,SeismicImpactModel.extent(j.context.mag,j.context.depth));
  j.revealTimer=setInterval(()=>{if(!valid(j)){clearInterval(j.revealTimer);return;}SeismicImpact.reveal(extent*Math.min(1,(Date.now()-begun)/ms));},100);
 }
 if(name==='area-hold'){window.SeismicImpact?.finish();}
 if(name==='area-final-opening'){window.SeismicImpact?.finish();move(j,area(j),ms);}
 j.timer=setTimeout(()=>phase(j,index+1),ms);
}
function start(item,zoom){
 stop();if(!map||!window.SeismicImpact||!window.SeismicFocus)return false;
 clearTimeout(cycleTimeout);window.PresentationLimits?.clear();stopMapCamera();stopWaveFront();stopFeltZone();clearTimeout(window.__mgFeltZoneReturnT);clearTimeout(window.__mgWaveDelayT);clearTimeout(window.__mgRadarDelayT);
 const context={id:item.id,lng:item.coords[0],lat:item.coords[1],mag:item.mag,depth:item.depth,keepCamera:true,presentation:true};
 const j=job={id:item.id,context,focusZoom:Math.max(8,Math.min(12,zoom+2)),endsAt:Date.now()+duration,past:Date.now()-item.time>30*60000,paused:false};
 window.__mgHoldEndsAt=j.endsAt;if(window.__mgRevisionProtectedId===j.id)window.__mgRevisionProtectedUntil=j.endsAt;
 SeismicImpact.start(context,false);SeismicImpact.setVisible(true);phase(j,0);scheduleNextAutoCycle(duration+250);return true;
}
function ready(c){if(!job||job.id!==c.id||!valid(job))return;const name=phases[job.index][0];if(name==='paint-opening'||name==='area-final-opening')move(job,area(job),Math.max(3500,(window.__mgPaintTourState?.until||Date.now())-Date.now()));else if(name==='area-hold'||name==='area-final-hold')move(job,area(job),3500);}
function pause(){if(job){job.paused=true;map.stop();}}
window.EventStore?.subscribe((reason,p)=>{if(reason==='select'&&job&&p.id!==job.id)stop();});
function install(){if(!map)return;for(const name of ['dragstart','wheel','touchstart'])map.on(name,e=>{if(e?.originalEvent)pause();});}
window.addEventListener('load',install,{once:true});window.addEventListener('pagehide',stop);
window.SeismicPaintTour={start,stop,ready,pause,owns:id=>job?.id===id,remaining:()=>job?Math.max(0,job.endsAt-Date.now()):0,duration,phases};
})();
