const {test,expect}=require('@playwright/test');
const fs=require('fs');
test.use({serviceWorkers:'block',reducedMotion:'reduce'});
const base=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';
async function prepare(page,width,handler){
 await page.setViewportSize({width,height:900});
 await page.route('**/*',async r=>{const u=new URL(r.request().url());if(await handler(r,u))return;return u.origin===base?r.continue():r.abort();});
 await page.goto(base);await page.waitForFunction(()=>window.__mgMapReady&&window.OfficialMapSources&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);stopWaveFront();stopFeltZone();pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();globalAlerts=[];globalEvents=[];isFirstLoad=false;isFirstDisplay=false;window.__mgColdLoadGraceUntil=0;});
}
for(const [source,width,mode,file]of [['ingv',1280,'auto','ingv-panama-47519522.json'],['eu',390,'new','eu-southern-italy-20260601.json']])test('real '+source+' published intensity replaces unavailable USGS in '+mode+' '+width,async({page})=>{
 const data=JSON.parse(fs.readFileSync('tests/fixtures/shaking/'+file)),row={...data.origin,source,eventId:data.eventId,version:data.version,path:source+'/'+data.eventId+'.json'};
 await prepare(page,width,async(r,u)=>{if(u.pathname==='/rupture-shaking'){await r.fulfill({json:{status:'unavailable'}});return true;}if(u.pathname.endsWith('/official-shaking/index.json')){await r.fulfill({json:{events:[row]}});return true;}if(u.pathname.endsWith('/'+row.path)){await r.fulfill({json:data});return true;}return false;});
 await page.evaluate(({data,mode})=>{const o=data.origin;globalEvents=[{id:'regional-qa',type:'earthquake',source:'QA',coords:[o.lng,o.lat],mag:o.mag,depth:10,time:o.time,place:'Teste de mapa publicado'}];window.__mgSoftCycle=mode==='auto';window.__mgRotationDisplay=mode==='auto';showEventDetails(0,mode==='new');window.__mgRotationDisplay=false;clearTimeout(cycleTimeout);}, {data,mode});
 await page.waitForFunction(method=>__mgSeismicImpactState?.method===method&&__mgSeismicImpactState.features>0,data.method);
 await expect(page.locator('.seismic-impact-status')).toContainText(source==='ingv'?'INGV ShakeMap':'ShakeMap-EU');
 expect(await page.evaluate(()=>map.getSource('quake-impact').serialize().data.features.every(f=>f.properties.official===true))).toBe(true);
 expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('regional-qa');expect(await page.evaluate(()=>__mgQuakePresentationMode)).toBe(mode);
 await page.evaluate(()=>{SeismicImpact.finish();SeismicPaintTour.stop();clearTimeout(cycleTimeout);});
 expect(await page.evaluate(()=>SeismicFocus.frame({id:'regional-qa',lng:globalEvents[0].coords[0],lat:globalEvents[0].coords[1],mag:globalEvents[0].mag,depth:10}).bounds)).not.toBeNull();
});
for(const [width,mode]of [[1280,'new'],[390,'auto']])test('rupture alone is presented without a fabricated footprint and upgrades to a map '+width+' '+mode,async({page})=>{
 let available=false;const time=Date.now(),grid={nx:3,ny:3,x0:36,x1:38,y0:36,y1:38,values:[3,4,3,4,7,4,3,4,3]};
 const raw={type:'FeatureCollection',features:[{geometry:{type:'Polygon',coordinates:[[[36.8,36.8,1],[37.2,37.2,1],[37.2,37.2,15],[36.8,36.8,1]]]}}]};
 await prepare(page,width,async(r,u)=>{
  if(u.pathname==='/rupture-shaking'){await r.fulfill({json:available?{status:'available',method:'usgs-shakemap-grid',provider:'USGS ShakeMap',version:'later-grid',grid}:{status:'unavailable'}});return true;}
  if(u.pathname.endsWith('/official-shaking/index.json')){await r.fulfill({json:{events:[]}});return true;}
  if(u.hostname==='earthquake.usgs.gov'){await r.fulfill({json:u.pathname.endsWith('/query')?{id:'us-real-rupture',geometry:{coordinates:[37,37]},properties:{time,mag:6.6,products:{shakemap:[{code:'us-real-rupture',updateTime:1,contents:{'download/rupture.json':{url:'https://earthquake.usgs.gov/rupture.json'}}}]}}}:raw});return true;}return false;
 });
 // Raster tile retry clocks are unrelated to product polling.
 await page.evaluate(()=>{for(const l of map.getStyle().layers||[])if(l.type==='raster')map.removeLayer(l.id);});
 await page.clock.install();
 await page.evaluate(({mode,time})=>{globalEvents=[{id:'USGS-us-real-rupture',type:'earthquake',source:'USGS',coords:[37,37],mag:6.6,depth:10,time,place:'Teste de ruptura publicada'}];window.__mgSoftCycle=mode==='auto';window.__mgRotationDisplay=mode==='auto';showEventDetails(0,mode==='new');window.__mgRotationDisplay=false;clearTimeout(cycleTimeout);},{mode,time});
 await page.waitForFunction(()=>__mgSeismicImpactState?.method==='usgs-finite-rupture'&&map.getLayer('quake-rupture-line'));
 await expect(page.locator('.seismic-impact-status')).toContainText('Sem mapa oficial de intensidade');
 expect(await page.evaluate(()=>map.getSource('quake-impact').serialize().data.features)).toEqual([]);
 expect(await page.evaluate(()=>__mgQuakePresentationMode)).toBe(mode);
 const bounds=await page.evaluate(()=>SeismicImpact.bounds(eventoSelecionadoId));for(let i=0;i<4;i++)expect(bounds[i]).toBeCloseTo([36.8,36.8,37.2,37.2][i],6);
 await page.evaluate(()=>{SeismicPaintTour.stop();clearTimeout(cycleTimeout);SeismicImpact.finish();});
 await expect(page.locator('.seismic-impact-status')).toContainText('Não delimita a área sentida');
 // Repeated rupture-only responses must not loop or restart the scene.
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));await page.clock.runFor(61000);
 await expect.poll(()=>page.evaluate(()=>RuptureShaking.get(globalEvents[0])?.status)).toBe('rupture-only');
 expect(await page.evaluate(()=>__mgSeismicImpactState.method)).toBe('usgs-finite-rupture');
 available=true;await page.clock.runFor(61000);
 await expect.poll(()=>page.evaluate(()=>__mgSeismicImpactState?.method==='usgs-shakemap-grid'&&__mgSeismicImpactState.features>0)).toBe(true);
 await expect(page.locator('.seismic-impact-status')).not.toContainText('Sem mapa oficial');
 expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('USGS-us-real-rupture');
 expect(await page.evaluate(()=>!!map.getLayer('quake-rupture-line'))).toBe(false);
});
test('menu demonstrates real rupture without an intensity map and restores the scene',async({page})=>{
 await prepare(page,390,async()=>false);await page.evaluate(()=>CardEffectDemo.preview('seismic-rupture-only'));
 await page.waitForFunction(()=>__mgSeismicImpactState?.id==='seismic-scenario-rupture-only'&&map.getLayer('quake-rupture-line'));
 await expect(page.locator('#pd-linked-presentation')).toContainText('grade foi ocultada neste teste');
 expect(await page.evaluate(()=>map.getSource('quake-impact').serialize().data.features.length)).toBe(0);
 expect(await page.evaluate(()=>globalEvents.length+globalAlerts.length)).toBe(0);
 await page.evaluate(()=>CardEffectDemo.stop());expect(await page.evaluate(()=>!!map.getSource('quake-published-rupture'))).toBe(false);
});
