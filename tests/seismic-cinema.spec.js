const {test,expect}=require('@playwright/test');test.use({serviceWorkers:'block'});
async function boot(page,width){await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.setViewportSize({width,height:844});await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&!!window.SeismicCinema);}
async function select(page,mag,mode='manual',depth=10){return page.evaluate(({mag,mode,depth})=>{const item={id:'seismic-qa',type:'earthquake',source:'QA',coords:[-70,-20],time:Date.now(),mag,depth,place:'Sismo de teste',bandeira:'🇨🇱'};globalEvents=[item];isFirstDisplay=false;window.__mgSoftCycle=mode==='auto';showEventDetails(0,mode==='new');clearTimeout(cycleTimeout);clearTimeout(window.__mgRadarDelayT);clearTimeout(window.__mgWaveDelayT);return SeismicCinema.state();},{mag,mode,depth});}
for(const width of [1280,390])test('M6/M7/M8 completo, ciclo discreto e troca limpa '+width,async({page})=>{
 await boot(page,width);const errors=[];page.on('pageerror',e=>{if(e.message!=='Failed to fetch')errors.push(e.message);});
 const before=await page.evaluate(()=>({ids:globalEvents.length,alerts:globalAlerts.length}));
 for(const mag of [6.5,7.5,8.2]){
  const state=await select(page,mag,mag===7.5?'new':'manual');expect(state.full).toBe(true);expect(state.pieces).toBeGreaterThan(0);
  await expect(page.locator('#app')).toHaveAttribute('data-seismic-motion','full');await expect(page.locator('.seismic-scene')).toHaveCount(1);await expect(page.locator('#painel-direito')).toHaveCSS('animation-name',width===390?'sheetUp':'none');
  await expect(page.locator('.seismic-piece').first()).toHaveCSS('pointer-events','none');expect(await page.locator('.seismic-scene [id]').count()).toBe(0);
  await page.waitForTimeout(1200);const moving=await page.locator('#app').evaluate(el=>getComputedStyle(el).translate);expect(moving).not.toBe('none');
  if(mag===7.5)await page.screenshot({path:'/tmp/seismic-full-'+width+'.png'});
 }
 const auto=await select(page,8.2,'auto');expect(auto.full).toBe(false);expect(auto.mode).toBe('auto');await expect(page.locator('.seismic-scene')).toHaveCount(0);await expect(page.locator('#app')).not.toHaveAttribute('data-seismic-motion','full');await expect(page.locator('#painel-direito')).toHaveAttribute('data-seismic-motion','discreet');
 await expect.poll(()=>page.evaluate(()=>SeismicCinema.state())).toBe(null);expect(await page.locator('#painel-direito').evaluate(el=>getComputedStyle(el).translate)).toBe('none');
 await select(page,7.5);await page.evaluate(()=>{globalAlerts=[{id:'fire-qa',type:'fire',source:'QA',coords:[-70,-20],time:Date.now(),place:'Incêndio de teste'}];showAlertDetails(globalAlerts[0],false);clearTimeout(cycleTimeout);});await expect(page.locator('.seismic-scene')).toHaveCount(0);expect(await page.evaluate(()=>SeismicCinema.state())).toBe(null);expect(errors).toEqual([]);
});
for(const width of [1280,390])test('Menu permite simular sem inserir evento, som ou câmera '+width,async({page})=>{
 await boot(page,width);await select(page,2);await page.evaluate(()=>{SeismicCinema.stop();window.__demoFlights=0;window.__demoSounds=0;map.flyTo=()=>__demoFlights++;window.softFlyToCoords=()=>{__demoFlights++;return 0;};window.playEarthquakeSound=()=>__demoSounds++;window.__demoBefore={id:eventoSelecionadoId,events:JSON.stringify(globalEvents),alerts:JSON.stringify(globalAlerts),rotation:JSON.stringify(window.__mgAutoRotation)};});
 if(width===390){await page.locator('#fab-menu').click();await page.getByRole('button',{name:'Testar efeitos sísmicos',exact:true}).click();}else{await page.locator('#chip-menu-desktop').click();await page.locator('#mf-main-seismic-demo').click();}
 await expect(page.locator('#seismic-demo-dialog')).toBeVisible();await page.locator('#seismic-demo-mag').selectOption('7.5');await page.locator('#seismic-demo-depth').selectOption('100');await page.locator('#seismic-demo-play').click();
 await expect(page.locator('#seismic-demo-status')).toContainText('DEMONSTRAÇÃO · M7.5');expect(await page.evaluate(()=>SeismicCinema.state().demo)).toBe(true);await expect(page.locator('.seismic-scene')).toHaveCount(1);
 expect(await page.evaluate(()=>({id:eventoSelecionadoId,events:JSON.stringify(globalEvents),alerts:JSON.stringify(globalAlerts),rotation:JSON.stringify(window.__mgAutoRotation)}))).toEqual(await page.evaluate(()=>__demoBefore));expect(await page.evaluate(()=>[__demoFlights,__demoSounds])).toEqual([0,0]);
 await page.locator('#seismic-demo-status').getByRole('button',{name:'Parar'}).click();await expect(page.locator('.seismic-scene')).toHaveCount(0);expect(await page.evaluate(()=>SeismicCinema.state())).toBe(null);await expect(page.locator('#seismic-demo-status')).toHaveCount(0);
 await page.evaluate(()=>SeismicCinema.openDemo());await page.locator('#seismic-demo-mode').selectOption('auto');await page.locator('#seismic-demo-play').click();await expect(page.locator('#seismic-demo-status')).toContainText('Discreto');await expect(page.locator('.seismic-scene')).toHaveCount(0);await page.keyboard.press('Escape');await expect(page.locator('#seismic-demo-status')).toHaveCount(0);
});
test('revisão silenciosa não repete efeito, e aba oculta/movimento reduzido cancelam',async({page})=>{
 await boot(page,1280);await select(page,7.5);const state=await page.evaluate(()=>{const before=SeismicCinema.state();globalEvents[0].mag=7.4;showEventDetails(0,false,true);return {before,after:SeismicCinema.state()};});expect(state.after).toEqual(state.before);
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.seismic-scene')).toHaveCount(0);expect(await select(page,8.2)).toBe(null);await page.evaluate(()=>SeismicCinema.openDemo());await page.locator('#seismic-demo-play').click();await expect(page.locator('#seismic-demo-status')).toContainText('Movimento reduzido');await expect(page.locator('.seismic-scene')).toHaveCount(0);
 await page.emulateMedia({reducedMotion:'no-preference'});await select(page,7.5);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});await expect(page.locator('.seismic-scene')).toHaveCount(0);
});

