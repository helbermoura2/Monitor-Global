const {test,expect}=require('@playwright/test');require('./helpers/card-renderer-fixture.cjs')(test);
test('glass timeline uses arrival times, latest-first revisions, individual dismissal and original expiry',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('/');await page.waitForFunction(()=>window.__cardRendererFixtureReady&&!__fetchGlobalFeedsEmAndamento);await page.clock.install({time:new Date('2026-10-20T18:31:59Z')});await page.clock.pauseAt(new Date('2026-10-20T18:32:00Z'));
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);activeAlertingIds.clear();activeUpdatedIds.clear();globalAlerts=[];globalEvents=[{id:'rail-quake',type:'earthquake',mag:5.3,depth:28,coords:[-71.1,-30],time:Date.now()-12*60000,place:'Coquimbo, Chile',source:'USGS',sourceSummary:'USGS · EMSC'}];activeAlertingIds.set('rail-quake',Date.now()+180000);applyFilters();EventStore.setSelected('rail-quake');});
 const quake=page.locator('#events>.event[data-event-id="rail-quake"]');await expect(quake.locator('.record-arrival-time')).toHaveText('15:32');await expect(quake.locator('.ev-time')).toHaveText('15:20 BRT');await expect(quake).toHaveAttribute('data-record-label','NOVO');await page.clock.runFor(600);
 await page.clock.fastForward(2000);
 await page.evaluate(()=>{const v={id:'rail-volcano',type:'volcano',coords:[-78.44,-.68],time:Date.now()-3600000,place:'Cotopaxi, Equador',source:'VAAC',detail:'Emissão de cinzas',ashStatus:'VA TO FL150'};globalAlerts=[v];activeAlertingIds.set(v.id,Date.now()+180000);applyFilters();});
 const volcano=page.locator('#events>.event[data-event-id="rail-volcano"]');await expect(page.locator('#events>.event').first()).toHaveAttribute('data-event-id','rail-volcano');await expect(volcano).toHaveAttribute('data-record-latest','true');await expect(volcano.locator('.ev-volcano-activity')).toContainText(/cinzas/i);
 await page.clock.fastForward(2100);
 await page.evaluate(()=>{const q=globalEvents[0];q.mag=5.4;q._updatedAt=Date.now();q._deltaTxt='M5,3 → M5,4';activeUpdatedIds.set(q.id,Date.now()+180000);applyFilters();EventStore.onDataRevised([q.id]);});
 await expect(page.locator('#events>.event').first()).toHaveAttribute('data-event-id','rail-quake');await expect(quake).toHaveAttribute('data-record-label','ATUALIZADO');await expect(quake.locator('.updated-delta')).toContainText('M5,3 → M5,4');
 await page.clock.runFor(600);await page.screenshot({path:'/tmp/records-glass-b-c-desktop.png'});
 // The close control has its own reserved corner and cannot select/pin the card.
 expect(await quake.evaluate(card=>{const badge=getComputedStyle(card,'::after'),x=card.querySelector('.record-notice-close').getBoundingClientRect();return card.getBoundingClientRect().right-parseFloat(badge.right)<x.left;})).toBe(true);
 const selected=await page.evaluate(()=>EventStore.selectedId);await volcano.locator('.record-notice-close').click();await page.clock.runFor(400);await expect(volcano).toHaveCount(0);expect(await page.evaluate(()=>EventStore.selectedId)).toBe(selected);expect(await page.evaluate(()=>DesktopRecords.state().pinned)).toBe(false);
 await page.clock.fastForward(31000);await page.clock.runFor(400);await expect(page.locator('#sidebar-left')).toBeHidden();
 // A M6 arrival still has its own full minute, independent of badge timer or clicks.
 await page.evaluate(()=>{const q={id:'rail-six',type:'earthquake',mag:6,depth:16,coords:[-100,31],time:Date.now(),place:'Evento M6',source:'USGS'};globalEvents.push(q);activeAlertingIds.set(q.id,Date.now()+180000);applyFilters();});await page.clock.fastForward(59000);await expect(page.locator('#sidebar-left')).toBeVisible();await page.clock.fastForward(1500);await page.clock.runFor(400);await expect(page.locator('#sidebar-left')).toBeHidden();
});
