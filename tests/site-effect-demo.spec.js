const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
require('./helpers/card-renderer-fixture.cjs')(test);
test.use({serviceWorkers:'block',reducedMotion:'no-preference'});
async function boot(page,width=1280){
 await page.setViewportSize({width,height:850});
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__cardRendererFixtureReady&&!__fetchGlobalFeedsEmAndamento&&!!window.CardEffectDemo);await page.evaluate(()=>CountryBoundaries.ready);
 await page.evaluate(()=>{
  clearTimeout(cycleTimeout);clearTimeout(window.__mgCycleGuard);stopWaveFront();stopFeltZone();window.SeismicPaintTour?.stop();
  globalEvents=Array.from({length:4},(_,i)=>({id:'site-scene-real-'+i,type:'earthquake',mag:4.2-i*.2,depth:10,coords:[-70+i,-20],time:Date.now()-i*240000,place:'Registro preservado '+i,source:'QA'}));globalAlerts=[];lastMerged=globalEvents.slice();if(innerWidth>900){sidebarFilter='earthquake';DesktopRecords.filter('earthquake');}renderSidebarList(lastMerged);
  showEventDetails(0,false);clearTimeout(cycleTimeout);window.SeismicPaintTour?.stop();map.stop();
  if(innerWidth<900){document.body.classList.remove('mobile-details-mid');document.body.classList.add('mobile-details-open');}
  window.__siteSceneBefore=JSON.stringify({events:globalEvents,alerts:globalAlerts,id:eventoSelecionadoId,center:map.getCenter().toArray(),zoom:map.getZoom()});
  window.__siteSceneSounds=0;window.playEarthquakeSound=()=>__siteSceneSounds++;
 });
 await expect(page.locator('#sidebar-left .event')).toHaveCount(4);
}
for(const width of [1280,390])test('menu de cenas realistas conserva registros, câmera e controles '+width,async({page})=>{
 test.setTimeout(90000);await boot(page,width);
 if(width<900){await page.locator('#fab-menu').click();await page.getByRole('button',{name:'Testar efeitos',exact:true}).click();}else{await page.locator('#chip-menu-desktop').click();await page.locator('#mf-main-seismic-demo').click();}
 const select=page.locator('#card-fx-demo-type');
 for(const key of ['site-lava','site-quake','site-rain'])await expect(select.locator('option[value="'+key+'"]')).toHaveCount(1);
 await select.selectOption('site-lava');await page.locator('#card-fx-demo-play').click();
 for(const kind of ['lava','quake','rain']){
  if(kind!=='lava')await page.evaluate(k=>CardEffectDemo.preview('site-'+k),kind);
  const canvas=page.locator('#site-effect-demo-canvas');await expect(canvas).toHaveAttribute('data-scene',kind);await expect(canvas).toHaveCSS('pointer-events','none');
  await expect(page.locator('#card-fx-demo-status')).toContainText('Cena ilustrativa');await expect(page.locator('#painel-direito .pd-cinema-layer')).toHaveAttribute('data-demo','true');
  await page.waitForTimeout(kind==='tsunami'||kind==='quake'?3300:1900);
  expect(await canvas.evaluate(c=>{const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>20)return true;return false;})).toBe(true);
  if(kind==='quake'){await expect(page.locator('.seismic-scene')).toHaveCount(1);expect(await page.evaluate(()=>SeismicCinema.state().recordPieces)).toBe(true);}if(kind==='tsunami'){expect(await page.locator(width<900?'#painel-direito':'#sidebar-left').evaluate(el=>el.getAnimations().length)).toBeGreaterThan(0);await expect(page.locator('.site-effect-floats')).toHaveCount(1);}
  await page.screenshot({path:'/tmp/site-scene-'+kind+'-'+width+'.png'});
  const hit=await page.locator('#card-fx-demo-status').getByRole('button',{name:'Parar',exact:true}).evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;});expect(hit).toBe(true);
 }
 await page.evaluate(()=>CardEffectDemo.stop());
 await expect(page.locator('#site-effect-demo-canvas,#card-fx-demo-status,.site-effect-texture-video')).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.stringify({events:globalEvents,alerts:globalAlerts,id:eventoSelecionadoId,center:map.getCenter().toArray(),zoom:map.getZoom()}))).toBe(await page.evaluate(()=>__siteSceneBefore));
 expect(await page.evaluate(()=>__siteSceneSounds)).toBe(0);
 expect(await page.evaluate(()=>['header','#sidebar-left','#painel-direito'].flatMap(s=>[...document.querySelectorAll(s)]).every(el=>el.getAnimations().every(a=>a.effect?.getKeyframes().every(k=>!k.translate))))).toBe(true);
});
test('M8+ dura 24 segundos, derruba registros por partes e restaura estilos',async({page})=>{
 await boot(page);await page.evaluate(()=>OptionalFeatures.siteEffectDemo());
 const before=await page.locator('#sidebar-left').getAttribute('style');
 await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));
 await page.evaluate(()=>CardEffectDemo.preview('site-quake'));await expect(page.locator('#site-effect-demo-canvas')).toHaveCount(1);
 expect(await page.locator('.seismic-piece[data-kind=record]').count()).toBeGreaterThan(2);await page.clock.runFor(7000);expect(await page.locator('#sidebar-left .event.seismic-displaced').count()).toBeGreaterThan(0);expect(await page.locator('#sidebar-left .event:not(.seismic-displaced)').count()).toBeGreaterThan(0);await page.screenshot({path:"/tmp/site-scene-records-staged.png"});await page.clock.fastForward(16900);await expect(page.locator('#site-effect-demo-canvas')).toHaveCount(1);
 await page.clock.runFor(150);await expect(page.locator('#site-effect-demo-canvas,#card-fx-demo-status,.site-effect-texture-video')).toHaveCount(0);
 await expect(page.locator('.seismic-scene,.seismic-displaced')).toHaveCount(0);expect(await page.locator('#sidebar-left').getAttribute('style')).toBe(before);expect(await page.locator('#sidebar-left').evaluate(el=>el.getAnimations().length)).toBe(0);
});
test('cancelamento durante carregamento não ressuscita a cena e evento real interrompe teste',async({page})=>{
 await boot(page);let release;
 await page.route('**/js/site-effect-demo.js?**',async r=>{await new Promise(ok=>release=ok);await r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(__dirname,'../js/site-effect-demo.js'),'utf8')});});
 await page.evaluate(()=>CardEffectDemo.preview('site-lava'));await expect.poll(()=>!!release).toBe(true);await page.evaluate(()=>CardEffectDemo.stop());release();await page.waitForFunction(()=>!!window.SiteEffectDemo);
 await expect(page.locator('#site-effect-demo-canvas,#card-fx-demo-status,.site-effect-texture-video')).toHaveCount(0);
 await page.evaluate(()=>CardEffectDemo.preview('site-rain'));await expect(page.locator('#site-effect-demo-canvas')).toHaveCount(1);
 await page.evaluate(()=>{showEventDetails(0,false);clearTimeout(cycleTimeout);});await expect(page.locator('#site-effect-demo-canvas,#card-fx-demo-status,.site-effect-texture-video')).toHaveCount(0);
});
test('movimento reduzido e aba oculta suspendem a cena; redimensionamento mantém resolução limitada',async({page})=>{
 await boot(page,390);await page.evaluate(()=>CardEffectDemo.preview('site-rain'));await expect(page.locator('#site-effect-demo-canvas')).toHaveCount(1);
 await page.setViewportSize({width:420,height:800});await expect.poll(()=>page.locator('#site-effect-demo-canvas').evaluate(c=>c.width<=Math.ceil(innerWidth*1.25)&&c.height<=Math.ceil(innerHeight*1.25))).toBe(true);
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('#site-effect-demo-canvas')).toHaveCount(0);await page.evaluate(()=>CardEffectDemo.stop());
 await page.evaluate(()=>CardEffectDemo.preview('site-lava'));await expect(page.locator('#card-fx-demo-status')).toContainText('Movimento reduzido');await expect(page.locator('#site-effect-demo-canvas')).toHaveCount(0);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>CardEffectDemo.preview('site-rain'));await expect(page.locator('#site-effect-demo-canvas')).toHaveCount(1);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});await expect(page.locator('#site-effect-demo-canvas,#card-fx-demo-status,.site-effect-texture-video')).toHaveCount(0);
});


test('tsunami de tela inteira foi removido; chuva mantém clarões de teste isolados',async({page})=>{
 await boot(page);await page.evaluate(()=>OptionalFeatures.siteEffectDemo());await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));
 await page.evaluate(()=>{CardEffectDemo.open();});await expect(page.locator('#card-fx-demo-type option[value="site-tsunami"]')).toHaveCount(0);
 expect(await page.evaluate(()=>SiteEffectDemo.start('tsunami'))).toBe(false);await expect(page.locator('.site-effect-fragment,.site-effect-floats,#site-effect-demo-canvas')).toHaveCount(0);
 await page.evaluate(()=>CardEffectDemo.preview('site-rain'));await expect(page.locator('#site-effect-demo-canvas')).toHaveCount(1);await page.clock.runFor(2350);await expect(page.locator('#site-effect-demo-canvas')).toHaveAttribute('data-lightning','flash');await page.clock.runFor(700);await expect(page.locator('#site-effect-demo-canvas')).toHaveAttribute('data-lightning','off');
 await page.evaluate(()=>CardEffectDemo.stop());
});
