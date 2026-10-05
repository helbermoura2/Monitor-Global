const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
test.use({serviceWorkers:'block'});
async function isolated(page,mobile=false){
 await page.setViewportSize({width:mobile?390:1280,height:844});
 await page.setContent('<body class="mobile-details-open"><div id="painel-direito" data-lightning="on" style="position:absolute;left:12px;top:20px;width:320px;height:600px;background:#0b2231;border-radius:16px;isolation:isolate;overflow:hidden"><div id="pd-local" style="margin:65px 16px;font:600 19px system-ui;color:white">Evento extremo — São Paulo 🇧🇷</div><div id="pd-source" style="margin:16px;color:white">Fonte oficial · 02:15 BRT</div><div class="stat-card" style="margin:210px 16px 16px;color:white;padding:10px"><span class="stat-card-label">Vento</span><span class="stat-card-value"><b style="color:rgb(240,210,120)">150</b> km/h</span></div><button id="control" style="position:absolute;top:12px;right:12px">Detalhes</button></div></body>');
 for(const file of ['painel-fx.css','cinematic-card.css','storm-cinema.css','wind-cinema.css','advanced-weather.css'])await page.addStyleTag({content:fs.readFileSync(path.join(__dirname,'../css',file),'utf8')});
 await page.evaluate(()=>{window.__weatherFrame=null;window.requestAnimationFrame=cb=>{__weatherFrame=cb;return 1;};window.cancelAnimationFrame=()=>{__weatherFrame=null;};window.CardCinemaFilm={create:()=>null,footage:()=>null};});
 for(const file of ['painel-fx.js','card-weather-physics.js','cinematic-card.js'])await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../js',file),'utf8')});
}
for(const mobile of [false,true])test('materiais sem GPU: chuva, vento e água preservam conteúdo, controles e limpeza '+mobile,async({page})=>{
 await isolated(page,mobile);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const original=await page.locator('#painel-direito').innerText();
 for(const type of ['storm','hurricane','wind','flood','tsunami']){
  const result=await page.evaluate(type=>{
   const start=performance.now();CinematicCard.start({id:type,type,windKmh:150,classification:type==='hurricane'?'TS':undefined},Infinity);
   // Draw actual frames at 30 Hz, including the full-frame flood reserve.
   const frames=75;for(let i=1;i<=frames;i++)__weatherFrame(start+i*34);
   const c=document.querySelector('.pd-weather-material'),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   const topAlpha=Array.from(data.slice(0,c.width*20*4)).filter((v,i)=>i%4===3).reduce((a,b)=>a+b,0);
   return {wet:data.some((v,i)=>i%4===3&&v>15),topAlpha,submerged:document.querySelectorAll('.pd-water-submerged').length,secondary:Array.from(document.querySelectorAll('#pd-source .pd-fx-windletter,.stat-card .pd-fx-windletter')).some(el=>el.style.transform),waterTop:parseFloat(document.getElementById('painel-direito').style.getPropertyValue('--pd-water-top'))};
  },type);
  expect(result.wet,type).toBe(true);
  if(['flood','tsunami'].includes(type)){expect(result.topAlpha).toBeGreaterThan(0);expect(result.submerged).toBeGreaterThan(0);expect(result.waterTop).toBe(0);}
  else expect(result.secondary,type).toBe(true);
  expect(await page.locator('#painel-direito').innerText()).toBe(original);
  await expect(page.locator('.stat-card-value b')).toHaveCSS('color','rgb(240, 210, 120)');
  await page.locator('#control').click();
  await page.evaluate(()=>CinematicCard.stop());
  await expect(page.locator('.pd-weather-material,.pd-weather-lenses,.pd-water-submerged,.pd-fx-windletter')).toHaveCount(0);
  expect(await page.locator('#painel-direito').innerText()).toBe(original);
 }
 expect(errors).toEqual([]);
});
for(const width of [1280,390])test('cenas avançadas no evento real, revisão, redimensionamento e movimento reduzido '+width,async({page})=>{
 test.setTimeout(180000);
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.setViewportSize({width,height:844});await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&!!window.CardWeatherPhysics);
 const errors=[];page.on('pageerror',e=>{if(e.message!=='Failed to fetch')errors.push(e.message);});
 await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+10000));
 for(const [key,type,classification] of [['storm','storm',null],['tropical-storm','hurricane','TS'],['typhoon','hurricane','TY'],['wind','wind',null],['flood','flood',null]]){
  await page.evaluate(({type,classification})=>{
   const item={id:'advanced-'+type,type,classification,windKmh:classification==='TS'?85:150,source:'QA',place:'São Paulo — evento de teste',detail:'Trovoadas e chuva intensa',coords:[-46.63,-23.55],time:Date.now(),sev:3};
   globalAlerts=[item];upsertAlert(item);showAlertDetails(item,false);clearTimeout(cycleTimeout);clearTimeout(window.__mgRadarDelayT);clearTimeout(window.__mgWaveDelayT);
  },{type,classification});
  await page.clock.runFor(1800);
  await expect(page.locator('.pd-weather-material')).toHaveCount(1);
  await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-demo','false');
  await expect(page.locator('#pd-local')).toContainText('São Paulo');
  expect(await page.locator('#pd-focus-btn').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#pd-focus-btn')===el;})).toBe(true);
  const before=await page.locator('.pd-weather-material').elementHandle();
  await page.evaluate(()=>{const item={...EventStore.getSelected(),place:'São Paulo — boletim atualizado'};upsertAlert(item);showAlertDetails(item,false,true);clearTimeout(cycleTimeout);});
  await page.clock.runFor(1600);expect(await before.evaluate(el=>el.isConnected)).toBe(true);
  await expect(page.locator('#pd-local')).toContainText('boletim atualizado');
  if(type==='flood'){await expect.poll(()=>page.locator('.pd-cinema-footage').evaluate(v=>v.readyState>=2&&!v.paused)).toBe(true);await page.clock.runFor(200);}
  await page.screenshot({path:'/tmp/advanced-weather-'+key+'-'+width+'.png'});
 }
 if(width===390){await page.evaluate(()=>{document.body.classList.remove('mobile-details-mid');document.body.classList.add('mobile-details-open');});await page.clock.runFor(300);}
 await expect.poll(()=>page.locator('.pd-weather-material').evaluate(el=>Math.abs(el.getBoundingClientRect().height-el.parentElement.getBoundingClientRect().height)<1)).toBe(true);
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.pd-weather-material,.pd-weather-lenses,.pd-fx-windletter,.pd-water-submerged')).toHaveCount(0);
 await expect(page.locator('#pd-local')).toContainText('boletim atualizado');expect(errors).toEqual([]);
});
