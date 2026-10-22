const {test,expect}=require('@playwright/test');const fs=require('fs');
for(const width of [411,1280])test('real globe route stays continuous through California and Hawaii '+width,async({page})=>{
 test.setTimeout(300000);await page.setViewportSize({width,height:806});await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.goto('/');await page.waitForFunction(()=>__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{pausarBuscas();for(const job of __buscasAgendadas)PeriodicScheduler.cancel(job.key);clearTimeout(cycleTimeout);EventCamera.cancel();SeismicPaintTour.stop();stopWaveFront();stopMapCamera();SeismicImpact.stop();for(const l of map.getStyle().layers)if(l.type==='raster')map.removeLayer(l.id);GlobePreview.setMode('globe');map.setPixelRatio(.5);globalAlerts=[];globalEvents=[];map.jumpTo({center:[-47,-23],zoom:7,padding:SeismicFocus.padding(),bearing:0,pitch:0});window.__snaps=0;const jump=map.jumpTo.bind(map);map.jumpTo=o=>{__snaps++;return jump(o);};});
 for(const q of [{id:'route-start',coords:[-47,-23]},{id:'route-ca',coords:[-122.75,38.8]},{id:'route-hi',coords:[-155.5,19.4]}]){
  const r=await page.evaluate(async q=>{
   eventoSelecionadoId=q.id;const samples=[];let running=true;function sample(){const c=map.getCenter();samples.push({t:performance.now(),lng:c.lng,lat:c.lat,z:map.getZoom(),stage:EventCamera.state()?.stage});if(running)requestAnimationFrame(sample);}sample();
   EventCamera.enter(q.id,{center:q.coords,anchor:q.coords,zoom:8});await new Promise(resolve=>{const check=()=>EventCamera.owns(q.id)?setTimeout(check,50):resolve();check();});running=false;
   const final=map.project(q.coords),f=getEventoTelaFrac(),box=map.getContainer();return {samples,final:[final.x,final.y],target:[box.clientWidth*f.x,box.clientHeight*f.y],snaps:__snaps,center:map.getCenter().toArray()};
  },q);
  fs.writeFileSync('/tmp/smooth-route-'+width+'-'+q.id+'.json',JSON.stringify(r));expect(r.snaps).toBe(0);expect(Math.hypot(r.final[0]-r.target[0],r.final[1]-r.target[1])).toBeLessThan(4);
  expect(r.samples.length).toBeGreaterThan(20);expect(Math.max(...r.samples.map(s=>s.lat))).toBeLessThan(50);
  const jumps=r.samples.slice(1).map((s,i)=>{const p=r.samples[i],d=Math.abs(((s.lng-p.lng+540)%360)-180);return Math.hypot(d,s.lat-p.lat);});expect(Math.max(...jumps),JSON.stringify({id:q.id,max:Math.max(...jumps)})).toBeLessThan(12);
 }
});
