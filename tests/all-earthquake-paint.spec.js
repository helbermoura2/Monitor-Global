const {test,expect}=require('@playwright/test');
test('a small settled earthquake paints its land footprint without a radar sweep',async({page})=>{
 const base=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';
 await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.clock.install();await page.goto(base);await page.waitForFunction(()=>window.SeismicImpact&&window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento);await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);stopWaveFront();stopFeltZone();globalAlerts=[];globalEvents=[{id:'brazil-small-qa',type:'earthquake',mag:3.4,depth:4,coords:[-47.66,-20.71],time:Date.now()-3600000,place:'Brasil',source:'QA'}];lastMerged=[...globalEvents];eventoSelecionadoId='brazil-small-qa';startFeltZone(-47.66,-20.71,3.4,4,'brazil-small-qa',true);});
 await expect.poll(()=>page.evaluate(()=>window.__mgSeismicImpactState?.id),{timeout:15000}).toBe('brazil-small-qa');
 await expect.poll(()=>page.evaluate(()=>window.__mgSeismicImpactState?.features||0),{timeout:15000}).toBeGreaterThan(0);
 expect(await page.evaluate(()=>window.__mgSeismicImpactState.id)).toBe('brazil-small-qa');
 await expect(page.locator('.felt-zone-sweep')).toHaveCount(0);
 await page.evaluate(()=>{clearTimeout(window.__mgRadarDelayT);startFeltZone(-47.66,-20.71,3.4,4,'brazil-small-qa',true);});
 await expect.poll(()=>page.evaluate(()=>window.__mgSeismicImpactState?.stage)).toBe('impact');
 await expect(page.locator('.felt-zone-sweep')).toHaveCount(0);
});
