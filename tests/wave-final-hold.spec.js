const {test,expect}=require('@playwright/test');test.use({serviceWorkers:'block'});
async function boot(page,width){const base=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';await page.setViewportSize({width,height:844});await page.route('**/*',r=>new URL(r.request().url()).hostname===new URL(base).hostname?r.continue():r.abort());await page.goto(base+'/?verify='+Date.now());await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&GlobalQuakeTravel?.status()==='ready');await page.evaluate(()=>{pausarBuscas();pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();clearTimeout(cycleTimeout);stopWaveFront();SeismicCinema.stop();});await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));}
async function start(page){return page.evaluate(()=>{const id='wave-final-qa',depth=10,end=Math.min(GlobalQuakeTravel.endTime('p',depth),waveDisplaySeconds(5,depth));globalEvents=[{id,type:'earthquake',mag:5,depth,time:Date.now()-(end-1)*1000,coords:[120,-9],place:'Sismo QA',source:'QA'}];eventoSelecionadoId=id;window.__mgRevisionProtectedId=id;window.__mgRevisionProtectedUntil=Date.now()+90000;window.__mgHoldEndsAt=__mgRevisionProtectedUntil;window.__mgLiveQuakeId=id;window.__mgLiveQuakeUntil=__mgRevisionProtectedUntil;window.__finalRotation=[];window.scheduleNextAutoCycle=ms=>__finalRotation.push(ms);map.jumpTo({zoom:1.5,center:[120,-9]});startWaveFront(120,-9,5,depth,globalEvents[0].time,{id,mode:'live',chaseCam:true,protectUntilEnd:true});return {end,expectedP:GlobalQuakeTravel.radius('p',depth,end-.001)};});}
for(const width of [1280,390])test('final rays hold for five seconds after opening, then release '+width,async({page})=>{
 await boot(page,width);const expected=await start(page);await page.clock.runFor(1400);
 const s=await page.evaluate(()=>__mgWaveFrontState);expect(s.stage).toBe('holding');expect(s.radii.p).toBe(expected.expectedP);await expect(page.locator('.wave-front-status')).toContainText('Quadro final');
 const deadline=s.finalUntil;expect(await page.evaluate(()=>__mgRevisionProtectedUntil)).toBe(deadline);expect(await page.evaluate(()=>__finalRotation)).toEqual([5020]);
 await page.clock.fastForward(deadline-await page.evaluate(()=>Date.now())-100);await page.clock.runFor(40);
 expect(await page.evaluate(()=>__mgWaveFrontState.radii)).toEqual(s.radii);await page.screenshot({path:'/tmp/wave-final-hold-'+width+'.png'});
 await page.clock.fastForward(150);await expect(page.locator('.wave-front-status')).toHaveCount(0);expect(await page.evaluate(()=>__mgWaveFrontState)).toBe(null);expect(await page.evaluate(()=>getAutoCycleProtectionRemaining())).toBe(0);
});
test('only a larger new quake interrupts the hold; manual changes cancel old timers',async({page})=>{
 await boot(page,1280);await start(page);await page.clock.runFor(1400);
 const result=await page.evaluate(()=>{for(const [id,mag] of [['equal-qa',5],['small-qa',4]])globalEvents.push({id,type:'earthquake',mag,depth:10,time:Date.now(),coords:[120,-9],place:'Novo QA',source:'QA'});queueNewCameraQuakes(globalEvents.slice(1));const smaller=focusNextNewCameraQuake();globalEvents.push({id:'large-qa',type:'earthquake',mag:6,depth:10,time:Date.now(),coords:[120,-9],place:'Maior QA',source:'QA'});queueNewCameraQuakes([globalEvents.at(-1)]);const larger=focusNextNewCameraQuake();return {smaller,larger,selected:eventoSelecionadoId};});
 expect(result).toEqual({smaller:false,larger:true,selected:'large-qa'});await page.clock.runFor(200);await page.clock.fastForward(3100);await page.clock.runFor(50);expect(await page.evaluate(()=>__mgWaveFrontState.id)).toBe('large-qa');await page.clock.fastForward(3000);await page.clock.runFor(50);expect(await page.evaluate(()=>__mgWaveFrontState.id)).toBe('large-qa');
 await page.evaluate(()=>stopWaveFront());
});
test('opening stays protected beyond the old fixed display timer',async({page})=>{
 await boot(page,1280);
 await page.evaluate(()=>{const id='opening-qa';globalEvents=[{id,type:'earthquake',mag:5,depth:10,time:Date.now(),coords:[120,-9],place:'QA',source:'QA'},{id:'equal-opening-qa',type:'earthquake',mag:5,depth:10,time:Date.now(),coords:[120,-9],place:'QA',source:'QA'}];eventoSelecionadoId=id;window.__mgRevisionProtectedId=id;window.__mgRevisionProtectedUntil=Date.now()+90000;window.__mgHoldEndsAt=__mgRevisionProtectedUntil;startWaveFront(120,-9,5,10,Date.now(),{id,mode:'replay',protectUntilEnd:true});});
 await page.clock.fastForward(90100);await page.clock.runFor(40);
 expect(await page.evaluate(()=>getAutoCycleProtectionRemaining())).toBeGreaterThan(0);expect(await page.evaluate(()=>__mgWaveFrontState.stage)).toBe('opening');
 expect(await page.evaluate(()=>{queueNewCameraQuakes([globalEvents[1]]);return focusNextNewCameraQuake();})).toBe(false);await page.evaluate(()=>stopWaveFront());
});
test('GlobalQuake display deadline fades weak quakes, caps the final snapshot, and omits expired reports',async({page})=>{
 await boot(page,1280);
 const expected=await page.evaluate(()=>{
  const id='display-limit-qa',depth=10,mag=3.2,end=waveDisplaySeconds(mag,depth);
  eventoSelecionadoId=id;window.__mgRevisionProtectedId=id;window.__mgRevisionProtectedUntil=Date.now()+90000;window.__mgHoldEndsAt=__mgRevisionProtectedUntil;
  window.__finalRotation=[];window.scheduleNextAutoCycle=ms=>__finalRotation.push(ms);
  startWaveFront(120,-9,mag,depth,Date.now(),{id,mode:'live',protectUntilEnd:true});
  return {end,p:GlobalQuakeTravel.radius('p',depth,end-.001)};
 });
 expect(expected.end).toBeGreaterThan(185);expect(expected.end).toBeLessThan(186);
 await page.clock.fastForward(150000);await page.clock.runFor(100);
 const faded=await page.evaluate(()=>({state:__mgWaveFrontState,paint:map.getPaintProperty('wave-front-p-line','line-opacity')}));
 expect(faded.state.alpha).toBeCloseTo(2-2*faded.state.elapsedS/expected.end,10);expect(faded.paint).toBe(faded.state.alpha);expect(faded.state.radii.pkp).toBe(null);expect(faded.state.radii.pkikp).toBe(null);
 await page.clock.fastForward((expected.end-150)*1000+300);await page.clock.runFor(100);
 const held=await page.evaluate(()=>__mgWaveFrontState);expect(held.stage).toBe('holding');expect(held.radii.p).toBe(expected.p);expect(held.elapsedS).toBeLessThan(186);expect(held.alpha).toBeLessThan(faded.state.alpha);
 await expect(page.locator('.wave-front-status')).toContainText('03:05 / 03:05');
 await page.clock.fastForward(2000);await page.clock.runFor(100);expect(await page.evaluate(()=>__mgWaveFrontState.radii.p)).toBe(expected.p);
 await page.clock.fastForward(3100);await expect(page.locator('.wave-front-status')).toHaveCount(0);
 await page.evaluate(()=>startWaveFront(120,-9,3.2,10,Date.now()-11*60000,{id:'expired-qa',mode:'live',chaseCam:true}));await page.clock.runFor(400);
 const expired=await page.evaluate(()=>({state:__mgWaveFrontState,camera:waveCamRAF,radar:__mgFeltZoneState}));expect(expired.state).toBe(null);expect(expired.camera).toBe(null);expect(expired.radar.lateReport).toBe(true);
 await expect(page.locator('.felt-zone-status')).toContainText('Ondas já passaram');
 await page.evaluate(()=>{stopWaveFront();stopFeltZone();});
});
for(const mag of [1.9,4.1])test('manual chase stops at its display deadline '+mag,async({page})=>{
 test.setTimeout(120000);await boot(page,1280);
 const expected=await page.evaluate(mag=>{
  const depth=mag===1.9?3:30,id='manual-stop-qa';
  globalEvents=[{id,type:'earthquake',mag,depth,time:Date.now()-16*60000,coords:[142.9355,44.4099],place:'Japão QA',source:'QA'}];eventoSelecionadoId=id;
  window.__mgRevisionProtectedId=id;window.__mgRevisionProtectedUntil=Date.now()+90000;window.__mgHoldEndsAt=__mgRevisionProtectedUntil;
  window.__finalRotation=[];window.scheduleNextAutoCycle=ms=>__finalRotation.push(ms);
  map.jumpTo({center:[142.9355,44.4099],zoom:9});
  startWaveFront(142.9355,44.4099,mag,depth,Date.now(),{id,mode:'replay',chaseCam:true,protectUntilEnd:true});
  return {end:waveDisplaySeconds(mag,depth),depth};
 },mag);
 await page.clock.fastForward(15000);await page.clock.runFor(100);await page.clock.fastForward(expected.end*1000-15000);await page.clock.runFor(5000);
 const s=await page.evaluate(()=>__mgWaveFrontState);expect(s.stage).toBe('holding');expect(s.elapsedS).toBeCloseTo(expected.end-.001,8);expect(s.alpha).toBeLessThan(1);
 await expect(page.locator('.wave-front-status')).toContainText(mag===1.9?'02:08 / 02:08':'05:02 / 05:02');
 const radius=await page.evaluate(()=>__mgWaveFrontState.radii.p);await page.clock.runFor(1000);expect(await page.evaluate(()=>__mgWaveFrontState.radii.p)).toBe(radius);
 await page.clock.fastForward(5100);await expect(page.locator('.wave-front-status')).toHaveCount(0);
 console.log(JSON.stringify({mag,depth:expected.depth,stopsAfterSeconds:expected.end,finalRadiusKm:radius}));
});
