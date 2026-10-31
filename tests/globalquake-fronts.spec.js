const {test,expect}=require('@playwright/test');
const reference=require('./fixtures/globalquake-travel-reference.json');
test.use({serviceWorkers:'block'});
async function boot(page,width=1280){
 const base=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';await page.setViewportSize({width,height:844});
 await page.route('**/*',r=>new URL(r.request().url()).hostname===new URL(base).hostname?r.continue():r.abort());
 await page.goto(base+'/?verify='+Date.now(),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&window.GlobalQuakeTravel?.status()==='ready');
 await page.evaluate(()=>{pausarBuscas();isFirstLoad=false;window.__mgColdLoadGraceUntil=0;EventCamera.cancel();SeismicPaintTour.stop();stopMapCamera();pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();clearTimeout(cycleTimeout);});
}
test('browser agrees with original GlobalQuake Java tables for all 308 fronts',async({page})=>{
 await boot(page);
 const results=await page.evaluate(ref=>ref.map(r=>['p','s','pkp','pkikp'].map(p=>GlobalQuakeTravel.angle(p,r.depth,r.time))),reference);
 for(const [i,row] of reference.entries())for(let phase=0;phase<4;phase++){
  if(row.angles[phase]===-999)expect(results[i][phase]).toBe(null);else expect(Math.abs(results[i][phase]-row.angles[phase])).toBeLessThan(1e-10);
 }
});
for(const width of [1280,390])test('wave controller preserves live origin, replay, revisions and geodesic fronts '+width,async({page})=>{
 await boot(page,width);await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));
 await page.evaluate(()=>{
  const item={id:'wave-physics-qa',type:'earthquake',mag:4.8,depth:10,time:Date.now()-230000,coords:[120.757,-9.382],place:'Sumba · verificação do modelo',source:'QA',bandeira:'🇮🇩'};
  globalEvents=[item];isFirstDisplay=false;eventoSelecionadoId=item.id;startWaveFront(item.coords[0],item.coords[1],item.mag,item.depth,item.time,{id:item.id,mode:'live'});clearTimeout(cycleTimeout);
 });
 await page.clock.runFor(200);await page.clock.fastForward(3300);await page.clock.runFor(100);
 await expect(page.locator('.wave-front-status')).toContainText('Tempo real');
 let state=await page.evaluate(()=>__mgWaveFrontState);expect(state.mode).toBe('live');expect(state.elapsedS).toBeGreaterThan(230);expect(state.radii.p).toBeGreaterThan(865);
 const fronts=await page.evaluate(async()=>{
  const state=__mgWaveFrontState;return Promise.all(['p','s'].map(async phase=>{
   const data=await map.getSource(`wave-front-${phase}`).getData();
   const point=data.geometry.coordinates[0];
   const lat1=-9.382*Math.PI/180,lat2=point[1]*Math.PI/180,dlat=lat2-lat1,dlon=(point[0]-120.757)*Math.PI/180;
   const a=Math.sin(dlat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlon/2)**2;
   return {radius:2*6379*Math.asin(Math.sqrt(a)),expected:state.radii[phase]};
  }));
 });for(const f of fronts)expect(Math.abs(f.radius-f.expected)).toBeLessThan(.01);
 const origin=state.originTime;
 await page.evaluate(()=>{globalEvents[0].depth=100;globalEvents[0].mag=5;refreshWaveFront(globalEvents[0]);});await page.clock.runFor(350);
 state=await page.evaluate(()=>__mgWaveFrontState);expect(state.depth).toBe(100);expect(state.originTime).toBe(origin);expect(state.mode).toBe('live');
 await page.clock.fastForward(7500);await page.clock.runFor(1200);
 const badge=await page.locator('.wave-front-status').boundingBox(),header=await page.locator('#ux-controlbar').boundingBox();expect(badge.y).toBeGreaterThan(header.y+header.height);
 await page.screenshot({path:'/tmp/globalquake-live-'+width+'.png'});
 await page.evaluate(()=>{const q=globalEvents[0];startWaveFront(q.coords[0],q.coords[1],q.mag,q.depth,Date.now(),{id:q.id,mode:'replay'});clearTimeout(cycleTimeout);});
 await page.clock.runFor(200);await page.clock.fastForward(3300);await page.clock.runFor(100);
 await expect(page.locator('.wave-front-status')).toContainText('Replay');state=await page.evaluate(()=>__mgWaveFrontState);expect(state.elapsedS).toBeLessThan(10);expect(state.radii.p).toBe(null); // Vertical travel delay at 100 km.
 await page.clock.fastForward(45000);await page.clock.runFor(100);state=await page.evaluate(()=>__mgWaveFrontState);expect(state.radii.p).toBeGreaterThan(0);
 const radii=await page.evaluate(()=>{const s=__mgWaveFrontState;return {actual:s.radii.p,expected:GlobalQuakeTravel.radius('p',s.depth,s.elapsedS)};});expect(radii.actual).toBe(radii.expected);
 await page.evaluate(()=>{const q=globalEvents[0];startFeltZone(q.coords[0],q.coords[1],q.mag,q.depth,q.id);});await page.clock.runFor(400);
 expect(await page.evaluate(()=>__mgWaveFrontState)).toBe(null);await expect(page.locator('.felt-zone-wrap')).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>window.__mgSeismicImpactState?.id)).toBe('wave-physics-qa');
 await page.evaluate(()=>{stopWaveFront();stopFeltZone();SeismicImpact.stop();});await page.clock.fastForward(2700);await expect(page.locator('.wave-front-status')).toHaveCount(0);expect(await page.evaluate(()=>__mgWaveFrontState)).toBe(null);
});
test('failed model omits waves without inventing a radius',async({page})=>{
 await page.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'&&!u.pathname.endsWith('.bin.gz')?r.continue():r.abort();});
 await page.goto('/');await page.waitForFunction(()=>window.GlobalQuakeTravel?.status()==='error');
 expect(await page.evaluate(()=>GlobalQuakeTravel.radius('p',10,230))).toBe(null);
});
test('stop invalidates pending paints and reduced motion keeps the physical radius',async({page})=>{
 await boot(page);await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));
 await page.evaluate(()=>{startWaveFront(120.757,-9.382,4.8,10,Date.now()-230000,{id:'cleanup-qa',mode:'live'});stopWaveFront();});
 await page.clock.runFor(100);await expect(page.locator('.wave-front-status')).toHaveCount(0);expect(await page.evaluate(()=>__mgWaveFrontState)).toBe(null);
 expect(await page.evaluate(()=>['p','s','pkp','pkikp'].every(p=>map.getPaintProperty(`wave-front-${p}-line`,'line-opacity')===0))).toBe(true);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>startWaveFront(120.757,-9.382,4.8,600,Date.now()-230000,{id:'reduced-qa',mode:'live',chaseCam:true}));await page.clock.runFor(100);
 const r=await page.evaluate(()=>({actual:__mgWaveFrontState.radii.p,expected:GlobalQuakeTravel.radius('p',600,__mgWaveFrontState.elapsedS),camera:waveCamRAF}));expect(r.actual).toBe(r.expected);expect(r.camera).toBe(null);
 await page.evaluate(()=>stopWaveFront());
});
test('wave controller revision during camera delay uses the latest hypocenter',async({page})=>{
 await boot(page);await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));
 await page.evaluate(()=>{globalEvents=[{id:'pending-wave-qa',type:'earthquake',mag:4.8,depth:10,time:Date.now()-230000,coords:[120.757,-9.382],place:'Sismo de teste',source:'QA'}];isFirstDisplay=false;const q=globalEvents[0];eventoSelecionadoId=q.id;startWaveFront(q.coords[0],q.coords[1],q.mag,q.depth,q.time,{id:q.id,mode:'live',camDelayMs:3300});clearTimeout(cycleTimeout);});
 await page.clock.runFor(200);
 const expected=await page.evaluate(()=>{globalEvents[0]={...globalEvents[0],depth:100,time:globalEvents[0].time-2000,coords:[121,-9]};refreshWaveFront(globalEvents[0]);return {depth:100,originTime:globalEvents[0].time};});
 await page.clock.fastForward(3300);await page.clock.runFor(100);
 const s=await page.evaluate(()=>__mgWaveFrontState);expect(s.depth).toBe(expected.depth);expect(s.originTime).toBe(expected.originTime);
 await page.evaluate(()=>stopWaveFront());
});
for(const width of [1280,390])test('automatic painted presentation preserves origin and revision without GlobalQuake fronts '+width,async({page})=>{
 await boot(page,width);await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 const original=await page.evaluate(()=>{const time=Date.now()-9*3600000;globalEvents=[{id:'old-radar-qa',type:'earthquake',mag:5,depth:10,time,coords:[-155,19],place:'Sismo antigo',source:'QA'}];isFirstDisplay=false;window.__mgRotationDisplay=true;window.__mgSoftCycle=true;try{showEventDetails(0,false);}finally{window.__mgRotationDisplay=false;window.__mgSoftCycle=false;}clearTimeout(cycleTimeout);return time;});
 await page.clock.runFor(1000);await expect.poll(()=>page.evaluate(()=>window.__mgSeismicImpactState?.id)).toBe('old-radar-qa');
 expect(await page.evaluate(()=>__mgWaveFrontState)).toBeNull();await expect(page.locator('.felt-zone-wrap,.wave-front-status')).toHaveCount(0);
 const before=await page.evaluate(()=>({time:globalEvents[0].time,endsAt:__mgPaintTourState.endsAt,remaining:SeismicPaintTour.remaining(),method:__mgSeismicImpactState.method}));expect(before.time).toBe(original);expect(before.method).toBe('radial');expect(before.remaining).toBeGreaterThan(0);expect(before.remaining).toBeLessThanOrEqual(68000);
 await page.evaluate(()=>{globalEvents[0].mag=6;globalEvents[0].depth=100;showEventDetails(0,false,true);});
 expect(await page.evaluate(()=>__mgPaintTourState.endsAt)).toBe(before.endsAt);expect(await page.evaluate(()=>globalEvents[0].time)).toBe(original);
 const result=await page.evaluate(()=>{const item={id:'new-small-qa',type:'earthquake',mag:1,depth:10,time:Date.now(),coords:[-155,19],place:'Novo sismo',source:'QA'};globalEvents.push(item);queueNewCameraQuakes([item]);const focused=focusNextNewCameraQuake();clearTimeout(cycleTimeout);return {focused,id:eventoSelecionadoId};});expect(result).toEqual({focused:true,id:'new-small-qa'});
 expect(await page.evaluate(()=>__mgWaveFrontState)).toBeNull();await expect(page.locator('.felt-zone-wrap')).toHaveCount(0);
 await page.evaluate(()=>{SeismicPaintTour.stop();EventCamera.cancel();SeismicImpact.stop();});
});
for(const width of [1280,390])test('late, manual and fresh selections use the painted presentation without fabricating live fronts '+width,async({page})=>{
 await boot(page,width);await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 const origins=await page.evaluate(()=>{globalEvents=[{id:'late-indonesia-qa',type:'earthquake',mag:4.2,depth:157,time:Date.now()-10*60000,coords:[128,-8],place:'Kepulauan Barat Daya',source:'QA'},{id:'late-india-qa',type:'earthquake',mag:3.7,depth:10,time:Date.now()-13*60000,coords:[92.4,27.4],place:'Arunachal Pradesh',source:'QA'}];isFirstDisplay=false;return globalEvents.map(q=>q.time);});
 for(const index of [0,1]){
  await page.evaluate(index=>{showEventDetails(index,true);clearTimeout(cycleTimeout);},index);await page.clock.runFor(400);
  expect(await page.evaluate(()=>__mgWaveFrontState)).toBeNull();await expect(page.locator('.felt-zone-wrap,.wave-front-status')).toHaveCount(0);
  const state=await page.evaluate(index=>({id:__mgPaintTourState.id,expected:globalEvents[index].id,time:globalEvents[index].time}),index);expect(state.id).toBe(state.expected);expect(state.time).toBe(origins[index]);
 }
 const deadline=await page.evaluate(()=>__mgPaintTourState.endsAt);await page.evaluate(()=>{globalEvents[1].mag=3.8;showEventDetails(1,false,true);});expect(await page.evaluate(()=>__mgPaintTourState.endsAt)).toBe(deadline);
 await page.evaluate(()=>{showEventDetails(1,false);clearTimeout(cycleTimeout);});expect(await page.evaluate(()=>__mgPaintTourState.id)).toBe('late-india-qa');expect(await page.evaluate(()=>__mgWaveFrontState)).toBeNull();
 await page.evaluate(()=>{globalEvents.push({id:'fresh-qa',type:'earthquake',mag:4,depth:10,time:Date.now()-30000,coords:[92.4,27.4],place:'Chegada recente QA',source:'QA'});showEventDetails(2,true);clearTimeout(cycleTimeout);});expect(await page.evaluate(()=>__mgPaintTourState.id)).toBe('fresh-qa');expect(await page.evaluate(()=>__mgWaveFrontState)).toBeNull();
 // The independent physical controller still discards stale paints when explicitly invoked.
 await page.evaluate(()=>{SeismicPaintTour.stop();EventCamera.cancel();startWaveFront(128,-8,4.2,157,Date.now()-10*60000,{id:'stale-qa',mode:'live'});startWaveFront(92.4,27.4,4,10,Date.now()-30000,{id:'winning-qa',mode:'live'});});await page.clock.runFor(400);expect(await page.evaluate(()=>__mgWaveFrontState.id)).toBe('winning-qa');
 await page.evaluate(()=>{stopWaveFront();SeismicImpact.stop();});
});
