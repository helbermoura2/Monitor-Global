const {test,expect}=require('@playwright/test');
const fs=require('fs');
const {promisify}=require('util');const execFile=promisify(require('child_process').execFile);
const realTiles=process.env.GLOBE_REAL_TILES==='1';
for(const width of [1280,390])test.describe('globe '+width,()=>{
 test.use({serviceWorkers:'block',viewport:{width,height:900},hasTouch:width===390,isMobile:width===390,reducedMotion:'reduce'});
 async function boot(page){
  await page.route('**/*',async r=>{
   const u=new URL(r.request().url());
   if(u.pathname==='/qa-world-tile'&&realTiles){const [z,x,y]=['z','x','y'].map(k=>Number(u.searchParams.get(k)));if(![z,x,y].every(Number.isInteger)||z<0||z>4||x<0||y<0||x>=2**z||y>=2**z)return r.abort();const file='/tmp/globe-real-'+z+'-'+y+'-'+x+'.jpg';if(!fs.existsSync(file))await execFile('curl',['-fsSL','--max-time','20','-A','Mozilla/5.0','https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/'+z+'/'+y+'/'+x,'-o',file]);return r.fulfill({path:file,contentType:'image/jpeg'});}
   if(u.pathname==='/qa-world-tile'&&fs.existsSync('/tmp/globe-world-tile.jpg'))return r.fulfill({path:'/tmp/globe-world-tile.jpg',contentType:'image/jpeg'});
   return u.origin==='http://127.0.0.1:4173'?r.continue():r.abort();
  });
  await page.goto('/');await page.waitForFunction(()=>window.GlobePreview&&__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
  await page.evaluate(()=>CountryBoundaries.ready);
  await page.evaluate(realTiles=>{
   pausarBuscas();PeriodicScheduler.cancel('correlation');clearTimeout(cycleTimeout);clearTimeout(window.__mgCycleGuard);pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();NewEventPriority.clear?.();stopMapCamera();stopWaveFront();stopFeltZone();SeismicCinema.stop();PresentationLimits.clear();
   for(const l of map.getStyle().layers)if(l.type==='raster')map.removeLayer(l.id);
   map.addSource('qa-world',{type:'raster',tiles:['http://127.0.0.1:4173/qa-world-tile?z={z}&x={x}&y={y}'],tileSize:256,maxzoom:realTiles?4:0});map.addLayer({id:'qa-world',type:'raster',source:'qa-world'});
   globalAlerts=[];globalEvents=[[37,37.2],[37,65],[-143,-37.2]].map((coords,i)=>({id:'globe-'+i,type:'earthquake',mag:6.1,depth:10,coords,time:Date.now()-3600000,place:'Teste '+i,source:'QA'}));
   globalEvents.forEach(item=>CountryBoundaries.apply(item));
   showEventDetails(0,false);clearTimeout(cycleTimeout);clearTimeout(window.__mgCycleGuard);clearTimeout(window.__mgWaveDelayT);clearTimeout(window.__mgRadarDelayT);SeismicPaintTour.stop();EventCamera.cancel();stopMapCamera();stopWaveFront();stopFeltZone();SeismicCinema.stop();CinematicCard.stop();
   document.body.classList.remove('mobile-details-open','mobile-details-mid');map.jumpTo({center:[37,37.2],zoom:1.3,bearing:0,pitch:0,padding:0});syncAllMarkers();
   window.__originalMap=map;window.__originalMarkers=[...markerStores.quake.values()];window.__globeErrors=[];map.on('error',e=>{if(/projection|sky|WebGL|shader/i.test(e.error?.message||''))__globeErrors.push(e.error.message);});
  },realTiles);
 }
 test('menu toggles the same map, preserves data, hides far-side pins and remembers projection on reload',async({page})=>{
  await boot(page);expect(await page.evaluate(()=>(map.getProjection()?.type||'mercator'))).toBe('globe');
  const before=await page.evaluate(()=>({events:JSON.stringify(globalEvents),selected:eventoSelecionadoId,center:map.getCenter().toArray(),zoom:map.getZoom(),layers:map.getStyle().layers.map(l=>l.id)}));
  await page.evaluate(()=>GlobePreview.open());await expect(page.locator('#globe-preview-panel')).toBeVisible();await page.getByRole('button',{name:'Usar globo',exact:true}).click();
  await expect(page.locator('#globe-preview-status')).toHaveCount(0);await page.waitForTimeout(700);
  expect(await page.evaluate(()=>(map.getProjection()?.type||'mercator'))).toBe('globe');
  expect(await page.evaluate(()=>({events:JSON.stringify(globalEvents),selected:eventoSelecionadoId,center:map.getCenter().toArray(),zoom:map.getZoom(),layers:map.getStyle().layers.map(l=>l.id)}))).toEqual(before);
  expect(await page.evaluate(()=>map===__originalMap&&[...markerStores.quake.values()].every((m,i)=>m===__originalMarkers[i]))).toBe(true);
  const pins=await page.evaluate(()=>[...markerStores.quake].map(([id,m])=>{const b=m.getElement().getBoundingClientRect(),c=map.getContainer().getBoundingClientRect(),p=map.project(m.getLngLat());return {id,error:Math.hypot(b.x+b.width/2-c.x-p.x,b.y+b.height/2-c.y-p.y),visibility:getComputedStyle(m.getElement()).visibility};}));
  for(const id of ['globe-0']){const p=pins.find(p=>p.id===id);expect(p,id+' remains represented on the visible hemisphere').toBeDefined();expect(p.error).toBeLessThan(2);expect(p.visibility).toBe('visible');}
  // At world zoom only the selected pin is retained; far-side pins must never remain visible.
  expect(pins.some(p=>p.id==='globe-2'&&p.visibility!=='hidden')).toBe(false);
  if(width===1280){await page.evaluate(()=>window.__openMobileMenu());await page.locator('#mf-main-map').click();expect(await page.evaluate(()=>GlobePreview.state().mode)).toBe('mercator');expect(await page.evaluate(()=>sidebarFilter)).toBe('all');await page.waitForTimeout(500);await page.evaluate(()=>window.__openMobileMenu());await page.locator('#mf-main-planet').click();expect(await page.evaluate(()=>GlobePreview.state().mode)).toBe('globe');await expect(page.locator('#chip-radar')).toBeHidden();await expect(page.locator('[data-f=storm]')).toBeHidden();}else await page.evaluate(()=>GlobePreview.overview());await expect.poll(()=>page.evaluate(()=>Math.abs(map.getZoom()-GlobePreview.worldZoom()))).toBeLessThan(0.001);await page.waitForFunction(()=>GlobeSpace.state().epoch&&document.getElementById('globe-space-canvas')?.dataset.epoch);
  expect(await page.evaluate(()=>GlobeSpace.state().bodies.length)).toBe(0);expect(await page.evaluate(()=>getComputedStyle(document.getElementById('globe-space-canvas')).pointerEvents)).toBe('none');expect(await page.evaluate(()=>Math.abs(EventCamera.worldZoom()-GlobePreview.worldZoom()))).toBeLessThan(.001);expect(await page.evaluate(()=>Math.abs(Number(document.getElementById('globe-space-canvas').dataset.epoch)-Date.now()))).toBeLessThan(2000);
  const framing=await page.evaluate(()=>{const c=map.getCenter(),p=map.project(c),r=GlobePreview.availableRadius().radius;let actual=0;for(const az of [0,90,180,270])for(let d=40;d<=100;d+=4){const q=destinoGeodesico(c.lat,c.lng,d*Math.PI/180*6371,az),s=map.project(q);actual=Math.max(actual,Math.hypot(s.x-p.x,s.y-p.y));}return {actual,r,zoom:map.getZoom(),center:[p.x,p.y],expected:GlobePreview.availableRadius().center};});
  expect(framing.actual).toBeGreaterThan(framing.r*.85);expect(framing.actual).toBeLessThan(framing.r*1.08);expect(framing.zoom).toBeGreaterThan(.7);expect(framing.center[0]).toBeCloseTo(framing.expected[0],0);expect(framing.center[1]).toBeCloseTo(framing.expected[1],0);
  if(fs.existsSync('/tmp/globe-world-tile.jpg'))await page.waitForFunction(()=>map.isSourceLoaded('qa-world'),null,{timeout:5000});await page.waitForTimeout(500);await page.screenshot({path:'/tmp/globe-preview-'+width+'.png'});
  await page.evaluate(()=>GlobePreview.open());
  await expect(page.getByRole('button',{name:'Sistema Solar · escala real',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>/astronomy-engine|solar-system/.test(r.name)))).toBe(false);
  await page.locator('.globe-preview-close').click();

  // Native drag must rotate the globe without being cancelled by preview code.
  const x=width===390?160:600,y=460,old=await page.evaluate(()=>map.getCenter().lng);
  if(width===390){const c=await page.context().newCDPSession(page);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=10;i++){await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+70*i/10,y}]});await page.waitForTimeout(25);}await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  else{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+100,y,{steps:12});await page.mouse.up();}
  await expect.poll(()=>page.evaluate(old=>Math.abs(map.getCenter().lng-old),old)).toBeGreaterThan(5);
  await page.evaluate(()=>GlobePreview.setMode('mercator'));expect(await page.evaluate(()=>(map.getProjection()?.type||'mercator'))).toBe('mercator');await expect(page.locator('#globe-preview-status')).toHaveCount(0);await expect(page.locator('#globe-space-canvas,#globe-space-note')).toHaveCount(0);expect(await page.evaluate(()=>map.getSky())).toBeUndefined();
  expect(await page.evaluate(()=>__globeErrors)).toEqual([]);
  await page.reload();await page.waitForFunction(()=>__mgMapReady);expect(await page.evaluate(()=>(map.getProjection()?.type||'mercator'))).toBe('mercator');
  await page.evaluate(()=>GlobePreview.setMode('globe'));await page.reload();await page.waitForFunction(()=>__mgMapReady);expect(await page.evaluate(()=>(map.getProjection()?.type||'mercator'))).toBe('globe');await expect(page.locator('#globe-preview-status')).toHaveCount(0);
 });
 test('official ShakeMap and tsunami polygons render on the globe and survive switching back',async({page})=>{
  await boot(page);await page.evaluate(()=>OptionalFeatures.seismicScenarios());await page.evaluate(()=>{GlobePreview.setMode('globe');SeismicScenarioDemo.start('official');});
  await page.waitForFunction(()=>['usgs-shakemap-grid','usgs-shakemap-finite'].includes(__mgSeismicImpactState?.method)&&map.getSource('quake-impact')?.serialize().data.features.length>0,null,{timeout:15000}).catch(async e=>{throw Error(e.message+' '+JSON.stringify(await page.evaluate(()=>({state:window.__mgSeismicImpactState,scenario:SeismicScenarioDemo.state(),panel:document.getElementById('pd-linked-presentation')?.textContent,errors:__globeErrors}))));});
  await page.evaluate(()=>{SeismicScenarioDemo.togglePause();map.stop();map.jumpTo({center:[37,37.2],zoom:4,padding:0});window.__officialSource=map.getSource('quake-impact');window.__officialData=JSON.stringify(__officialSource.serialize().data);});
  await page.waitForTimeout(600);expect(await page.evaluate(()=>map.getLayer('quake-impact-fill')||map.getStyle().layers.find(l=>l.source==='quake-impact'))).toBeTruthy();
  await page.evaluate(()=>GlobePreview.setMode('mercator'));expect(await page.evaluate(()=>map.getSource('quake-impact')===__officialSource&&JSON.stringify(__officialSource.serialize().data)===__officialData)).toBe(true);
  await page.evaluate(()=>{SeismicScenarioDemo.stop(false);GlobePreview.setMode('globe');TsunamiMap.preview('warning');});
  await page.waitForFunction(()=>map.getSource('tsunami-official-regions')?.serialize().data.features.length>0);
  await page.evaluate(()=>{map.stop();window.__tsunamiSource=map.getSource('tsunami-official-regions');window.__tsunamiData=JSON.stringify(__tsunamiSource.serialize().data);GlobePreview.setMode('mercator');});
  expect(await page.evaluate(()=>map.getSource('tsunami-official-regions')===__tsunamiSource&&JSON.stringify(__tsunamiSource.serialize().data)===__tsunamiData)).toBe(true);expect(await page.evaluate(()=>__globeErrors)).toEqual([]);
 });
});
