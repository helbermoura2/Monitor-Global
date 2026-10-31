const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block',reducedMotion:'no-preference'});
for(const width of [1280,390])test('glass badge stays anchored with and without paint '+width,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto('/');await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);EventCamera.cancel();SeismicPaintTour.stop();SeismicImpact.stop();stopMapCamera();for(const l of map.getStyle().layers)if(l.type==='raster')map.removeLayer(l.id);
 globalAlerts=[];globalEvents=[0,1].map(i=>({id:'beacon-'+i,type:'earthquake',source:'QA',place:'Sismo fraco',mag:2.4,depth:5,time:Date.now(),coords:[-47+i*.02,-21]}));eventoSelecionadoId='beacon-0';layerVisibility.earthquakes=true;map.jumpTo({center:[-47,-21],zoom:9,padding:0,pitch:0,bearing:0});syncAllMarkers();});
 const beacon=page.locator('.event-focus-beacon');await expect(beacon).toHaveCount(1);
 const anchor=()=>page.evaluate(()=>{const el=markerStores.quake.get(eventoSelecionadoId).getElement(),r=el.getBoundingClientRect(),c=map.getContainer().getBoundingClientRect(),p=map.project(markerStores.quake.get(eventoSelecionadoId).getLngLat());return Math.hypot(r.x+r.width/2-c.x-p.x,r.y+r.height/2-c.y-p.y);});
 expect(await anchor()).toBeLessThan(2);await page.waitForTimeout(700);expect(await anchor()).toBeLessThan(2);
 expect(await beacon.evaluate(el=>getComputedStyle(el).pointerEvents)).toBe('none');
 await page.evaluate(()=>{map.addSource('quake-impact',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[-48,-22],[-46,-22],[-46,-20],[-48,-20],[-48,-22]]]}}});map.addLayer({id:'quake-impact-fill',type:'fill',source:'quake-impact',paint:{'fill-color':'#41db8a','fill-opacity':.56}});window.__mgSeismicImpactState={id:'beacon-0',features:1};});
 await expect(beacon).toHaveCount(1);await expect(beacon.locator('.event-pin-value')).toHaveText('M 2,4');
 await page.evaluate(()=>map.setLayoutProperty('quake-impact-fill','visibility','none'));await expect(beacon).toHaveCount(1);
 await page.evaluate(()=>{eventoSelecionadoId='beacon-1';syncAllMarkers();});await expect(page.locator('[data-quake-id="beacon-1"] > .event-focus-beacon')).toHaveCount(1);await expect(beacon).toHaveCount(1);
 await expect(page.locator('[data-quake-id="beacon-1"]')).toHaveAttribute('aria-label',/M2,4/);
 await page.emulateMedia({reducedMotion:'reduce'});expect(await beacon.locator('.event-pin-glass').evaluate(el=>getComputedStyle(el,'::after').animationName)).toBe('none');
 await page.evaluate(()=>{layerVisibility.earthquakes=false;syncAllMarkers();});await expect(beacon).toHaveCount(0);
});
for(const globe of [false,true])test('real camera descends over its destination '+(globe?'mobile globe':'desktop flat'),async({page})=>{
 await page.setViewportSize({width:globe?390:1280,height:900});
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto('/');await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(globe=>{pausarBuscas();clearTimeout(cycleTimeout);EventCamera.cancel();SeismicPaintTour.stop();SeismicImpact.stop();stopMapCamera();for(const l of map.getStyle().layers)if(l.type==='raster')map.removeLayer(l.id);
 GlobePreview.setMode(globe?'globe':'mercator');
 map.jumpTo({center:[-80,-55],zoom:8,padding:0,pitch:0,bearing:0});eventoSelecionadoId='camera-start';EventCamera.enter('camera-start',{center:[-80,-55],zoom:8});EventCamera.cancel();
 eventoSelecionadoId='camera-polar';window.__arrivalCount=0;EventCamera.afterArrival('camera-polar',()=>__arrivalCount++);window.__tripStarted=Date.now();EventCamera.enter('camera-polar',{center:[27,67.25],zoom:10});},globe);
 // Render-budget delays can extend earlier legs. Inspect the actual approach, not wall-clock age.
 await page.waitForFunction(()=>EventCamera.state()?.id==='camera-polar'&&EventCamera.state()?.stage==='approach'&&map.getZoom()>8);
 // The optical center compensates for panels and zoom: the destination stays anchored in pixels.
 const position=()=>page.evaluate(()=>{const p=map.project([27,67.25]);return {x:p.x,y:p.y,width:map.getContainer().clientWidth,height:map.getContainer().clientHeight};});
 const first=await position();console.log('camera-approach',await page.evaluate(()=>({state:EventCamera.state(),selected:eventoSelecionadoId,center:map.getCenter().toArray(),zoom:map.getZoom()})));expect(first.x).toBeGreaterThan(0);expect(first.x).toBeLessThan(first.width);expect(first.y).toBeGreaterThan(0);expect(first.y).toBeLessThan(first.height);
 await page.waitForTimeout(300);const second=await position();expect(Math.hypot(second.x-first.x,second.y-first.y)).toBeLessThan(4);
 expect(await page.evaluate(()=>__arrivalCount)).toBe(0);await page.waitForFunction(()=>__arrivalCount===1);
});
