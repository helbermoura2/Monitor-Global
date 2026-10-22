const{test,expect}=require('@playwright/test');require('./helpers/card-renderer-fixture.cjs')(test);test.use({reducedMotion:'reduce'});
for(const width of [1280,390,844])test('sequence hub geographic links, chronology, filters and responsive controls '+width,async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width,height:width===844?390:900});await page.goto('/');await page.waitForFunction(()=>window.__cardRendererFixtureReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);window.__mgSoftCycle=false;EventPortuguese.ensure=async()=>false;globalAlerts=[];const now=Date.now();globalEvents=[{id:'hub-main',type:'earthquake',mag:6.3,depth:16,coords:[167,-15],time:now-3600000,place:'Vanuatu',source:'EMSC'},{id:'hub-first',type:'earthquake',mag:4.2,depth:18,coords:[167.05,-15],time:now-2880000,place:'Vanuatu',source:'EMSC'},{id:'hub-second',type:'earthquake',mag:4.8,depth:18,coords:[167.1,-15.1],time:now-2280000,place:'Vanuatu',source:'EMSC'},{id:'hub-other',type:'earthquake',mag:3,depth:10,coords:[-80,8],time:now,place:'Panamá',source:'EMSC'}];lastMerged=globalEvents.slice();AftershockSequence.refresh();showEventDetails(0,false);clearTimeout(cycleTimeout);fecharViradaCardAlcance();});
 const hub=page.locator('#sequence-hub');await expect(hub).toBeVisible();await expect(page.locator('.sequence-hub-row')).toHaveCount(3);await expect(page.locator('.sequence-hub-row').nth(1)).toContainText('+12 min · M4,2');await expect(page.locator('.sequence-hub-row').nth(2)).toContainText('+22 min · M4,8');
 const before=await page.evaluate(()=>({count:globalEvents.length,c:map.getCenter().toArray(),zoom:map.getZoom()}));
 await page.locator('[data-sequence-id="hub-second"]').click();await expect(page.locator('[data-sequence-id="hub-second"]')).toHaveAttribute('aria-pressed','true');expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('hub-second');
 expect(await page.evaluate(()=>map.getSource('sequence-hub-links').serialize().data.features.filter(f=>f.properties.selected).map(f=>f.properties.id))).toEqual(['hub-second']);expect(await page.evaluate(()=>globalEvents.length)).toBe(before.count);
 if(width===390){const y=await page.evaluate(()=>({points:[map.project(globalEvents[0].coords).y,map.project(globalEvents[2].coords).y],top:document.getElementById('sequence-hub').getBoundingClientRect().bottom,bottom:document.getElementById('painel-direito').getBoundingClientRect().top}));for(const n of y.points){expect(n).toBeGreaterThan(y.top);expect(n).toBeLessThan(y.bottom);}}
 if(width>900){
  await page.evaluate(()=>{sidebarFilter='all';DesktopRecords.filter('all');activeAlertingIds.set('hub-other',Date.now()+60000);EventStore.notify('filter',{});renderSidebarList(lastMerged);});await expect(page.locator('#sidebar-left')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.getElementById('sequence-hub').getBoundingClientRect().top>=document.getElementById('sidebar-left').getBoundingClientRect().bottom+8)).toBe(true);
  await page.evaluate(()=>{sidebarFilter='earthquake';DesktopRecords.filter('earthquake');renderSidebarList(lastMerged);});await expect(hub).toBeHidden();await page.locator('#pd-event-insights [data-workbench="sequence"]').click();await expect(page.locator('#monitor-workbench-dialog')).toBeVisible();await page.locator('#monitor-workbench-dialog header button').click();
  await page.evaluate(()=>{sidebarFilter='all';DesktopRecords.filter('all');});await expect(hub).toBeVisible();
 }else{
  await expect(page.locator('#painel-direito')).toBeVisible();const r=await hub.boundingBox();expect(r.height).toBeLessThanOrEqual((width===844?390:900)*.47);
  await page.locator('#sequence-hub-toggle').click();await expect(hub).toHaveClass(/collapsed/);await page.locator('#sequence-hub-toggle').click();await expect(hub).not.toHaveClass(/collapsed/);
  if(width===390){await expect(page.locator('.sequence-hub-close')).toBeVisible();await page.locator('.sequence-hub-close').click();await expect(hub).toBeHidden();await page.evaluate(()=>AftershockHub.show('hub-second'));await expect(hub).toBeVisible();await page.evaluate(()=>abrirPainelDetalhesMobile());}else await page.locator('.sequence-hub-details').click();await expect(page.locator('#painel-direito')).toBeVisible();await page.locator('#pd-event-insights [data-workbench="sequence"]').click();await expect(hub).toBeVisible();await expect(hub).not.toHaveClass(/collapsed/);
 }
 await page.screenshot({path:'/tmp/sequence-hub-'+width+'.png'});
 await page.evaluate(()=>AftershockSequence.setVisible(false));await expect(hub).toBeHidden();expect(await page.evaluate(()=>map.getLayoutProperty('sequence-hub-links-selected','visibility'))).toBe('none');await page.evaluate(()=>AftershockSequence.setVisible(true));await expect(hub).toBeVisible();
 await page.evaluate(()=>{showEventDetails(3,false);clearTimeout(cycleTimeout);});await expect(hub).toBeHidden();expect(await page.evaluate(()=>!!map.getSource('sequence-hub-links'))).toBe(false);
});

