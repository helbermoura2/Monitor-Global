const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block',reducedMotion:'reduce'});
test('Concept 6 keeps land intensity on the map but removes verbose exposure from share image',async({page})=>{
 const base=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';
 await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.goto(base+'/?verify=site-concept6-v1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{
  pausarBuscas();clearTimeout(cycleTimeout);window.__storyTexts=[];window.__painted=false;
  const fill=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(text,...args){
   if(this.canvas.width===1080)__storyTexts.push(String(text));
   return fill.call(this,text,...args);
  };
  const paint=CanvasRenderingContext2D.prototype.putImageData;
  CanvasRenderingContext2D.prototype.putImageData=function(...args){
   if(this.canvas.width===1080&&this.canvas.height>1000&&this.canvas.height<1900)__painted=true;
   return paint.apply(this,args);
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
 for(const needle of ['MONITOR GLOBAL','M8,0','SISMO','CONTEXTO REGIONAL','EPICENTRO','PROFUNDIDADE','INTENSIDADE EST.','TSUNAMI','monitorglobal.top','Telegram · @monitor_global'])expect(texts).toContain(needle);
 for(const removed of ['123.456','VI+:','USGS PAGER','POPULAÇÃO POTENCIALMENTE EXPOSTA','COMO LER O MAPA · INTENSIDADE LOCAL','PESSOAS QUE PODEM TER SENTIDO','ALCANCE DA ONDA','CIDADES PRÓXIMAS','Animação do sismo','Replay do mapa'])expect(texts).not.toContain(removed);
 expect(await page.evaluate(()=>[...document.fonts].some(f=>f.family==='MonitorGlobalRajdhani'&&f.status==='loaded'))).toBe(true);
 expect(await page.evaluate(()=>[...document.fonts].some(f=>f.family==='MonitorGlobalJetBrains'&&f.status==='loaded'))).toBe(true);
 expect(await page.evaluate(()=>__painted)).toBe(true);
});
