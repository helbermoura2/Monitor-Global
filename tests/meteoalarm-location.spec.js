const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
const area='Nacimiento y Campo de Tabernas';
for(const width of [1280,390])test('Meteoalarm focuses the official Spanish region in every selection mode '+width,async({page})=>{
 await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto('/');await page.waitForFunction(()=>__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);EventCamera.cancel();stopMapCamera();SeismicPaintTour.stop();SeismicImpact.stop();for(const l of map.getStyle().layers)if(l.type==='raster')map.removeLayer(l.id);isFirstLoad=false;isFirstDisplay=false;window.__mgColdLoadGraceUntil=0;pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();activeAlertingIds.clear();globalEvents=[];EventCamera.enter=(id,c)=>{map.jumpTo(c);return 0;};});
 const result=await page.evaluate(async area=>{
  const actualFocus=WeatherWarningCamera.focus;let pending;
  WeatherWarningCamera.focus=item=>(pending=actualFocus(item));
  const results=[];
  for(const projection of ['globe','mercator'])for(const mode of ['auto','priority','manual']){
   GlobePreview.setMode(projection);map.jumpTo({center:[-60,-10],zoom:1.2,padding:{top:0,right:0,bottom:0,left:0}});
   const item={id:'spain-'+projection+'-'+mode,type:mode==='priority'?'flood':'storm',hazardNature:'warning',source:'Meteoalarm / Espanha',country:'Espanha',countryCode:'ES',meteoalarmArea:area,area,place:area+' — Espanha',severity:'Moderate',time:Date.now(),expiresAt:Date.now()+3600000};
   globalAlerts=[item];PresentationLimits.clear();window.__mgHoldEndsAt=0;window.__mgRevisionProtectedUntil=0;window.__mgSoftCycle=mode==='auto';window.__mgRotationDisplay=mode!=='manual';pending=null;showAlertDetails(item,mode==='priority');window.__mgRotationDisplay=false;
   if(!pending)throw Error('No warning focus');await pending;clearTimeout(cycleTimeout);
   const bounds=await WeatherWarningCamera.resolve(item),padding=WeatherWarningCamera.frame(bounds).padding;
   const corners=[bounds[0],bounds[1],[bounds[0][0],bounds[1][1]],[bounds[1][0],bounds[0][1]]].map(p=>{const q=map.project(p);return[q.x,q.y];});
   results.push({projection,mode,center:map.getCenter().toArray(),zoom:map.getZoom(),bounds,padding,corners,w:map.getContainer().clientWidth,h:map.getContainer().clientHeight,note:document.getElementById('pd-warning-location')?.textContent});
  }return results;
 },area);
 for(const row of result){expect(row.center[0]).toBeCloseTo(-2.46477,3);expect(row.center[1]).toBeGreaterThan(36.98);expect(row.center[1]).toBeLessThan(37.28);expect(row.zoom).toBeGreaterThan(5);expect(row.note).toContain('área oficial');for(const[x,y]of row.corners){expect(x).toBeGreaterThanOrEqual(row.padding.left-3);expect(x).toBeLessThanOrEqual(row.w-row.padding.right+3);expect(y).toBeGreaterThanOrEqual(row.padding.top-3);expect(y).toBeLessThanOrEqual(row.h-row.padding.bottom+3);}}
});
test('country context never becomes an exact regional marker, and late catalogue responses cannot steal selection',async({page})=>{
 let release;await page.route('**/*',r=>{
  if(r.request().url().includes('/data/meteoalarm-areas.json'))return new Promise(resolve=>{release=()=>r.fulfill({json:{countries:{ES:[[-9,35],[4,44]]},areas:{ES:{Known:{bb:[[-3,36],[-2,37]],verified:new Date().toISOString().slice(0,10)}}}}}).then(resolve);});
  return new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort();
 });
 await page.goto('/');await page.waitForFunction(()=>__mgMapReady);await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);EventCamera.cancel();stopMapCamera();window.focusCalls=[];EventCamera.enter=(id,c)=>focusCalls.push(c);window.lateItem={id:'late-met',countryCode:'ES',country:'Espanha',meteoalarmArea:'Known'};eventoSelecionadoId='late-met';window.lateFocus=WeatherWarningCamera.focus(lateItem);});
 await expect.poll(()=>!!release).toBe(true);await page.evaluate(()=>eventoSelecionadoId='other');await release();
 const result=await page.evaluate(async()=>{await lateFocus;const lateCount=focusCalls.length,item={id:'unknown-region',countryCode:'ES',country:'Espanha',meteoalarmArea:'Not published'};eventoSelecionadoId=item.id;const exact=await WeatherWarningCamera.resolve(item),focused=await WeatherWarningCamera.focus(item);return{lateCount,exact,focused,center:focusCalls.at(-1)?.center,note:document.getElementById('pd-warning-location')?.textContent};});
 expect(result.lateCount).toBe(0);expect(result.exact).toBeNull();expect(result.focused).toBe(true);expect(result.center[0]).toBe(-2.5);expect(result.note).toContain('Visão geral: Espanha');expect(result.note).toContain('área exata indisponível');
});
