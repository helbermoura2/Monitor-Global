const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
for(const width of [1280,390])test('tsunami invade o cartão com uma cena única e mantém o evento ativo '+width,async({page})=>{
 test.setTimeout(120000);
 await page.addInitScript(()=>{
  window.__tsunamiVideoCopies=0;const draw=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(source,...args){if(source instanceof HTMLVideoElement)__tsunamiVideoCopies++;return draw.call(this,source,...args);};
 });
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.setViewportSize({width,height:844});await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&!!window.CardEffectDemo);
 await page.evaluate(()=>{
  const item={id:'continuous-tsunami',type:'tsunami',place:'Tsunami — boletim de teste',source:'QA',coords:[-46.63,-23.55],time:Date.now(),sev:3};
  globalAlerts=[item];upsertAlert(item);showAlertDetails(item,false);clearTimeout(cycleTimeout);clearTimeout(window.__mgRadarDelayT);clearTimeout(window.__mgWaveDelayT);
  if(innerWidth<900){document.body.classList.remove('mobile-details-mid');document.body.classList.add('mobile-details-open');}
 });
 const video=page.locator('.pd-cinema-footage');await expect(video).toHaveCount(1);await expect(video).toHaveAttribute('src','media/card-fx/tsunami-inundation.mp4');
 await expect.poll(()=>video.evaluate(v=>v.readyState>=2&&!v.paused)).toBe(true);await expect(video).toHaveCSS('clip-path','none');
 await expect.poll(()=>page.locator('.pd-cinema-film').evaluate(c=>{const gl=c.getContext('webgl'),pixels=new Uint8Array(4);gl.readPixels(Math.floor(c.width/2),Math.floor(c.height/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels[3];})).toBe(0);
 // Buffering keeps the last displayed frame, rather than revealing a second water scene.
 await video.evaluate(v=>Object.defineProperty(v,'readyState',{value:1,configurable:true}));await page.waitForTimeout(250);
 expect(await page.locator('.pd-cinema-film').evaluate(c=>{const gl=c.getContext('webgl'),p=new Uint8Array(4);gl.readPixels(c.width>>1,c.height>>1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return p[3];})).toBe(0);
 await video.evaluate(v=>{delete v.readyState;});
 await expect.poll(()=>page.locator('.pd-weather-material').evaluate(c=>!c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0))).toBe(true);
 const before=await video.evaluate(v=>v.currentTime);await expect.poll(()=>video.evaluate((v,t)=>Math.abs(v.currentTime-t)>.15,before)).toBe(true);
 // Real atmospheric scenes remain active beyond the Menu's 20-second preview.
 await page.clock.install();await page.clock.fastForward(21000);
 await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-demo','false');await expect(video).toHaveCount(1);
 const first=await video.elementHandle();
 await page.evaluate(()=>{const item={...EventStore.getSelected(),place:'Boletim atualizado'};upsertAlert(item);showAlertDetails(item,false,true);clearTimeout(cycleTimeout);});
 expect(await first.evaluate(v=>v.isConnected)).toBe(true);await expect(page.locator('#pd-local')).toContainText('Boletim atualizado');
 const text=await page.locator('#pd-local').textContent();await page.evaluate(()=>CardEffectDemo.preview('tsunami'));await expect.poll(()=>video.evaluate(v=>v.readyState>=2&&!v.paused)).toBe(true);await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-demo','true');
 // A demonstração mostra seu próprio texto (não o do evento real por baixo) -- ver CardEffectDemo.preview().
 expect(await page.locator('#pd-local').textContent()).toBe('Demonstração · Tsunami');await expect(video).toHaveCount(1);await expect(video).toHaveCSS('clip-path','none');
 expect(await page.evaluate(()=>__tsunamiVideoCopies)).toBe(0);
 const {duration,...attributes}=await video.evaluate(v=>({muted:v.muted,loop:v.loop,inline:v.playsInline,width:v.videoWidth,height:v.videoHeight,duration:v.duration}));
 expect(attributes).toEqual({muted:true,loop:true,inline:true,width:432,height:768});expect(duration).toBeCloseTo(8.68,1);
 await video.evaluate(v=>{v.currentTime=v.duration-.35;});await expect.poll(()=>video.evaluate(v=>v.currentTime<1&&!v.paused),{timeout:12000,intervals:[50,100,200]}).toBe(true);
 expect(await video.evaluate(v=>{const r=v.getBoundingClientRect(),p=document.getElementById('painel-direito');return Math.abs(r.height-p.clientHeight)<1&&r.width>=p.clientWidth-1;})).toBe(true);
 // Item de demonstração não tem coords reais -- "focar no mapa" ficaria sem destino, então o botão some (mesmo tratamento de qualquer alerta regional sem localização verificada).
 await expect(page.locator('#pd-focus-btn')).toBeHidden();
 await video.evaluate(v=>{v.currentTime=4;});await expect.poll(()=>video.evaluate(v=>!v.seeking)).toBe(true);
 await page.locator('#painel-direito').screenshot({path:'/tmp/tsunami-inundation-'+width+'.png'});
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.pd-cinema-footage,.pd-cinema-layer,.pd-weather-material')).toHaveCount(0);
 await expect(page.locator('#pd-local')).toHaveText(text);
});
