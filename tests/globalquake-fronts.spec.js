const {test,expect}=require('@playwright/test');
const reference=require('./fixtures/globalquake-travel-reference.json');
test.use({serviceWorkers:'block'});
async function boot(page,width=1280){
 const base=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';await page.setViewportSize({width,height:844});
 await page.route('**/*',r=>new URL(r.request().url()).hostname===new URL(base).hostname?r.continue():r.abort());
 await page.goto(base+'/?verify='+Date.now(),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&window.GlobalQuakeTravel?.status()==='ready');
 await page.evaluate(()=>{pausarBuscas();pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();clearTimeout(cycleTimeout);});
}
test('browser agrees with original GlobalQuake Java tables for all 308 fronts',async({page})=>{
 await boot(page);
 const results=await page.evaluate(ref=>ref.map(r=>['p','s','pkp','pkikp'].map(p=>GlobalQuakeTravel.angle(p,r.depth,r.time))),reference);
 for(const [i,row] of reference.entries())for(let phase=0;phase<4;phase++){
  if(row.angles[phase]===-999)expect(results[i][phase]).toBe(null);else expect(Math.abs(results[i][phase]-row.angles[phase])).toBeLessThan(1e-10);
 }
});
for(const width of [1280,390])test('live origin, manual replay, revision and geodesic fronts '+width,async({page})=>{
 await boot(page,width);await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));
 await page.evaluate(()=>{
  const item={id:'wave-physics-qa',type:'earthquake',mag:4.8,depth:10,time:Date.now()-230000,coords:[120.757,-9.382],place:'Sumba · verificação do modelo',source:'QA',bandeira:'🇮🇩'};
  globalEvents=[item];isFirstDisplay=false;showEventDetails(0,true);clearTimeout(cycleTimeout);
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
 await page.evaluate(()=>{globalEvents[0].depth=100;globalEvents[0].mag=5;showEventDetails(0,false,true);});await page.clock.runFor(350);
 state=await page.evaluate(()=>__mgWaveFrontState);expect(state.depth).toBe(100);expect(state.originTime).toBe(origin);expect(state.mode).toBe('live');
 await page.clock.fastForward(7500);await page.clock.runFor(1200);
 const badge=await page.locator('.wave-front-status').boundingBox(),header=await page.locator('#ux-controlbar').boundingBox();expect(badge.y).toBeGreaterThan(header.y+header.height);
 await page.screenshot({path:'/tmp/globalquake-live-'+width+'.png'});
 await page.evaluate(()=>{window.__mgSoftCycle=false;showEventDetails(0,false);clearTimeout(cycleTimeout);});
 await page.clock.runFor(200);await page.clock.fastForward(3300);await page.clock.runFor(100);
 await expect(page.locator('.wave-front-status')).toContainText('Replay');state=await page.evaluate(()=>__mgWaveFrontState);expect(state.elapsedS).toBeLessThan(10);expect(state.radii.p).toBe(null); // Vertical travel delay at 100 km.
 await page.clock.fastForward(45000);await page.clock.runFor(100);state=await page.evaluate(()=>__mgWaveFrontState);expect(state.radii.p).toBeGreaterThan(0);
 const radii=await page.evaluate(()=>{const s=__mgWaveFrontState;return {actual:s.radii.p,expected:GlobalQuakeTravel.radius('p',s.depth,s.elapsedS)};});expect(radii.actual).toBe(radii.expected);
 await page.evaluate(()=>{__mgSoftCycle=true;showEventDetails(0,false);clearTimeout(cycleTimeout);});await page.clock.fastForward(5600);await page.clock.fastForward(3300);await page.clock.runFor(100);
 await expect(page.locator('.felt-zone-status')).toContainText('Radar');expect(await page.evaluate(()=>__mgWaveFrontState)).toBe(null);expect(await page.evaluate(()=>__mgFeltZoneState.depth)).toBe(100);
 await page.evaluate(()=>{stopWaveFront();stopFeltZone();});await page.clock.fastForward(2700);await expect(page.locator('.wave-front-status')).toHaveCount(0);expect(await page.evaluate(()=>__mgWaveFrontState)).toBe(null);
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
test('revision during the initial delay uses the latest hypocenter',async({page})=>{
 await boot(page);await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));
 await page.evaluate(()=>{globalEvents=[{id:'pending-wave-qa',type:'earthquake',mag:4.8,depth:10,time:Date.now()-230000,coords:[120.757,-9.382],place:'Sismo de teste',source:'QA'}];isFirstDisplay=false;showEventDetails(0,true);clearTimeout(cycleTimeout);});
 await page.clock.runFor(200);
 const expected=await page.evaluate(()=>{globalEvents[0]={...globalEvents[0],depth:100,time:globalEvents[0].time-2000,coords:[121,-9]};showEventDetails(0,false,true);return {depth:100,originTime:globalEvents[0].time};});
 await page.clock.fastForward(3300);await page.clock.runFor(100);
 const s=await page.evaluate(()=>__mgWaveFrontState);expect(s.depth).toBe(expected.depth);expect(s.originTime).toBe(expected.originTime);
 await page.evaluate(()=>stopWaveFront());
});
for(const width of [1280,390])test('automatic radar estimates areas without GlobalQuake fronts '+width,async({page})=>{
 await boot(page,width);await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));
 const original=await page.evaluate(()=>{
  const time=Date.now()-9*3600000;
  globalEvents=[{id:'old-radar-qa',type:'earthquake',mag:5,depth:10,time,coords:[-155,19],place:'Sismo antigo',source:'QA'}];
  isFirstDisplay=false;window.__automaticSchedule=[];window.scheduleNextAutoCycle=ms=>__automaticSchedule.push(ms);
  __mgSoftCycle=true;showEventDetails(0,false);return time;
 });
 await page.clock.fastForward(5600);await page.clock.runFor(100);
 await expect(page.locator('.felt-zone-status')).toContainText('Estimativa');
 expect(await page.evaluate(()=>__mgWaveFrontState)).toBe(null);
 expect(await page.evaluate(()=>['p','s','pkp','pkikp'].every(p=>map.getPaintProperty(`wave-front-${p}-line`,'line-opacity')===0))).toBe(true);
 const state=await page.evaluate(()=>({state:__mgFeltZoneState,critical:raioCritico(5,10),felt:raioEstimado(5,10),schedule:__automaticSchedule,protected:getAutoCycleProtectionRemaining(),time:globalEvents[0].time}));
 expect(state.state.criticalKm).toBe(state.critical);expect(state.state.feltKm).toBe(state.felt);expect(state.schedule).toEqual([36000]);expect(state.protected).toBe(0);expect(state.time).toBe(original);
 await page.clock.runFor(2600);
 if(width===390){const badge=await page.locator('.felt-zone-status').boundingBox(),ticker=await page.locator('#latest-event-ticker').boundingBox();expect(badge.y).toBeGreaterThan(ticker.y+ticker.height);}
 await page.screenshot({path:'/tmp/automatic-felt-radar-'+width+'.png'});
 await page.evaluate(()=>{globalEvents[0].mag=6;globalEvents[0].depth=100;showEventDetails(0,false,true);});
 expect(await page.evaluate(()=>__mgFeltZoneState.criticalKm)).toBe(await page.evaluate(()=>raioCritico(6,100)));expect(await page.evaluate(()=>__automaticSchedule)).toEqual([36000]);
 await page.evaluate(()=>{__mgSoftCycle=false;showEventDetails(0,false);});await page.clock.runFor(200);await page.clock.fastForward(3300);await page.clock.runFor(100);
 expect(await page.evaluate(()=>__mgWaveFrontState.mode)).toBe('replay');await expect(page.locator('.felt-zone-wrap')).toHaveCount(0);
 await page.evaluate(()=>{__mgSoftCycle=true;showEventDetails(0,false);});await page.clock.fastForward(5600);await page.clock.runFor(100);
 expect(await page.evaluate(()=>__mgWaveFrontState)).toBe(null);
 const result=await page.evaluate(()=>{const item={id:'new-small-qa',type:'earthquake',mag:1,depth:10,time:Date.now(),coords:[-155,19],place:'Novo sismo',source:'QA'};globalEvents.push(item);queueNewCameraQuakes([item]);return focusNextNewCameraQuake();});expect(result).toBe(true);
 await page.clock.runFor(200);await page.clock.fastForward(3300);await page.clock.runFor(100);
 expect(await page.evaluate(()=>__mgWaveFrontState.mode)).toBe('live');await expect(page.locator('.felt-zone-wrap')).toHaveCount(0);await expect(page.locator('.wave-front-status')).toContainText('Tempo real');
 await page.evaluate(()=>stopWaveFront());
});
for(const width of [1280,390])test('newly received late reports show estimated radar, then manual and fresh arrivals show fronts '+width,async({page})=>{
 await boot(page,width);await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));
 await page.evaluate(()=>{
  globalEvents=[{id:'late-indonesia-qa',type:'earthquake',mag:4.2,depth:157,time:Date.now()-10*60000,coords:[128,-8],place:'Kepulauan Barat Daya',source:'QA'},{id:'late-india-qa',type:'earthquake',mag:3.7,depth:10,time:Date.now()-13*60000,coords:[92.4,27.4],place:'Arunachal Pradesh',source:'QA'}];isFirstDisplay=false;
 });
 for(const index of [0,1]){
  await page.evaluate(index=>{showEventDetails(index,true);clearTimeout(cycleTimeout);},index);
  await page.clock.runFor(200);await page.clock.fastForward(3300);await page.clock.runFor(100);
  await expect(page.locator('.felt-zone-status').filter({hasText:'Ondas já passaram'})).toHaveCount(1);
  const state=await page.evaluate(index=>({wave:__mgWaveFrontState,radar:__mgFeltZoneState,id:globalEvents[index].id,origin:globalEvents[index].time,critical:raioCritico(globalEvents[index].mag,globalEvents[index].depth),felt:raioEstimado(globalEvents[index].mag,globalEvents[index].depth)}),index);
  expect(state.wave).toBe(null);expect(state.radar.id).toBe(state.id);expect(state.radar.criticalKm).toBe(state.critical);expect(state.radar.feltKm).toBe(state.felt);expect(state.radar.lateReport).toBe(true);
 }
 await page.evaluate(()=>{globalEvents[1].mag=3.8;showEventDetails(1,false,true);});expect(await page.evaluate(()=>__mgFeltZoneState.mag)).toBe(3.8);
 await page.clock.runFor(2600);await page.screenshot({path:'/tmp/late-quake-radar-'+width+'.png'});
 await page.evaluate(()=>{showEventDetails(1,false);clearTimeout(cycleTimeout);});await page.clock.runFor(200);await page.clock.fastForward(3300);await page.clock.runFor(100);
 expect(await page.evaluate(()=>__mgWaveFrontState.mode)).toBe('replay');expect(await page.evaluate(()=>__mgWaveFrontState.radii.p)).toBeGreaterThan(0);await expect(page.locator('.felt-zone-wrap')).toHaveCount(0);
 await page.evaluate(()=>{globalEvents.push({id:'fresh-qa',type:'earthquake',mag:4,depth:10,time:Date.now()-30000,coords:[92.4,27.4],place:'Chegada recente QA',source:'QA'});showEventDetails(2,true);clearTimeout(cycleTimeout);});await page.clock.runFor(200);await page.clock.fastForward(3300);await page.clock.runFor(100);
 const live=await page.evaluate(()=>__mgWaveFrontState);expect(live.mode).toBe('live');expect(live.radii.p).toBeGreaterThan(0);expect(live.radii.s).toBeGreaterThan(0);await expect(page.locator('.felt-zone-wrap')).toHaveCount(0);
 await page.evaluate(()=>{startWaveFront(128,-8,4.2,157,Date.now()-10*60000,{id:'stale-qa',mode:'live'});startWaveFront(92.4,27.4,4,10,Date.now()-30000,{id:'winning-qa',mode:'live'});});await page.clock.runFor(100);
 expect(await page.evaluate(()=>__mgWaveFrontState.id)).toBe('winning-qa');await expect(page.locator('.felt-zone-wrap')).toHaveCount(0);
 await page.evaluate(()=>stopWaveFront());
});
