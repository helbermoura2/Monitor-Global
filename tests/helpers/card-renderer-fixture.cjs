// Card-only suites isolate rendering from camera trips and rotation deadlines.
// Real arrival timing/cancellation is covered by card-camera-arrival.spec.js.
module.exports=test=>test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  const nativeFetch=window.fetch.bind(window);window.__cardRendererFetches=0;
  window.fetch=(...args)=>{__cardRendererFetches++;return nativeFetch(...args).finally(()=>{__cardRendererFetches--;});};
  document.addEventListener('DOMContentLoaded',()=>{
  if(typeof pausarBuscas==='function')pausarBuscas();
  window.__cardRendererMapReady=false;window.__cardRendererFeedsReady=false;
  Object.defineProperty(window,'__cardRendererFixtureReady',{configurable:true,get:()=>__cardRendererMapReady&&__cardRendererFeedsReady});
  Promise.resolve(typeof fetchVolcanoes==='function'?fetchVolcanoes():null).finally(()=>{
   let idleAt=null;
   const settle=()=>{
    if(__cardRendererFetches)idleAt=null;else if(idleAt===null)idleAt=Date.now();
    if(idleAt!==null&&Date.now()-idleAt>=1500){
     // pageshow may resume jobs after the first DOMContentLoaded pause.
     // Cancel bootstrap feeds before the test seeds records or advances time.
     if(typeof pausarBuscas==='function')pausarBuscas();
     if(typeof __buscasAgendadas!=='undefined')for(const job of __buscasAgendadas)window.PeriodicScheduler?.cancel(job.key);
     window.__cardRendererFeedsReady=true;return;
    }
    setTimeout(settle,50);
   };
   settle();
  });
  const quietMap=()=>{
   for(const id of ['satellite','esri-boundaries-places']){try{const src=map.getSource(id);if(src)src.setTiles=()=>{};if(map.getLayer(id))map.removeLayer(id);if(map.getSource(id))map.removeSource(id);}catch(_){}}
   map._render=()=>{};window.__cardRendererMapReady=true;
  };
  const prepareMap=()=>{if(typeof map==='undefined'||!map){setTimeout(prepareMap,20);return;}map.once('style.load',quietMap);quietMap();};prepareMap();
  window.PresentationLimits?.clear();
  if(window.PresentationLimits){PresentationLimits.begin=()=>{};PresentationLimits.delayEntry=()=>{};}
  if(window.EventCamera){
   EventCamera.afterArrival=(_id,effect)=>effect();
   EventCamera.enter=(_id,camera,arrive)=>{window.SeismicPaintTour?.stop();if(arrive)arrive();else map.jumpTo(camera);map.stop();return 0;};
  }
 },{once:true});});
});
