const {test,expect}=require('@playwright/test');test.use({serviceWorkers:'block'});
async function fixture(page){
 await page.route('**/__recovery',r=>r.fulfill({contentType:'text/html',body:'<main id="mapWrap"></main><div id="source-panel"></div>'}));await page.goto('/__recovery');
 await page.evaluate(()=>{window.calls=0;window.reloads=0;window.handlers={};window.fetchGlobalFeeds=async()=>{calls++;await new Promise(r=>window.finish=r);};window.fakeMap={on:(n,f)=>handlers[n]=f,getSource:()=>({tiles:['local'],setTiles:()=>reloads++}),resize(){},triggerRepaint(){}};});
 await page.addScriptTag({path:'js/app-recovery.js'});await page.evaluate(()=>AppRecovery.attach(fakeMap));
}
test('tile failure storms have a bounded retry budget, sleep when hidden and clear on successful tile',async({page})=>{
 await fixture(page);await page.clock.install();await page.evaluate(()=>{for(let i=0;i<100;i++)handlers.error({sourceId:'satellite'});});
 await expect(page.locator('#map-recovery')).toBeVisible();await page.clock.runFor(81000);
 expect(await page.evaluate(()=>reloads)).toBe(3);await page.clock.runFor(180000);expect(await page.evaluate(()=>reloads)).toBe(3);
 await page.evaluate(()=>handlers.sourcedata({sourceId:'satellite',sourceDataType:'content',tile:{state:'loaded'}}));await expect(page.locator('#map-recovery')).toBeHidden();
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});handlers.error({sourceId:'satellite'});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.runFor(100000);expect(await page.evaluate(()=>reloads)).toBe(3);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.runFor(4001);expect(await page.evaluate(()=>reloads)).toBe(4);
});
test('graphics loss keeps records accessible and restoration uses the same map',async({page})=>{
 await fixture(page);const state=await page.evaluate(()=>{let prevented=false;handlers.webglcontextlost({originalEvent:{preventDefault(){prevented=true;}}});return {prevented,retry:AppRecovery.retryMap(),lost:AppRecovery.state().lost};});
 expect(state).toEqual({prevented:true,retry:false,lost:true});await expect(page.locator('#map-recovery')).toContainText('registros continuam');await expect(page.locator('#map-recovery button').first()).toBeDisabled();
 await page.evaluate(()=>handlers.webglcontextrestored());await expect(page.locator('#map-recovery')).toBeHidden();expect(await page.evaluate(()=>AppRecovery.state().lost)).toBe(false);
});
test('feed retry prevents concurrent runs and repeated clicks, retains state on rejection and blocks offline',async({page})=>{
 await fixture(page);await page.evaluate(()=>{AppRecovery.mountFeeds(document.getElementById('source-panel'));window.saved={selected:'event-1',filter:5.5};void AppRecovery.retryFeeds();});
 await expect(page.locator('.source-recovery-button')).toBeDisabled();await page.evaluate(()=>AppRecovery.retryFeeds());expect(await page.evaluate(()=>calls)).toBe(1);
 await page.evaluate(()=>finish());await expect(page.locator('.source-recovery-button')).toBeEnabled();await page.evaluate(()=>AppRecovery.retryFeeds());expect(await page.evaluate(()=>calls)).toBe(1);
 expect(await page.evaluate(()=>saved)).toEqual({selected:'event-1',filter:5.5});
 await page.clock.install();await page.clock.runFor(60001);await page.evaluate(async()=>{fetchGlobalFeeds=async()=>{calls++;throw Error('503');};await AppRecovery.retryFeeds();});await expect(page.locator('.source-recovery-button')).toContainText('registros anteriores');
 await page.evaluate(()=>Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false}));await page.evaluate(()=>AppRecovery.retryFeeds());expect(await page.evaluate(()=>calls)).toBe(2);await expect(page.locator('.source-recovery-button')).toContainText('Sem conexão');
});
for(const width of [390,1280])test('retry controls keep page, camera, filters and catalog on '+width,async({page})=>{
 await page.setViewportSize({width,height:844});await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort());await page.goto('/');await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);stopMapCamera();window.testCalls=0;fetchGlobalFeeds=async()=>{testCalls++;};window.catalogBefore=globalEvents;window.tokenBefore={};minMagnitude=5.5;eventoSelecionadoId='retain-qa';map.jumpTo({center:[25,35],zoom:4});window.cameraBefore=map.getCenter().toArray();MonitorFreshness.open();});
 await page.locator('.source-recovery-button').click();await page.evaluate(()=>MonitorFreshness.recordStatus('IGP','off'));await expect(page.locator('.source-recovery-button')).toHaveCount(1);
 await page.evaluate(()=>document.getElementById('mg-fresh-dialog').close());await page.evaluate(()=>document.getElementById('empty-map-retry').click());
 expect(await page.evaluate(()=>({calls:testCalls,same:globalEvents===catalogBefore,selected:eventoSelecionadoId,min:minMagnitude,camera:map.getCenter().toArray(),before:cameraBefore}))).toMatchObject({calls:1,same:true,selected:'retain-qa',min:5.5});expect(await page.evaluate(()=>map.getCenter().toArray())).toEqual(await page.evaluate(()=>cameraBefore));
});
test('native WebGL context loss restores the existing map and its event layers',async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort());await page.goto('/');await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
 const supported=await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);stopMapCamera();window.beforeMap=map;window.beforeSources=Object.keys(map.getStyle().sources);const canvas=map.getCanvas(),gl=canvas.getContext('webgl2')||canvas.getContext('webgl');window.lossExtension=gl?.getExtension('WEBGL_lose_context');if(!lossExtension)return false;lossExtension.loseContext();return true;});
 test.skip(!supported,'Chromium GPU does not expose context loss simulation');await expect.poll(()=>page.evaluate(()=>AppRecovery.state().lost)).toBe(true);
 await page.waitForTimeout(300);await page.evaluate(()=>lossExtension.restoreContext());await expect.poll(()=>page.evaluate(()=>AppRecovery.state().lost)).toBe(false);
 expect(await page.evaluate(()=>map===beforeMap)).toBe(true);expect(await page.evaluate(()=>Object.keys(map.getStyle().sources))).toEqual(await page.evaluate(()=>beforeSources));
});
test('manual map retries cannot cancel a scheduled recovery by repeated clicks or bypass its cooldown',async({page})=>{
 await fixture(page);await page.clock.install();await page.evaluate(()=>{handlers.error({sourceId:'satellite'});AppRecovery.retryMap();AppRecovery.retryMap();});
 expect(await page.evaluate(()=>reloads)).toBe(1);expect(await page.evaluate(()=>AppRecovery.state().sources[0].pending)).toBe(true);
 await page.clock.runFor(16001);expect(await page.evaluate(()=>reloads)).toBe(2);
 await page.clock.runFor(8001);await page.evaluate(()=>{AppRecovery.retryMap();AppRecovery.retryMap();});expect(await page.evaluate(()=>reloads)).toBe(3);
 await page.clock.runFor(60001);await page.evaluate(()=>AppRecovery.retryMap());expect(await page.evaluate(()=>reloads)).toBe(4);
});
test('public source completion clears a stuck warning without private tile state',async({page})=>{
 await fixture(page);await page.evaluate(()=>handlers.error({sourceId:'esri-boundaries-places'}));await expect(page.locator('#map-recovery')).toContainText('nomes ou limites');await page.evaluate(()=>handlers.sourcedata({sourceId:'esri-boundaries-places',sourceDataType:'content',isSourceLoaded:true}));await expect(page.locator('#map-recovery')).toBeHidden();
 await page.evaluate(()=>{handlers.error({sourceId:'satellite'});fakeMap.isSourceLoaded=()=>true;handlers.sourcedata({sourceId:'satellite',sourceDataType:'content'});});await expect(page.locator('#map-recovery')).toBeHidden();
 await page.evaluate(()=>handlers.error({sourceId:'satellite',error:{name:'AbortError',message:'cancelled tile'}}));await expect(page.locator('#map-recovery')).toBeHidden();
});
