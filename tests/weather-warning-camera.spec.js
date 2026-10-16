const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block',reducedMotion:'reduce'});
for(const width of [1280,390])test('avisos regionais de tempestade e vento focam a área oficial em todos os modos '+width,async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.setViewportSize({width,height:844});await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&window.__mgMapReady);await page.evaluate(()=>pausarBuscas());
 const result=await page.evaluate(async()=>{
  isFirstLoad=false;isFirstDisplay=false;window.__mgColdLoadGraceUntil=0;pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();activeAlertingIds.clear();globalEvents=[];
  const g={type:'Polygon',coordinates:[[[-98,35],[-97,35],[-97,36],[-98,36],[-98,35]]]};
  EventCamera.enter=(id,camera)=>{calls.push({o:camera});return 6000;};
  const calls=[],fetches=[];map.fitBounds=(b,o)=>calls.push({b,o});map.flyTo=o=>calls.push({fly:o});map.easeTo=()=>{};map.stop=()=>{};
  fetchWithCorsFallback=async url=>{fetches.push(url);return Response.json({geometry:g});};
  let focused;
  const actualFocus=WeatherWarningCamera.focus;WeatherWarningCamera.focus=item=>(focused=actualFocus(item));
  const rows=[];
  for(const type of ['storm','wind'])for(const mode of ['auto','priority','manual']){
   const item={id:type+'-'+mode,type,hazardNature:'warning',source:'NWS / NOAA',place:'Área oficial Oklahoma',severity:'Severe',sev:3,time:Date.now(),expiresAt:Date.now()+3600000,affectedZones:['https://api.weather.gov/zones/forecast/OKZ025']};
   globalAlerts=[item];PresentationLimits.clear();window.__mgHoldEndsAt=0;window.__mgRevisionProtectedUntil=0;window.__mgSoftCycle=mode==='auto';window.__mgRotationDisplay=mode!=='manual';
   calls.length=0;focused=null;showAlertDetails(item,mode==='priority');window.__mgRotationDisplay=false;
   if(!focused)throw Error("Seleção não disparou o foco meteorológico");await focused;clearTimeout(cycleTimeout);clearTimeout(window.__mgRadarDelayT);
   rows.push({type,mode,id:eventoSelecionadoId,fit:calls.find(c=>c.o),world:calls.some(c=>c.fly?.zoom===1.5)});
  }
  const inmet={id:'inmet-no-anchor',type:'wind',hazardNature:'warning',place:'Municípios brasileiros',source:'INMET',time:Date.now(),municipalityLocations:[{coords:[-48,-22]},{coords:[-47,-21]}]};
  globalAlerts=[inmet];PresentationLimits.clear();window.__mgRevisionProtectedUntil=0;window.__mgHoldEndsAt=0;calls.length=0;focused=null;window.__mgSoftCycle=true;window.__mgRotationDisplay=true;showAlertDetails(inmet,false);window.__mgRotationDisplay=false;if(!focused)throw Error("Seleção municipal não disparou o foco");await focused;clearTimeout(cycleTimeout);
  return {rows,fetches,inmet:calls.find(c=>c.o),error:window.__lastPainelDetalheError};
 });
 expect(result.rows).toHaveLength(6);for(const row of result.rows){expect(row.id).toBe(row.type+'-'+row.mode);expect(row.fit.o.center[0]).toBeCloseTo(-97.5,3);expect(row.fit.o.center[1]).toBeGreaterThan(35);expect(row.fit.o.center[1]).toBeLessThan(36);expect(row.world).toBe(false);expect(row.fit.o.padding.left+row.fit.o.padding.right).toBeLessThan(width);expect(row.fit.o.zoom).toBeGreaterThan(4);expect(row.fit.o.zoom).toBeLessThanOrEqual(8);}
 expect(result.fetches).toHaveLength(1);expect(result.inmet.o.center[0]).toBeCloseTo(-47.5,3);expect(result.inmet.o.center[1]).toBeGreaterThan(-22);expect(result.inmet.o.center[1]).toBeLessThan(-21);expect(result.error).toBeFalsy();
});
test('resposta tardia de zona não rouba câmera de outro evento; área desconhecida não abre o mundo',async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__mgMapReady);
 const r=await page.evaluate(async()=>{
  const fits=[];EventCamera.enter=(id,camera)=>fits.push(camera);let release;fetchWithCorsFallback=()=>new Promise(resolve=>{release=resolve;});
  const item={id:'late-zone',affectedZones:['https://api.weather.gov/zones/county/FLZ001']};eventoSelecionadoId=item.id;
  const pending=WeatherWarningCamera.focus(item);eventoSelecionadoId='other';release(Response.json({geometry:{type:'Polygon',coordinates:[[[-81,28],[-80,28],[-80,29],[-81,28]]]}}));await pending;
  return {fits,empty:await WeatherWarningCamera.resolve({}),dateLine:WeatherWarningCamera.bounds([[179,50],[-179,51]])};
 });expect(r.fits).toHaveLength(0);expect(r.empty).toBe(null);expect(r.dateLine[1][0]-r.dateLine[0][0]).toBe(2);
});
