const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
async function boot(page,width=1280){
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.setViewportSize({width,height:844});await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!isFirstDisplay&&!__fetchGlobalFeedsEmAndamento);
}
async function select(page,type,extra={}){
 await page.evaluate(({type,extra})=>{
  const item={id:'cinema-'+type,type,source:'NOAA METAR',place:'Evento demonstrativo — Brasil',coords:[-46.63,-23.55],time:Date.now(),bandeira:'🇧🇷',detail:type==='storm'?'Trovoada reportada no aeródromo':'',mag:5.6,depth:10,windKmh:120,...extra};
  if(type==='earthquake'){globalEvents=[item];showEventDetails(0,false);}else{globalAlerts=[item];upsertAlert(item);showAlertDetails(item,false);}
  clearTimeout(cycleTimeout);clearTimeout(window.__mgRadarDelayT);clearTimeout(window.__mgWaveDelayT);
 },{type,extra});
}
for(const width of [1280,390])test('todos os efeitos respeitam texto, vidro e controles '+width,async({page})=>{
 await boot(page,width);
 for(const type of ['storm','hurricane','tornado','fire','volcano','flood','tsunami','wind','earthquake']){
  await select(page,type,type==='volcano'?{eruptionStatus:'Em erupção',detail:'Emissão de cinzas'}:{});
  const layer=page.locator('.pd-cinema-layer');await expect(layer).toHaveCount(1);await expect(layer).toHaveAttribute('data-scene',type);await expect(layer).toHaveAttribute('aria-hidden','true');
  await expect(layer).toHaveCSS('pointer-events','none');await expect.poll(()=>layer.evaluate(el=>Number(getComputedStyle(el).opacity))).toBeGreaterThan(.8);
  await expect(page.locator('#pd-local')).toBeVisible();await expect(page.locator('#pd-local')).toContainText('Evento demonstrativo');
  const result=await page.locator('#pd-focus-btn').evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#pd-focus-btn')===el};});
  expect(result.hit).toBe(true);
  const same=await layer.evaluate(el=>{el.dataset.testIdentity='same';return getComputedStyle(el.parentElement).isolation;});expect(same).toBe('isolate');
  await page.evaluate(()=>{const item=EventStore.getSelected();item.type==='earthquake'?showEventDetails(0,false,true):showAlertDetails(item,false,true);clearTimeout(cycleTimeout);});await expect(layer).toHaveAttribute('data-test-identity','same');
  await page.screenshot({path:'/tmp/cinema-'+type+'-'+width+'.png'});
 }
 // A mobile expansion resizes the same animation instead of stretching a stale bitmap.
 if(width===390){
  await page.evaluate(()=>{document.body.classList.remove('mobile-details-mid');document.body.classList.add('mobile-details-open');});
  await page.waitForTimeout(350);
  await expect.poll(()=>page.locator('.pd-cinema-layer canvas').evaluate(el=>el.height===Math.round(el.parentElement.clientHeight*Math.min(devicePixelRatio,1.25)))).toBe(true);
  const dimensions=await page.locator('.pd-cinema-layer canvas').evaluate(el=>({pixels:el.height,expected:Math.round(el.parentElement.clientHeight*Math.min(devicePixelRatio,1.25))}));expect(dimensions.pixels).toBe(dimensions.expected);
 }
 await page.evaluate(()=>CinematicCard.stop());await expect(page.locator('.pd-cinema-layer,.pd-cinema-afterglow')).toHaveCount(0);
});
test('gotas deslizam, transições limpam camadas e boletim não vira desastre',async({page})=>{
 await boot(page);await select(page,'storm');const drops=page.locator('.pd-cinema-drop');await expect(drops).toHaveCount(18);await expect.poll(()=>drops.first().evaluate(el=>el.style.transform)).toContain('translate3d');const initial=await drops.evaluateAll(els=>els.map(e=>e.style.transform));await page.waitForTimeout(1200);expect(await drops.evaluateAll(els=>els.map(e=>e.style.transform))).not.toEqual(initial);
 await select(page,'fire');await select(page,'flood');await select(page,'tornado');await expect(page.locator('.pd-cinema-layer')).toHaveCount(1);expect(await page.locator('.pd-cinema-afterglow').count()).toBeLessThanOrEqual(1);await expect(page.locator('.pd-cinema-drop')).toHaveCount(0);await expect(page.locator('.pd-cinema-heat')).toHaveCount(0);
 await select(page,'storm',{id:'cge-bulletin',source:'CGE',hazardNature:'bulletin',detail:'Boletim municipal',warningDescription:'Texto publicado pelo CGE.'});await expect(page.locator('.pd-cinema-layer,.pd-cinema-afterglow')).toHaveCount(0);await expect(page.locator('#pd-bulletin-summary')).toBeVisible();
 await select(page,'flood');await page.evaluate(()=>CinematicCard.start(EventStore.getSelected(),600));await expect(page.locator('.pd-cinema-layer')).toHaveCount(0,{timeout:2000});await expect(page.locator('#painel-direito')).not.toHaveClass(/pd-cinema-active/);
});
test('vulcão só recebe calor com indicação eruptiva e movimento reduzido encerra tudo',async({page})=>{
 await boot(page);await select(page,'volcano',{eruptionStatus:'Sem atividade eruptiva',detail:'Em monitoramento'});await expect(page.locator('.pd-cinema-heat')).toHaveCount(0);await expect(page.locator('.pd-fx-ember').first()).toHaveCSS('opacity','0');
 await select(page,'volcano',{eruptionStatus:'Erupção encerrada',detail:'Em monitoramento'});await expect(page.locator('.pd-cinema-heat')).toHaveCount(0);
 await select(page,'volcano',{eruptionStatus:'Em erupção',detail:'Emissão de cinzas'});await expect(page.locator('.pd-cinema-heat')).toHaveCount(2);
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.pd-cinema-layer,.pd-cinema-afterglow')).toHaveCount(0);
 await select(page,'hurricane');await expect(page.locator('.pd-cinema-layer')).toHaveCount(0);await expect(page.locator('#pd-local .pd-fx-windletter')).toHaveCount(0);await expect(page.locator('.pd-rain-overlay')).toHaveCount(0);
 await select(page,'earthquake');await expect(page.locator('#painel-direito')).toHaveCSS('animation-name','none');await expect(page.locator('#pd-local')).toContainText('Evento demonstrativo');
});

