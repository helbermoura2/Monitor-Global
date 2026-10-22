const {test,expect}=require('@playwright/test');const fs=require('node:fs');require('./helpers/card-renderer-fixture.cjs')(test);test.use({reducedMotion:'reduce'});
test('repeated local event selection releases DOM and records post-GC heap for investigation',async({page},testInfo)=>{
 test.setTimeout(180000);await page.setViewportSize({width:411,height:806});await page.goto('/');await page.waitForFunction(()=>window.__cardRendererFixtureReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);EventPortuguese.ensure=async()=>false;globalAlerts=[];globalEvents=Array.from({length:30},(_,i)=>({id:'endurance-'+i,type:'earthquake',mag:2.5,depth:10,coords:[-80+i*.05,8],time:Date.now()-i*120000,place:'Ensaio local',source:'QA'}));lastMerged=globalEvents.slice();});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');const measurements=[];
 for(let round=0;round<4;round++){
  for(let i=0;i<30;i++){await page.evaluate(i=>{showEventDetails(i,false);clearTimeout(cycleTimeout);},i);await page.waitForTimeout(10);}
  await page.evaluate(()=>{CinematicCard?.stop();stopWaveFront?.(true);});await page.waitForTimeout(450);await cdp.send('HeapProfiler.collectGarbage');const dom=await cdp.send('Memory.getDOMCounters'),perf=await cdp.send('Performance.getMetrics');measurements.push({round,...dom,heapMiB:perf.metrics.find(x=>x.name==='JSHeapUsedSize').value/1048576});
 }
 const file=testInfo.outputPath('local-event-selection-memory.json');fs.mkdirSync(require('node:path').dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(measurements,null,2));
 expect(measurements.at(-1).nodes).toBeLessThan(measurements[0].nodes+800);expect(measurements.at(-1).jsEventListeners).toBeLessThan(measurements[0].jsEventListeners+100);
});
test('regional source cooldown suppresses dispatch without inflating failures, then allows recovery',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>window.__cardRendererFixtureReady&&!__fetchGlobalFeedsEmAndamento);
 const result=await page.evaluate(async()=>{pausarBuscas();clearTimeout(cycleTimeout);let calls=0;fetchOVSICORIData=async()=>{calls++;return [];};fetchSSNMexicoData=async()=>{calls++;return [];};const names=['OVSICORI','SSN-Mexico'];for(const n of names)SourceHealth.get(n).openUntil=Date.now()+60000;const before=names.map(n=>SourceHealth.get(n).failCount);await fetchGlobalFeeds();const blocked=calls,after=names.map(n=>SourceHealth.get(n).failCount),suppressed=names.map(n=>SourceHealth.get(n).suppressedCount);for(const n of names)SourceHealth.get(n).openUntil=Date.now()-1;await fetchGlobalFeeds();return {before,after,blocked,suppressed,recoveredCalls:calls};});
 expect(result.blocked).toBe(0);expect(result.after).toEqual(result.before);expect(result.suppressed.every(n=>n>=1)).toBe(true);expect(result.recoveredCalls).toBe(2);
});

test('ending an effect releases its owned canvas backing buffers',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/');await page.waitForFunction(()=>window.__cardRendererFixtureReady&&!__fetchGlobalFeedsEmAndamento);
 const result=await page.evaluate(async()=>{pausarBuscas();clearTimeout(cycleTimeout);await OptionalFeatures.effect('wind');CinematicCard.start({id:'cleanup-local',type:'wind',windKmh:120,place:'Ensaio local',time:Date.now()});const canvases=[...document.querySelectorAll('.pd-cinema-particles,.pd-cinema-contact > canvas:first-child')],before=canvases.map(c=>c.width);CinematicCard.stop();return {before,after:canvases.map(c=>c.width),connected:canvases.some(c=>c.isConnected)};});
 expect(result.before.length).toBeGreaterThan(0);expect(result.before.some(n=>n>1)).toBe(true);expect(result.after.every(n=>n===1)).toBe(true);expect(result.connected).toBe(false);
});
