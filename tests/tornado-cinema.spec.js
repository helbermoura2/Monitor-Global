const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
test.use({serviceWorkers:'block'});
for(const width of [1280,390])test('circulação do tornado alterna a carga e conserva grafemas e métricas sem GPU '+width,async({page})=>{
 await page.setViewportSize({width,height:844});
 await page.setContent('<body class="mobile-details-mid"><div id="painel-direito" style="position:absolute;left:20px;top:25px;width:320px;height:620px;background:#202a25;border:1px solid #777;border-radius:16px;isolation:isolate"><div id="pd-local" style="margin:80px 25px;color:white;font:600 18px system-ui">Tornado — São Paulo 🇧🇷</div><div id="pd-source" style="margin:24px;color:white">Defesa Civil · fonte oficial</div><div class="stat-card" style="margin:24px;color:white"><span class="stat-card-label">Intensidade</span><span class="stat-card-value"><b style="color:rgb(240, 210, 120)">150</b> km/h</span></div><button id="control" style="margin:24px">Detalhes</button></div></body>');
 for(const file of ['painel-fx.css','cinematic-card.css','tornado-cinema.css','advanced-weather.css'])await page.addStyleTag({content:fs.readFileSync(path.join(__dirname,'../css',file),'utf8')});
 await page.evaluate(()=>{window.__frame=null;window.requestAnimationFrame=cb=>{__frame=cb;return 1;};window.cancelAnimationFrame=()=>{__frame=null;};window.CardCinemaFilm={create:()=>null,footage:()=>null};});
 for(const file of ['painel-fx.js','card-effect-quality.js','card-tornado-field.js','card-weather-physics.js','cinematic-card.js'])await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../js',file),'utf8')});
 const original=await page.locator('#painel-direito').innerText();
 const state=await page.evaluate(()=>{
  const begin=performance.now();CinematicCard.start({id:'isolated-tornado',type:'tornado',windKmh:150},Infinity);
  let left=0,right=0,title=0,lift=0,secondary=0,paint=false;
  for(let i=1;i<=420;i++){
   __frame(begin+i*33.34);const p=document.getElementById('painel-direito'),x=parseFloat(p.style.getPropertyValue('--pd-wind-x'));left=Math.min(left,x);right=Math.max(right,x);
   for(const el of document.querySelectorAll('#pd-local .pd-fx-windletter')){const m=new DOMMatrixReadOnly(getComputedStyle(el).transform);title=Math.max(title,Math.abs(m.m41));lift=Math.max(lift,Math.abs(m.m42));}
   for(const el of document.querySelectorAll('#pd-source .pd-fx-windletter,.stat-card .pd-fx-windletter'))secondary=Math.max(secondary,Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m41));
  }
  const c=document.querySelector('.pd-tornado-field');paint=c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>15);
  return {left,right,title,lift,secondary,paint,flags:Array.from(document.querySelectorAll('#pd-local .pd-fx-windletter')).filter(el=>el.textContent==='🇧🇷').length};
 });
 expect(state.left).toBeLessThan(-1);expect(state.right).toBeGreaterThan(1);expect(Math.max(-state.left,state.right)).toBeLessThan(width===390?4.5:6.5);expect(state.title).toBeGreaterThan(10);expect(state.lift).toBeGreaterThan(4);expect(state.secondary).toBeGreaterThan(2);expect(state.secondary).toBeLessThan(state.title);expect(state.flags).toBe(1);expect(state.paint).toBe(true);
 expect(await page.locator('#painel-direito').innerText()).toBe(original);await expect(page.locator('.stat-card-value b')).toHaveCSS('color','rgb(240, 210, 120)');await expect(page.locator('.pd-fx-letter-blown')).toHaveCount(0);await expect(page.locator('.pd-tornado-field')).toHaveCount(1);await page.locator('#control').click();
 await page.evaluate(()=>document.getElementById('pd-local').textContent='Tornado — boletim atualizado 🇧🇷');await expect.poll(()=>page.locator('#pd-local .pd-fx-windletter').count()).toBeGreaterThan(10);
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.pd-cinema-layer,.pd-cinema-contact,.pd-tornado-field,.pd-tornado-reserve,.pd-fx-windletter')).toHaveCount(0);await expect(page.locator('#pd-local')).toHaveText('Tornado — boletim atualizado 🇧🇷');expect(await page.locator('#painel-direito').evaluate(p=>Array.from(p.style).filter(k=>k.startsWith('--pd-wind-')))).toEqual([]);await page.locator('#control').click();
});
async function captureCard(page,options){
 const r=await page.locator('#painel-direito').boundingBox(),v=page.viewportSize();const x=Math.max(0,r.x),y=Math.max(0,r.y);
 await page.screenshot({...options,clip:{x,y,width:Math.min(r.width,v.width-x),height:Math.min(r.height,v.height-y)}});
}
async function boot(page,width=1280,controlled=false){
 await page.setViewportSize({width,height:844});await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.fallback():r.abort());await page.goto('/',{waitUntil:'domcontentloaded'});await page.evaluate(()=>OptionalFeatures.effect("tornado"));await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&!!window.CardTornadoField);
 if(controlled){await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));}
 await page.evaluate(()=>{const item={id:'real-tornado-qa',type:'tornado',source:'Defesa Civil',place:'Tornado — São Paulo 🇧🇷',coords:[-46.63,-23.55],time:Date.now(),sev:3};globalAlerts=[item];upsertAlert(item);showAlertDetails(item,false);clearTimeout(cycleTimeout);clearTimeout(window.__mgRadarDelayT);clearTimeout(window.__mgWaveDelayT);});
 if(controlled)await page.clock.runFor(1800);
}
for(const width of [1280,390])test('tornado real usa cena única e circulação, mantém revisão, controles e pausa '+width,async({page})=>{
 test.setTimeout(150000);
 await page.addInitScript(()=>{window.__tornadoVideoCopies=0;const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(source,...args){if(source instanceof HTMLVideoElement)__tornadoVideoCopies++;return draw.call(this,source,...args);};});
 await boot(page,width,true);const errors=[];page.on('pageerror',e=>{if(e.message!=='Failed to fetch')errors.push(e.message);});
 const video=page.locator('.pd-cinema-footage');await expect(video).toHaveCount(1);await expect(video).toHaveAttribute('src','media/card-fx/tornado-vortex.mp4');await expect.poll(()=>video.evaluate(v=>v.readyState>=2&&!v.paused),{timeout:15000}).toBe(true);await expect(video).toHaveCSS('clip-path','none');await page.clock.runFor(100);await expect(page.locator('.pd-tornado-field')).toHaveCount(1);await expect(page.locator('.pd-cinema-drop,.pd-weather-lens,.pd-fx-letter-blown')).toHaveCount(0);await expect(page.locator('#pd-local')).toContainText('São Paulo',{timeout:20000});
 const attrs=await video.evaluate(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration,muted:v.muted,loop:v.loop,inline:v.playsInline}));expect(attrs).toEqual({width:432,height:768,duration:7,muted:true,loop:true,inline:true});
 const original=await video.elementHandle(),field=await page.locator('.pd-tornado-field').elementHandle();
 await page.evaluate(()=>{const item={...EventStore.getSelected(),place:'Tornado — boletim atualizado 🇧🇷',sev:2};upsertAlert(item);showAlertDetails(item,false,true);clearTimeout(cycleTimeout);});await page.clock.runFor(1800);await expect(page.locator('#pd-local')).toContainText('boletim atualizado',{timeout:20000});expect(await original.evaluate(v=>v.isConnected)).toBe(true);expect(await field.evaluate(c=>c.isConnected)).toBe(true);
 const alpha=()=>page.locator('.pd-cinema-film').evaluate(c=>{const gl=c.getContext('webgl'),p=new Uint8Array(4);gl.readPixels(c.width>>1,c.height>>1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return p[3];});await expect.poll(alpha).toBeLessThan(20);await video.evaluate(v=>Object.defineProperty(v,'readyState',{value:1,configurable:true}));await page.clock.runFor(250);expect(await alpha()).toBeLessThan(20);await video.evaluate(v=>{delete v.readyState;v.currentTime=v.duration-.35;});await expect.poll(()=>video.evaluate(v=>v.currentTime<1&&!v.paused),{timeout:12000}).toBe(true);
 const safe=async()=>{const r=await page.locator('#painel-direito').evaluate(p=>{const r=p.getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth,coverage:Math.abs(document.querySelector('.pd-cinema-footage').offsetHeight-p.clientHeight)<1};});expect(r.left).toBeGreaterThanOrEqual(-1);expect(r.right).toBeLessThanOrEqual(r.width+1);expect(r.coverage).toBe(true);expect(await page.locator('#pd-focus-btn').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#pd-focus-btn')===el;})).toBe(true);};
 await safe();await page.screenshot({path:'/tmp/tornado-scene-'+width+'.png'});
 if(width===390){await page.evaluate(()=>{document.body.classList.remove('mobile-details-mid');document.body.classList.add('mobile-details-open');});await page.clock.runFor(500);await safe();}await captureCard(page,{path:'/tmp/tornado-card-'+width+'.png'});
 await page.evaluate(()=>document.getElementById('painel-direito').classList.add('pd-flip-girado'));await page.clock.runFor(100);await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(true);await page.evaluate(()=>document.getElementById('painel-direito').classList.remove('pd-flip-girado'));await page.clock.runFor(100);await expect.poll(()=>video.evaluate(v=>!v.paused)).toBe(true);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.runFor(100);await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(true);await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await page.clock.runFor(100);await expect.poll(()=>video.evaluate(v=>!v.paused)).toBe(true);
 await page.clock.fastForward(16100);await page.clock.runFor(100);await expect(page.locator('.pd-cinema-layer')).toHaveCount(0);expect(await page.evaluate(()=>__tornadoVideoCopies)).toBe(0);
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.pd-cinema-layer,.pd-cinema-contact,.pd-fx-windletter')).toHaveCount(0);expect(await original.evaluate(v=>({connected:v.isConnected,paused:v.paused,src:v.getAttribute('src')}))).toEqual({connected:false,paused:true,src:null});await expect(page.locator('#pd-local')).toContainText('boletim atualizado');expect(errors).toEqual([]);
});
for(const gpu of [true,false])test('falha da filmagem do tornado conserva fotografia, texto e controles '+(gpu?'GPU':'2D'),async({page})=>{
 if(!gpu)await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args);};});
 await page.route('**/media/card-fx/tornado-vortex.mp4',r=>r.abort());await boot(page);await expect(page.locator('#pd-local')).toContainText('São Paulo',{timeout:20000});await expect(page.locator('.pd-tornado-field')).toHaveCount(1);
 if(gpu){await expect(page.locator('.pd-cinema-film')).toHaveAttribute('data-texture','tornado-vortex');await expect.poll(()=>page.locator('.pd-cinema-film').evaluate(c=>{const gl=c.getContext('webgl'),p=new Uint8Array(4);gl.readPixels(c.width>>1,c.height>>1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return p[3];})).toBeGreaterThan(200);}
 else{await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-renderer','layers');await expect.poll(()=>page.locator('.pd-tornado-reserve').evaluate(c=>c.getContext('2d').getImageData(c.width>>1,c.height>>1,1,1).data[3])).toBeGreaterThan(200);}
 expect(await page.locator('#pd-focus-btn').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#pd-focus-btn')===el;})).toBe(true);await captureCard(page,{path:'/tmp/tornado-fallback-'+(gpu?'gpu':'2d')+'.png'});await page.evaluate(()=>CinematicCard.stop());await expect(page.locator('.pd-tornado-field,.pd-tornado-reserve,.pd-cinema-footage,.pd-fx-windletter')).toHaveCount(0);
});
