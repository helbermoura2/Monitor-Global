const {test,expect}=require('@playwright/test');
test('local opt-in diagnostics export, persist, stop, bound samples and do not make requests',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('**/diagnostic-harness.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><button id="performance-diagnostics-menu">Desempenho no aparelho</button><script src="/js/performance-diagnostics.js"></script>'}));
 const outgoing=[];page.on('request',r=>outgoing.push(r.url()));
 await page.goto('/diagnostic-harness.html');await page.clock.install();
 expect(await page.evaluate(()=>PerformanceDiagnostics.snapshot())).toBeNull();
 await page.getByRole('button',{name:'Desempenho no aparelho'}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('button',{name:'Iniciar diagnóstico',exact:true}).click();
 await page.evaluate(()=>{window.dispatchEvent(new Event('unhandledrejection'));document.dispatchEvent(new Event('webglcontextlost'));});
 await page.clock.runFor(1100);await page.clock.fastForward(60000);
 let data=await page.evaluate(()=>PerformanceDiagnostics.snapshot());expect(data.active).toBe(true);expect(data.visibleMs).toBeGreaterThan(60000);expect(data.frames.windows).toBeGreaterThan(0);expect(data.errors.unhandledRejection).toBe(1);expect(data.errors.webglContextLost).toBe(1);
 expect(JSON.stringify(data)).not.toContain('http://');expect(data.samples.length).toBeGreaterThan(0);
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar relatório'}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toMatch(/diagnostico-.*\.json/);
 const fs=require('node:fs');const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));expect(exported.errors.unhandledRejection).toBe(1);
 await page.reload();data=await page.evaluate(()=>PerformanceDiagnostics.snapshot());expect(data.active).toBe(true);expect(data.pageVisits).toBe(2);expect(data.errors.unhandledRejection).toBe(1);
 // A suspended tab must not inflate observed foreground time or become a frame stall.
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.clock.fastForward(60000);expect((await page.evaluate(()=>PerformanceDiagnostics.snapshot())).hiddenMs).toBeGreaterThanOrEqual(60000);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
 data=await page.evaluate(()=>PerformanceDiagnostics.snapshot());const before=data.visibleMs;await page.clock.fastForward(20*60000);data=await page.evaluate(()=>PerformanceDiagnostics.snapshot());expect(data.unobservedGapMs).toBeGreaterThan(10*60000);expect(data.visibleMs-before).toBeLessThan(120000);
 await page.evaluate(()=>PerformanceDiagnostics.stop());data=await page.evaluate(()=>PerformanceDiagnostics.snapshot());expect(data.active).toBe(false);const count=data.errors.unhandledRejection;
 await page.evaluate(()=>window.dispatchEvent(new Event('unhandledrejection')));expect((await page.evaluate(()=>PerformanceDiagnostics.snapshot())).errors.unhandledRejection).toBe(count);
 await page.reload();expect((await page.evaluate(()=>PerformanceDiagnostics.snapshot())).active).toBe(false);
 await page.getByRole('button',{name:'Desempenho no aparelho'}).click();await page.getByRole('button',{name:'Apagar relatório'}).click();expect(await page.evaluate(()=>PerformanceDiagnostics.snapshot())).toBeNull();expect(await page.evaluate(()=>localStorage.getItem('mg-performance-diagnostic-v1'))).toBeNull();
 expect(outgoing.every(u=>/diagnostic-harness\.html|\/js\/performance-diagnostics\.js/.test(u))).toBe(true);
});
test('sample ring is bounded and unavailable memory stays null',async({page})=>{
 await page.route('**/diagnostic-harness.html',r=>r.fulfill({contentType:'text/html',body:'<script src="/js/performance-diagnostics.js"></script>'}));
 await page.addInitScript(()=>Object.defineProperty(performance,'memory',{configurable:true,value:undefined}));
 await page.goto('/diagnostic-harness.html');await page.clock.install();
 await page.evaluate(()=>{PerformanceDiagnostics.start();PerformanceDiagnostics.stop();const r=PerformanceDiagnostics.snapshot();r.samples=Array.from({length:288},()=>({at:'old',jsHeapMiB:null}));r.active=true;localStorage.setItem('mg-performance-diagnostic-v1',JSON.stringify(r));});
 await page.reload();const data=await page.evaluate(()=>PerformanceDiagnostics.snapshot());expect(data.samples).toHaveLength(288);expect(data.samples.at(-1).at).not.toBe('old');expect(data.samples.at(-1).jsHeapMiB).toBeNull();expect(data.capabilities.jsMemory).toBe(false);
});
test('resource investigation keeps bounded categories, separates cache visibility, resumes old reports without URL retention',async({page})=>{
 await page.addInitScript(()=>{
  const observers=[];
  window.PerformanceObserver=class {static supportedEntryTypes=['resource'];constructor(cb){this.cb=cb;}observe({type}){this.type=type;observers.push(this);}disconnect(){this.dead=true;}};
  window.__diagnosticResources=entries=>{for(const o of observers)if(!o.dead&&o.type==='resource')o.cb({getEntries:()=>entries});};
 });
 await page.route('**/diagnostic-harness.html',r=>r.fulfill({contentType:'text/html',body:'<script src="/js/performance-diagnostics.js"></script>'}));
 await page.goto('/diagnostic-harness.html');
 await page.evaluate(()=>{
  PerformanceDiagnostics.start();PerformanceDiagnostics.stop();const old=PerformanceDiagnostics.snapshot();delete old.collectorVersion;delete old.resources.byCategory;delete old.resources.categoryCount;old.resources.count=77;old.active=true;localStorage.setItem('mg-performance-diagnostic-v1',JSON.stringify(old));
 });
 await page.reload();
 await page.evaluate(()=>{
  const urls=['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/5/6/7','https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/5/6/7','https://tiles.openfreemap.org/planet/5/6/7.pbf','https://tilecache.rainviewer.com/v2/radar/private/5/6/7.png','/assets/flags/countries/BR.svg','/assets/geography/countries-10m.json','https://black-sky-9ba0.terrestre.workers.dev/?url=secret-coordinates','https://api.example.com/private?token=secret','/js/mapa.js','https://images.example.com/secret.png','data:private','/media/card-fx/gale-canopy.mp4','https://black-sky-9ba0.terrestre.workers.dev/rainbow-tile/private/5/6/7'];
  __diagnosticResources(urls.map((name,i)=>({name,duration:10,initiatorType:i===6||i===7?'fetch':i===9?'img':'other',responseStatus:i===6?429:200,encodedBodySize:i===0?0:100,transferSize:i===1?0:150})));
  __diagnosticResources(Array.from({length:1000},(_,i)=>({name:'https://private-'+i+'.example.com/?secret',duration:1,initiatorType:'fetch',responseStatus:200,encodedBodySize:0,transferSize:0})));
 });
 const data=await page.evaluate(()=>PerformanceDiagnostics.snapshot());
 expect(data.collectorVersion).toBe(2);expect(data.resources.count).toBe(1090);expect(data.resources.categoryCount).toBe(1013);
 expect(Object.keys(data.resources.byCategory)).toHaveLength(12);
 expect(data.resources.byCategory.mapImagery.timingUnavailable).toBe(1);expect(data.resources.byCategory.mapImagery.cacheHits).toBe(0);
 expect(data.resources.byCategory.mapLabels.cacheHits).toBe(1);expect(data.resources.byCategory.workerApi.httpErrors).toBe(1);
 expect(data.resources.byCategory.cardMedia.count).toBe(1);expect(data.resources.byCategory.radar.count).toBe(2);
 expect(data.resources.byCategory.otherApi.count).toBe(1001);
 expect(data.samples.at(-1).rendering.mapSources).toBeNull();
 expect(JSON.stringify(data)).not.toMatch(/secret|arcgisonline|private-|tile\/5/);
 await page.evaluate(()=>PerformanceDiagnostics.stop());
});
