const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
async function select(page){
 await page.evaluate(()=>{
  const item={id:'native-gale',type:'wind',place:'Rajadas — teste de publicação',source:'QA',coords:[-46.63,-23.55],time:Date.now(),sev:3,windKmh:150};
  globalAlerts=[item];upsertAlert(item);showAlertDetails(item,false);clearTimeout(cycleTimeout);clearTimeout(window.__mgRadarDelayT);clearTimeout(window.__mgWaveDelayT);
  if(innerWidth<900){document.body.classList.remove('mobile-details-mid');document.body.classList.add('mobile-details-open');}
 });
}
for(const width of [1280,390])test('rajada usa um vídeo e um campo de matéria, preserva revisão e pausa '+width,async({page})=>{
 test.setTimeout(120000);await page.setViewportSize({width,height:844});
 await page.addInitScript(()=>{window.__windCopies=0;const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(source,...args){if(source instanceof HTMLVideoElement)__windCopies++;return draw.call(this,source,...args);};});
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&!!window.CardGaleField);await select(page);
 const video=page.locator('.pd-cinema-footage');await expect(video).toHaveCount(1);await expect(video).toHaveAttribute('src','media/card-fx/gale-canopy.mp4');await expect(page.locator('.pd-gale-field')).toHaveCount(1);await expect(page.locator('.pd-cinema-drop,.pd-weather-lens')).toHaveCount(0);
 await expect.poll(()=>video.evaluate(v=>v.readyState>=2&&!v.paused),{timeout:12000}).toBe(true);await expect(video).toHaveCSS('clip-path','none');
 const {duration,...attrs}=await video.evaluate(v=>({muted:v.muted,loop:v.loop,inline:v.playsInline,width:v.videoWidth,height:v.videoHeight,duration:v.duration}));expect(attrs).toEqual({muted:true,loop:true,inline:true,width:432,height:768});expect(duration).toBeCloseTo(11,1);
 const original=await video.elementHandle();await page.evaluate(()=>{const item={...EventStore.getSelected(),place:'Rajadas — boletim atualizado'};upsertAlert(item);showAlertDetails(item,false,true);clearTimeout(cycleTimeout);});expect(await original.evaluate(el=>el.isConnected)).toBe(true);await expect(page.locator('#pd-local')).toContainText('boletim atualizado',{timeout:20000});
 const alpha=()=>page.locator('.pd-cinema-film').evaluate(c=>{const gl=c.getContext('webgl'),p=new Uint8Array(4);gl.readPixels(c.width>>1,c.height>>1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return p[3];});await expect.poll(alpha).toBeLessThan(20);
 await video.evaluate(v=>Object.defineProperty(v,'readyState',{value:1,configurable:true}));await page.waitForTimeout(250);expect(await alpha()).toBeLessThan(20);await video.evaluate(v=>{delete v.readyState;});
 await video.evaluate(v=>{v.currentTime=v.duration-.35;});await expect.poll(()=>video.evaluate(v=>v.currentTime<1&&!v.paused),{timeout:12000,intervals:[50,100,200]}).toBe(true);
 await page.evaluate(()=>document.getElementById('painel-direito').classList.add('pd-flip-girado'));await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(true);await page.evaluate(()=>document.getElementById('painel-direito').classList.remove('pd-flip-girado'));await expect.poll(()=>video.evaluate(v=>!v.paused)).toBe(true);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(true);await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await expect.poll(()=>video.evaluate(v=>!v.paused)).toBe(true);
 await page.clock.install();await page.clock.fastForward(21000);await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-demo','false');await expect(video).toHaveCount(1);
 expect(await page.evaluate(()=>__windCopies)).toBe(0);await page.locator('#painel-direito').screenshot({path:'/tmp/gale-material-'+width+'.png'});
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.pd-cinema-layer,.pd-gale-field,.pd-cinema-footage,.pd-fx-windletter')).toHaveCount(0);expect(await original.evaluate(v=>({connected:v.isConnected,paused:v.paused,src:v.getAttribute('src')}))).toEqual({connected:false,paused:true,src:null});await expect(page.locator('#pd-local')).toContainText('boletim atualizado',{timeout:20000});
});
test('falha da filmagem da rajada usa a fotografia e conserva o campo e os controles',async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.route('**/media/card-fx/gale-canopy.mp4',r=>r.abort());
 await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&!!window.CardGaleField);await select(page);
 await expect(page.locator('.pd-cinema-film')).toHaveAttribute('data-texture','gale-canopy');await expect(page.locator('.pd-gale-field')).toHaveCount(1);
 await expect.poll(()=>page.locator('.pd-cinema-film').evaluate(c=>{const gl=c.getContext('webgl'),p=new Uint8Array(4);gl.readPixels(c.width>>1,c.height>>1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return p[3];})).toBeGreaterThan(200);
 expect(await page.locator('#pd-focus-btn').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#pd-focus-btn')===el;})).toBe(true);
});
for(const width of [1280,390])test('rajada real e Menu arrancam letras e restauram as lacunas '+width,async({page})=>{
 test.setTimeout(120000);const site=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';
 await page.setViewportSize({width,height:844});await page.route('**/*',r=>new URL(r.request().url()).hostname===new URL(site).hostname?r.continue():r.abort());
 await page.goto(site+'/?verify=flying-letters-'+Date.now(),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&!!window.CardGaleField);
 await page.evaluate(()=>{pausarBuscas();globalEvents=[];pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();});await select(page);
 await expect(page.locator('#pd-local')).toContainText('teste de publicação',{timeout:20000});const original=await page.locator('#pd-local').textContent();
 await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 for(const demo of [false,true]){
  await page.evaluate(demo=>demo?CardEffectDemo.preview('wind'):CinematicCard.start(EventStore.getSelected()),demo);
  await page.clock.fastForward(1300);await page.clock.runFor(300);await page.clock.fastForward(1700);await page.clock.runFor(100);
  const missing=await page.locator('#pd-local').evaluate(el=>{const letters=Array.from(el.querySelectorAll('.pd-fx-windletter'));return {total:letters.length,away:letters.filter(l=>l.dataset.galeFlight==='away'&&getComputedStyle(l).opacity==='0').length};});expect(missing.away).toBeGreaterThan(1);expect(missing.away).toBeLessThan(missing.total*.5);
  await expect(page.locator('.pd-cinema-footage')).toHaveCount(1);await expect(page.locator('#pd-local')).toHaveText(original);
  expect(await page.locator('#pd-focus-btn').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#pd-focus-btn')===el;})).toBe(true);
  if(!demo){const box=await page.locator('#painel-direito').boundingBox();await page.screenshot({path:'/tmp/wind-missing-letters-'+width+'.png',clip:box});}
  await page.clock.fastForward(2200);await page.clock.runFor(300);await expect(page.locator('[data-gale-flight]')).toHaveCount(0);expect(await page.locator('#pd-local .pd-fx-windletter').evaluateAll(letters=>letters.every(l=>getComputedStyle(l).opacity==='1'))).toBe(true);
 }
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.pd-fx-windletter,[data-gale-flight],.pd-gale-field')).toHaveCount(0);await expect(page.locator('#pd-local')).toHaveText(original);
});
