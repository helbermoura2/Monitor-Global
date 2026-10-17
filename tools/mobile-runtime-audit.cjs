// Local isolation audit: no feeds, tiles, production API calls or KV operations.
// Start a static server on 4173. Values describe Chromium emulation, not a phone.
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,serviceWorkers:'block',reducedMotion:'no-preference'});
 try{
 const page=await context.newPage();await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort());
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Performance.enable');
 await page.goto('http://127.0.0.1:4173/');await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento);await page.evaluate(()=>CountryBoundaries.ready);
 await page.evaluate(async()=>{pausarBuscas();clearTimeout(cycleTimeout);clearTimeout(window.__mgCycleGuard);stopMapCamera();stopWaveFront();stopFeltZone();SeismicCinema.stop();CinematicCard.stop();pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();NewEventPriority.clear?.();globalEvents=[];globalAlerts=[];lastMerged=[];applyFilters=()=>{};syncAllMarkers();await OptionalFeatures.siteEffectDemo();});
 const results=[];
 const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 for(let repeat=0;repeat<Number(process.env.AUDIT_REPEATS||3);repeat++)for(const scenario of (process.env.AUDIT_SCENARIOS||'globe-idle,globe-moving,flat-idle,rain,lava,quake').split(',')){
 await page.evaluate(s=>{SiteEffectDemo.stop();SeismicCinema.stop();SeismicImpact.stop();map.stop();GlobePreview.setMode(s==='flat-idle'?'mercator':'globe',false);map.jumpTo({center:[-60,0],zoom:1.7});if(s==='paint'){map.jumpTo({center:[139.5,36],zoom:5});SeismicImpact.start({id:'audit-paint',lng:139.5,lat:36,mag:6,depth:10,skipOfficial:true,keepCamera:true},true);}if(s==='globe-moving')map.easeTo({center:[100,30],duration:6000,easing:t=>t});if(['rain','lava','quake'].includes(s))SiteEffectDemo.start(s);},scenario);
 if(scenario==='paint')await page.waitForFunction(()=>window.__mgSeismicImpactState?.features>0);await page.waitForTimeout(300);await cdp.send('HeapProfiler.collectGarbage');const before=await metrics();
 await page.waitForTimeout(5000);const after=await metrics();const heap=await cdp.send('Runtime.getHeapUsage');
 const row={repeat,scenario,windowMs:Math.round((after.Timestamp-before.Timestamp)*1000),heapBytes:heap.usedSize};
 for(const key of ['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration'])row[key+'Ms']=Math.round((after[key]-before[key])*1000);
 row.nodes=await page.evaluate(()=>document.getElementsByTagName('*').length);results.push(row);
 }
 console.log(JSON.stringify({method:{viewport:'390x844',dpr:3,cpuSlowdown:4,windowSeconds:5,externalRequests:'blocked',tiles:'unavailable',heap:'main JS heap only; sampled after workload, includes uncollected allocations',effects:'real local renderers; no production events'},results},null,2));
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
