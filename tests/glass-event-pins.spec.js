const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block',reducedMotion:'no-preference'});
for(const width of [1280,390])test('model 12 stays anchored and adapts to each point-event '+width,async({page})=>{
 await page.setViewportSize({width,height:900});await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.goto('/');await page.waitForFunction(()=>__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);EventCamera.cancel();SeismicPaintTour.stop();SeismicImpact.stop();stopMapCamera();AftershockSequence.setVisible(false);for(const l of map.getStyle().layers)if(l.type==='raster')map.removeLayer(l.id);
 globalEvents=[{id:'glass-quake',type:'earthquake',mag:2.4,depth:5,coords:[-47,-21],time:Date.now(),source:'QA',place:'Brasil'},{id:'glass-other',type:'earthquake',mag:5.8,depth:10,coords:[-48,-22],time:Date.now(),source:'QA',place:'Outro ponto'}];
 globalAlerts=['volcano','tsunami','storm','wind','hurricane','tornado','flood','civil'].map((type,i)=>({id:'glass-'+type,type,source:'QA',coords:[-47+i*.01,-21],place:'Evento de teste',time:Date.now(),...(['wind','hurricane'].includes(type)?{windKmh:179.7}:{})}));
 for(const key of ['earthquakes','volcano','tsunami','lightning','wind','hurricanes','tornado','flood','civil'])layerVisibility[key]=true;
 EventStore.setSelected('glass-quake');map.jumpTo({center:[-47,-21],zoom:7,bearing:0,pitch:0,padding:0});syncAllMarkers();});
 const badge=page.locator('.event-focus-beacon .event-pin-glass');await expect(badge).toHaveText('M 2,4');expect(await badge.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(22);
 const checkAnchor=async()=>{const error=await page.evaluate(()=>{const core=document.querySelector('.has-glass-pin'),rect=core.getBoundingClientRect(),c=map.getContainer().getBoundingClientRect(),item=EventStore.getSelected(),p=map.project(item.coords);return Math.hypot(rect.x+rect.width/2-c.x-p.x,rect.y+rect.height/2-c.y-p.y);});expect(error).toBeLessThan(2);};
 await checkAnchor();await page.waitForTimeout(600);await checkAnchor();expect(await badge.evaluate(el=>getComputedStyle(el,'::after').animationName)).toBe('event-pin-glass-line');
 await page.evaluate(()=>{globalEvents[0].mag=6.1;EventStore.notify('revise',{id:'glass-quake'});syncAllMarkers();});await expect(badge).toHaveText('M 6,1');expect(await page.evaluate(()=>document.querySelector('.has-glass-pin').style.getPropertyValue('--event-pin-tone'))).toBe(await page.evaluate(()=>getHexColor(6.1)));
 const words={volcano:'VULCÃO',tsunami:'TSUNAMI',storm:'TEMPESTADE',wind:'180 km/h',hurricane:'180 km/h',tornado:'TORNADO',flood:'ENCHENTE',civil:'ALERTA'};
 for(const mode of ['mercator','globe']){
  await page.evaluate(mode=>{GlobePreview.setMode(mode);map.jumpTo({center:[-47,-21],zoom:3,padding:0,pitch:0,bearing:0});},mode);
  for(const [type,text]of Object.entries(words)){
   await page.evaluate(type=>{EventStore.setSelected('glass-'+type);syncAllMarkers();},type);await expect(badge).toHaveText(text);await expect(page.locator('.has-glass-pin')).toHaveCount(1);await checkAnchor();
   expect(await badge.evaluate(el=>getComputedStyle(el).pointerEvents)).toBe('none');
  }
 }
 await page.evaluate(()=>{EventStore.setSelected('glass-quake');syncAllMarkers();});await expect(badge).toHaveText('M 6,1');
 await page.emulateMedia({reducedMotion:'reduce'});expect(await badge.evaluate(el=>getComputedStyle(el,'::after').animationName)).toBe('none');
 await page.evaluate(()=>{layerVisibility.earthquakes=false;syncAllMarkers();});await expect(badge).toHaveCount(0);
});
