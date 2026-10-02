const {test,expect}=require('@playwright/test');const fs=require('node:fs');
test.use({serviceWorkers:'block',reducedMotion:'reduce'});
for(const width of [1280,390])test('primeiro catálogo abre evento sem esperar agência lenta '+width,async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.route('**/js/orquestrador-feeds.js*',r=>r.fulfill({contentType:'application/javascript',body:`  const fast={source:'USGS',sourceEventId:'startup-fast',coords:[-70,-20],mag:3,depth:10,time:Date.now(),place:'Catálogo rápido'};
  window.fetchFdsnGeoJSON=async()=>[fast];
  for(const name of ['fetchUsgsRealtimeFeeds','fetchOVSICORIData','fetchMARNSismos','fetchGeofonData','fetchFunvisisData','fetchJMAData','fetchIGPData','fetchOSCBoliviaData','fetchBMKGData','fetchGeoNetData','fetchUspSismos','fetchCSNChileData','fetchSSNMexicoData'])window[name]=async()=>[];
  window.fetchEMSCData=()=>new Promise(resolve=>{window.__releaseSlowCatalog=()=>resolve([]);});
\n`+fs.readFileSync('js/orquestrador-feeds.js','utf8')}));
 await page.setViewportSize({width,height:844});await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#pd-local')).toContainText('Catálogo rápido',{timeout:10000});
 const state=await page.evaluate(()=>({loading:__fetchGlobalFeedsEmAndamento,phase:window.__mgAutoRotation.phase,id:eventoSelecionadoId,protectedUntil:window.__mgRevisionProtectedUntil,error:window.__lastPainelDetalheError}));
 expect(state.loading).toBe(true);expect(state.phase).toBe(1);expect(state.id).toBeTruthy();expect(state.protectedUntil).toBe(0);expect(state.error).toBeFalsy();
 await page.evaluate(()=>__releaseSlowCatalog());await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento);
 expect(await page.evaluate(()=>window.__mgAutoRotation.phase)).toBe(1);
 await page.evaluate(()=>{clearTimeout(cycleTimeout);CinematicCard.stop();});
});
test('aviso sem ponto entra na terceira vaga, sem inventar voo ou epicentro',async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento);
 const result=await page.evaluate(()=>{
  isFirstDisplay=false;const now=Date.now();globalEvents=[1,2].map(i=>({id:'q'+i,type:'earthquake',source:'QA',coords:[-70,-20],time:now,mag:3,depth:10,place:'Sismo'}));
  globalAlerts=[{id:'regional-cycle',type:'flood',hazardNature:'warning',coords:null,source:'NWS / NOAA',time:now,expiresAt:now+60000,place:'Região de teste',warningDescription:'Aviso regional',severityLabel:'Moderada'}];
  window.__mgAutoRotation=undefined;window.__mgRevisionProtectedUntil=0;map.isMoving=()=>false;map.flyTo=()=>{};window.__flights=0;window.softFlyToCoords=()=>{window.__flights++;return 0;};
  const rows=[];for(let i=0;i<3;i++){showNextAutoCycleItem();clearTimeout(cycleTimeout);rows.push(EventStore.getSelected()?.type);}
  return {rows,flights:window.__flights,soft:window.__mgSoftCycle,error:window.__lastPainelDetalheError};
 });
 expect(result.rows).toEqual(['earthquake','earthquake','flood']);expect(result.flights).toBe(2);expect(result.soft).toBe(false);expect(result.error).toBeFalsy();await expect(page.locator('#pd-local')).toContainText('Região de teste');await expect(page.locator('#pd-notice-brief')).toContainText('não fornece um ponto verificado');
});
