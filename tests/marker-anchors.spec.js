const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block',reducedMotion:'reduce'});
for(const width of [1280,390])test('pins seguem a projeção e revisões sem sair do epicentro '+width,async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.setViewportSize({width,height:844});await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);stopMapCamera();SeismicCinema.stop();AftershockSequence.setVisible(false);globalAlerts=[];globalEvents=[[-70,-20],[-70.2,-20.1],[-69.8,-19.9]].map((coords,i)=>({id:'anchor-'+i,type:'earthquake',source:'QA',place:'Pin '+i,mag:2.3+i*.1,depth:5,time:Date.now()-3600000,coords}));eventoSelecionadoId='anchor-0';layerVisibility.earthquakes=true;map.jumpTo({center:[-70,-20],zoom:7,pitch:0,bearing:0});syncAllMarkers();});
 for(const camera of [{center:[-70,-20],zoom:7,bearing:0,pitch:0},{center:[-70.1,-20.05],zoom:7.5,bearing:25,pitch:20},{center:[-69.9,-20.1],zoom:6,bearing:0,pitch:0}]){
  await page.evaluate(c=>map.jumpTo(c),camera);await page.waitForTimeout(100);
  const errors=await page.evaluate(()=>globalEvents.map(q=>{const el=markerStores.quake.get(q.id).getElement(),r=el.getBoundingClientRect(),container=map.getContainer().getBoundingClientRect(),p=map.project(q.coords);return {error:Math.hypot(r.x+r.width/2-container.x-p.x,r.y+r.height/2-container.y-p.y),position:getComputedStyle(el).position};}));
  for(const p of errors){expect(p.position).toBe('absolute');expect(p.error).toBeLessThan(2);}
 }
 const revision=await page.evaluate(()=>{const marker=markerStores.quake.get('anchor-0');globalEvents[0].coords=[-70.4,-20.3];globalEvents[0].mag=3.4;syncAllMarkers();const updated=markerStores.quake.get('anchor-0');return {same:marker===updated,coords:updated.getLngLat().toArray(),title:updated.getElement().title};});
 expect(revision.same).toBe(true);expect(revision.coords).toEqual([-70.4,-20.3]);expect(revision.title).toContain('M3,4');
 const wide=await page.evaluate(()=>{map.jumpTo({center:[-70.4,-20.3],zoom:2});syncAllMarkers();return {selected:markerStores.quake.has('anchor-0'),other:markerStores.quake.has('anchor-1')};});expect(wide.selected).toBe(true);expect(wide.other).toBe(false);
 const cyclone=await page.evaluate(()=>{layerVisibility.hurricanes=true;const q={id:'moving-storm',type:'hurricane',coords:[-70,-20],time:Date.now(),place:'Ciclone QA',source:'QA',sev:2};globalAlerts=[q];syncAllMarkers();const store=markerStores.cyclone.get(q.id);q.coords=[-69,-19];syncAllMarkers();return {exists:!!store,coords:markerStores.cyclone.get(q.id)?.marker.getLngLat().toArray()};});expect(cyclone.exists).toBe(true);expect(cyclone.coords).toEqual([-69,-19]);
});
