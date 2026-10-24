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
 expect(data.collectorVersion).toBe(7);expect(data.resources.count).toBe(1090);expect(data.resources.categoryCount).toBe(1013);
 expect(Object.keys(data.resources.byCategory)).toHaveLength(12);
 expect(data.resources.byCategory.mapImagery.timingUnavailable).toBe(1);expect(data.resources.byCategory.mapImagery.cacheHits).toBe(0);
 expect(data.resources.byCategory.mapLabels.cacheHits).toBe(1);expect(data.resources.byCategory.workerApi.httpErrors).toBe(1);
 expect(data.resources.byCategory.cardMedia.count).toBe(1);expect(data.resources.byCategory.radar.count).toBe(2);
 expect(data.resources.byCategory.otherApi.count).toBe(1001);
 expect(data.samples.at(-1).rendering.mapSources).toBeNull();
 expect(JSON.stringify(data)).not.toMatch(/secret|arcgisonline|private-|tile\/5/);
 await page.evaluate(()=>PerformanceDiagnostics.stop());
});

test('error locations are bounded and omit messages, URLs and stacks',async({page})=>{
 await page.route('**/diagnostic-harness.html',r=>r.fulfill({contentType:'text/html',body:'<script src="/js/performance-diagnostics.js"></script>'}));await page.goto('/diagnostic-harness.html');
 await page.evaluate(()=>{const m=document.createElement('div');m.id='mapContainer';m.append(document.createElement('canvas'));const card=document.createElement('div');card.id='painel-direito';card.append(document.createElement('canvas'));document.body.append(m,card);document.getAnimations=()=>[{playState:'running',effect:{target:m}},{playState:'finished',effect:{target:card}}];PerformanceDiagnostics.start();for(let i=0;i<50;i++)window.dispatchEvent(new ErrorEvent('error',{message:'private token and coordinates https://secret.example',filename:location.origin+'/js/performance-diagnostics.js?private',lineno:i+1,colno:7,error:new TypeError('private token')}));window.dispatchEvent(new ErrorEvent('error',{message:'another private message',filename:location.origin+'/js/performance-diagnostics.js',lineno:1,colno:7,error:new TypeError('secret')}));});
 const d=await page.evaluate(()=>PerformanceDiagnostics.snapshot());expect(d.errorLocations).toHaveLength(32);expect(d.errorLocationsOmitted).toBe(18);expect(d.errorLocations[0]).toMatchObject({type:'TypeError',file:'performance-diagnostics.js',line:1,column:7,count:2});expect(JSON.stringify(d)).not.toMatch(/secret|private|https:\/\//);expect(d.samples[0].rendering.canvasByOwner).toEqual({map:1,mainCard:1});expect(d.samples[0].rendering.runningAnimations).toBe(1);expect(d.samples[0].rendering.animations).toBe(2);expect(d.renderingPeaks.runningAnimations).toBe(1);
});

test('opaque script failures remain explicit and HTTP diagnostics retain only fixed routes and statuses',async({page})=>{
 await page.route('**/diagnostic-harness.html',r=>r.fulfill({contentType:'text/html',body:'<script src="/js/performance-diagnostics.js"></script>'}));await page.goto('/diagnostic-harness.html');
 await page.evaluate(()=>{window.EmscJsonpGuard={stats:()=>({active:2,retired:1})};PerformanceDiagnostics.start();window.dispatchEvent(new ErrorEvent('error',{message:'Script error.'}));PerformanceDiagnostics.network('https://black-sky-9ba0.terrestre.workers.dev/?url='+encodeURIComponent('https://api.open-meteo.com/v1/forecast?latitude=secret'),new Response('{}',{status:429}));PerformanceDiagnostics.network('https://black-sky-9ba0.terrestre.workers.dev/official-weather-alerts?token=secret',null,'abort');});
 const d=await page.evaluate(()=>PerformanceDiagnostics.snapshot());expect(d.errorLocations[0]).toMatchObject({type:'OpaqueScriptError',file:null,opaque:true,emscPending:2});expect(d.workerRequests[0]).toMatchObject({route:'proxy',provider:'openMeteo',attempts:1,statuses:{'429':1}});expect(d.workerRequests[1].aborts).toBe(1);expect(JSON.stringify(d)).not.toMatch(/secret|latitude|https:\/\//);
});

test('overnight diagnostics retain bounded source transitions and interval totals without source error text',async({page})=>{
 await page.route('**/overnight-harness.html',r=>r.fulfill({contentType:'text/html',body:'<script src="/js/performance-diagnostics.js"></script>'}));
 await page.goto('/overnight-harness.html');await page.clock.install();
 await page.evaluate(()=>{window.qaSource={status:'ok',fails:0,lastOk:Date.now(),okCount:3,failCount:0,lastErr:'PRIVATE_ERROR_COORDINATES'};window.SourceHealth={summary:()=>({ok:1,warn:0,off:0,cooling:0,total:1}),snapshot:()=>({USGS:qaSource,'PRIVATE_SOURCE':qaSource}),get:()=>qaSource};PerformanceDiagnostics.start();});
 let r=await page.evaluate(()=>PerformanceDiagnostics.snapshot());expect(r.collectorVersion).toBe(7);expect(r.sourceDetails.USGS.successes).toBe(3);expect(r.samples[0].windowTotals.resources).toBe(0);expect(r.samples[0].viewport.width).toBeGreaterThan(0);
 await page.evaluate(()=>{qaSource.status='off';qaSource.fails=3;qaSource.failCount=3;qaSource.openUntil=Date.now()+3600000;});await page.clock.fastForward(360000);
 r=await page.evaluate(()=>PerformanceDiagnostics.snapshot());expect(r.sourceDetails.USGS.cooling).toBe(true);expect(r.sourceTransitions.at(-1).source).toBe('USGS');expect(r.samples.at(-1).windowTotals.visibleMs).toBeGreaterThanOrEqual(0);expect(JSON.stringify(r)).not.toContain('PRIVATE_');
 await page.evaluate(()=>PerformanceDiagnostics.stop());
});

test('memory samples include catalogue report ownership without exporting event data',async({page})=>{
 await page.route('**/catalog-memory-harness.html',r=>r.fulfill({contentType:'text/html',body:'<script src="/js/performance-diagnostics.js"></script>'}));
 await page.goto('/catalog-memory-harness.html');
 await page.evaluate(()=>{window.SismoReportMemory={stats:()=>({events:200,reports:200,maxReportsPerEvent:1,bySource:{GEONET:200}})};PerformanceDiagnostics.start();PerformanceDiagnostics.stop();});
 const report=await page.evaluate(()=>PerformanceDiagnostics.snapshot());
 expect(report.samples[0].runtimeVersion).toBe('catalog-memory-v8');
 expect(report.samples[0].memoryOwners.quakeReports).toEqual({events:200,reports:200,maxReportsPerEvent:1,bySource:{GEONET:200}});
});