test('sequence follows newest rows, preserves manual scroll and closes on automatic rotation outside the group',async({page})=>{
 await page.setViewportSize({width:1280,height:720});await page.goto('/');await page.waitForFunction(()=>window.__cardRendererFixtureReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);EventPortuguese.ensure=async()=>false;const now=Date.now();globalAlerts=[];const main={id:'scroll-main',type:'earthquake',mag:6.3,depth:16,coords:[167,-15],time:now-3600000,place:'Vanuatu',source:'QA'};globalEvents=[main,...Array.from({length:15},(_,i)=>({...main,id:'scroll-'+i,mag:3,time:main.time+(i+1)*60000,coords:[167.01,-15]})),{...main,id:'outside',mag:2,coords:[-80,8]}];lastMerged=globalEvents.slice();showEventDetails(0,false);clearTimeout(cycleTimeout);AftershockSequence.refresh();});
 const list=page.locator('#sequence-hub-list');await expect(page.locator('#sequence-hub')).toBeVisible();
 await expect.poll(()=>list.evaluate(n=>Math.abs(n.scrollHeight-n.clientHeight-n.scrollTop)<2)).toBe(true);
 const bounds=await page.evaluate(()=>{const last=document.querySelector('#sequence-hub-list .sequence-hub-row:last-child').getBoundingClientRect(),footer=document.querySelector('#sequence-hub footer').getBoundingClientRect();return {bottom:last.bottom,footer:footer.top};});expect(bounds.bottom).toBeLessThanOrEqual(bounds.footer);
 await list.evaluate(n=>{n.dispatchEvent(new Event('wheel'));n.scrollTop=0;n.dispatchEvent(new Event('scroll'));});
 await page.evaluate(()=>{const m=globalEvents[0];globalEvents=[...globalEvents,{...m,id:'scroll-new',mag:3,time:m.time+17*60000}];AftershockSequence.refresh();});expect(await list.evaluate(n=>n.scrollTop)).toBe(0);
 await list.evaluate(n=>{n.dispatchEvent(new Event('wheel'));n.scrollTop=n.scrollHeight;n.dispatchEvent(new Event('scroll'));});
 await page.evaluate(()=>{const m=globalEvents[0];globalEvents=[...globalEvents,{...m,id:'scroll-newest',mag:3,time:m.time+18*60000}];AftershockSequence.refresh();});
 await expect.poll(()=>list.evaluate(n=>Math.abs(n.scrollHeight-n.clientHeight-n.scrollTop)<2)).toBe(true);
 await page.evaluate(()=>{window.__mgRotationDisplay=true;try{showEventDetails(globalEvents.findIndex(q=>q.id==='outside'),false);}finally{window.__mgRotationDisplay=false;}clearTimeout(cycleTimeout);AftershockSequence.refresh();});await expect(page.locator('#sequence-hub')).toBeHidden();await expect(page.locator('[data-sequence-id="scroll-newest"]')).toHaveCount(0);await expect(page.locator('#pd-aftershocks-summary')).toHaveCount(0);
 await page.evaluate(()=>{showEventDetails(1,false);clearTimeout(cycleTimeout);showEventDetails(globalEvents.findIndex(q=>q.id==='outside'),false);clearTimeout(cycleTimeout);});await expect(page.locator('#sequence-hub')).toBeHidden();
});

