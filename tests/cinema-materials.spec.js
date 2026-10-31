const {test,expect}=require('@playwright/test');test.use({serviceWorkers:'block'});
require('./helpers/card-renderer-fixture.cjs')(test);
async function boot(page,width){
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.setViewportSize({width,height:844});await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__cardRendererFixtureReady&&!__fetchGlobalFeedsEmAndamento&&!!window.CardEffectDemo);
 await page.evaluate(()=>{const q={id:'material-qa',type:'earthquake',mag:3,depth:10,source:'QA',coords:[-70,-20],place:'Evento real de teste',time:Date.now()};globalEvents=[q];showEventDetails(0,false);clearTimeout(cycleTimeout);clearTimeout(window.__mgRadarDelayT);clearTimeout(window.__mgWaveDelayT);SeismicCinema.stop();});
}
for(const width of [1280,390])test('demonstrações de todos os materiais preservam dados, áudio, câmera e controles '+width,async({page})=>{
 test.setTimeout(180000);await boot(page,width);await expect(page.locator('#pd-local')).toHaveText('Evento real de teste — Chile');const errors=[];page.on('console',m=>{if(m.text().includes('[CardCinema]'))errors.push(m.text());});
 await page.evaluate(()=>{window.__materialFlights=0;window.__materialSounds=0;map.flyTo=()=>__materialFlights++;window.softFlyToCoords=()=>{__materialFlights++;return 0;};window.playEarthquakeSound=()=>__materialSounds++;window.__materialBefore={id:eventoSelecionadoId,events:JSON.stringify(globalEvents),alerts:JSON.stringify(globalAlerts),rotation:JSON.stringify(window.__mgAutoRotation),local:document.getElementById('pd-local').textContent.replace(/\u00a0/g,' '),mag:document.getElementById('pd-mag').textContent};});
 if(width===390){await page.locator('#fab-menu').click();await page.getByRole('button',{name:'Testar efeitos',exact:true}).click();}else{await page.locator('#chip-menu-desktop').click();await page.locator('#mf-main-seismic-demo').click();}
 await page.locator('#card-fx-demo-type').selectOption('flood');await page.locator('#card-fx-demo-play').click();
 // Tsunami is a map tour; camera movement/restoration is covered in tsunami-map.spec.js.
 for(const [key,src] of [['flood','flood-current'],['hurricane','gusts'],['volcano-lava','lava'],['volcano-ash','smoke'],['volcano-monitoring',null],['tornado','tornado-vortex'],['wind','gale-canopy'],['fire','fire'],['storm','storm']]){
  if(key!=='flood')await page.evaluate(k=>CardEffectDemo.preview(k),key);
  await expect(page.locator('#card-fx-demo-status')).toContainText('DEMONSTRAÇÃO');await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-demo','true');await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-renderer',key==='volcano-monitoring'?'crater':'film');
  const video=page.locator('.pd-cinema-footage');if(key==='volcano-monitoring'){await expect(page.locator('.pd-volcano-monitor')).toHaveAttribute('data-texture','photograph');}if(['storm','hurricane','volcano-monitoring'].includes(key)){await expect(video).toHaveCount(0);await expect(page.locator('.pd-cinema-contact')).toHaveCount(1);expect(await page.evaluate(()=>[__materialFlights,__materialSounds])).toEqual([0,0]);continue;}await expect(video).toHaveAttribute('src','media/card-fx/'+src+'.mp4');await expect.poll(()=>video.evaluate(v=>v.readyState>=2&&!v.paused),{timeout:12000}).toBe(true);
  expect(await video.evaluate(v=>v.muted)).toBe(true);expect(await page.evaluate(()=>({id:eventoSelecionadoId,events:JSON.stringify(globalEvents),alerts:JSON.stringify(globalAlerts),rotation:JSON.stringify(window.__mgAutoRotation),local:document.getElementById('pd-local').textContent.replace(/\u00a0/g,' '),mag:document.getElementById('pd-mag').textContent}))).toEqual(await page.evaluate(()=>__materialBefore));
  await expect(page.locator('.pd-cinema-layer')).toHaveCSS('pointer-events','none');
  if(['flood','volcano-lava','tornado'].includes(key)){if(width===390)await page.evaluate(()=>{document.body.classList.remove('mobile-details-mid');document.body.classList.add('mobile-details-open');});await page.waitForTimeout(800);await page.screenshot({path:'/tmp/material-'+key+'-'+width+'.png'});}
 }
 expect(await page.evaluate(()=>[__materialFlights,__materialSounds])).toEqual([0,0]);expect(errors).toEqual([]);
 await page.locator('#card-fx-demo-status').getByRole('button',{name:'Parar'}).click();await expect(page.locator('#card-fx-demo-status')).toHaveCount(0);await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-scene','earthquake');
});
for(const width of [1280,390])test('M5.9 treme no cartão tanto no manual quanto no aleatório '+width,async({page})=>{
 await boot(page,width);
 for(const mode of ['manual','auto']){
  const movement=await page.evaluate(async mode=>{
   SeismicCinema.stop();CinematicCard.stop();globalEvents[0].mag=5.9;window.__mgSoftCycle=mode==='auto';showEventDetails(0,false);clearTimeout(cycleTimeout);
   const target=document.getElementById('painel-direito');
   const animation=target.getAnimations().find(a=>a.effect?.getKeyframes().some(f=>f.translate!==undefined));
   if(!animation)throw Error('The real M5.9 card animation did not start');
   // Seek the actual attached animation, preserving the original 1500ms window
   // and >4px expectation without depending on which frames CI happens to draw.
   animation.pause();await animation.ready;let max=0;
   for(let ms=0;ms<=1500;ms+=25){animation.currentTime=ms;const v=getComputedStyle(target).translate.split(' ').map(parseFloat);max=Math.max(max,Math.hypot(v[0]||0,v[1]||0));}
   return max;
  },mode);
  expect(movement).toBeGreaterThan(4);await expect(page.locator('.seismic-scene')).toHaveCount(0);expect(await page.locator('#app').evaluate(el=>getComputedStyle(el).translate)).toBe('none');
 }
});
test('estado eruptivo e lava são distintos, revisão retira lava e reserva gráfica funciona',async({page})=>{
 await boot(page,1280);await page.route('**/media/card-fx/*.mp4',r=>r.abort());
 async function volcano(extra){await page.evaluate(extra=>{const item={id:'volcano-material',type:'volcano',source:'QA',coords:[-70,-20],time:Date.now(),place:'Vulcão de teste',...extra};globalAlerts=[item];upsertAlert(item);showAlertDetails(item,false);clearTimeout(cycleTimeout);},extra);}
 await volcano({eruptionStatus:'Em erupção',detail:'Emissão de cinzas · sem fluxo de lava'});
 expect(await page.evaluate(()=>CinematicCard.volcanoActivity(EventStore.getSelected()))).toMatchObject({eruptive:true,ash:true,lava:false});
 await expect(page.locator('#site-effect-demo-canvas')).toHaveAttribute('data-scene','lava');await expect(page.locator('.pd-cinema-layer')).toHaveCount(0);
 await volcano({eruptionStatus:'Em erupção',detail:'Fluxo de lava ativo · sem cinzas'});
 expect(await page.evaluate(()=>CinematicCard.volcanoActivity(EventStore.getSelected()))).toMatchObject({eruptive:true,ash:false,lava:true});
 await expect(page.locator('#site-effect-demo-canvas')).toHaveAttribute('data-scene','lava');
 await page.evaluate(()=>{const item={...EventStore.getSelected(),eruptionStatus:'Erupção encerrada',detail:'Sem atividade eruptiva'};upsertAlert(item);showAlertDetails(item,false,true);});
 await expect(page.locator('.pd-cinema-layer,.pd-cinema-footage,.pd-volcano-monitor,.pd-cinema-heat,#site-effect-demo-canvas')).toHaveCount(0);
});
test('evento real interrompe teste e movimento reduzido/aba oculta limpam a demonstração',async({page})=>{
 await boot(page,1280);await page.evaluate(()=>CardEffectDemo.preview('flood'));await expect(page.locator('#card-fx-demo-status')).toHaveCount(1);
 await page.evaluate(()=>{showEventDetails(0,false);clearTimeout(cycleTimeout);});await expect(page.locator('#card-fx-demo-status')).toHaveCount(0);await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-scene','earthquake');
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>CardEffectDemo.preview('volcano-lava'));await expect(page.locator('#card-fx-demo-status')).toContainText('Movimento reduzido');await expect(page.locator('.pd-cinema-layer')).toHaveCount(0);await page.keyboard.press('Escape');await expect(page.locator('#card-fx-demo-status')).toHaveCount(0);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{CardEffectDemo.preview('fire');Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});await expect(page.locator('#card-fx-demo-status')).toHaveCount(0);
});

