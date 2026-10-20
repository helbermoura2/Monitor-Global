const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block',reducedMotion:'reduce'});
async function boot(page,width){
 await page.setViewportSize({width,height:900});await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.fallback());await page.goto('/');await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento);await page.waitForTimeout(1600);
 await page.evaluate(async()=>{pausarBuscas();for(const j of __buscasAgendadas)PeriodicScheduler.cancel(j.key);clearTimeout(cycleTimeout);clearTimeout(window.__mgCycleGuard);EventCamera.cancel();SeismicPaintTour.stop();stopWaveFront();stopFeltZone();CinematicCard.stop();await CountryBoundaries.ready;for(const l of map.getStyle().layers)if(l.type==='raster')map.removeLayer(l.id);map._render=()=>{};pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();activeAlertingIds.clear();activeUpdatedIds.clear();isFirstLoad=false;isFirstDisplay=false;window.__mgColdLoadGraceUntil=0;window.__mgQuakeCameraPresented=new Map();window.__mgAutoRotation=undefined;window.__mgHoldEndsAt=window.__mgLiveQuakeUntil=window.__mgRevisionProtectedUntil=0;});
 await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));
}
for(const width of [1280,390])test('new Venezuela M2.6 interrupts the camera of a clicked M5.3 update '+width,async({page})=>{
 await boot(page,width);await page.evaluate(()=>{globalEvents=[{id:'updated53',type:'earthquake',mag:5.3,depth:10,coords:[-60,-20],time:Date.now()-3600000,place:'Sismo atualizado',source:'QA',_updatedAt:Date.now()}];globalAlerts=[];lastMerged=globalEvents.slice();activeUpdatedIds.set('updated53',Date.now()+180000);if(innerWidth>900){sidebarFilter='earthquake';DesktopRecords.filter('earthquake');}else toggleMobileEventsModal(true);renderSidebarList(lastMerged);});
 await page.locator('#events .event').click();expect(await page.evaluate(()=>__mgQuakePresentationMode)).toBe('revision');expect(await page.evaluate(()=>SeismicPaintTour.owns('updated53'))).toBe(true);
 const result=await page.evaluate(()=>{const q={id:'venezuela26',type:'earthquake',mag:2.6,depth:12,coords:[-66,10],time:Date.now(),place:'Venezuela',source:'QA'};globalEvents.push(q);activeAlertingIds.set(q.id,Date.now()+180000);queueNewCameraQuakes([q]);const accepted=focusNextNewCameraQuake();return {accepted,id:EventStore.selectedId,previousTour:SeismicPaintTour.owns('updated53')};});
 expect(result).toEqual({accepted:true,id:'venezuela26',previousTour:false});await expect(page.locator('#pd-local')).toContainText('Venezuela');
});
test('late catalog records do not hijack the timed eleven-slot rotation',async({page})=>{
 test.setTimeout(120000);

 await page.route('https://api.open-meteo.com/v1/forecast?*',r=>{const u=new URL(r.request().url()),lats=u.searchParams.get('latitude').split(',').map(Number),lons=u.searchParams.get('longitude').split(',').map(Number);return r.fulfill({json:lats.map((lat,i)=>({latitude:lat,longitude:lons[i],current_units:{temperature_2m:'°C',wind_speed_10m:'km/h'},current:{time:Math.floor(Date.now()/1000),temperature_2m:18,weather_code:2}}))});});
 await boot(page,1280);
 await page.evaluate(async()=>{window.__mgAutoRotation={phase:0,quakes:{},types:{},alerts:new Map(),worldCapitals:{},lastType:null};await WorldCapitalWeather.warm(__mgAutoRotation.worldCapitals);});
 await page.evaluate(()=>{
  const now=Date.now();globalEvents=[0,1].map(i=>({id:'rotation-q'+i,type:'earthquake',countryCode:'US',mag:2+i*.2,depth:10,coords:[-120+i*10,30],time:now-3600000,place:'Sismo '+i,source:'QA'}));
  globalAlerts=[{id:'rotation-other',type:'wind',hazardNature:'warning',countryCode:'BR',uf:'SP',coords:null,time:now,place:'Aviso em São Paulo',source:'INMET',expiresAt:now+3600000}];lastMerged=[...globalEvents,...globalAlerts];CapitalWeather.ingest([{cidade:'São Paulo',temp:23,atualizado_em:new Date(now).toISOString(),condicao_desc:'Céu claro'}]);CapitalWeather.load=async()=>CapitalWeather.records();
  // Real ingestion path: delayed source records stay catalog-only.
  const late={id:'late-catalog',type:'earthquake',mag:5.3,depth:10,coords:[20,40],time:now-24*3600000,place:'Catálogo tardio',source:'QA'};globalEvents.push(late);anunciarSismosSuplementares([late]);
  window.__timedSelections=[];EventStore.subscribe(reason=>{if(reason==='select')__timedSelections.push({id:EventStore.selectedId,type:EventStore.getSelected()?.type});});
  runAutoCycle();
 });
 expect(await page.evaluate(()=>pendingNewCameraQuakes.size)).toBe(0);
 // Advance the real tour/presentation timers rather than calling the selector.
 for(let i=0;i<18;i++){await page.clock.runFor(30000);if(await page.evaluate(()=>__timedSelections.length>=11))break;}
 const rows=await page.evaluate(()=>__timedSelections.slice(0,11));expect(rows).toHaveLength(11);expect(rows.map(x=>x.type)).toEqual(['earthquake','earthquake','wind','wind','capital-weather','capital-weather','earthquake','earthquake','wind','wind','wind']);
});
