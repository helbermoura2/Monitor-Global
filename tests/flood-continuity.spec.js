const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
for(const width of [1280,390])test('enchente sobe, faz letras boiarem e devolve o cartão aos 16 segundos '+width,async({page})=>{
 test.setTimeout(120000);
 await page.addInitScript(()=>{window.__floodVideoCopies=0;const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(source,...args){if(source instanceof HTMLVideoElement)__floodVideoCopies++;return draw.call(this,source,...args);};});
 const site=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';
 await page.route('**/*',r=>new URL(r.request().url()).hostname===new URL(site).hostname?r.continue():r.abort());
 await page.setViewportSize({width,height:844});await page.goto(site+'/?verify=flood-rise-'+Date.now(),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&!!window.CardFloodRise);
 await page.evaluate(()=>{pausarBuscas();globalEvents=[];pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();});
 await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 await page.evaluate(()=>{const item={id:'continuous-flood',type:'flood',place:'Enchente — boletim de teste 🇧🇷',source:'QA',coords:[-46.63,-23.55],time:Date.now(),sev:3};globalAlerts=[item];upsertAlert(item);showAlertDetails(item,false);clearTimeout(cycleTimeout);clearTimeout(window.__mgRadarDelayT);clearTimeout(window.__mgWaveDelayT);if(innerWidth<900){document.body.classList.remove('mobile-details-mid');document.body.classList.add('mobile-details-open');}});
 await page.clock.runFor(1800);
 const video=page.locator('.pd-cinema-footage');await expect(video).toHaveCount(1);await expect(video).toHaveAttribute('src','media/card-fx/flood-current.mp4');await expect.poll(()=>video.evaluate(v=>v.readyState>=2&&!v.paused)).toBe(true);await expect(video).toHaveCSS('clip-path','none');
 const first=await video.elementHandle();
 const early=await page.locator('#painel-direito').evaluate(p=>({top:parseFloat(p.style.getPropertyValue('--pd-water-top')),dry:!p.querySelector('#pd-local').classList.contains('pd-water-submerged')}));expect(early.top).toBeGreaterThan(90);expect(early.dry).toBe(true);
 await page.clock.fastForward(4800);await page.clock.runFor(400);const middle=await page.locator('#painel-direito').evaluate(p=>parseFloat(p.style.getPropertyValue('--pd-water-top')));expect(middle).toBeLessThan(early.top-40);
 await page.evaluate(()=>{const item={...EventStore.getSelected(),place:'Boletim atualizado 🇧🇷'};upsertAlert(item);showAlertDetails(item,false,true);clearTimeout(cycleTimeout);});
 await page.clock.runFor(1800);await page.clock.fastForward(1300);await page.clock.runFor(600);expect(await first.evaluate(v=>v.isConnected)).toBe(true);
 const late=await page.locator('#painel-direito').evaluate(p=>({top:parseFloat(p.style.getPropertyValue('--pd-water-top')),wet:p.querySelector('#pd-local').classList.contains('pd-water-submerged'),moving:Array.from(p.querySelectorAll('#pd-local .pd-fx-windletter')).some(l=>{const m=new DOMMatrix(getComputedStyle(l).transform);return Math.abs(m.m41)>2||Math.abs(m.m42)>2;})}));expect(late.top).toBeLessThan(10);expect(late.wet,JSON.stringify(late)).toBe(true);expect(late.moving,JSON.stringify(late)).toBe(true);
 await expect(page.locator('#pd-local')).toContainText('Boletim atualizado 🇧🇷');
 expect(await page.locator('#pd-focus-btn').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#pd-focus-btn')===el;})).toBe(true);
 const box=await page.locator('#painel-direito').boundingBox();await page.screenshot({path:'/tmp/flood-continuous-'+width+'.png',clip:box});expect(await page.evaluate(()=>__floodVideoCopies)).toBe(0);
 await page.clock.fastForward(5400);await page.clock.runFor(100);await expect(page.locator('.pd-cinema-layer,.pd-weather-material,.pd-fx-windletter,.pd-water-submerged')).toHaveCount(0);await expect(page.locator('#painel-direito')).not.toHaveClass(/pd-fx-flood/);expect(await page.locator('#painel-direito').evaluate(p=>p.style.getPropertyValue('--pd-water-top'))).toBe('');await expect(page.locator('#pd-local')).toContainText('Boletim atualizado 🇧🇷');
 // A silent bulletin after expiry must not start a new flood.
 await page.evaluate(()=>CinematicCard.refresh(EventStore.getSelected()));await page.clock.runFor(500);await expect(page.locator('.pd-cinema-layer')).toHaveCount(0);
 await page.evaluate(()=>CardEffectDemo.preview('flood'));await expect(page.locator('#card-fx-demo-status')).toContainText('16 s');await page.clock.fastForward(16100);await page.clock.runFor(100);await expect(page.locator('.pd-cinema-layer,#card-fx-demo-status,.pd-fx-windletter')).toHaveCount(0);expect(await page.evaluate(()=>CardEffectDemo.isActive())).toBe(false);
});
