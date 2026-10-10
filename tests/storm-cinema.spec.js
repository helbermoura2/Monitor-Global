const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
test.use({serviceWorkers:'block'});
for(const width of [1280,390])test('tempestade tem profundidade, pressão e clarões breves '+width,async({page})=>{
 await page.setViewportSize({width,height:844});
 await page.setContent('<body class="mobile-details-mid"><div id="painel-direito" data-lightning="on" style="position:absolute;left:20px;top:25px;width:320px;height:600px;background:#0b2231;border-radius:16px;isolation:isolate"><div id="pd-local" style="margin:80px 16px;color:white;font:600 18px system-ui">Tempestade em São Paulo</div><button id="control">Detalhes</button></div></body>');
 for(const file of ['painel-fx.css','cinematic-card.css','storm-cinema.css'])await page.addStyleTag({content:fs.readFileSync(path.join(__dirname,'../css',file),'utf8')});
 await page.evaluate(()=>{window.__frame=null;window.requestAnimationFrame=cb=>{__frame=cb;return 1;};window.cancelAnimationFrame=()=>{__frame=null;};});
 for(const file of ['painel-fx.js','card-effect-quality.js','card-cinema-film.js','cinematic-card.js'])await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../js',file),'utf8')});
 const result=await page.evaluate(()=>{
  CinematicCard.start({id:'storm-qa',type:'storm',windKmh:150,detail:'Trovoadas'},Infinity);const start=performance.now(),panel=document.getElementById('painel-direito');
  let flash=0,lit=0,movement=0,calm=0;
  for(let i=1;i<=300;i++){__frame(start+i*33.34);const f=parseFloat(panel.style.getPropertyValue('--pd-storm-flash'));flash=Math.max(flash,f);if(f>.05)lit++;movement=Math.max(movement,Math.abs(parseFloat(panel.style.getPropertyValue('--pd-wind-x'))));if(i===160)calm=Math.abs(parseFloat(panel.style.getPropertyValue('--pd-wind-x')));}
  const coverage=canvas=>{const scratch=document.createElement('canvas');scratch.width=canvas.width;scratch.height=canvas.height;const ctx=scratch.getContext('2d');ctx.drawImage(canvas,0,0);const data=ctx.getImageData(0,0,scratch.width,scratch.height).data;return data.reduce((n,v,i)=>n+(i%4===3&&v>0?1:0),0);};
  return {flash,lit,movement,calm,rear:coverage(document.querySelector('.pd-cinema-particles')),front:coverage(document.querySelector('.pd-cinema-contact canvas')),text:document.getElementById('pd-local').textContent.replace(/\u00a0/g,' '),renderer:document.querySelector('.pd-cinema-layer').dataset.renderer};
 });
 expect(result.renderer).toBe('film');expect(result.flash).toBeGreaterThan(.3);expect(result.lit).toBeGreaterThan(0);expect(result.lit).toBeLessThan(25);
 expect(result.movement).toBeGreaterThan(width===390?.8:1.5);expect(result.calm).toBeLessThan(.2);
 expect(result.rear).toBeGreaterThan(100);expect(result.front).toBeGreaterThan(100);expect(result.text).toBe('Tempestade em São Paulo');
 await expect(page.locator('.pd-cinema-drop')).toHaveCount(width===390?20:32);await expect(page.locator('.pd-fx-letter-blown')).toHaveCount(0);
 await expect(page.locator('.pd-cinema-storm-bolt')).toHaveAttribute('data-channel','heavy');
 await expect(page.locator('.pd-bolt-filament')).toHaveCount(8);
 const noLightning=await page.evaluate(()=>{document.getElementById('painel-direito').dataset.lightning='off';CinematicCard.start({id:'rain-only',type:'storm',detail:'Chuva forte'},Infinity);__frame(performance.now()+2310);return document.getElementById('painel-direito').style.getPropertyValue('--pd-storm-flash');});
 expect(Number(noLightning)).toBe(0);
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.pd-cinema-layer,.pd-cinema-contact,.pd-fx-windletter')).toHaveCount(0);
 expect(await page.locator('#painel-direito').evaluate(el=>Array.from(el.style).filter(k=>k.startsWith('--pd-wind-')||k==='--pd-storm-flash'))).toEqual([]);
 await page.locator('#control').click();
});
for(const width of [1280,390])test('tempestade no cartão completo mantém leitura e controles '+width,async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.setViewportSize({width,height:844});await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento);
 await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+200));
 const errors=[];page.on('pageerror',e=>{if(e.message!=='Failed to fetch')errors.push(e.message);});page.on('console',m=>{if(m.text().includes('[CardCinema]'))errors.push(m.text());});
 await page.evaluate(()=>{const item={id:'storm-preview',type:'storm',source:'Visual QA',place:'Tempestade — São Paulo',detail:'Trovoadas e chuva intensa',coords:[-46.63,-23.55],windKmh:150,sev:3,time:Date.now(),bandeira:'🇧🇷'};globalAlerts=[item];upsertAlert(item);showAlertDetails(item,false);clearTimeout(cycleTimeout);clearTimeout(window.__mgRadarDelayT);clearTimeout(window.__mgWaveDelayT);});
 await page.clock.runFor(2100);
 await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-renderer','film');await expect(page.locator('#pd-local')).toContainText('Tempestade');
 const hit=()=>page.locator('#pd-focus-btn').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#pd-focus-btn')===el;});
 expect(await hit()).toBe(true);await page.screenshot({path:'/tmp/storm-scene-'+width+'.png'});
 await page.clock.runFor(240);await page.screenshot({path:'/tmp/storm-scene-lightning-'+width+'.png'});
 if(width===390){await page.evaluate(()=>{document.body.classList.remove('mobile-details-mid');document.body.classList.add('mobile-details-open');});await page.clock.runFor(500);await page.screenshot({path:'/tmp/storm-scene-expanded-'+width+'.png'});}
 expect(errors).toEqual([]);await page.evaluate(()=>CinematicCard.stop());await expect(page.locator('.pd-cinema-contact,.pd-fx-windletter')).toHaveCount(0);await expect(page.locator('#pd-local')).toContainText('Tempestade');expect(await hit()).toBe(true);
});
