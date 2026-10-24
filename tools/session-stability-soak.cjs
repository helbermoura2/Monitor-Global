// Actual timed local browser soak. Serve on 4173 first. Every external request
// is mocked/blocked, including alert delivery. Native camera/renderers stay on.
const {chromium}=require('playwright'),fs=require('node:fs'),crypto=require('node:crypto');
const seconds=Number(process.env.SOAK_SECONDS||600),dwell=Number(process.env.SOAK_DWELL_MS||30000);
if(!(seconds>=30&&seconds<=3600&&dwell>=1000))throw Error('Invalid soak duration');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const context=await browser.newContext({viewport:{width:411,height:806},deviceScaleFactor:2.625,serviceWorkers:'block'});
 try{
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack||e.name+': '+e.message));
  const png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#163b49';x.fillRect(0,0,256,256);return c.toDataURL().split(',')[1];}),'base64');
  let tileRequests=0,blocked=0,injectedFailures=0;
  await page.route('**/*',r=>{
   const u=new URL(r.request().url());if(u.origin==='http://127.0.0.1:4173')return r.continue();
   if(u.hostname==='server.arcgisonline.com'&&u.pathname.includes('/tile/')){
    tileRequests++;if(injectedFailures<2){injectedFailures++;return r.fulfill({status:503,body:'Local injected tile failure',headers:{'Access-Control-Allow-Origin':'*'}});}
    return r.fulfill({body:png,contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*'}});
   }
   blocked++;return r.abort();
  });
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento,null,{timeout:60000});await page.evaluate(()=>CountryBoundaries.ready);
  await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);clearTimeout(window.__mgCycleGuard);stopMapCamera();pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();NewEventPriority.clear?.();somAtivo=true;vozVolume=0;unlockAudio(false);PerformanceDiagnostics.start();});
  const samples=[],sourceHashes=Object.fromEntries(['js/sismo-fontes.js','js/app-recovery.js','js/nucleo-estado.js','js/weather-warning-camera.js'].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
  const sample=async cycle=>{
   await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage'),metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
   return {cycle,elapsedMs:Date.now()-started,heapBytes:heap.usedSize,backingStorageBytes:heap.backingStorageSize,cdpNodes:metrics.Nodes,listeners:metrics.JSEventListeners,taskDurationSeconds:metrics.TaskDuration,...await page.evaluate(()=>({canvases:document.querySelectorAll('canvas').length,nodes:document.querySelectorAll('*').length,tiles:MapRenderBudget.stats(),audio:AudioLifecycle.stats(),products:EventProducts.stats(),warningAreas:WeatherWarningCamera.stats(),requests:BrowserRequestBudget.stats(),reports:SismoReportMemory.stats(),recovery:AppRecovery.state()}))};
  };
  const started=Date.now();samples.push(await sample(0));let cycle=0;
  while(Date.now()-started<seconds*1000){
   await page.evaluate(cycle=>{
    const coords=[[-78,-1],[138,36],[30,39],[-72,-32],[165,-18],[-151,62]][cycle%6],time=Date.now()-7200000;
    globalEvents=Array.from({length:200},(_,i)=>({id:'soak-'+cycle+'-'+i,type:'earthquake',mag:i===0?(cycle%6===0?6.2:4.3):2.5,depth:16,time:time-i*300000,coords:[coords[0]+(i%10)*.08,coords[1]+Math.floor(i/10)*.03],place:'Ensaio local',source:'QA'}));
    const types=['earthquake','storm','volcano','wind','flood','earthquake'],type=types[cycle%types.length];
    globalAlerts=type==='earthquake'?[]:[{id:'soak-alert-'+cycle,type,coords,time,place:'Ensaio local '+type,source:'QA',detail:type==='volcano'?'Em observação':'Tempestade com chuva e vento',windKmh:80,sev:2}];
    lastMerged=[...globalEvents,...globalAlerts];syncAllMarkers();renderSidebarList(lastMerged);window.__mgSoftCycle=false;
    if(type==='earthquake')showEventDetails(0,false);else showAlertDetails(globalAlerts[0],false);
    clearTimeout(cycleTimeout);clearTimeout(window.__mgCycleGuard);tone(440,{dur:.1,vol:.01});noise({dur:.1,vol:.01});
   },cycle);
   await page.waitForTimeout(Math.min(dwell,Math.max(1,seconds*1000-(Date.now()-started))));cycle++;samples.push(await sample(cycle));
   process.stderr.write('soak sample '+cycle+' '+Math.round((Date.now()-started)/1000)+'s\n');
  }
  await page.evaluate(()=>{CinematicCard.stop();SeismicCinema.stop();SeismicImpact.stop();FullScreenEffects.stop();stopWaveFront();stopFeltZone();EventCamera.cancel();stopMapCamera();AudioLifecycle.stop();clearTimeout(cycleTimeout);clearTimeout(window.__mgCycleGuard);PerformanceDiagnostics.stop();});
  await page.waitForTimeout(1200);const cleaned=await sample(cycle);
  console.log(JSON.stringify({method:{actualElapsedMs:Date.now()-started,targetSeconds:seconds,cpuSlowdown:4,viewport:'411x806',dpr:2.625,camera:'native, not overridden',tiles:'native raster layers; local synthetic 256px PNG, two injected 503 failures',traffic:'all other external traffic blocked; no Telegram or production events',memory:'main JS heap after explicit GC; GPU/workers/total RAM excluded',audio:'real short oscillator/noise nodes; cloud speech not exercised'},sourceHashes,tileRequests,blocked,injectedFailures,samples,cleaned,errors},null,2));
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
