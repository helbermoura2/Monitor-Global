const {test,expect}=require('@playwright/test');require('./helpers/card-renderer-fixture.cjs')(test);
for(const width of [1280,390])test(`model 1 retains working details and restores other events at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/');await page.waitForFunction(()=>window.__cardRendererFixtureReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);globalAlerts=[];globalEvents=[{id:'model-one',type:'earthquake',mag:6.3,depth:16,coords:[165.5892,-13.9906],time:Date.now()-660000,place:'197 km a noroeste de Port-Olry, Vanuatu',source:'USGS',sourceSummary:'USGS · EMSC · GEOFON',sourceEventId:'us6000u3jl',isPreliminary:false}];lastMerged=globalEvents.slice();showEventDetails(0,false);if(innerWidth<700){document.body.classList.remove('mobile-details-mid');document.body.classList.add('mobile-details-open');}});
 const panel=page.locator('#painel-direito');await expect(panel).toHaveClass(/pd-model-one/);
 await expect(page.locator('.pd-location-row #pd-local')).toContainText('Port-Olry');await expect(page.locator('#painel-direito>.stats-grid>.stat-card')).toHaveCount(2);
 await expect(page.locator('.pd-model-one-footer #pd-share-btn')).toBeVisible();await expect(page.locator('#pd-source')).toHaveText('ANÁLISE SÍSMICA');
 await page.locator('#pd-more-toggle').click();await expect(page.locator('#pd-details-verso')).toBeVisible();await expect(page.locator('#pd-details-verso #pd-energy')).toHaveCount(1);
 await page.locator('#pd-details-verso header button').click();await expect(page.locator('#pd-details-verso')).toHaveCount(0);
 await page.evaluate(()=>{showEventDetails(0,false,true);showEventDetails(0,false,true);});await expect(page.locator('#pd-mag')).toHaveCount(1);await expect(page.locator('.pd-location-row')).toHaveCount(1);
 await page.screenshot({path:`/tmp/main-card-model-one-${width}.png`});
 if(width<700){await page.evaluate(()=>{document.body.classList.remove('mobile-details-open');document.body.classList.add('mobile-details-mid');});await expect(page.locator('.pd-location-row')).toBeVisible();await expect(page.locator('#pd-more-toggle')).toBeVisible();await page.screenshot({path:'/tmp/main-card-model-one-mobile-summary.png'});}
 await page.evaluate(()=>MainCardLayout.sync({type:'volcano'}));await expect(panel).not.toHaveClass(/pd-model-one/);await expect(page.locator('.pd-header-row #pd-more-toggle')).toHaveCount(1);await expect(page.locator('#painel-direito>.stats-grid>.stat-card')).toHaveCount(3);await expect(page.locator('#pd-gauge-wrap>#pd-flag')).toHaveCount(1);
});
