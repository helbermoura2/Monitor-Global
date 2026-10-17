const {test,expect}=require('@playwright/test');
for(const mobile of [false,true])test.describe(mobile?'native touch':'native mouse',()=>{
 test.use({serviceWorkers:'block',hasTouch:mobile,isMobile:mobile,viewport:{width:mobile?390:1280,height:900}});
 for(const scene of ['paint','scenario','tsunami'])test(`${scene} preserves the entire drag`,async({page,context})=>{
  await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort());
  await page.goto('/');
  await page.evaluate(()=>OptionalFeatures.seismicScenarios());await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento&&window.TsunamiPresentation&&window.SeismicScenarioDemo);
  await page.evaluate(scene=>{
   pausarBuscas();PeriodicScheduler.cancel('correlation');clearTimeout(cycleTimeout);clearTimeout(window.__mgCycleGuard);pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();NewEventPriority.clear?.();stopWaveFront();stopFeltZone();SeismicCinema.stop();PresentationLimits.clear();
   // Keep the real renderer and native handlers. Remove only offline raster tiles.
   for(const l of map.getStyle().layers)if(l.type==='raster')map.removeLayer(l.id);
   globalAlerts=[];globalEvents=[{id:'gesture-qa',type:'earthquake',mag:6.6,depth:10,coords:[-80.8,7.5],time:Date.now(),place:'Panamá',source:'QA'}];
   if(scene==='tsunami')globalAlerts=[{id:'gesture-bulletin',type:'tsunami',official:true,source:'PTWC',coords:[-80.8,7.5],originTime:globalEvents[0].time,originMag:6.6,time:Date.now(),place:'Panamá',hazardNature:'warning',warningLevel:'Ameaça oficial',sev:4,affectedAreas:[{name:'Panama',category:'1 TO 3 METERS'}]}];
   showEventDetails(0,false);if(scene==='scenario')SeismicScenarioDemo.start('rupture');
   clearTimeout(cycleTimeout);clearTimeout(window.__mgCycleGuard);clearTimeout(window.__mgWaveDelayT);clearTimeout(window.__mgRadarDelayT);EventCamera.cancel();stopMapCamera();CinematicCard.stop();SeismicCinema.stop();
   document.body.classList.remove('mobile-details-open','mobile-details-mid');
   map.stop();map.jumpTo({center:[-80.8,7.5],zoom:4,padding:0,pitch:0,bearing:0});
   window.__gestureStops=0;const stop=map.stop.bind(map);map.stop=(...args)=>{if(window.__gestureActive)__gestureStops++;return stop(...args);};
  },scene);
  if(scene==='tsunami')await page.waitForFunction(()=>TsunamiPresentation.state());
  const x=mobile?120:590,y=mobile?370:420,dx=mobile?125:180;
  const cdp=mobile?await context.newCDPSession(page):null;
  for(let attempt=0;attempt<2;attempt++){
   await page.evaluate(({x,y})=>{window.__gestureActive=true;window.__gestureAnchor=map.unproject([x,y]).toArray();},{x,y});
   if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});else{await page.mouse.move(x,y);await page.mouse.down();}
   // Pause the scenario on press, before rendering delays can allow an auto refocus.
   if(scene==='scenario')expect(await page.evaluate(()=>SeismicScenarioDemo.state().paused)).toBe(true);
   for(let step=1;step<=12;step++){
    const point={x:x+dx*step/12,y:y+20*step/12};
    if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point]});else await page.mouse.move(point.x,point.y);
    await page.waitForTimeout(30);
   }
   const result=await page.evaluate(({x,y})=>{const p=map.project(__gestureAnchor);return {dx:p.x-x,dy:p.y-y,stops:__gestureStops,selected:eventoSelecionadoId};},{x,y});
   if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();
   await page.evaluate(()=>{window.__gestureActive=false;});
   expect(result.stops).toBe(0);expect(result.dx).toBeGreaterThan(dx*.75);expect(result.selected).toBe('gesture-qa');
  }
  if(scene==='scenario')expect(await page.evaluate(()=>SeismicScenarioDemo.state().paused)).toBe(true);
  if(scene==='tsunami')expect(await page.evaluate(()=>TsunamiPresentation.state().paused)).toBe(true);
 });
});
