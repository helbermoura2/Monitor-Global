const {test,expect}=require('@playwright/test');require('./helpers/card-renderer-fixture.cjs')(test);
for(const width of [1280,390])test('regional notices belong to arriving record cards, not the main panel '+width,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/');await page.waitForFunction(()=>window.__cardRendererFixtureReady&&!__fetchGlobalFeedsEmAndamento);await page.clock.install();await page.clock.pauseAt(new Date());
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);PresentationLimits.clear();activeAlertingIds.clear();activeUpdatedIds.clear();globalEvents=[{id:'region-first',type:'earthquake',coords:[29,40.8],mag:7.2,depth:12,time:Date.now(),place:'Mar de Mármara',source:'USGS'},{id:'region-second',type:'earthquake',coords:[121,14.6],mag:7.1,depth:15,time:Date.now()-1000,place:'Manila',source:'USGS'},{id:'region-history',type:'earthquake',coords:[29,40.8],mag:7.2,depth:12,time:Date.now()-86400000,place:'Histórico',source:'USGS'}];lastMerged=[...globalEvents];EventStore.setSelected('region-history');for(const e of globalEvents.slice(0,2))activeAlertingIds.set(e.id,Date.now()+60000);applyFilters();if(innerWidth<=900)toggleMobileEventsModal(true);});

 const notices=page.locator('#events>.regional-attention-card');await expect(notices).toHaveCount(2);
 await page.clock.runFor(600);
 const first=page.locator('#events>.event[data-event-id="region-first"]'),notice=page.locator('[data-regional-event-id="region-first"]');
 expect(await first.evaluate(el=>el.nextElementSibling.dataset.regionalEventId)).toBe('region-first');await expect(notice).toContainText('Istambul');await expect(notice).toContainText('M7,2');await expect(page.locator('#painel-direito .regional-attention-card')).toHaveCount(0);await expect(page.locator('#regional-attention-card')).toHaveCount(0);await expect(page.locator('#painel-direito')).not.toHaveClass(/has-regional-attention/);
 await expect(notice).toBeVisible();await notice.locator('summary').click();await expect(notice.locator('details')).toHaveAttribute('open','');expect(await page.evaluate(()=>EventStore.selectedId)).toBe('region-history');
 await page.screenshot({path:'/tmp/regional-record-'+width+'.png'});
 // Selection and clearing the seen badge must not remove another arrival's notice.
 await page.evaluate(()=>{marcarEventoComoVisto('region-first');EventStore.setSelected('region-second');renderSidebarList(lastMerged);});
 await expect(notices).toHaveCount(2);
 // Revision invalidates only its own contextual card.
 await page.evaluate(()=>{globalEvents[1].depth=100;lastMerged.find(e=>e.id==='region-second').depth=100;renderSidebarList(lastMerged);});await expect(page.locator('[data-regional-event-id="region-second"]')).toHaveCount(0);
 if(width>900){await page.clock.fastForward(60000);await page.clock.runFor(400);await expect(notices).toHaveCount(0);await expect(page.locator('#events>.event')).toHaveCount(0);}
 else {await page.clock.fastForward(60000);await page.clock.runFor(400);await page.evaluate(()=>renderSidebarList(lastMerged));await expect(notices).toHaveCount(0);}
});
