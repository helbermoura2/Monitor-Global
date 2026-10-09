const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block',reducedMotion:'reduce'});
for(const width of [1280,390])test('Portuguese numbers and persistent revisions stay attached to the selected event '+width,async({page})=>{
 const base=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';await page.setViewportSize({width,height:800});
 await page.route('**/*',r=>new URL(r.request().url()).hostname===new URL(base).hostname?r.continue():r.abort());
 await page.goto(base+'/?numbers-revisions='+Date.now());await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&window.__mgMapReady);
 await page.evaluate(()=>{pausarBuscas();globalAlerts=[];window.__mgSoftCycle=false;globalEvents=[{id:'revision-quake',type:'earthquake',mag:6.6,depth:10,place:'Panama',coords:[-81.47,7.72],time:Date.now()-3600000,source:'USGS'},{id:'another-quake',type:'earthquake',mag:2.4,depth:13,place:'Brazil',coords:[-47,-15],time:Date.now(),source:'USP'}];showEventDetails(0);clearTimeout(cycleTimeout);});
 await expect(page.locator('#pd-mag')).toHaveText('M6,6');await expect(page.locator('#pd-revision-note')).toBeHidden();
 const selected=await page.evaluate(()=>{Object.assign(globalEvents[0],{mag:6.3,depth:12.647,_deltaTxt:'M6.6 → M6.3 · 10 → 13 km',_updatedAt:Date.now()});activeUpdatedIds.set('revision-quake',Date.now()+60000);showEventDetails(0,false,true);clearTimeout(cycleTimeout);return eventoSelecionadoId;});expect(selected).toBe('revision-quake');
 await expect(page.locator('#pd-mag')).toHaveText('M6,3');await expect(page.locator('#pd-depth')).toContainText('13 km');await expect(page.locator('#pd-revision-note')).toContainText('6,6 → 6,3');
 await page.waitForTimeout(8500);await expect(page.locator('#pd-revision-note')).toBeVisible();
 await page.evaluate(()=>{showEventDetails(1);clearTimeout(cycleTimeout);});await expect(page.locator('#pd-mag')).toHaveText('M2,4');await expect(page.locator('#pd-revision-note')).toBeHidden();
 await page.evaluate(()=>{const v={id:'revised-wind',type:'wind',place:'Brasil',source:'INMET',time:Date.now(),sev:2,_deltaTxt:'Rajada: 60.5 → 80.5 km/h',_updatedAt:Date.now()};globalAlerts=[v];activeUpdatedIds.set(v.id,Date.now()+60000);showAlertDetails(v,false);clearTimeout(cycleTimeout);});
 await expect(page.locator('#pd-revision-note')).toContainText('EVENTO ATUALIZADO');await expect(page.locator('#pd-revision-note')).toContainText('60,5 → 80,5 km/h');
 expect(await page.evaluate(()=>globalEvents[0].depth)).toBe(12.647);
});
