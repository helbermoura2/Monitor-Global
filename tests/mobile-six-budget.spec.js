const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
async function boot(page){await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort());await page.setViewportSize({width:390,height:844});await page.goto('/');await page.waitForFunction(()=>__mgMapReady&&!__fetchGlobalFeedsEmAndamento);await page.evaluate(()=>CountryBoundaries.ready);await page.evaluate(()=>{pausarBuscas();PeriodicScheduler.cancel('correlation');clearTimeout(cycleTimeout);clearTimeout(window.__mgCycleGuard);stopMapCamera();stopWaveFront();stopFeltZone();});}
test('ordinary points appear individually only nearby on mobile and desktop',async({page})=>{
 await boot(page);await page.evaluate(()=>{const now=Date.now();globalAlerts=[];globalEvents=Array.from({length:120},(_,i)=>({id:'q-'+i,type:'earthquake',mag:6,depth:10,coords:[-70+i*.0001,-20+i*.0001],time:now,place:'Teste '+i,source:'QA'}));eventoSelecionadoId='q-0';map.jumpTo({zoom:2,center:[-70,-20]});syncAllMarkers();});
 await expect(page.locator('.mg-mobile-cluster')).toHaveCount(0);expect(await page.evaluate(()=>markerStores.quake.has('q-0')&&markerStores.quake.size===1&&globalEvents.length===120)).toBe(true);
 await page.evaluate(()=>{map.jumpTo({zoom:6});syncAllMarkers();});expect(await page.evaluate(()=>markerStores.quake.size)).toBe(120);
 const moving=await page.evaluate(()=>{map.jumpTo({zoom:2});return {count:markerStores.quake.size,hidden:getComputedStyle([...markerStores.quake.values()].find(m=>m.getElement().classList.contains('map-pin-secondary')).getElement()).visibility};});expect(moving).toEqual({count:120,hidden:'hidden'});
 await page.setViewportSize({width:1280,height:844});await page.evaluate(()=>{map.jumpTo({zoom:2});syncAllMarkers();});await expect(page.locator('.mg-mobile-cluster')).toHaveCount(0);expect(await page.evaluate(()=>markerStores.quake.size)).toBe(1);
});
test('mobile list loads more records, retains existing cards and resets on a filter change',async({page})=>{
 await boot(page);await page.evaluate(()=>{applyFilters=()=>{};window.IntersectionObserver=undefined;const now=Date.now();globalEvents=Array.from({length:95},(_,i)=>({id:'list-'+i,type:'earthquake',mag:5,depth:10,coords:[-70,-20],time:now-i*60000,place:'Teste '+i,source:'QA'}));globalAlerts=[];lastMerged=globalEvents;window.__rows=globalEvents;renderSidebarList(__rows);window.__first=document.querySelector('#events .event');});
 expect(await page.locator('#events .event').count()).toBe(30);await page.evaluate(()=>document.querySelector('.sidebar-load-more').click());expect(await page.locator('#events .event').count()).toBe(60);expect(await page.evaluate(()=>__first===document.querySelector('#events .event'))).toBe(true);
 await page.evaluate(()=>{document.querySelector('.sidebar-load-more').click();document.querySelector('.sidebar-load-more').click();});expect(await page.locator('#events .event').count()).toBe(95);await expect(page.locator('.sidebar-load-more')).toHaveCount(0);
 await page.evaluate(()=>{sidebarFilter='earthquake';renderSidebarList(__rows);});expect(await page.locator('#events .event').count()).toBe(30);
});
test('effects menu loads only when opened and a stopped pending load cannot launch a demo',async({page})=>{
 await boot(page);expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>r.name.includes('/js/card-effect-demo.js')))).toBe(false);
 await page.route('**/__demo-loader',r=>r.fulfill({contentType:'text/html',body:'<main></main>'}));await page.goto('/__demo-loader');await page.addScriptTag({path:'js/optional-features.js'});
 let release;await page.route('**/js/card-effect-demo.js*',async route=>{await new Promise(r=>release=r);await route.continue();});
 await page.evaluate(()=>{window.__opening=CardEffectDemo.open();});await expect.poll(()=>!!release,{timeout:15000}).toBe(true);await page.evaluate(()=>CardEffectDemo.stop());release();await page.evaluate(()=>__opening);await expect(page.locator('#card-fx-demo-dialog')).toHaveCount(0);
 await page.evaluate(()=>CardEffectDemo.open());await expect(page.locator('#card-fx-demo-dialog')).toBeVisible();
});
