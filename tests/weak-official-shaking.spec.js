const{test,expect}=require('@playwright/test'),fs=require('node:fs');
test.use({serviceWorkers:'block',reducedMotion:'reduce'});
const shaking=JSON.parse(fs.readFileSync('tests/fixtures/shaking/nz-us6000u2ev.json')),exposure=JSON.parse(fs.readFileSync('tests/fixtures/shaking/nz-us6000u2ev-exposure.json'));
for(const width of [1280,390])test('deep NZ official weak footprint and population remain visible '+width,async({page})=>{
 await page.setViewportSize({width,height:844});
 await page.route('**/*',r=>{const url=new URL(r.request().url());if(url.pathname==='/rupture-shaking')return r.fulfill({json:shaking});if(url.pathname==='/population-exposure')return r.fulfill({json:exposure});return url.hostname==='127.0.0.1'?r.continue():r.abort();});
 await page.goto('/');await page.waitForFunction(()=>__mgMapReady&&!__fetchGlobalFeedsEmAndamento);await page.evaluate(async()=>{pausarBuscas();clearTimeout(cycleTimeout);EventCamera.cancel();stopMapCamera();await CountryBoundaries.ready;for(const layer of map.getStyle().layers)if(layer.type==='raster')map.removeLayer(layer.id);});
 await page.evaluate(({shaking})=>{
  const item={id:'nz-deep',source:'GEONET',mag:5.7,depth:269,time:Date.parse('2026-10-15T05:25:31Z'),coords:[175.3814,-38.5478],place:'30 km a norte-leste de Taumarunui, Nova Zelândia',reports:[{source:'USGS',sourceEventId:'us6000u2ev'}]};
  globalEvents=[item];globalAlerts=[];showEventDetails(0,false,true);clearTimeout(cycleTimeout);EventCamera.cancel();stopMapCamera();map.jumpTo({center:item.coords,zoom:6,padding:{top:0,right:0,bottom:0,left:0}});
  window.__nzShaking=shaking;SeismicFocus.ready=()=>{};SeismicPaintTour.ready=()=>{};SeismicImpact.start({id:item.id,lng:item.coords[0],lat:item.coords[1],mag:item.mag,depth:item.depth,shaking},true);
 },{shaking});
 await expect.poll(()=>page.evaluate(()=>__mgSeismicImpactState?.features||0)).toBeGreaterThan(0);
 await expect(page.locator('.seismic-impact-status')).toContainText('II–III');await expect(page.locator('.seismic-impact-status')).not.toContainText('Sem área');
 const brief=page.locator('#pd-exposure-brief');await expect(brief).toHaveAttribute('data-status','available');await expect(brief).toContainText('19.661');await expect(brief).toContainText('EST');
 expect(await brief.evaluate(el=>el.previousElementSibling?.id)).toBe('pd-horario');
 await expect(page.locator('#pd-grid-exposure')).toContainText('USGS PAGER');
 const info=await page.evaluate(async()=>{const data=await SeismicImpact.snapshot({id:'nz-deep',lng:175.3814,lat:-38.5478,mag:5.7,depth:269,shaking:window.__nzShaking});return{official:data.features.every(f=>f.properties.official),max:Math.max(...data.features.map(f=>f.properties.mmi)),selected:eventoSelecionadoId};});expect(info.official).toBe(true);expect(info.max).toBeLessThanOrEqual(2.5);expect(info.selected).toBe('nz-deep');
 await page.screenshot({path:'/tmp/nz-weak-official-'+width+'.png'});
});
test('population query shows loading and failure in the main card instead of disappearing or becoming zero',async({page})=>{
 let release;await page.route('**/*',r=>{if(new URL(r.request().url()).pathname==='/population-exposure')return new Promise(resolve=>{release=()=>r.fulfill({json:{status:'unavailable',note:'Consulta indisponível.'}}).then(resolve);});return new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort();});
 await page.goto('/');await page.waitForFunction(()=>__mgMapReady&&!__fetchGlobalFeedsEmAndamento);await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);EventCamera.cancel();stopMapCamera();const item={id:'pop-loading',type:'earthquake',mag:5.7,depth:269,time:Date.now(),coords:[175.38,-38.54]};globalEvents=[item];eventoSelecionadoId=item.id;carregarExposicaoPopulacional(item);});
 await expect(page.locator('#pd-exposure-brief')).toHaveAttribute('data-status','pending');await expect.poll(()=>!!release).toBe(true);await release();await expect(page.locator('#pd-exposure-brief')).toHaveAttribute('data-status','unavailable');await expect(page.locator('#pd-exposure-brief')).toContainText('indisponível');await expect(page.locator('#pd-exposure-brief')).not.toContainText('0 pessoas');
});
