const {test,expect}=require('@playwright/test');
for(const width of [1280,390])test.describe('map status '+width,()=>{
 test.use({serviceWorkers:'block',viewport:{width,height:900},reducedMotion:'reduce'});
 test('intensity and wave notices paint above native pins while preserving map input',async({page})=>{
  await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort());
  await page.goto('/');await page.waitForFunction(()=>__mgMapReady&&!__fetchGlobalFeedsEmAndamento&&window.GlobePreview);
  // This fixture compares notices with map pins, independently of the mobile notice stack.
  await page.addStyleTag({content:'#mobile-notice-stack{display:none!important}'});
  await page.evaluate(()=>{
   pausarBuscas();PeriodicScheduler.cancel('correlation');clearTimeout(cycleTimeout);clearTimeout(window.__mgCycleGuard);pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();NewEventPriority.clear?.();
   for(const l of map.getStyle().layers)if(l.type==='raster')map.removeLayer(l.id);
   globalAlerts=[];globalEvents=[{id:'status-layer-qa',type:'earthquake',coords:[-46.63,-23.55],mag:2.1,depth:195,time:Date.now()-3600000,place:'São Paulo',source:'QA'}];
   showEventDetails(0,false);clearTimeout(cycleTimeout);clearTimeout(window.__mgCycleGuard);clearTimeout(window.__mgWaveDelayT);clearTimeout(window.__mgRadarDelayT);EventCamera.cancel();SeismicPaintTour.stop();stopWaveFront();stopFeltZone();stopMapCamera();SeismicCinema.stop();CinematicCard.stop();
   document.getElementById('mobile-notice-stack')?.remove();SeismicFocus.pause();document.body.classList.remove('mobile-details-open','mobile-details-mid');map.jumpTo({center:[-46.63,-23.55],zoom:6,bearing:0,pitch:0,padding:0});
   SeismicImpact.start({id:'status-layer-qa',lng:-46.63,lat:-23.55,mag:2.1,depth:195,skipOfficial:true,keepCamera:true},true);
  });
  // A deep, weak event keeps the no-contour status visible after calculation.
  await page.waitForFunction(()=>__mgSeismicImpactState?.id==='status-layer-qa');
  await expect(page.locator('.seismic-impact-status')).toBeVisible();
  for(const projection of ['mercator','globe']){
   await page.evaluate(mode=>{GlobePreview.setMode(mode);map.jumpTo({center:[-46.63,-23.55],zoom:6,padding:0});},projection);
   for(const className of ['seismic-impact-status','wave-front-status']){
    let stack;
    // Projection/layout changes can move the notice after its first measurement.
    // Re-place the real marker at the current notice until both boxes settle.
    await expect.poll(async()=>{
    const result=await page.evaluate(className=>{
     let notice=document.querySelector('.'+className);if(!notice){notice=document.createElement('div');notice.className=className;notice.textContent='Ondas sísmicas · 00:10 / 01:00';notice.style.top=document.querySelector('.seismic-impact-status').style.top;document.getElementById('mapWrap').append(notice);}
     const r=notice.getBoundingClientRect(),container=map.getContainer().getBoundingClientRect(),x=r.x+r.width*.7,y=r.y+r.height/2,coord=map.unproject([x-container.x,y-container.y]);
     globalEvents[0].coords=[coord.lng,coord.lat];syncAllMarkers();return {x,y};
    },className);
    await page.waitForTimeout(100);
    stack=await page.evaluate(({className,x,y})=>{
     const notice=document.querySelector('.'+className),pin=markerStores.quake.get('status-layer-qa').getElement(),b=pin.getBoundingClientRect(),original=notice.style.pointerEvents;
     // Temporarily hit-test the visual notice: normal pointer-events:none intentionally passes input through.
     notice.style.pointerEvents='auto';const top=document.elementFromPoint(x,y);notice.style.pointerEvents=original;
     return {top:top?.tagName+'#'+top?.id+'.'+top?.className,noticeZ:getComputedStyle(notice).zIndex,pinZ:getComputedStyle(pin).zIndex,noticeOnTop:top===notice||notice.contains(top),pinError:Math.hypot(b.x+b.width/2-x,b.y+b.height/2-y),input:getComputedStyle(notice).pointerEvents,background:getComputedStyle(notice).backgroundColor};
    },{className,...result});
    return {noticeOnTop:stack.noticeOnTop,pinAligned:stack.pinError<2};
    },{timeout:5000}).toEqual({noticeOnTop:true,pinAligned:true});
    expect(stack.pinError).toBeLessThan(2);expect(stack.noticeOnTop,JSON.stringify({className,projection,stack})).toBe(true);expect(stack.input).toBe('none');expect(Number(stack.noticeZ)).toBeGreaterThan(Number(stack.pinZ));expect(stack.background).not.toBe('transparent');expect(stack.background).not.toMatch(/^rgba\([^)]*,\s*0\)$/);
    if(className==='wave-front-status')await page.locator('.wave-front-status').evaluate(el=>el.remove());
   }
  }
 });
});
