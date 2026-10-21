const {test,expect}=require('@playwright/test');test.use({serviceWorkers:'block',reducedMotion:'reduce'});
test('cyclone history and official products render and follow a new advisory without movement',async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort());
 await page.goto('/');await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{
  pausarBuscas();for(const l of map.getStyle().layers)if(l.type==='raster')map.removeLayer(l.id);clearTimeout(cycleTimeout);stopMapCamera();stopWaveFront();stopHurricaneOfficialRoute();
  globalAlerts=[];globalEvents=[];cycloneHistory.clear();hurricaneFxSyncCoords.clear();eventoSelecionadoId=null;
  // Controlled public-source-shaped records, never a production event or delivery.
  window.__routeFeed={features:[{type:'Feature',geometry:{type:'Point',coordinates:[130.1,18.1]},properties:{eventid:'route-test',eventname:'Cyclone route fixture',iscurrent:'true',severitydata:{severity:140}}}]};window.__routeNHC={activeStorms:[]};
  fetchWithCorsFallback=async url=>new Response(JSON.stringify(String(url).includes('CurrentStorms')?__routeNHC:__routeFeed),{status:200,headers:{'Content-Type':'application/json'}});
  buscarTrilhaGDACS=async()=>null;fonteBooted=()=>false;
 });
 await page.evaluate(()=>fetchRealHurricanes());
 expect(await page.evaluate(()=>map.getSource('cyclone-track').serialize().data.features.length)).toBe(0);
 await page.evaluate(async()=>{__routeFeed.features[0].geometry.coordinates=[130.3,18.3];await fetchRealHurricanes();});
 expect(await page.evaluate(()=>map.getSource('cyclone-track').serialize().data.features[0].geometry.coordinates)).toEqual([[130.1,18.1],[130.3,18.3]]);
 expect(await page.evaluate(()=>map.getSource('cyclone-cone').serialize().data.features.length)).toBe(0);
 // NHC publishes a new product even if the rounded current center is unchanged.
 await page.evaluate(async()=>{__routeFeed.features=[];__routeNHC.activeStorms=[{id:'ALQA',name:'Route fixture',latitudeNumeric:20,longitudeNumeric:-60,intensity:'80',trackCone:{kmzFile:'https://example.invalid/advisory-1.kmz'}}];await fetchRealHurricanes();eventoSelecionadoId=globalAlerts[0].id;window.__officialCalls=[];fetchKmzGeoJSON=async url=>{__officialCalls.push(url);return kmlToGeoJSONRota('<kml><Placemark><name>Fixture</name><LineString><coordinates>-60,20 -59,21</coordinates></LineString><Polygon><outerBoundaryIs><LinearRing><coordinates>-61,19 -58,19 -59,22 -61,19</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>');};await startHurricaneOfficialRoute(globalAlerts[0]);hurricaneFxSyncCoords.set(eventoSelecionadoId,[-60,20]);});
 expect(await page.evaluate(()=>map.getSource('nhc-official-track').serialize().data.features[0].geometry.coordinates)).toEqual([[-60,20],[-59,21]]);
 expect(await page.evaluate(()=>!!map.getLayer('nhc-official-cone-fill'))).toBe(true);
 await page.evaluate(async()=>{__routeNHC.activeStorms[0].trackCone.kmzFile='https://example.invalid/advisory-2.kmz';await fetchRealHurricanes();});
 await expect.poll(()=>page.evaluate(()=>__officialCalls)).toEqual(['https://example.invalid/advisory-1.kmz','https://example.invalid/advisory-2.kmz']);
 expect(await page.evaluate(()=>globalAlerts[0].coneUrl)).toBe('https://example.invalid/advisory-2.kmz');
 await page.evaluate(()=>fetchRealHurricanes());expect(await page.evaluate(()=>__officialCalls)).toHaveLength(2);
 await page.evaluate(async()=>{__routeNHC.activeStorms[0].trackCone=null;await fetchRealHurricanes();});
 expect(await page.evaluate(()=>!!map.getSource('nhc-official-track'))).toBe(false);
 expect(await page.evaluate(()=>globalAlerts[0].coneUrl)).toBeNull();
 // A delayed old download must not overwrite the newer advisory.
 await page.evaluate(async()=>{
  fetchKmzGeoJSON=async url=>{if(url.endsWith('old.kmz'))await new Promise(resolve=>window.__releaseOldRoute=resolve);return {poligonos:[],pontos:[],linhas:[{type:'Feature',properties:{name:url.endsWith('old.kmz')?'old':'latest'},geometry:{type:'LineString',coordinates:[[-60,20],[-59,21]]}}]};};
  const item=globalAlerts[0];item.coneUrl='https://example.invalid/old.kmz';const old=startHurricaneOfficialRoute(item);item.coneUrl='https://example.invalid/latest.kmz';await startHurricaneOfficialRoute(item);__releaseOldRoute();await old;
 });
 expect(await page.evaluate(()=>map.getSource('nhc-official-track').serialize().data.features[0].properties.name)).toBe('latest');
});