test('sequência completa termina sozinha e devolve tela e camadas ao estado normal',async({page})=>{
 await boot(page,1280);await select(page,6.5,'manual');await expect(page.locator('.seismic-scene')).toHaveCount(1);
 await expect.poll(()=>page.evaluate(()=>SeismicCinema.state()),{timeout:15000}).toBe(null);await expect(page.locator('.seismic-scene')).toHaveCount(0);
 expect(await page.locator('#app').evaluate(el=>getComputedStyle(el).translate)).toBe('none');await expect(page.locator('#app')).not.toHaveAttribute('data-seismic-motion','full');
 await expect(page.locator('[data-seismic-sway]')).toHaveCount(0);
});
for(const width of [1280,390])test('M6.1 a 43 km é visível na tela inteira e continua operável '+width,async({page})=>{
 await boot(page,width);await select(page,6.1,'manual',43);
 const motion=await page.evaluate(async()=>{
  let max=0;const started=performance.now();
  while(performance.now()-started<1600){
   const t=getComputedStyle(document.getElementById('app')).translate.split(' ').map(parseFloat);
   max=Math.max(max,Math.hypot(t[0]||0,t[1]||0));await new Promise(requestAnimationFrame);
  }return max;
 });
 expect(motion).toBeGreaterThan(5);await expect(page.locator('.seismic-scene')).toHaveCount(1);
 await expect(page.locator('#painel-direito')).toHaveAttribute('data-seismic-sway','true');
 await page.screenshot({path:'/tmp/seismic-impact-61-'+width+'.png'});
 expect(await page.locator('.seismic-piece').count()).toBeGreaterThanOrEqual(3);
 await page.evaluate(()=>SeismicCinema.stop());await expect(page.locator('[data-seismic-sway]')).toHaveCount(0);
 expect(await page.locator('#painel-direito').evaluate(el=>getComputedStyle(el).translate)).toBe('none');
});
