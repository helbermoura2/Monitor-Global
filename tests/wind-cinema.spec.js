const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
test.use({serviceWorkers:'block'});
for(const width of [1280,390])test('pressão da rajada move vidro e letras e recupera o repouso '+width,async({page})=>{
 await page.setViewportSize({width,height:844});
 await page.setContent('<body class="mobile-details-mid"><div id="painel-direito" style="position:absolute;left:20px;top:30px;width:320px;height:600px;background:#0b2231;border:1px solid #68808d;border-radius:16px;isolation:isolate"><div id="pd-local" style="margin:80px 16px;color:white;font:600 18px system-ui">Rajadas de vento em São Paulo 🇧🇷</div><div id="pd-source" style="color:white">Estação local — atualização em tempo real</div><div class="stat-card" style="margin:16px;color:white"><span class="stat-card-label">Intensidade</span><span class="stat-card-value"><b style="color:rgb(240, 210, 120)">150</b> km/h</span></div><button id="control" style="margin:16px">Detalhes</button></div></body>');
 for(const file of ['painel-fx.css','cinematic-card.css','wind-cinema.css'])await page.addStyleTag({content:fs.readFileSync(path.join(__dirname,'../css',file),'utf8')});
 await page.evaluate(()=>{window.__frame=null;window.requestAnimationFrame=cb=>{__frame=cb;return 1;};window.cancelAnimationFrame=()=>{__frame=null;};});
 for(const file of ['painel-fx.js','card-cinema-film.js','card-gale-field.js','card-weather-physics.js','cinematic-card.js'])await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../js',file),'utf8')});
 const result=await page.evaluate(()=>{
  const begin=performance.now();CinematicCard.start({id:'gust',type:'wind',windKmh:150},Infinity);
  const panel=document.getElementById('painel-direito');
  const shift=selector=>Math.max(0,...Array.from(document.querySelectorAll(selector),el=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)));
  const sample=()=>({x:parseFloat(panel.style.getPropertyValue('--pd-wind-x')),pressure:parseFloat(panel.style.getPropertyValue('--pd-wind-pressure')),letter:shift('#pd-local .pd-fx-windletter'),secondary:shift('#pd-source .pd-fx-windletter,.stat-card .pd-fx-windletter'),text:document.getElementById('pd-local').textContent,metric:document.querySelector('.stat-card-value').textContent,metricColor:getComputedStyle(document.querySelector('.stat-card-value b')).color,flagSpans:Array.from(document.querySelectorAll('#pd-local .pd-fx-windletter')).filter(el=>el.textContent==='🇧🇷').length});
  let peak=null,calm=null,second=null,maxX=0;
  for(let i=1;i<=270;i++){__frame(begin+i*33.34);maxX=Math.max(maxX,parseFloat(panel.style.getPropertyValue('--pd-wind-x')));if(i===54)peak=sample();if(i===160)calm=sample();if(i===210)second=sample();}
  const renderer=document.querySelector('.pd-cinema-layer').dataset.renderer;
  CinematicCard.start({id:'gust-unknown-speed',type:'wind'},Infinity);
  const secondBegin=performance.now();for(let i=1;i<=60;i++)__frame(secondBegin+i*33.34);
  return {peak,calm,second,maxX,unknown:sample(),renderer};
 });
 expect(result.renderer).toBe('film');expect(result.peak.pressure).toBeGreaterThan(.5);
 expect(result.peak.x).toBeGreaterThan(width===390?4.5:8);expect(result.peak.x).toBeLessThanOrEqual(width===390?7:12);expect(result.peak.letter).toBeGreaterThan(width===390?9:12);
 expect(result.peak.secondary).toBeGreaterThan(2);expect(result.peak.secondary).toBeLessThan(result.peak.letter);
 expect(result.maxX).toBeLessThanOrEqual(width===390?7:12);expect(result.second.pressure).toBeGreaterThan(result.calm.pressure*3);expect(result.second.letter).toBeGreaterThan(3);
 expect(result.unknown.pressure).toBeGreaterThan(.65);expect(result.unknown.x).toBeGreaterThan(width===390?4.5:8);expect(result.unknown.letter).toBeGreaterThan(8);
 expect(Math.abs(result.calm.x)).toBeLessThan(result.peak.x*.3);expect(result.calm.pressure).toBeGreaterThan(.04);expect(result.calm.letter).toBeLessThan(.25);
 expect(result.peak.text).toBe('Rajadas de vento em São Paulo 🇧🇷');expect(result.calm.text).toBe(result.peak.text);expect(result.peak.metric).toBe('150 km/h');expect(result.peak.metricColor).toBe('rgb(240, 210, 120)');expect(result.peak.flagSpans).toBe(1);
 await expect(page.locator('.pd-fx-letter-blown')).toHaveCount(0);
 await page.evaluate(()=>document.getElementById('pd-local').textContent='Rajada atualizada');
 await expect(page.locator('#pd-local')).toHaveText('Rajada atualizada');
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.pd-cinema-layer,.pd-cinema-contact,.pd-fx-windletter')).toHaveCount(0);
 expect(await page.locator('#painel-direito').evaluate(el=>Array.from(el.style).filter(k=>k.startsWith('--pd-wind-')))).toEqual([]);
 await page.locator('#control').click();
});
for(const width of [1280,390])test('rajada cinematográfica no cartão completo mantém controles '+width,async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.setViewportSize({width,height:844});await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento);
 const errors=[];page.on('pageerror',e=>{if(e.message!=='Failed to fetch')errors.push(e.message);});page.on('console',m=>{if(m.text().includes('[CardCinema]'))errors.push(m.text());});
 await page.evaluate(()=>{const item={id:'wind-preview',type:'wind',source:'Visual QA',place:'Rajadas de vento — São Paulo',coords:[-46.63,-23.55],windKmh:150,sev:3,time:Date.now(),bandeira:'🇧🇷'};globalAlerts=[item];upsertAlert(item);showAlertDetails(item,false);clearTimeout(cycleTimeout);clearTimeout(window.__mgRadarDelayT);clearTimeout(window.__mgWaveDelayT);});
 await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-scene','wind');
 await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-renderer','film');
 const video=page.locator('.pd-cinema-footage');await expect(video).toHaveAttribute('src','media/card-fx/gale-canopy.mp4');await expect.poll(()=>video.evaluate(v=>v.readyState>=2&&!v.paused),{timeout:12000}).toBe(true);
 await expect(page.locator('.pd-gale-field')).toHaveCount(1);await expect(page.locator('.pd-cinema-drop,.pd-weather-lens')).toHaveCount(0);
 await expect(page.locator('#pd-local')).toContainText('Rajadas de vento');
 const hit=()=>page.locator('#pd-focus-btn').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#pd-focus-btn')===el;});
 await expect.poll(hit).toBe(true);
 await page.waitForFunction(()=>parseFloat(document.getElementById('painel-direito').style.getPropertyValue('--pd-wind-pressure'))>.5);
 const bounds=async()=>page.locator('#painel-direito').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,viewport:innerWidth};});
 const peakBounds=await bounds();expect(peakBounds.left).toBeGreaterThanOrEqual(-1);expect(peakBounds.right).toBeLessThanOrEqual(peakBounds.viewport+1);
 await page.screenshot({path:'/tmp/wind-scene-'+width+'.png'});
 if(width===390){await page.evaluate(()=>{document.body.classList.remove('mobile-details-mid');document.body.classList.add('mobile-details-open');});await page.waitForTimeout(450);const expandedBounds=await bounds();expect(expandedBounds.left).toBeGreaterThanOrEqual(-1);expect(expandedBounds.right).toBeLessThanOrEqual(expandedBounds.viewport+1);await page.screenshot({path:'/tmp/wind-scene-expanded-'+width+'.png'});}
 await expect.poll(()=>page.locator('#painel-direito').evaluate(el=>parseFloat(el.style.getPropertyValue('--pd-wind-pressure'))),{timeout:12000}).toBeLessThan(.18);
 await page.screenshot({path:'/tmp/wind-scene-calm-'+width+'.png'});expect(errors).toEqual([]);
 await page.evaluate(()=>CinematicCard.stop());await expect(page.locator('.pd-cinema-contact,.pd-fx-windletter')).toHaveCount(0);
 await expect(page.locator('#pd-local')).toContainText('Rajadas de vento');await expect.poll(hit).toBe(true);
});
