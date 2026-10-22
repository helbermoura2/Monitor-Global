const {test,expect}=require('@playwright/test');
for(const width of [411,1280])test('M7 keeps geographic anchor during zoom, shows card and draws hollow intensity '+width,async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width,height:806});
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto('/');await page.waitForFunction(()=>__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{
  pausarBuscas();clearTimeout(cycleTimeout);EventCamera.cancel();stopMapCamera();SeismicPaintTour.stop();stopWaveFront();SeismicImpact.stop();
  for(const l of map.getStyle().layers)if(l.type==='raster')map.removeLayer(l.id);
  globalAlerts=[];const q={id:'anchor-m7',type:'earthquake',source:'QA',place:'Nagqu, China',coords:[93.71,32.34],mag:7,depth:18,time:Date.now()-3600000};globalEvents=[q,...[1,2,3].map(i=>({...q,id:'anchor-child-'+i,mag:4.5,time:q.time+i*600000,coords:[93.71+i*.1,32.34+i*.06]}))];lastMerged=globalEvents.slice();
  window.__mgSoftCycle=true;showEventDetails(0,false);window.__mgSoftCycle=false;
  EventCamera.cancel();SeismicPaintTour.stop();stopWaveFront();stopMapCamera();clearTimeout(cycleTimeout);fecharViradaCardAlcance();AftershockSequence.refresh();
 });
 await expect(page.locator('#sequence-hub')).toBeHidden();
 expect(await page.evaluate(()=>map.getSource('sequence-hub-links').serialize().data.features.length)).toBeGreaterThan(0);
 await expect(page.locator('.aftershock-pin-time').first()).toContainText('BRT');
 if(width<900){await expect(page.locator('body')).toHaveClass(/mobile-details-mid/);await expect(page.locator('#latest-event-ticker')).toBeHidden();const panel=await page.locator('#painel-direito').boundingBox();expect(panel.height).toBeGreaterThan(120);expect(panel.y+panel.height).toBeLessThanOrEqual(807);}
 for(const mode of ['globe','mercator']){
  await page.evaluate(mode=>{GlobePreview.setMode(mode);const a=globalEvents[0].coords,f=getEventoTelaFrac(),box=map.getContainer();map.easeTo({center:a,zoom:8,offset:[box.clientWidth*(f.x-.5),box.clientHeight*(f.y-.5)],padding:{top:0,right:0,bottom:0,left:0},bearing:0,pitch:0,duration:0});},mode);
  await page.waitForTimeout(150);
  const r=await page.evaluate(async()=>{
   const c={id:'anchor-m7',lng:93.71,lat:32.34,mag:7,depth:18},positions=[],start=map.project([c.lng,c.lat]);
   const timer=setInterval(()=>{const p=map.project([c.lng,c.lat]);positions.push([p.x,p.y]);},25);
   SeismicFocus.move(c,{zoom:2},1400);await new Promise(r=>setTimeout(r,1600));
   SeismicFocus.move(c,{zoom:8},1400);await new Promise(r=>setTimeout(r,1600));clearInterval(timer);
   const f=getEventoTelaFrac(),box=map.getContainer();return {start:[start.x,start.y],target:[box.clientWidth*f.x,box.clientHeight*f.y],max:Math.max(...positions.map(p=>Math.hypot(p[0]-start.x,p[1]-start.y))),count:positions.length};
  });
  expect(r.count).toBeGreaterThan(10);expect(Math.hypot(r.start[0]-r.target[0],r.start[1]-r.target[1]),JSON.stringify({mode,...r})).toBeLessThan(4);expect(r.max,JSON.stringify({mode,...r})).toBeLessThan(4);
 }
 await page.evaluate(()=>SeismicImpact.start({id:'anchor-m7',lng:93.71,lat:32.34,mag:7,depth:18,skipOfficial:true,keepCamera:true},true));
 await page.waitForFunction(()=>__mgSeismicImpactState?.features>0);
 const layer=await page.evaluate(()=>({type:map.getLayer('quake-impact-fill').type,data:map.getSource('quake-impact').serialize().data,legend:document.querySelector('.seismic-contour-scale')?.textContent}));
 expect(layer.type).toBe('line');expect(layer.data.features.length).toBeGreaterThan(2);expect(layer.data.features.every(f=>f.geometry.type==='MultiLineString')).toBe(true);expect(layer.legend).toContain('Forte');
 await page.screenshot({path:'/tmp/epicenter-hollow-'+width+'.png'});
 await page.evaluate(()=>SeismicImpact.start({id:'anchor-m7',lng:93.71,lat:32.34,mag:7,depth:18,keepCamera:true,skipOfficial:true,shaking:{provider:'USGS ShakeMap',version:'qa-linear-grid',grid:{nx:3,ny:3,x0:92,x1:94,y0:31,y1:33,values:[2,4,6,2,4,6,2,4,6]}}},true));
 await page.waitForFunction(()=>__mgSeismicImpactState?.version==='qa-linear-grid');
 const official=await page.evaluate(()=>map.getSource('quake-impact').serialize().data.features);
 expect(official.length).toBeGreaterThan(0);expect(official.every(f=>f.properties.official&&f.geometry.type==='MultiLineString')).toBe(true);
 for(const f of official.filter(f=>f.properties.mmi===4))for(const line of f.geometry.coordinates)for(const p of line)expect(p[0]).toBeCloseTo(93,6);
 await page.evaluate(()=>AftershockHub.show('anchor-m7'));await expect(page.locator('#sequence-hub')).toBeVisible();
 await page.evaluate(()=>{AftershockSequence.clear();SeismicImpact.stop();});expect(await page.evaluate(()=>!!map.getSource('sequence-hub-links'))).toBe(false);
});
