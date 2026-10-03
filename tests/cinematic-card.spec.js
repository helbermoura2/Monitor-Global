const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
async function boot(page,width=1280){
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.setViewportSize({width,height:844});await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento);
}
async function select(page,type,extra={}){
 await page.evaluate(({type,extra})=>{
  const item={id:'cinema-'+type,type,source:'Visual QA',place:'Evento demonstrativo — Brasil',coords:[-46.63,-23.55],time:Date.now(),bandeira:'🇧🇷',detail:type==='storm'?'Trovoada reportada no aeródromo':'',mag:5.6,depth:10,windKmh:120,...extra};
  if(type==='earthquake'){globalEvents=[item];showEventDetails(0,false);}else{globalAlerts=[item];upsertAlert(item);showAlertDetails(item,false);}
  clearTimeout(cycleTimeout);clearTimeout(window.__mgRadarDelayT);clearTimeout(window.__mgWaveDelayT);
 },{type,extra});
}
async function cardCoverage(page){
 return page.locator('.pd-cinema-layer').evaluate(layer=>{
  const rect=layer.getBoundingClientRect(),video=layer.querySelector('video'),film=layer.querySelector('.pd-cinema-film');
  const bounds=el=>{const r=el.getBoundingClientRect();return {top:r.top-rect.top,left:r.left-rect.left,width:r.width,height:r.height};};
  const width=film.width,height=film.height,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');ctx.drawImage(film,0,0,width,height);
  const particles=layer.querySelector('.pd-cinema-particles');if(particles)ctx.drawImage(particles,0,0,width,height);
  const pixels=ctx.getImageData(0,0,width,height).data,thirds=[];
  // Ignore the edges: the previous hero band plus thin edge effects must fail this check.
  for(let third=0;third<3;third++){
   let total=0,max=0,count=0,covered=0;
   for(let y=Math.floor(third*height/3);y<Math.floor((third+1)*height/3);y++)for(let x=Math.floor(width*.2);x<Math.floor(width*.8);x++){
    const alpha=pixels[(y*width+x)*4+3];total+=alpha;max=Math.max(max,alpha);count++;if(alpha>=12)covered++;
   }
   thirds.push({mean:total/count,max,covered:covered/count});
  }
  const panel=layer.parentElement.getBoundingClientRect();
  return {width:rect.width,height:rect.height,top:rect.top-panel.top,left:rect.left-panel.left,video:bounds(video||film),film:bounds(film),mask:video?getComputedStyle(video).maskImage:"none",thirds};
 });
}
async function readableControls(page){
 await expect(page.locator('#pd-local')).toBeVisible();await expect(page.locator('#pd-local')).toContainText('Evento demonstrativo');
 const result=await page.locator('#pd-local').evaluate(el=>{
  const style=getComputedStyle(el),rgb=style.color.match(/[\d.]+/g).slice(0,3).map(Number);
  return {lightness:rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722,opacity:Number(style.opacity)};
 });
 expect(result.lightness).toBeGreaterThan(190);expect(result.opacity).toBeGreaterThanOrEqual(.9);
 const focus=await page.locator('#pd-focus-btn').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#pd-focus-btn')===el;});
 expect(focus).toBe(true);
}
for(const width of [1280,390])test('cena ocupa o cartão inteiro e mantém os controles legíveis '+width,async({page})=>{
 await boot(page,width);
 page.on('pageerror', error=>console.log('Erro na cena: '+error.message));
 for(const type of ['storm','flood','fire']){
  await select(page,type,type==='fire'?{detail:'Foco de incêndio reportado; equipes acompanham a ocorrência e as condições locais. '.repeat(12)}:{});
  if(width===390)await page.evaluate(()=>{document.body.classList.remove('mobile-details-mid');document.body.classList.add('mobile-details-open');});
  const video=page.locator('.pd-cinema-footage');if(type==='storm')await expect(video).toHaveCount(0);else await expect.poll(()=>video.evaluate(v=>v.readyState>=2&&!v.paused)).toBe(true);
  await expect.poll(async()=>{const c=await cardCoverage(page);return Math.abs(c.video.height-c.height)<1&&Math.abs(c.video.top)<1;}).toBe(true);
  const coverage=await cardCoverage(page);
  for(const bounds of [coverage.video,coverage.film]){
   expect(Math.abs(bounds.top)).toBeLessThan(1);expect(Math.abs(bounds.left)).toBeLessThan(1);
   expect(Math.abs(bounds.width-coverage.width)).toBeLessThan(1);expect(Math.abs(bounds.height-coverage.height)).toBeLessThan(1);
  }
  expect(coverage.mask).toBe('none');
  for(const third of coverage.thirds){expect(third.mean).toBeGreaterThan(8);expect(third.covered).toBeGreaterThan(.3);}
  await readableControls(page);
  await page.screenshot({path:'/tmp/full-card-'+type+'-'+width+'.png'});
 }
 const beforeScroll=await cardCoverage(page);
 const scrollTop=await page.locator('#painel-direito').evaluate(panel=>{panel.scrollTop=Math.min(120,panel.scrollHeight-panel.clientHeight);return panel.scrollTop;});
 expect(scrollTop).toBeGreaterThan(20);
 await expect.poll(async()=>Math.abs((await cardCoverage(page)).top-beforeScroll.top)).toBeLessThan(2);
 const scrolled=await cardCoverage(page);expect(Math.abs(scrolled.video.height-scrolled.height)).toBeLessThan(1);
 for(const third of scrolled.thirds)expect(third.mean).toBeGreaterThan(8);
 await page.locator('#painel-direito').evaluate(panel=>{panel.scrollTop=0;});
 if(width===390){
  const expanded=await cardCoverage(page);
  await page.evaluate(()=>{document.body.classList.remove('mobile-details-open');document.body.classList.add('mobile-details-mid');});
  await expect.poll(async()=>{const c=await cardCoverage(page);return c.height<expanded.height&&Math.abs(c.video.height-c.height)<1;}).toBe(true);
  const compact=await cardCoverage(page);for(const third of compact.thirds)expect(third.mean).toBeGreaterThan(8);
  await readableControls(page);await page.screenshot({path:'/tmp/full-card-compact-390.png'});
 }
});
for(const width of [1280,390])test('todos os efeitos respeitam texto, vidro e controles '+width,async({page})=>{
 test.setTimeout(180000);
 await boot(page,width);
 for(const type of ['storm','hurricane','tornado','fire','volcano','flood','tsunami','wind','earthquake']){
  await select(page,type,type==='volcano'?{eruptionStatus:'Em erupção',detail:'Emissão de cinzas'}:{});
  const layer=page.locator('.pd-cinema-layer');await expect(layer).toHaveCount(1);await expect(layer).toHaveAttribute('data-scene',type);await expect(layer).toHaveAttribute('aria-hidden','true');
  if(type!=='earthquake')await expect(layer).toHaveAttribute('data-renderer','film');
  await expect(layer).toHaveCSS('pointer-events','none');try { await expect.poll(()=>layer.evaluate(el=>Number(getComputedStyle(el).opacity)),{message:'Cena visível: '+type+' / '+width}).toBeGreaterThan(.8); } catch(error) { console.log('Estado da cena',type,width,await page.evaluate(()=>({body:document.body.className,panel:document.getElementById('painel-direito').className,width:document.getElementById('painel-direito').clientWidth,hidden:document.hidden,layer:document.querySelector('.pd-cinema-layer')?.getAttribute('style')})));throw error; }
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
  await expect.poll(()=>page.locator('.pd-cinema-layer .pd-cinema-particles').evaluate(el=>el.height===Math.round(el.parentElement.clientHeight*Math.min(devicePixelRatio,1.25)))).toBe(true);
  const dimensions=await page.locator('.pd-cinema-layer .pd-cinema-particles').evaluate(el=>({pixels:el.height,expected:Math.round(el.parentElement.clientHeight*Math.min(devicePixelRatio,1.25))}));expect(dimensions.pixels).toBe(dimensions.expected);
 }
 await page.evaluate(()=>CinematicCard.stop());await expect(page.locator('.pd-cinema-layer,.pd-cinema-afterglow')).toHaveCount(0);
});
test('gotas deslizam, transições limpam camadas e boletim não vira desastre',async({page})=>{
 await boot(page);await select(page,'storm');const drops=page.locator('.pd-cinema-drop');await expect(drops).toHaveCount(32);await expect.poll(()=>drops.first().evaluate(el=>el.style.transform)).toContain('translate3d');const initial=await drops.evaluateAll(els=>els.map(e=>e.style.transform));await page.waitForTimeout(1200);expect(await drops.evaluateAll(els=>els.map(e=>e.style.transform))).not.toEqual(initial);
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
  const pixels=await layer.locator('.pd-cinema-particles').evaluate(c=>{const scratch=document.createElement('canvas');scratch.width=c.width;scratch.height=c.height;const ctx=scratch.getContext('2d');const film=c.parentElement.querySelector('.pd-cinema-film');if(film)ctx.drawImage(film,0,0,c.width,c.height);ctx.drawImage(c,0,0);const a=ctx.getImageData(0,0,c.width,c.height).data;let max=0,total=0;for(let i=3;i<a.length;i+=4){max=Math.max(max,a[i]);total+=a[i];}return {max,mean:total/(a.length/4)};});expect(pixels.max).toBeGreaterThan(28);expect(pixels.mean).toBeGreaterThan(1);
  await page.screenshot({path:'/tmp/fx-visible-'+type+'-'+width+'.png'});
 }
 await select(page,'earthquake');await page.clock.fastForward(8000);await page.clock.runFor(100);await expect(page.locator('.pd-cinema-layer')).toHaveCount(0);await expect(page.locator('#painel-direito')).not.toHaveClass(/pd-fx-earthquake/);
});
test('revisão vulcânica ajusta a cena e remove calor quando a erupção termina',async({page})=>{
 await boot(page);await select(page,'volcano',{eruptionStatus:'Em monitoramento',detail:'Estado de fundo'});await expect(page.locator('.pd-cinema-heat')).toHaveCount(0);
 await page.evaluate(()=>{const item={...EventStore.getSelected(),eruptionStatus:'Em erupção',detail:'Emissão de cinzas'};upsertAlert(item);showAlertDetails(item,false,true);});await expect(page.locator('.pd-cinema-heat')).toHaveCount(2);
 await page.evaluate(()=>{const item={...EventStore.getSelected(),eruptionStatus:'Erupção encerrada',detail:'Sem atividade eruptiva'};upsertAlert(item);showAlertDetails(item,false,true);});await expect(page.locator('.pd-cinema-heat')).toHaveCount(0);await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-activity','monitoring');await expect(page.locator('#painel-direito')).toHaveClass(/pd-fx-volcano/);
});

