const {test,expect}=require('@playwright/test');test.use({serviceWorkers:'block',reducedMotion:'reduce'});
test('Story includes exposure bands and draws the land footprint at the epicenter',async({page})=>{
 const base=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.goto(base+'/?verify=20261009-quake-image-tsunami',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);window.__storyTexts=[];window.__painted=false;const fill=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(this.canvas.width===1080)__storyTexts.push(String(text));return fill.call(this,text,...args);};const paint=CanvasRenderingContext2D.prototype.putImageData;CanvasRenderingContext2D.prototype.putImageData=function(...args){if(this.canvas.width===800&&this.canvas.height===820)__painted=true;return paint.apply(this,args);};});
 const exposure={status:'available',method:'pager',provider:'USGS PAGER',ranges:[{population:123456},{population:12345},{population:1000}]};
 await page.route('**/population-exposure?**',r=>r.fulfill({json:exposure}));
 // Solid local satellite substitute keeps PNG export deterministic and cannot contact Telegram.
 await page.route('https://server.arcgisonline.com/**',r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')}));
 await page.evaluate(()=>{const q={id:'story-major',type:'earthquake',mag:8,depth:33,time:Date.now(),coords:[-80.75,7.54],place:'Panamá',source:'QA'};globalEvents=[q];showEventDetails(0,false);clearTimeout(cycleTimeout);});
 await expect(page.locator('#pd-grid-exposure')).toContainText('123');
 await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true});});
 const download=page.waitForEvent('download');await page.locator('#pd-share-btn').click();await download;
 const texts=await page.evaluate(()=>__storyTexts.join(' '));expect(texts).toContain('123.456');expect(texts).toContain('VI+');expect(texts).toContain('USGS PAGER');expect(texts).not.toContain('PESSOAS QUE PODEM TER SENTIDO');expect(texts).not.toContain('ALCANCE DA ONDA');expect(texts).not.toContain('CIDADES PRÓXIMAS');expect(texts).toContain('MAGNITUDE DO SISMO');expect(await page.evaluate(()=>__painted)).toBe(true);
});
