const {test,expect}=require('@playwright/test');
for(const width of [1280,390])test('painted-area frame stays geographical after epicenter arrival '+width,async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.goto('/');await page.waitForFunction(()=>__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);EventCamera.cancel();stopMapCamera();SeismicPaintTour.stop();SeismicImpact.stop();for(const l of map.getStyle().layers)if(l.type==='raster')map.removeLayer(l.id);globalAlerts=[];globalEvents=[];AftershockSequence.setVisible(false);AftershockSequence.framePoints=()=>null;SeismicImpact.bounds=()=>[-82,7,-79,9];document.body.classList.remove('mobile-details-open','mobile-details-mid');});
 for(const mode of ['globe','mercator']){
  const results=await page.evaluate(mode=>{GlobePreview.setMode(mode);return [[[-80.8,7.5],10],[[120,60],1.4],[[-80.8,7.5],6]].map(([center,zoom],i)=>{map.jumpTo({center,zoom,padding:0,bearing:0,pitch:0});return SeismicFocus.frame({id:'area-'+mode+'-'+i,lng:-80.8,lat:7.5,mag:6.6,depth:10});});},mode);
  for(const f of results){expect(f.center[0]).toBeGreaterThan(-83);expect(f.center[0]).toBeLessThan(-78);expect(f.center[1]).toBeGreaterThan(6);expect(f.center[1]).toBeLessThan(11);expect(f.zoom).toBeGreaterThan(4);expect(f.zoom).toBeLessThan(9);expect(f.center[0]).toBeCloseTo(results[0].center[0],5);expect(f.center[1]).toBeCloseTo(results[0].center[1],5);expect(f.zoom).toBeCloseTo(results[0].zoom,5);}
  await page.evaluate(f=>{map.jumpTo({...f,padding:0,pitch:0,bearing:0});},results[0]);
  const view=await page.evaluate(()=>{const box=map.getContainer().getBoundingClientRect();return {w:box.width,h:box.height,points:[[-82,7],[-79,7],[-79,9],[-82,9],[-80.8,7.5]].map(c=>{const p=map.project(c);return [p.x,p.y];})};});
  for(const [x,y]of view.points){expect(x).toBeGreaterThan(0);expect(x).toBeLessThan(view.w);expect(y).toBeGreaterThan(0);expect(y).toBeLessThan(view.h);}
 }
});
