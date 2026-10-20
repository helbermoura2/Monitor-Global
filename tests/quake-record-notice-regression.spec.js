const {test,expect}=require('@playwright/test');require('./helpers/card-renderer-fixture.cjs')(test);
test('viewing Vanuatu official maps never reopens records; only a real quake revision does',async({page})=>{
 await page.setViewportSize({width:1280,height:900});await page.goto('/');await page.waitForFunction(()=>window.__cardRendererFixtureReady&&!__fetchGlobalFeedsEmAndamento);await page.clock.install();await page.clock.pauseAt(new Date());
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);activeAlertingIds.clear();activeUpdatedIds.clear();globalAlerts=[];globalEvents=[{id:'vanuatu-unchanged',type:'earthquake',mag:6.3,depth:16,coords:[165.5892,-13.9906],time:Date.now()-11*3600000,place:'197 km a noroeste de Port-Olry, Vanuatu',source:'USGS',sourceEventId:'us6000u3jl',isPreliminary:false}];lastMerged=globalEvents.slice();EventStore.setSelected('vanuatu-unchanged');applyFilters();});
 await expect(page.locator('#sidebar-left')).toBeHidden();
 await page.evaluate(()=>{globalEvents[0].sourceSummary='USGS · EMSC · GEOFON';globalEvents[0].quality='A';EventStore.onDataRevised(['vanuatu-unchanged']);});await expect(page.locator('#sidebar-left')).toBeHidden();
 for(const version of ['USGS-1','EU-1','USGS-1','USGS-2']){await page.evaluate(version=>EventStore.notify('official-map',{id:'vanuatu-unchanged',mag:6.3,version}),version);await expect(page.locator('#sidebar-left')).toBeHidden();}
 // Advance past the feed's two-second render cache, as separate polls do.
 await page.clock.fastForward(2100);
 await page.evaluate(()=>{const q=globalEvents[0];q.mag=6.2;q._updatedAt=Date.now();q._deltaTxt='M6,3 → M6,2';activeUpdatedIds.set(q.id,Date.now()+180000);applyFilters();EventStore.onDataRevised([q.id]);});await expect(page.locator('#sidebar-left')).toBeVisible();await expect(page.locator('#events>.event')).toHaveCount(1);await expect(page.locator('#events>.event')).toContainText('M6,3 → M6,2');
 await page.clock.fastForward(50000);await page.evaluate(()=>{EventStore.onDataRevised(['vanuatu-unchanged']);EventStore.notify('official-map',{id:'vanuatu-unchanged',mag:6.2,version:'USGS-3'});});
 await page.clock.fastForward(10500);await page.clock.runFor(400);await expect(page.locator('#sidebar-left')).toBeHidden();
 await page.evaluate(()=>{globalEvents[0].sourceSummary='USGS · EMSC · GEOFON';globalEvents[0].quality='A';EventStore.onDataRevised(['vanuatu-unchanged']);});await expect(page.locator('#sidebar-left')).toBeHidden();
 // A later actual revision is allowed to open a fresh notice.
 await page.evaluate(()=>{globalEvents[0].depth=22;globalEvents[0]._deltaTxt='16 → 22 km';applyFilters();EventStore.onDataRevised(['vanuatu-unchanged']);});await expect(page.locator('#sidebar-left')).toBeVisible();
});
