// Controlled renderer/card lifecycle audit. External requests are blocked.
// Not an hours-long or physical-phone benchmark. Start a static server on 4173.
const {chromium}=require('playwright');
(async()=>{
 const cycles=Math.max(6,Math.min(600,Number(process.env.AUDIT_CYCLES)||30));
 const dwell=Math.max(250,Math.min(10000,Number(process.env.AUDIT_DWELL_MS)||2000));
 const viewport={width:Number(process.env.AUDIT_WIDTH)||390,height:Number(process.env.AUDIT_HEIGHT)||844},dpr=Number(process.env.AUDIT_DPR)||3,cpu=Number(process.env.AUDIT_CPU)||4;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport,deviceScaleFactor:dpr,serviceWorkers:'block'});
 try{
  const page=await context.newPage();let blocked=0,phase='boot';const errors=[];
  page.on('pageerror',e=>{if(errors.length<20)errors.push({phase,message:e.message,stack:e.stack});});
  await page.route('**/*',r=>{if(new URL(r.request().url()).origin==='http://127.0.0.1:4173')return r.continue();blocked++;return r.abort();});
  await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
   const watch=()=>{
    if(typeof map==='undefined'||!map){setTimeout(watch,20);return;}
    const addLayer=map.addLayer;map.addLayer=function(layer,...args){return layer?.type==='raster'?this:addLayer.call(this,layer,...args);};
    let dropping=false;
    const removeRasters=()=>{if(dropping)return;dropping=true;try{for(const layer of map.getStyle()?.layers||[])if(layer.type==='raster'&&map.getLayer(layer.id))map.removeLayer(layer.id);}finally{dropping=false;}};
    map.on('style.load',removeRasters);map.on('styledata',removeRasters);if(map.isStyleLoaded())removeRasters();
   };watch();
  },{once:true}));
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpu});
  await page.goto('http://127.0.0.1:4173/');await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento,null,{timeout:60000});await page.evaluate(()=>CountryBoundaries.ready);
  await page.evaluate(()=>{
   pausarBuscas();clearTimeout(cycleTimeout);clearTimeout(window.__mgCycleGuard);stopMapCamera();pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();NewEventPriority.clear?.();
   EventPortuguese.ensure=async()=>false;
   if(window.EventCamera){EventCamera.afterArrival=(_id,fn)=>fn();EventCamera.enter=(_id,camera,arrive)=>{map.stop();map.jumpTo(camera);arrive?.();return 0;};}
   if(window.PresentationLimits){PresentationLimits.begin=()=>{};PresentationLimits.delayEntry=()=>{};}
   document.body.classList.remove('mobile-details-mid');document.body.classList.add('mobile-details-open');
   const coords=[-78.44,-.68],time=Date.now();
   globalEvents=[{id:'session-quake',type:'earthquake',mag:5.3,depth:16,coords,time,place:'Auditoria local de sismo',source:'USGS'}];
   globalAlerts=['volcano','storm','fire','flood','wind'].map(type=>({id:'session-'+type,type,coords,time,place:'Auditoria local '+type,source:'GDACS',detail:type==='volcano'?'Emissão de cinzas':'Atividade monitorada',windKmh:80,sev:2}));
   lastMerged=[...globalEvents,...globalAlerts];window.__sessionAuditRows=lastMerged;syncAllMarkers();
  });
  const sample=async cycle=>{
   await cdp.send('HeapProfiler.collectGarbage');
   const heap=await cdp.send('Runtime.getHeapUsage');const metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
   const dom=await page.evaluate(()=>({connectedNodes:document.querySelectorAll('*').length,canvases:document.querySelectorAll('canvas').length,videos:document.querySelectorAll('video').length,cinemaLayers:document.querySelectorAll('.pd-cinema-layer').length,markers:document.querySelectorAll('.maplibregl-marker').length}));
   return {cycle,heapBytes:heap.usedSize,cdpNodes:metrics.Nodes,documents:metrics.Documents,jsEventListeners:metrics.JSEventListeners,taskDuration:metrics.TaskDuration,...dom};
  };
  const select=async cycle=>{
   await page.evaluate(index=>{
    const item=__sessionAuditRows[index%__sessionAuditRows.length];window.__mgSoftCycle=false;
    if(item.type==='earthquake')showEventDetails(0,false);else showAlertDetails(item,false);
    clearTimeout(cycleTimeout);clearTimeout(window.__mgCycleGuard);
   },cycle);
   await page.waitForTimeout(dwell);
   await page.evaluate(()=>{CinematicCard.stop();FullScreenEffects.stop();SeismicCinema.stop();SeismicImpact.stop();stopWaveFront();stopFeltZone();stopMapCamera();clearTimeout(cycleTimeout);clearTimeout(window.__mgCycleGuard);});
  };
  // Exercise each category before the first memory sample: module loading is not a leak.
  for(let i=0;i<6;i++){phase='warmup-'+i;await select(i);}
  const started=Date.now(),samples=[await sample(0)];
  for(let i=0;i<cycles;i++){phase='cycle-'+i;await select(i);if((i+1)%6===0||i+1===cycles)samples.push(await sample(i+1));}
  console.log(JSON.stringify({method:{cycles,dwellMs:dwell,elapsedMs:Date.now()-started,viewport,dpr,cpuSlowdown:cpu,externalRequests:'blocked',externalAttemptsBlocked:blocked,camera:'jumped; no flight benchmark',tiles:'raster layers removed; external imagery unavailable',heap:'main JS heap after garbage collection; GPU/workers excluded',scope:'repeated actual event card and effect lifecycle; not an hours-long session'},samples,pageErrors:[...new Set(errors)]},null,2));
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