test('sequence scroll reverses at both ends and pauses for manual input and hidden panels',async({page})=>{
 test.setTimeout(60000);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1280,height:720});await page.goto('/');await page.waitForFunction(()=>window.__cardRendererFixtureReady&&!__fetchGlobalFeedsEmAndamento);
 await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);EventPortuguese.ensure=async()=>false;globalAlerts=[];const main={id:'ping-main',type:'earthquake',mag:6.3,depth:16,coords:[167,-15],time:Date.now()-3600000,place:'Vanuatu',source:'QA'};globalEvents=[main,...Array.from({length:20},(_,i)=>({...main,id:'ping-'+i,mag:3,time:main.time+(i+1)*60000}))];lastMerged=globalEvents.slice();showEventDetails(0,false);clearTimeout(cycleTimeout);AftershockSequence.refresh();});
 const list=page.locator('#sequence-hub-list');await expect(page.locator('#sequence-hub')).toBeVisible();await page.clock.runFor(100);await expect.poll(()=>list.evaluate(n=>n.scrollTop>0)).toBe(true);
 await page.clock.runFor(6500);
 const bottom=await list.evaluate(n=>n.scrollHeight-n.clientHeight);expect(await list.evaluate(n=>n.scrollTop)).toBeLessThan(bottom-5);
 await list.evaluate(n=>{n.scrollTop=1;});await page.clock.runFor(3500);expect(await list.evaluate(n=>n.scrollTop)).toBeGreaterThan(5);
 await list.evaluate(n=>{n.dispatchEvent(new Event('wheel'));n.scrollTop=30;});await page.clock.runFor(5000);expect(await list.evaluate(n=>n.scrollTop)).toBe(30);
 await page.clock.runFor(6000);expect(await list.evaluate(n=>n.scrollTop)).toBeGreaterThan(30);
 await page.locator('#sequence-hub-toggle').click();const paused=await list.evaluate(n=>n.scrollTop);await page.clock.runFor(4000);expect(await list.evaluate(n=>n.scrollTop)).toBe(paused);
 await page.clock.fastForward(61000);await expect(page.locator('#sequence-hub')).toBeHidden();
 await page.evaluate(()=>AftershockSequence.refresh());await expect(page.locator('#sequence-hub')).toBeHidden();
 await page.evaluate(()=>AftershockHub.show('ping-main'));await expect(page.locator('#sequence-hub')).toBeVisible();
 await page.clock.fastForward(30000);await list.dispatchEvent('wheel');await page.clock.fastForward(40000);await expect(page.locator('#sequence-hub')).toBeVisible();
 await page.clock.fastForward(21000);await expect(page.locator('#sequence-hub')).toBeHidden();
 await page.evaluate(()=>{window.__mgRotationDisplay=true;window.__mgSoftCycle=true;try{showEventDetails(2,false);}finally{window.__mgRotationDisplay=false;window.__mgSoftCycle=false;}clearTimeout(cycleTimeout);});await expect(page.locator('#sequence-hub')).toBeVisible();
 await page.clock.fastForward(61000);await expect(page.locator('#sequence-hub')).toBeVisible();
 await page.evaluate(()=>{const m=globalEvents[0];globalEvents.push({...m,id:'context-outside',coords:[-80,8]});window.__mgRotationDisplay=true;try{showEventDetails(globalEvents.length-1,false);}finally{window.__mgRotationDisplay=false;}clearTimeout(cycleTimeout);});await expect(page.locator('#sequence-hub')).toBeHidden();
});
