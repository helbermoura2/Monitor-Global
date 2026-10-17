// Controlled catalog benchmark. Start `npx serve -l 4173 .` before running.
// No external feeds/tiles: this measures JS/DOM, not real-network or phone GPU performance.
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const result=[];
 try{for(let run=0;run<3;run++){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,serviceWorkers:'block'});
  try{
   const page=await context.newPage();await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort());
   const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
   await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento);await page.evaluate(()=>CountryBoundaries.ready);
   const measured=await page.evaluate(()=>{
    pausarBuscas();clearTimeout(cycleTimeout);clearTimeout(window.__mgCycleGuard);stopMapCamera();stopWaveFront();stopFeltZone();SeismicCinema.stop();CinematicCard.stop();
    pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();NewEventPriority.clear?.();
    const now=Date.now(),regions=[[-122,38],[-72,-32],[140,36],[30,39],[170,-20],[-151,62]];
    globalEvents=Array.from({length:600},(_,i)=>({id:'bench-q-'+i,type:'earthquake',mag:6+(i%3)*.1,depth:10,coords:[regions[i%6][0]+(i%20)*.03,regions[i%6][1]+Math.floor(i/20)%10*.03],time:now-i*60000,place:'Sismo de teste '+i,source:'QA'}));
    globalAlerts=Array.from({length:200},(_,i)=>({id:'bench-w-'+i,type:'wind',sev:2,windKmh:80,coords:[-110+i%20,30+Math.floor(i/20)],time:now-i*60000,place:'Vento de teste '+i,source:'QA'}));
    globalEvents.forEach(item=>CountryBoundaries.apply(item));minMagnitude=0;sidebarFilter='all';geoFilter='all';soImportantes=false;soCriticos=false;eventoSelecionadoId=globalEvents[0].id;lastMerged=[...globalEvents,...globalAlerts];
    map.jumpTo({center:[-70,10],zoom:2});
    const samples=[];for(let i=0;i<6;i++){const start=performance.now();renderSidebarList(lastMerged);syncAllMarkers();samples.push(performance.now()-start);}
    return {dcl:performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,catalog:800,cards:document.querySelectorAll('#events .event').length,markers:document.querySelectorAll('.maplibregl-marker').length,firstRenderMs:samples[0],repeatMs:samples.slice(1),nodes:document.getElementsByTagName('*').length,
      scriptsAndStyles:performance.getEntriesByType('resource').filter(r=>r.initiatorType==='script'||r.initiatorType==='link').reduce((a,r)=>({count:a.count+1,bytes:a.bytes+r.decodedBodySize}),{count:0,bytes:0}),
      particlesWeak:CardEffectQuality.create(true,{deviceMemory:2,hardwareConcurrency:2}).count(300)};
   });
   await cdp.send('HeapProfiler.collectGarbage');measured.mainHeapBytes=(await cdp.send('Runtime.getHeapUsage')).usedSize;result.push(measured);
  }finally{await context.close();}
 }}finally{await browser.close();}
 console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