for(const width of [1280,390])test('vídeo ilustra o evento, avança e pausa no verso '+width,async({page})=>{
 await boot(page,width);await select(page,'flood');
 const video=page.locator('.pd-cinema-footage');await expect(video).toHaveCount(1);
 await expect.poll(()=>video.evaluate(v=>v.readyState>=2&&!v.paused)).toBe(true);
 const initial=await video.evaluate(v=>v.currentTime);await page.waitForTimeout(800);expect(await video.evaluate(v=>v.currentTime)).toBeGreaterThan(initial);
 const attributes=await video.evaluate(v=>({muted:v.muted,inline:v.playsInline,loop:v.loop,src:v.getAttribute('src')}));expect(attributes).toEqual({muted:true,inline:true,loop:true,src:'media/card-fx/current.mp4'});
 await expect(page.locator('#pd-mag svg.pd-cinema-symbol')).toHaveCount(1);
 await page.evaluate(()=>document.getElementById('painel-direito').classList.add('pd-flip-girado'));await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(true);
 await page.evaluate(()=>document.getElementById('painel-direito').classList.remove('pd-flip-girado'));await expect.poll(()=>video.evaluate(v=>!v.paused)).toBe(true);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(true);
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await expect.poll(()=>video.evaluate(v=>!v.paused)).toBe(true);
 if(width===390){
  await page.evaluate(()=>document.body.classList.remove('mobile-details-mid','mobile-details-open'));await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(true);
  await page.evaluate(()=>document.body.classList.add('mobile-details-mid'));await expect.poll(()=>video.evaluate(v=>!v.paused)).toBe(true);
 }
 const previous=await video.elementHandle();
 await select(page,'fire');await expect(video).toHaveCount(1);await expect(video).toHaveAttribute('src','media/card-fx/fire.mp4');
 expect(await previous.evaluate(v=>({connected:v.isConnected,paused:v.paused,src:v.getAttribute('src')}))).toEqual({connected:false,paused:true,src:null});
 await page.emulateMedia({reducedMotion:'reduce'});await expect(video).toHaveCount(0);
});
test('falha do vídeo mantém cena gráfica e vulcão em monitoramento não recebe erupção',async({page})=>{
 await boot(page);await page.route('**/media/card-fx/*.mp4',r=>r.abort());await select(page,'flood');
 // A carga do renderizador de software pode atrasar a digitação no runner.
 await expect(page.locator('.pd-cinema-film')).toHaveCount(1);await expect(page.locator('#pd-local')).toContainText('Evento demonstrativo',{timeout:15000});
 await expect.poll(async()=>{const coverage=await cardCoverage(page);return coverage.thirds.every(third=>third.mean>8&&third.covered>.3);}).toBe(true);
 await select(page,'volcano',{eruptionStatus:'Em monitoramento',detail:'Atividade vulcânica em andamento'});await expect(page.locator('.pd-cinema-footage')).toHaveAttribute('src','media/card-fx/terrain.mp4');await expect(page.locator('.pd-cinema-heat')).toHaveCount(0);
});

test('vento move as letras preservando o conteúdo do local',async({page})=>{
 await boot(page);
 for(const type of ['wind']){await select(page,type);await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-scene',type);expect(await page.locator('#pd-local .pd-fx-windletter').count()).toBeGreaterThan(5);await expect(page.locator('#pd-local')).toContainText('Evento');await expect(page.locator('.pd-cinema-contact')).toHaveCount(1);}
});


for(const width of [1280,390])test('água sobe pela frente do cartão e não bloqueia foco '+width,async({page})=>{
 await boot(page,width);await select(page,'flood');const before=await page.locator('#painel-direito').evaluate(p=>parseFloat(p.style.getPropertyValue('--pd-water-top')));await page.waitForTimeout(2000);const after=await page.locator('#painel-direito').evaluate(p=>parseFloat(p.style.getPropertyValue('--pd-water-top')));expect(after).toBeLessThan(before);await expect(page.locator('.pd-cinema-contact')).toHaveCSS('pointer-events','none');await readableControls(page);await select(page,'storm');await expect(page.locator('.pd-cinema-contact .pd-cinema-lenses')).toHaveCount(1);await expect(page.locator('.pd-cinema-footage')).toHaveCount(0);
});
