const {test,expect}=require('@playwright/test');require('./helpers/card-renderer-fixture.cjs')(test);
test('real ingestion keeps Vanuatu M6.3 stable across alternating and failed catalogues and accepts a genuine revision',async({page})=>{
 await page.setViewportSize({width:1280,height:900});await page.goto('/');await page.waitForFunction(()=>window.__cardRendererFixtureReady&&!__fetchGlobalFeedsEmAndamento);
 const result=await page.evaluate(async()=>{
  pausarBuscas();clearTimeout(cycleTimeout);PresentationLimits.clear();pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();activeAlertingIds.clear();activeUpdatedIds.clear();isFirstLoad=false;isFirstDisplay=false;somAtivo=false;
  const base={type:'earthquake',time:Date.now()-3600000,place:'197 km NW of Port-Olry, Vanuatu',coords:[165.5892,-13.9906],depth:16,source:'USGS',isPreliminary:false,quality:'B'};
  const seismic={...base,id:'USGS-us6000u3jl',sourceEventId:'us6000u3jl',sourceAliases:['us6000u3jl','pt26293000'],sourceNetwork:'us',mag:6.3,magnitudeType:'mww',sourceUpdatedAt:1792477739943};
  const rapid={...base,id:'USGS-pt26293000',sourceEventId:'pt26293000',sourceAliases:['pt26293000'],sourceNetwork:'pt',mag:6.6,magnitudeType:'mi',sourceUpdatedAt:1792470573579,depth:10,coords:[165.713,-13.869],time:base.time-1737};
  const emsc={...base,source:'EMSC',sourceEventId:'emsc-vanuatu',mag:6.6,depth:10},gfz={...base,source:'GEOFON',sourceEventId:'gfz-vanuatu',mag:6.3};
  globalEvents=mergeEarthquakeReports([seismic,rapid,emsc,gfz]);globalAlerts=[];globalEvents[0].id='vanuatu-canonical';knownEventIds.add('vanuatu-canonical');lastMerged=[...globalEvents];showEventDetails(0,false);clearTimeout(cycleTimeout);
  for(const name of ['fetchOVSICORIData','fetchMARNSismos','fetchGeofonData','fetchFunvisisData','fetchJMAData','fetchIGPData','fetchOSCBoliviaData','fetchBMKGData','fetchGeoNetData','fetchUspSismos','fetchCSNChileData','fetchSSNMexicoData','fetchEMSCData'])window[name]=async()=>[];
  window.fetchGeofonData=async()=>[gfz];window.fetchEMSCData=async()=>[{id:'emsc-vanuatu',geometry:{coordinates:[...base.coords,-10]},properties:{mag:6.6,depth:10,time:new Date(base.time).toISOString(),status:'reviewed',flynn_region:'Vanuatu'}}];
  let usgs=[],rt=[];window.fetchFdsnGeoJSON=async()=>{if(!usgs.length)throw Error('USGS unavailable in offline test');return usgs;};window.fetchUsgsRealtimeFeeds=async()=>{if(!rt.length)throw Error('USGS-RT unavailable in offline test');return rt;};
  let revisions=0;EventStore.subscribe(reason=>{if(reason==='revise')revisions++;});
  const states=[];
  for(let i=0;i<12;i++){usgs=i%4===0?[]:i%4===1?[rapid]:i%4===2?[]:[rapid,seismic];rt=i%4===2?[{...seismic,source:'USGS-RT'}]:[];await fetchGlobalFeeds();clearTimeout(cycleTimeout);states.push({id:globalEvents[0].id,mag:globalEvents[0].mag,depth:globalEvents[0].depth});}
  const before={revisions,queued:pendingQuakeRevisions.size,badges:activeUpdatedIds.size};
  usgs=[{...seismic,mag:6.2,sourceUpdatedAt:1792477739944}];rt=[];await fetchGlobalFeeds();clearTimeout(cycleTimeout);
  const after={mag:globalEvents[0].mag,revisions};
  usgs=[rapid,seismic];await fetchGlobalFeeds();clearTimeout(cycleTimeout);
  return {states,before,after,final:globalEvents[0].mag,error:window.__lastSismoError};
 });
 expect(result.error).toBeNull();expect(result.states).toHaveLength(12);for(const state of result.states)expect(state).toEqual({id:'vanuatu-canonical',mag:6.3,depth:16});expect(result.before).toEqual({revisions:0,queued:0,badges:0});expect(result.after).toEqual({mag:6.2,revisions:1});expect(result.final).toBe(6.2);await expect(page.locator('#pd-mag')).toContainText('6,2');
});
