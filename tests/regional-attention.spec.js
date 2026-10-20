const {test,expect}=require('@playwright/test');require('./helpers/card-renderer-fixture.cjs')(test);
for(const width of [1280,390])test('regional card follows event selection and revisions without overlap '+width,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/');await page.waitForFunction(()=>window.__cardRendererFixtureReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);globalEvents=[{id:'region-test',type:'earthquake',coords:[29,40.8],mag:7.2,depth:12,time:Date.now(),place:'Mar de Mármara',source:'USGS'}];lastMerged=[...globalEvents];showEventDetails(0,false);clearTimeout(cycleTimeout);if(innerWidth<901){document.body.classList.remove('mobile-details-mid');document.body.classList.add('mobile-details-open');}});
 const card=page.locator('#regional-attention-card');await expect(card).toBeVisible();await expect(card).toContainText('Istambul');await expect(card).toContainText('M7,2');await expect(card).toContainText('não foram confirmados');await card.locator('summary').click();await expect(card).toContainText('magnitude ≥ 7');
 if(width>900){const boxes=await page.evaluate(()=>({panel:document.querySelector('#painel-direito').getBoundingClientRect().toJSON(),card:document.querySelector('#regional-attention-card').getBoundingClientRect().toJSON()}));expect(boxes.panel.bottom).toBeLessThanOrEqual(boxes.card.top);expect(boxes.card.bottom).toBeLessThanOrEqual(900);}
 else {await card.scrollIntoViewIfNeeded();await expect(card).toHaveCSS('opacity','1');}
 await page.screenshot({path:'/tmp/regional-attention-'+width+'.png'});
 await page.evaluate(()=>{globalEvents[0].depth=100;EventStore.notify('revise',{ids:['region-test']});});await expect(card).toBeHidden();
 await page.evaluate(()=>{globalEvents[0].depth=12;EventStore.notify('revise',{ids:['region-test']});});await expect(card).toBeVisible();
 await page.evaluate(()=>EventStore.setSelected(null));await expect(card).toBeHidden();
});