for(const width of [1280,390])test('atmosfera continua visível depois da antiga duração '+width,async({page})=>{
 test.setTimeout(120000);
 await boot(page,width);await page.clock.install();
 for(const type of ['fire','hurricane','tornado','flood','tsunami','wind','volcano','storm']){
  await select(page,type,type==='volcano'?{eruptionStatus:'Em erupção',detail:'Emissão de cinzas'}:{});
  await page.clock.runFor(700);await page.clock.fastForward(20000);await page.clock.runFor(200);
  const layer=page.locator('.pd-cinema-layer');await expect(layer).toHaveCount(1);await expect(layer).toHaveAttribute('data-scene',type);
  await expect(page.locator('#painel-direito')).toHaveClass(new RegExp('pd-fx-'+type));
  const pixels=await layer.locator('canvas').evaluate(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let max=0,total=0;for(let i=3;i<a.length;i+=4){max=Math.max(max,a[i]);total+=a[i];}return {max,mean:total/(a.length/4)};});expect(pixels.max).toBeGreaterThan(28);expect(pixels.mean).toBeGreaterThan(1);
  await page.screenshot({path:'/tmp/fx-visible-'+type+'-'+width+'.png'});
 }
 await select(page,'earthquake');await page.clock.fastForward(8000);await page.clock.runFor(100);await expect(page.locator('.pd-cinema-layer')).toHaveCount(0);await expect(page.locator('#painel-direito')).not.toHaveClass(/pd-fx-earthquake/);
});
test('revisão vulcânica ajusta a cena e remove calor quando a erupção termina',async({page})=>{
 await boot(page);await select(page,'volcano',{eruptionStatus:'Em monitoramento',detail:'Estado de fundo'});await expect(page.locator('.pd-cinema-heat')).toHaveCount(0);
 await page.evaluate(()=>{const item={...EventStore.getSelected(),eruptionStatus:'Em erupção',detail:'Emissão de cinzas'};upsertAlert(item);showAlertDetails(item,false,true);});await expect(page.locator('.pd-cinema-heat')).toHaveCount(2);
 await page.evaluate(()=>{const item={...EventStore.getSelected(),eruptionStatus:'Erupção encerrada',detail:'Sem atividade eruptiva'};upsertAlert(item);showAlertDetails(item,false,true);});await expect(page.locator('.pd-cinema-heat')).toHaveCount(0);await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-activity','monitoring');await expect(page.locator('#painel-direito')).toHaveClass(/pd-fx-volcano/);
});
