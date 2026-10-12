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
for(const width of [1280,390])for(const reload of [false,true])test('catálogos paralelos lentos não roubam a câmera; chegada real continua prioritária '+width+(reload?' após refresh':''),async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.route('**/js/orquestrador-feeds.js*',r=>r.fulfill({contentType:'application/javascript',body:`
  window.fetchFdsnGeoJSON=async()=>[{source:'USGS',sourceEventId:'startup-stable',coords:[-70,-20],mag:2.9,depth:10,time:Date.now()-3*3600000,place:'Inicial estável'}];
  for(const name of ['fetchUsgsRealtimeFeeds','fetchOVSICORIData','fetchMARNSismos','fetchGeofonData','fetchFunvisisData','fetchJMAData','fetchIGPData','fetchOSCBoliviaData','fetchBMKGData','fetchGeoNetData','fetchUspSismos','fetchCSNChileData','fetchSSNMexicoData','fetchEMSCData'])window[name]=async()=>[];
\n`+fs.readFileSync('js/orquestrador-feeds.js','utf8')}));
 await page.setViewportSize({width,height:844});await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#pd-local')).toContainText('Inicial estável');
 if(reload){await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('#pd-local')).toContainText('Inicial estável');}
 await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&window.__mgMapReady);
 await page.evaluate(()=>pausarBuscas());await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 const state=await page.evaluate(async()=>{
  clearTimeout(cycleTimeout);SeismicCinema.stop();const original=eventoSelecionadoId;
  // Even beyond the old 60-second timer, each source's first snapshot is history.
  window.__mgPageLoadAt=Date.now()-120000;window.__mgColdLoadGraceUntil=0;
  pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();activeAlertingIds.clear();
  const q=(id,mag,coords)=>({id,sourceEventId:id,type:'earthquake',source:'USGS',coords,mag,depth:7,time:Date.now()-4*3600000,place:id});
  planetReinforcementDedupEAdiciona([q('Histórico Califórnia',2.1,[-117,36])],'USGS');
  planetReinforcementDedupEAdiciona([q('Histórico Havaí',1.8,[-155,19])],'EMSC');
  window.__afadRows=[{earthquake_id:'old-turkey',latitude:38,longitude:29,mag:1.8,depth:7,date:new Date(Date.now()-3*3600000).toISOString(),location:'Histórico Turquia'}];
  fetchWithCorsFallback=async()=>Response.json({result:__afadRows});await fetchAfadQuakes();
  applyFilters();focusNextNewCameraQuake();focusNextQuakeRevision();
  const after={selected:eventoSelecionadoId,pending:pendingNewCameraQuakes.size,revisions:pendingQuakeRevisions.size,badges:activeAlertingIds.size,count:globalEvents.length};
  window.__afadRows.push({earthquake_id:'new-turkey',latitude:37,longitude:31,mag:1.7,depth:6,date:new Date(Date.now()-60000).toISOString(),location:'Chegada real Turquia'});
  await fetchAfadQuakes();clearTimeout(cycleTimeout);
  return {original,after,selected:EventStore.getSelected()?.place,error:window.__lastPainelDetalheError};
 });
 expect(state.after.selected).toBe(state.original);expect(state.after.pending).toBe(0);expect(state.after.revisions).toBe(0);expect(state.after.badges).toBe(0);expect(state.after.count).toBeGreaterThanOrEqual(4);expect(state.selected).toContain('Chegada real Turquia');expect(state.error).toBeFalsy();
 await expect(page.locator('#pd-local')).toContainText(/Chegada real.*Turquia/);
});
