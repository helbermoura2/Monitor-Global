const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block',reducedMotion:'no-preference'});
for(const width of [1280,390])test('wave geometry is independent of camera frames and unchanged final rays '+width,async({page})=>{
 test.setTimeout(120000);
 const base=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';
 await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.setViewportSize({width,height:844});await page.goto(base+'/?verify=20261009-wave-cadence',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&GlobalQuakeTravel.status()==='ready');
 await page.evaluate(()=>{pausarBuscas();pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();clearTimeout(cycleTimeout);stopWaveFront();stopFeltZone();SeismicCinema.stop();stopMapCamera();});
 await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 await page.evaluate(()=>{
  window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),100);window.cancelAnimationFrame=id=>clearTimeout(id);
  window.__waveWrites={p:0,s:0,pkp:0,pkikp:0};window.__waveData={};window.__cameraMoves=0;
  for(const phase of WAVE_PHASES){const source=map.getSource('wave-front-'+phase),original=source.setData;source.setData=function(data){__waveWrites[phase]++;__waveData[phase]=data;return original.call(this,data);};}
  map.on('move',()=>__cameraMoves++);
  map.jumpTo({center:[142,38],zoom:9});
  startWaveFront(142,38,4.1,10,Date.now()-15000,{id:'cadence-qa',mode:'replay',chaseCam:true});
 });
 await page.clock.runFor(3000);
 const moving=await page.evaluate(()=>({writes:{...__waveWrites},moves:__cameraMoves,state:__mgWaveFrontState,expected:GlobalQuakeTravel.radius('p',10,__mgWaveFrontState.elapsedS)}));
 expect(moving.moves).toBeGreaterThanOrEqual(25);
 expect(moving.writes.p).toBeGreaterThanOrEqual(10);expect(moving.writes.p).toBeLessThanOrEqual(12);
 expect(moving.writes.s).toBeLessThanOrEqual(12);expect(moving.writes.pkp).toBe(1);expect(moving.writes.pkikp).toBe(1);
 expect(moving.state.radii.p).toBe(moving.expected);
 const pan=await page.evaluate(()=>{
  const before=JSON.stringify(__waveWrites);
  for(let i=0;i<80;i++)map.jumpTo({center:[142+i*.001,38],zoom:7+i*.001});
  return {before,after:JSON.stringify(__waveWrites)};
 });expect(pan.after).toBe(pan.before);
 // A revision must invalidate geometry even when the same source objects remain.
 await page.evaluate(()=>refreshWaveFront({id:'cadence-qa',coords:[140,36],mag:4.1,depth:20}));
 await page.clock.runFor(300);
 const revised=await page.evaluate(()=>({state:__mgWaveFrontState,expected:GlobalQuakeTravel.radius('p',20,__mgWaveFrontState.elapsedS),coordinates:__waveData.p.geometry.coordinates,writes:__waveWrites.p}));
 expect(revised.state.depth).toBe(20);expect(revised.state.radii.p).toBe(revised.expected);expect(revised.writes).toBeGreaterThan(moving.writes.p);
 expect(revised.coordinates[0][0]).toBeCloseTo(140,6);
 await page.evaluate(()=>{
  stopWaveFront();map.jumpTo({center:[140,36],zoom:1.5});
  const end=waveDisplaySeconds(1.9,10);
  startWaveFront(140,36,1.9,10,Date.now()-(end-1)*1000,{id:'final-cadence-qa',mode:'live'});
 });
 await page.clock.runFor(1500);
 const final=await page.evaluate(()=>({state:__mgWaveFrontState,writes:{...__waveWrites}}));expect(final.state.stage).toBe('holding');
 await page.clock.runFor(2000);
 expect(await page.evaluate(()=>__waveWrites)).toEqual(final.writes);
 expect(await page.evaluate(()=>__mgWaveFrontState.radii)).toEqual(final.state.radii);
 console.log(JSON.stringify({width,cameraMoves:moving.moves,geometryUpdatesPerPhase:moving.writes.p,panTriggeredUpdates:0,finalRepeatedUpdates:0}));
 await page.evaluate(()=>stopWaveFront());
 const stopped=await page.evaluate(()=>({...__waveWrites}));await page.clock.runFor(1000);
 expect(await page.evaluate(()=>__waveWrites)).toEqual(stopped);expect(await page.evaluate(()=>__mgWaveFrontState)).toBeNull();
});
