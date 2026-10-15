const {test,expect}=require('@playwright/test');
for(const width of [1280,390])test('remote official warning reaches its area on globe and flat '+width,async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.goto('/');await page.waitForFunction(()=>__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);EventCamera.cancel();stopMapCamera();SeismicPaintTour.stop();SeismicImpact.stop();for(const l of map.getStyle().layers)if(l.type==='raster')map.removeLayer(l.id);globalEvents=[];globalAlerts=[{id:'alaska-coast',type:'storm',source:'NWS / NOAA',place:'Cape Spencer a Cape Fairweather',time:Date.now(),warningGeometry:{type:'Polygon',coordinates:[[[-139,57],[-135,57],[-135,59],[-139,59],[-139,57]]]}}];EventStore.setSelected('alaska-coast');document.body.classList.remove('mobile-details-open','mobile-details-mid');});
 for(const mode of ['globe','mercator']){
  await page.evaluate(async mode=>{GlobePreview.setMode(mode);EventCamera.cancel();map.jumpTo({center:[130,-25],zoom:1.2,padding:0});await WeatherWarningCamera.focus(globalAlerts[0]);},mode);
  await expect.poll(()=>page.evaluate(()=>map.getZoom()),{timeout:20000}).toBeGreaterThan(4);
  const r=await page.evaluate(()=>{const b=WeatherWarningCamera.bounds(WeatherWarningCamera.geometryPoints(globalAlerts[0].warningGeometry)),p=WeatherWarningCamera.frame(b).padding;return {center:map.getCenter().toArray(),corners:[[-139,57],[-135,57],[-135,59],[-139,59]].map(c=>{const q=map.project(c);return [q.x,q.y];}),padding:p,width:map.getContainer().clientWidth,height:map.getContainer().clientHeight};});
  expect(r.center[0]).toBeCloseTo(-137,1);expect(r.center[1]).toBeGreaterThan(57);expect(r.center[1]).toBeLessThan(59);
  for(const [x,y]of r.corners){expect(x).toBeGreaterThanOrEqual(r.padding.left-3);expect(x).toBeLessThanOrEqual(r.width-r.padding.right+3);expect(y).toBeGreaterThanOrEqual(r.padding.top-3);expect(y).toBeLessThanOrEqual(r.height-r.padding.bottom+3);}
 }
});
