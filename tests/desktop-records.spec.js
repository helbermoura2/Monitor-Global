const {test,expect}=require('@playwright/test');
require('./helpers/card-renderer-fixture.cjs')(test);
async function ready(page){await page.goto('/index.html');await page.waitForFunction(()=>window.DesktopRecords&&window.__cardRendererFixtureReady&&!__fetchGlobalFeedsEmAndamento);}
test('desktop chips, dropdown and projection menu preserve their actions',async({page})=>{
 await page.setViewportSize({width:1280,height:800});await ready(page);
 const visible=await page.locator('#chips-row > button').evaluateAll(nodes=>nodes.filter(e=>getComputedStyle(e).display!=='none').sort((a,b)=>Number(getComputedStyle(a).order)-Number(getComputedStyle(b).order)).map(e=>e.textContent));
 expect(visible.slice(0,4)).toEqual(['Tudo','Sismos','Vulcões','Tsunamis']);
 await expect(page.locator('#chip-meteorologia')).toBeHidden();
 await page.locator('#more-filters-toggle').click();await expect(page.locator('#chip-meteorologia')).toBeVisible();
 await expect(page.locator('#desktop-extra-filters [data-f="hurricane"]')).toHaveText('Ciclones');
 await expect(page.locator('#chip-importantes,#chip-criticos,#chip-geo-me,#chip-geo-100,#chip-geo-500,#chip-tsunami-official,#chip-clima-global')).toHaveCount(0);
 await page.locator('#chip-menu-desktop').click();await expect(page.locator('#mf-main-planet')).toBeVisible();await expect(page.locator('#mf-main-map')).toBeVisible();
 await page.locator('#mf-main-map').click();expect(await page.evaluate(()=>GlobePreview.state().mode)).toBe('mercator');
});
test('event filter pins existing records; Tudo clears filters and retracts',async({page})=>{
 await page.setViewportSize({width:1280,height:800});await ready(page);
 await expect(page.locator('#sidebar-left')).toBeHidden();expect(await page.evaluate(()=>GlobePreview.availableRadius().padding.left)).toBe(0);
 await page.evaluate(()=>{globalEvents=[{id:'records-small',type:'earthquake',mag:2.2,depth:10,coords:[-70,-20],time:Date.now(),place:'Sismo pequeno',source:'QA'}];globalAlerts=[{id:'records-volcano',type:'volcano',coords:[-70,-20],time:Date.now(),place:'Vulcão local',source:'QA'}];applyFilters();});
 await page.locator('#chips-row > [data-f="volcano"]').click();await expect(page.locator('#sidebar-left')).toBeVisible();
 expect(await page.evaluate(()=>GlobePreview.availableRadius().padding.left)).toBeGreaterThan(250);
 expect(await page.evaluate(()=>DesktopRecords.state().pinned)).toBe(true);await expect(page.locator('#events')).toContainText('Vulcão local');await expect(page.locator('#events')).not.toContainText('Sismo pequeno');
 await page.evaluate(()=>{geoFilter='br';minMagnitude=6;soImportantes=true;soCriticos=true;document.getElementById('ux-search').value='inexistente';});
 await page.locator('#chips-row > [data-f="all"]').click();await expect(page.locator('#sidebar-left')).toBeHidden();
 expect(await page.evaluate(()=>[sidebarFilter,geoFilter,minMagnitude,soImportantes,soCriticos])).toEqual(['all','all',0.1,false,false]);
 await expect(page.locator('#events .event')).toHaveCount(0);await page.evaluate(()=>DesktopRecords.open(true));await expect(page.locator('#sidebar-left')).toBeHidden();await page.locator('#chips-row > [data-f="earthquake"]').click();await expect(page.locator('#events')).toContainText('Sismo pequeno');await expect(page.locator('#events')).not.toContainText('Vulcão local');
 await page.screenshot({path:'/tmp/desktop-records-open.png'});
});
test('new arrivals and M5+ revisions open once, expire and do not steal camera selection',async({page})=>{
 await page.setViewportSize({width:1280,height:800});await ready(page);await page.clock.install();
 await page.mouse.move(1200,740);
 await page.evaluate(()=>{globalEvents=[{id:'old-record',type:'earthquake',mag:6,depth:10,coords:[0,0],time:Date.now()-3600000,place:'Antigo não deve aparecer',source:'QA'},{id:'records-new',type:'earthquake',mag:5.2,depth:10,coords:[-70,-20],time:Date.now(),place:'Evento novo',source:'QA'}];EventStore.setSelected('records-new');activeAlertingIds.set('records-new',Date.now()+180000);applyFilters();});
 await expect(page.locator('#sidebar-left')).toBeVisible();expect(await page.evaluate(()=>EventStore.selectedId)).toBe('records-new');
 await expect(page.locator('#events .event')).toHaveCount(1);expect(await page.evaluate(()=>lastMerged.length)).toBe(2);await expect(page.locator('#events')).not.toContainText('Antigo não deve aparecer');await expect(page.locator('#events-label')).toBeHidden();
 const one=await page.locator('#sidebar-left').boundingBox();expect(one.height).toBeLessThan(350);
 await page.evaluate(()=>EventStore.onDataRevised(['records-new']));await expect(page.locator('#events .event')).toHaveCount(1);await page.clock.runFor(10000);
 await page.evaluate(()=>{const e={...globalEvents[1],id:'records-second',coords:[120,30],time:Date.now()-1000,place:'Segundo evento'};globalEvents.push(e);activeAlertingIds.set(e.id,Date.now()+180000);applyFilters();});
 await expect(page.locator('#events .event')).toHaveCount(2);
 await page.screenshot({path:'/tmp/arriving-two-cards.png'});
 await page.clock.runFor(20500);await expect(page.locator('#events .event')).toHaveCount(1);await expect(page.locator('#events .event')).toHaveAttribute('data-event-id','records-second');await page.clock.runFor(10000);await expect(page.locator('#sidebar-left')).toBeHidden();
 await page.evaluate(()=>applyFilters());await expect(page.locator('#sidebar-left')).toBeHidden();
 await page.evaluate(()=>{globalEvents.find(e=>e.id==='records-new').mag=5.3;EventStore.onDataRevised(['records-new']);});await expect(page.locator('#sidebar-left')).toBeVisible();await expect(page.locator('#events .event')).toHaveCount(1);
 await page.clock.runFor(30500);await expect(page.locator('#sidebar-left')).toBeHidden();
 await page.evaluate(()=>{globalEvents[1].mag=4.9;EventStore.onDataRevised(['records-new']);});await expect(page.locator('#sidebar-left')).toBeHidden();
 await page.evaluate(()=>EventStore.notify('official-map',{id:'records-new',mag:5.2,version:'2'}));await expect(page.locator('#sidebar-left')).toBeHidden();
});
test('mobile keeps the events sheet and local magnitude selector',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ready(page);
 await expect(page.locator('#desktop-records-toggle')).toBeHidden();await expect(page.locator('body')).not.toHaveClass(/desktop-records-ready/);
 await page.locator('#mobile-primary-nav [data-view="events"]').click();await expect(page.locator('#sidebar-left')).toBeVisible();await expect(page.locator('#mobile-event-magnitude')).toBeVisible();
 await page.screenshot({path:'/tmp/mobile-records-preserved.png'});
});
test('M6 notices last one minute and transparent controls have no blue fill',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.setViewportSize({width:1280,height:800});await ready(page);await page.clock.install();await page.clock.pauseAt(new Date());await page.mouse.move(1200,740);
 await expect(page.locator('#pd-focus-btn')).toHaveCount(0);
 expect(await page.locator('#pd-share-btn').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
 expect(await page.locator('#sidebar-left').evaluate(el=>getComputedStyle(el).scrollbarColor)).toContain('73, 115, 134');
 await page.evaluate(()=>{globalEvents=[{id:'large-notice',type:'earthquake',mag:6,depth:10,coords:[-70,-20],time:Date.now(),place:'Sismo M6',source:'QA'}];activeAlertingIds.set('large-notice',Date.now()+180000);applyFilters();});
 await expect(page.locator('#events .event')).toHaveClass(/record-notice-enter/);
 await page.clock.runFor(59000);await expect(page.locator('#sidebar-left')).toBeVisible();
 await page.clock.runFor(1100);await expect(page.locator('#events .event')).toHaveClass(/record-notice-exit/);
 await page.clock.runFor(400);await expect(page.locator('#sidebar-left')).toBeHidden();
});
test('arrival badges clear the close button and main badge keeps original expiry',async({page})=>{
 await page.setViewportSize({width:1280,height:800});await ready(page);await page.clock.install();await page.clock.pauseAt(new Date());await page.mouse.move(1200,740);
 await page.evaluate(()=>{globalEvents=[{id:'badge-quake',type:'earthquake',mag:5.1,depth:10,coords:[-70,-20],time:Date.now(),place:'Evento novo',source:'QA'}];activeAlertingIds.set('badge-quake',Date.now()+30000);EventStore.setSelected('badge-quake');applyFilters();});
 await expect(page.locator('#pd-event-status')).toHaveText('NOVO');
 const gap=await page.evaluate(()=>{const card=document.querySelector('#events .event');const style=getComputedStyle(card,'::after');const close=document.getElementById('sidebar-events-close').getBoundingClientRect();return {badgeRight:card.getBoundingClientRect().right-parseFloat(style.right),closeLeft:close.left};});expect(gap.badgeRight).toBeLessThan(gap.closeLeft);
 await page.clock.runFor(20000);await page.evaluate(()=>{marcarEventoComoVisto('badge-quake');EventStore.setSelected(null);EventStore.setSelected('badge-quake');});await expect(page.locator('#pd-event-status')).toHaveText('NOVO');
 await page.clock.runFor(10500);await expect(page.locator('#pd-event-status')).toBeHidden();
 await page.evaluate(()=>{activeUpdatedIds.set('badge-quake',Date.now()+10000);EventStore.onDataRevised(['badge-quake']);});await expect(page.locator('#pd-event-status')).toHaveText('ATUALIZADO');
 await page.clock.runFor(10500);await expect(page.locator('#pd-event-status')).toBeHidden();
});
test('clicking a notice cannot suspend its expiry or later arrivals',async({page})=>{
 await page.setViewportSize({width:1280,height:800});await ready(page);await page.clock.install();await page.clock.pauseAt(new Date());
 await page.evaluate(()=>{globalEvents=[{id:'clicked-notice',type:'earthquake',mag:5.1,depth:10,coords:[-70,-20],time:Date.now(),place:'Primeiro',source:'QA'}];activeAlertingIds.set('clicked-notice',Date.now()+180000);applyFilters();});
 await page.clock.runFor(600);const card=page.locator('#events .event');await card.click();await card.focus();
 expect(await page.evaluate(()=>DesktopRecords.state().pinned)).toBe(false);
 await page.clock.runFor(10000);
 await page.evaluate(()=>{for(let i=0;i<2;i++){const e={id:'next-notice-'+i,type:'earthquake',mag:5.2,depth:10,coords:[100+i*20,30],time:Date.now()-i*1000,place:'Seguinte '+i,source:'QA'};globalEvents.push(e);activeAlertingIds.set(e.id,Date.now()+180000);}applyFilters();});
 await expect(page.locator('#events .event')).toHaveCount(3);
 await page.clock.runFor(20500);await expect(page.locator('#events .event')).toHaveCount(2);
 await page.clock.runFor(10000);await expect(page.locator('#sidebar-left')).toBeHidden();await expect(page.locator('#events .event')).toHaveCount(0);
});
