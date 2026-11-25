const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block',reducedMotion:'reduce'});
test('current share image keeps population in the panel but excludes verbose exposure from export',async({page})=>{
 const base=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';
 await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.goto(base+'/?verify=site-concept6-v1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{
  pausarBuscas();clearTimeout(cycleTimeout);window.__storyTexts=[];window.__mapDraws=0;
  const fill=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(text,...args){
   if(this.canvas.width===1080)__storyTexts.push(String(text));
   return fill.call(this,text,...args);
  };
  const draw=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(...args){
   if(this.canvas.width===1080&&this.canvas.height===1920)__mapDraws++;
   return draw.apply(this,args);
  };
 });
 const exposure={status:'available',method:'pager',provider:'USGS PAGER',ranges:[{population:123456},{population:12345},{population:1000}]};
 await page.route('**/population-exposure?**',r=>r.fulfill({json:exposure}));
 await page.route('https://server.arcgisonline.com/**',r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')}));
 await page.evaluate(()=>{
  const q={id:'story-major',type:'earthquake',mag:8,depth:33,time:Date.now(),coords:[-80.75,7.54],place:'Panamá',source:'QA'};
  globalEvents=[q];showEventDetails(0,false);clearTimeout(cycleTimeout);
 });
 await expect(page.locator('#pd-grid-exposure')).toContainText('123');
 await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true});});
 const download=page.waitForEvent('download');await page.locator('#pd-share-btn').click();await download;
 const texts=await page.evaluate(()=>__storyTexts.join(' '));
 // Integer and decimal magnitude labels convey the same supplied M8 event.
 expect(texts).toMatch(/(?:^|\s)M8(?:[,.]0)?(?=\s|$)/);
 // This fixture supplies no tsunami bulletin; do not demand an invented warning.
 expect(texts).not.toContain('AVISO DE TSUNAMI');
 // The current Concept 6 uses a graphic brand/epicenter marker and an optional engraved regional map; these are not canvas text. Keep assertions on the actual textual metadata and the current Telegram handle.
 for(const needle of ['SISMO','PROFUNDIDADE','INTENSIDADE EST.','argosorbis.com.br','Telegram · @argosorbis'])expect(texts).toContain(needle);
 for(const removed of ['123.456','VI+:','USGS PAGER','POPULAÇÃO POTENCIALMENTE EXPOSTA','COMO LER O MAPA · INTENSIDADE LOCAL','PESSOAS QUE PODEM TER SENTIDO','ALCANCE DA ONDA','CIDADES PRÓXIMAS','Animação do sismo','Replay do mapa'])expect(texts).not.toContain(removed);
 // Concept 6 loads StoryInter and StorySerif; StoryRajdhani is a legacy font no longer used by this renderer.
 expect(await page.evaluate(()=>[...document.fonts].some(f=>f.family==='StoryInter'&&f.status==='loaded'))).toBe(true);
 expect(await page.evaluate(()=>[...document.fonts].some(f=>f.family==='StorySerif'&&f.status==='loaded'))).toBe(true);
 expect(await page.evaluate(()=>__mapDraws)).toBeGreaterThan(0);
});
