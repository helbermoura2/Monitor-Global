const {test,expect}=require('@playwright/test');
async function boot(page){
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort());
 await page.goto('/');await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento&&window.TsunamiPresentation);
 await page.evaluate(()=>{
  pausarBuscas();PeriodicScheduler.cancel('correlation');clearTimeout(cycleTimeout);clearTimeout(window.__mgCycleGuard);pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();NewEventPriority.clear?.();
  for(const l of map.getStyle().layers)if(l.type==='raster')map.removeLayer(l.id);
  globalAlerts=[];globalEvents=[{id:'preview-before',type:'earthquake',mag:6.8,depth:10,coords:[-85,7.5],time:Date.now()-600000,place:'Costa Rica',source:'QA'},{id:'preview-target',type:'earthquake',mag:6.6,depth:12.647,coords:[-80.8,7.5],time:Date.now()-600000,place:'Panamá',source:'QA'}];
  showEventDetails(0,false);clearTimeout(cycleTimeout);clearTimeout(window.__mgCycleGuard);clearTimeout(window.__mgWaveDelayT);clearTimeout(window.__mgRadarDelayT);EventCamera.cancel();SeismicPaintTour.stop();stopWaveFront();stopFeltZone();stopMapCamera();CinematicCard.stop();SeismicCinema.stop();
  document.body.classList.remove('mobile-details-open','mobile-details-mid');map.stop();map.jumpTo({center:[-81.8,7.5],zoom:4,padding:0,bearing:0,pitch:0});syncAllMarkers();updateQuakeLabels();
  window.__previewAudio=0;reproduzirAlertaSismicoManual=()=>{window.__previewAudio++;};
 });
}
const pin=page=>page.locator('.quake-dot[data-quake-id="preview-target"]');
test.describe('mouse preview',()=>{
 test.use({serviceWorkers:'block',viewport:{width:1280,height:900}});
 test('hover reads magnitude without selection, and click still opens the event',async({page})=>{
  await boot(page);const before=await page.evaluate(()=>map.getCenter().toArray());await pin(page).hover();
  await expect(page.locator('.quake-preview-magnitude')).toHaveText('M6,6');await expect(page.locator('.quake-preview-depth')).toHaveText('Profundidade: 13 km');await expect(page.locator('.quake-preview-open')).toHaveCount(0);
  expect(await page.evaluate(()=>({id:eventoSelecionadoId,audio:__previewAudio,center:map.getCenter().toArray()}))).toEqual({id:'preview-before',audio:0,center:before});
  await page.screenshot({path:'/tmp/quake-preview-desktop.png'});
  await page.locator('.quake-preview-content').hover();await page.waitForTimeout(200);await expect(page.locator('.map-quake-preview')).toBeVisible();
  await page.mouse.move(600,750);await expect(page.locator('.map-quake-preview')).toHaveCount(0);
  await pin(page).click();expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('preview-target');expect(await page.evaluate(()=>__previewAudio)).toBe(1);await expect(page.locator('.map-quake-preview')).toHaveCount(0);
 });
});
test.describe('touch preview',()=>{
 test.use({serviceWorkers:'block',hasTouch:true,isMobile:true,viewport:{width:390,height:900}});
 test('tap only consults; outside closes; the explicit button opens the event',async({page})=>{
  await boot(page);const before=await page.evaluate(()=>map.getCenter().toArray());await pin(page).tap();
  await expect(page.locator('.quake-preview-open')).toBeVisible();await expect(page.locator('.quake-preview-magnitude')).toHaveText('M6,6');
  expect(await page.evaluate(()=>({id:eventoSelecionadoId,audio:__previewAudio,center:map.getCenter().toArray()}))).toEqual({id:'preview-before',audio:0,center:before});
  await page.screenshot({path:'/tmp/quake-preview-mobile.png'});
  const box=await page.locator('.map-quake-preview').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(391);
  // Separate deliberate consultations from the map's native double-tap zoom.
  await page.waitForTimeout(350);
  await pin(page).tap();expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('preview-before');
  await page.touchscreen.tap(50,760);await expect(page.locator('.map-quake-preview')).toHaveCount(0);
  await page.waitForTimeout(350);await page.waitForFunction(()=>!map.isMoving());
  await pin(page).tap();await page.getByRole('button',{name:'Ver evento',exact:true}).tap();expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('preview-target');expect(await page.evaluate(()=>__previewAudio)).toBe(1);await expect(page.locator('.map-quake-preview')).toHaveCount(0);
 });
 test('drag from a pin moves the map without opening or selecting it',async({page,context})=>{
  await boot(page);const b=await pin(page).boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
  const session=await context.newCDPSession(page);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=10;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-80*i/10,y:y+30*i/10}]});await page.waitForTimeout(30);}
  const dx=await page.evaluate(()=>map.project([-80.8,7.5]).x)-x;expect(dx).toBeLessThan(-60);
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(250);
  await expect(page.locator('.map-quake-preview')).toHaveCount(0);expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('preview-before');expect(await page.evaluate(()=>__previewAudio)).toBe(0);
 });
});
