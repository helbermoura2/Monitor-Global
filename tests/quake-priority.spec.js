const{test,expect}=require('@playwright/test');test.use({serviceWorkers:'block',reducedMotion:'reduce'});
async function boot(page,width=1280){const base=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';await page.setViewportSize({width,height:844});await page.route('**/*',r=>new URL(r.request().url()).hostname===new URL(base).hostname?r.continue():r.abort());await page.goto(base+'/?verify='+Date.now());await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&window.__mgMapReady&&GlobalQuakeTravel?.status()==='ready');await page.evaluate(()=>pausarBuscas());await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));await page.evaluate(()=>{pausarBuscas();pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();activeAlertingIds.clear();window.__mgQuakeCameraPresented=new Map();clearTimeout(cycleTimeout);SeismicCinema.stop();globalEvents=[{id:'low-priority-qa',sourceEventId:'low-native-qa',type:'earthquake',mag:2.4,depth:9,time:Date.now()-6*60000,coords:[29,36],place:'Eastern Mediterranean QA',source:'EMSC'},{id:'high-priority-qa',sourceEventId:'high-native-qa',type:'earthquake',mag:5.2,depth:12,time:Date.now()-9*60000,coords:[-35,30],place:'Northern Mid-Atlantic Ridge QA',source:'GEOFON'}];isFirstDisplay=false;showEventDetails(0,true);clearTimeout(cycleTimeout);});}
for(const width of [1280,390])test('new M5.2 interrupts M2.4 card and late-report radar '+width,async({page})=>{
 await boot(page,width);await page.clock.runFor(200);await page.clock.fastForward(3300);await page.clock.runFor(100);
 expect(await page.evaluate(()=>__mgFeltZoneState.id)).toBe('low-priority-qa');
 const focused=await page.evaluate(()=>{queueNewCameraQuakes([globalEvents[1]]);const ok=focusNextNewCameraQuake();clearTimeout(cycleTimeout);return ok;});expect(focused).toBe(true);await expect(page.locator('#pd-local')).toContainText('Northern Mid-Atlantic');
 await page.clock.runFor(200);await page.clock.fastForward(3300);await page.clock.runFor(100);
 expect(await page.evaluate(()=>__mgWaveFrontState.id)).toBe('high-priority-qa');expect(await page.evaluate(()=>__mgWaveFrontState.radii.p)).toBeGreaterThan(0);await page.clock.runFor(2600);await page.screenshot({path:'/tmp/quake-priority-'+width+'.png'});
 const waiting=await page.evaluate(()=>{globalEvents.push({...globalEvents[0],id:'equal-priority-qa',mag:5.2},{...globalEvents[0],id:'small-priority-qa',mag:1.9});queueNewCameraQuakes(globalEvents.slice(2));return focusNextNewCameraQuake();});expect(waiting).toBe(false);expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('high-priority-qa');
});
test('known quake magnitude increase gains priority, and badge recovery runs before hold timer',async({page})=>{
 await boot(page);const revised=await page.evaluate(()=>{queueQuakeRevisions([{...globalEvents[1],_previousMag:2.3}]);return focusNextQuakeRevision(true);});expect(revised).toBe(true);await expect(page.locator('#pd-local')).toContainText('Northern Mid-Atlantic');
 await page.evaluate(()=>{pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();showEventDetails(0,true);window.__mgQuakeCameraPresented.delete('high-priority-qa');activeAlertingIds.set('high-priority-qa',Date.now()+180000);scheduleNextAutoCycle(250);});await page.clock.runFor(300);
 expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('high-priority-qa');
 await page.evaluate(()=>{showEventDetails(0,true);scheduleNextAutoCycle(250);});await page.clock.runFor(300);expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('low-priority-qa');
});
test('actual merged feed arrival and a raised revision preempt the low protected card',async({page})=>{
 await boot(page);await page.evaluate(()=>{
  const low={...globalEvents[0]},high={...globalEvents[1]};globalEvents=[low];knownEventIds.clear();knownEventIds.add(low.id);isFirstLoad=false;isFirstDisplay=false;
  window.__priorityReports=[low,high];
  fetchFdsnGeoJSON=async()=>__priorityReports;
  for(const name of ['fetchUsgsRealtimeFeeds','fetchOVSICORIData','fetchMARNSismos','fetchGeofonData','fetchFunvisisData','fetchJMAData','fetchIGPData','fetchOSCBoliviaData','fetchBMKGData','fetchGeoNetData','fetchUspSismos','fetchCSNChileData','fetchSSNMexicoData','fetchEMSCData'])window[name]=async()=>[];
  somAtivo=false;
 });await page.evaluate(()=>fetchGlobalFeeds());
 expect(await page.evaluate(()=>EventStore.getSelected()?.mag)).toBe(5.2);await expect(page.locator('#pd-local')).toContainText('Northern Mid-Atlantic');
 await page.evaluate(()=>{const low=globalEvents.find(e=>e.sourceEventId==='low-native-qa'),high=globalEvents.find(e=>e.sourceEventId==='high-native-qa');high.mag=2.3;high.magnitudeMin=2.3;high.magnitudeMax=2.3;pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();activeAlertingIds.clear();showEventDetails(globalEvents.indexOf(low),true);window.__priorityReports=[{...low},{...high,mag:5.2}];});await page.evaluate(()=>fetchGlobalFeeds());
 expect(await page.evaluate(()=>EventStore.getSelected()?.mag)).toBe(5.2);await expect(page.locator('#pd-local')).toContainText('Northern Mid-Atlantic');
});
