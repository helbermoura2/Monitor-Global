const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
for(const width of [1280,390])test('sustained frame delays resize the live effect without resetting letters or deadline '+width,async({page})=>{
 test.setTimeout(120000);
 const base=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173',errors=[];
 page.on('pageerror',e=>{if(e.message!=='Failed to fetch')errors.push(e.message);});
 await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'hardwareConcurrency',{value:8});Object.defineProperty(navigator,'deviceMemory',{value:8});
 });
 await page.setViewportSize({width,height:844});await page.goto(base+'/?verify=20261009-adaptive-quality',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&!!window.CardEffectQuality);
 await page.evaluate(async()=>{pausarBuscas();clearTimeout(cycleTimeout);stopWaveFront();CinematicCard.stop();await OptionalFeatures.effect('wind');});
 await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 await page.evaluate(()=>{window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),100);window.cancelAnimationFrame=id=>clearTimeout(id);});
 await page.evaluate(()=>{
  const item={id:'quality-wind',type:'wind',windKmh:140,place:'Rajada de teste',coords:[-46,-23],time:Date.now(),source:'QA'};
  globalAlerts=[item];showAlertDetails(item,false);clearTimeout(cycleTimeout);
  if(innerWidth<900)document.body.classList.add('mobile-details-open');
 });
 const layer=page.locator('.pd-cinema-layer');await expect(layer).toHaveAttribute('data-quality',width<900?'balanced':'full');
 const first=await layer.elementHandle(),letter=await page.locator('.pd-fx-windletter').first().elementHandle();
 const full=await page.locator('.pd-gale-field').evaluate(c=>({w:c.width,h:c.height}));
 await page.clock.runFor(2900);await expect(layer).toHaveAttribute('data-quality',width<900?'light':'balanced');
 const balanced=await page.locator('.pd-gale-field').evaluate(c=>({w:c.width,h:c.height}));expect(balanced.w).toBeCloseTo(full.w*(width<900?.75:.8),0);
 await page.clock.runFor(2900);await expect(layer).toHaveAttribute('data-quality','light');
 const light=await page.locator('.pd-gale-field').evaluate(c=>({w:c.width,h:c.height}));expect(light.w).toBeCloseTo(full.w*(width<900?.75:.6),0);
 expect(await first.evaluate(el=>el.isConnected)).toBe(true);expect(await letter.evaluate(el=>el.isConnected)).toBe(true);
 await page.clock.fastForward(10500);expect(await page.evaluate(()=>CinematicCard.isActive())).toBe(false);
 await expect(page.locator('.pd-cinema-layer,.pd-gale-field,.pd-fx-windletter')).toHaveCount(0);
 await page.evaluate(()=>{CinematicCard.start({id:'new-quality',type:'storm',detail:'Trovoadas'});});await expect(layer).toHaveAttribute('data-quality',width<900?'balanced':'full');
 await page.emulateMedia({reducedMotion:'reduce'});await expect(layer).toHaveCount(0);expect(errors).toEqual([]);
});
test('all material renderers honor the shared resolution without changing CSS bounds',async({page})=>{
 const fs=require('node:fs'),path=require('node:path');await page.setContent('<div id="p" style="width:320px;height:600px"><span id="pd-local">Alerta de teste</span></div>');
 await page.evaluate(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:original.call(this,type,...args);};});
 for(const module of ['card-effect-quality','card-gale-field','card-tornado-field','card-flood-rise','card-tsunami-surge','card-weather-physics','card-volcano-monitoring','card-event-typography','card-artifact-effects'])await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../js/'+module+'.js'),'utf8')});
 const result=await page.evaluate(()=>{
  const p=document.getElementById('p'),out=[];
  for(const type of ['wind','tornado','flood','tsunami','storm','hurricane','volcano','typography','artifacts']){
   const quality=CardEffectQuality.create(false,{}),cfg={type:['typography','artifacts'].includes(type)?'storm':type,strength:.7,hot:type!=='volcano',lava:type!=='volcano'};
   const renderer=type==='volcano'?CardVolcanoMonitoring.create(cfg,false,quality):type==='typography'?CardEventTypography.create(cfg,false,p,quality):type==='artifacts'?CardArtifactEffects.create(cfg,false,p,quality):CardWeatherPhysics.create(cfg,false,p,quality);
   renderer.resize(320,600);const before=renderer.canvas.width;
   for(let t=0;t<2800;t+=40)quality.sample(t,30,40,30);
   renderer.resize(320,600);out.push({type,before,after:renderer.canvas.width,cssWidth:p.clientWidth});renderer.draw?.(3,.04,1,{});renderer.destroy();
  }
  return out;
 });
 for(const r of result){expect(r.after,r.type).toBeCloseTo(r.before*.8,0);expect(r.cssWidth).toBe(320);}
});
test('full-screen seismic dust adapts while fallen originals stay absent and power flashes persist',async({page})=>{
 await page.setViewportSize({width:1280,height:844});await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));
 await page.setContent('<div id="app"><div id="top-strip"><div id="chips-row"><button class="chip">Brasil</button></div></div><div id="events">Eventos</div><aside id="painel-direito" style="width:320px;height:500px"><span id="pd-flag">Brasil</span><div class="stat-card">Magnitude 7.5</div></aside></div>');
 await page.addStyleTag({path:'css/seismic-cinema.css'});await page.addScriptTag({path:'js/card-effect-quality.js'});await page.addScriptTag({path:'js/seismic-cinema.js'});
 await page.evaluate(()=>{Object.defineProperty(navigator,'hardwareConcurrency',{value:8});Object.defineProperty(navigator,'deviceMemory',{value:8});window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),100);window.cancelAnimationFrame=id=>clearTimeout(id);SeismicCinema.play({mag:7.5,depth:10});});
 const scene=page.locator('.seismic-scene');await expect(scene).toHaveAttribute('data-quality','full');const original=await scene.elementHandle();
 const fullWidth=await page.locator('.seismic-atmosphere').evaluate(c=>c.width);
 await page.clock.runFor(5800);await expect(scene).toHaveAttribute('data-quality','light');
 expect(await page.locator('.seismic-atmosphere').evaluate(c=>c.width)).toBeCloseTo(fullWidth*.6,0);expect(await original.evaluate(el=>el.isConnected)).toBe(true);
 await expect(page.locator('#painel-direito')).toHaveClass(/seismic-displaced/);await expect(page.locator('.seismic-power-failure')).toHaveCount(1);
 await page.clock.fastForward(10500);await expect(scene).toHaveCount(0);await expect(page.locator('.seismic-displaced')).toHaveCount(0);expect(await page.locator('#painel-direito').evaluate(el=>el.inert)).toBe(false);
});
