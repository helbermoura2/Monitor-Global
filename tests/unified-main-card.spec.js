const {test,expect}=require('@playwright/test');require('./helpers/card-renderer-fixture.cjs')(test);
test('all hazard cards share centered layout, top actions and coordinate-based SVG flags',async({page})=>{
 test.setTimeout(120000);await page.setViewportSize({width:1280,height:900});await page.goto('/');await page.waitForFunction(()=>window.__cardRendererFixtureReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(async()=>{await CountryBoundaries.ready;pausarBuscas();clearTimeout(cycleTimeout);window.__mgSoftCycle=false;EventPortuguese.ensure=async()=>false;
  globalEvents=[{id:'us-flag',type:'earthquake',mag:3.5,depth:10,coords:[-100,31],time:Date.now(),place:'Texas',source:'USGS'}];globalAlerts=[];lastMerged=globalEvents.slice();showEventDetails(0,false);});
 await expect(page.locator('#pd-flag img.pd-country-flag')).toHaveAttribute('src','assets/flags/countries/us.svg');
 await expect(page.locator('.pd-header-row #pd-share-btn')).toBeVisible();await expect(page.locator('.pd-header-row #pd-more-toggle')).toBeVisible();
 for(const type of ['volcano','hurricane','storm','wind','flood','fire','tornado','civil','tsunami']){
  await page.evaluate(type=>{const a={id:'layout-'+type,type,coords:[-78.44,-.68],time:Date.now(),place:'Cotopaxi, Equador',source:'GDACS',detail:'Atividade monitorada',sev:2,gdacsAlertLevel:'orange',windKmh:140};globalAlerts=[a];lastMerged=[...globalEvents,a];showAlertDetails(a,false);clearTimeout(cycleTimeout);},type);
  await expect(page.locator('#painel-direito')).toHaveClass(/pd-model-one/);
  await expect(page.locator('#pd-flag img.pd-country-flag')).toHaveAttribute('src','assets/flags/countries/ec.svg');
  await expect.poll(()=>page.locator('#pd-flag img.pd-country-flag').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  await expect(page.locator('#painel-direito>.stats-grid>.stat-card')).toHaveCount(3);
  await expect(page.locator('.pd-header-row #pd-more-toggle')).toBeVisible();
  expect(await page.locator('#pd-local').evaluate(el=>getComputedStyle(el).textAlign)).toBe('center');
  expect(await page.locator('#pd-horario').evaluate(el=>getComputedStyle(el).textAlign)).toBe('center');
  if(type==='volcano')await page.screenshot({path:'/tmp/unified-main-card-volcano.png'});
 }
 // Switching out of a quake must retain an official regional notice, not delete it with moved technical nodes.
 await page.evaluate(()=>{showEventDetails(0,false);const a={id:'regional-warning',type:'wind',coords:null,time:Date.now(),place:'Área do aviso',source:'INMET',hazardNature:'warning',warningLevel:'Atenção',severityLabel:'Moderada',warningDescription:'Aviso válido para a região indicada.'};globalAlerts=[a];showAlertDetails(a,false);clearTimeout(cycleTimeout);});
 await expect(page.locator('#pd-notice-brief')).toContainText('Aviso válido para a região indicada.');await expect(page.locator('#pd-flag')).toBeHidden();
 // A country name or a stale flag must never assign land nationality to an ocean event.
 await page.evaluate(()=>{globalEvents[0].coords=[-140,0];globalEvents[0].place='Panamá';globalEvents[0].bandeira='🇵🇦';showEventDetails(0,false);});await expect(page.locator('#pd-flag')).toBeHidden();await expect(page.locator('#pd-flag img')).toHaveCount(0);
});
