const {test,expect}=require('@playwright/test');require('./helpers/card-renderer-fixture.cjs')(test);test.use({reducedMotion:'reduce'});
const raw=require('./fixtures/cyclone-jma-champi.json');
for(const width of [1280,390])test('cyclone card and JMA route stay factual, interactive and isolated '+width,async({page})=>{
 await page.setViewportSize({width,height:900});await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort());await page.goto('/');await page.waitForFunction(()=>window.__cardRendererFixtureReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(({raw})=>{
  pausarBuscas();clearTimeout(cycleTimeout);stopMapCamera();stopWaveFront();window.__jmaRequests=[];
  const now=Date.now();raw[0].issue.UTC=new Date(now).toISOString();for(const r of raw)if(r.validtime)r.validtime.UTC=new Date(now+r.advancedHours*3600000).toISOString();
  fetchWithCorsFallback=async url=>{if(!String(url).startsWith('https://www.jma.go.jp/bosai/typhoon/data/'))return new Response('{}',{status:200});__jmaRequests.push(url);return new Response(JSON.stringify(url.endsWith('targetTc.json')?[{tropicalCyclone:'TC2636',issue:new Date(now).toISOString()}]:raw),{status:200});};
  const q={id:'card-quake',type:'earthquake',source:'QA',mag:3,depth:10,time:now,coords:[130,18],place:'Teste'};globalEvents=[q];const t={id:'card-typhoon',type:'hurricane',source:'GDACS',windKmh:175,pressureMb:960,movementInfo:{compass:'NO',speedKmh:18},time:now,coords:[130.1,18.1],place:'CHAMPI',cycloneLabel:'Tufão'};globalAlerts=[t];lastMerged=[t,q];showAlertDetails(t,false);clearTimeout(cycleTimeout);document.body.classList.add('mobile-details-open');
 },{raw});
 await expect(page.locator('#pd-cyclone-card')).toContainText('175 km/h');await expect(page.locator('#pd-cyclone-card')).toContainText('960 hPa');await expect(page.locator('#pd-cyclone-card')).toContainText('NO · 18 km/h');
 await expect(page.locator('#pd-cyclone-card')).toContainText('+45 h');await expect(page.locator('#pd-cyclone-card')).toContainText('JMA');await expect(page.locator('#cyclone-map-legend')).toContainText('não são a área dos ventos');
 expect(await page.evaluate(()=>map.getPaintProperty('cyclone-jma-forecast-line','line-dasharray'))).toEqual([2,2]);
 expect(await page.evaluate(()=>__jmaRequests.length)).toBe(2);expect(await page.locator('.cyclone-forecast-pin').count()).toBeLessThanOrEqual(12);
 if(width===390){await page.evaluate(()=>abrirPainelDetalhesMobile());await expect(page.locator('#pd-cyclone-card .cyclone-card-wind')).toBeVisible();await expect(page.locator('#pd-gauge-wrap')).toBeHidden();await expect(page.locator('#painel-direito>.stats-grid')).toBeHidden();await page.evaluate(()=>alternarPainelDetalhesMobile());}await page.evaluate(()=>document.getElementById('painel-direito').scrollTop=0);await page.screenshot({path:'/tmp/cyclone-card-initial-'+width+'.png'});
 if(width===390)await page.evaluate(()=>{abrirPainelDetalhesMobile();alternarPainelDetalhesMobile();});
 await expect(page.locator('#pd-cyclone-card')).toBeVisible();await page.locator('.cyclone-card-timeline button').filter({hasText:'+45 h'}).click();await expect(page.locator('.cyclone-route-popup')).toContainText('Posição publicada · JMA');await expect(page.locator('.cyclone-route-popup')).not.toContainText('165');
 await page.evaluate(()=>CycloneRouteCard.refresh());expect(await page.evaluate(()=>__jmaRequests.length)).toBe(2);
 await page.evaluate(()=>document.getElementById('painel-direito').scrollTop=0);await page.screenshot({path:'/tmp/cyclone-card-'+width+'.png'});
 await page.evaluate(()=>{const t={id:'card-no-wind',type:'hurricane',source:'GDACS',time:Date.now(),coords:[-160,-20],place:'Ciclone tropical Wati',cycloneLabel:'Ciclone'};globalAlerts=[t];showAlertDetails(t,false);clearTimeout(cycleTimeout);if(innerWidth<700){abrirPainelDetalhesMobile();alternarPainelDetalhesMobile();}});
 await expect(page.locator('#pd-local')).toHaveText('Ciclone tropical Wati');
 await expect(page.locator('.cyclone-card-wind')).toHaveText('Não informado');
 expect(await page.locator('.cyclone-card-hero').evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
 expect(await page.locator('.cyclone-card-wind').evaluate(n=>parseFloat(getComputedStyle(n).fontSize))).toBeLessThanOrEqual(18);
 await page.evaluate(()=>{showEventDetails(0,false);clearTimeout(cycleTimeout);});await expect(page.locator('#pd-cyclone-card')).toHaveCount(0);await expect(page.locator('#painel-direito')).not.toHaveClass(/pd-cyclone/);await expect(page.locator('#cyclone-map-legend')).toHaveCount(0);expect(await page.evaluate(()=>!!map.getSource('cyclone-jma'))).toBe(false);
 await expect(page.locator('#pd-mag')).toContainText('3');
});
test('JMA loader deduplicates concurrent consumers, caches failures and skips unsupported records',async({page})=>{
 await page.route('**/cyclone-loader-test',r=>r.fulfill({contentType:'text/html',body:'<script src="/js/cyclone-route-model.js"></script><script src="/js/cyclone-jma.js"></script>'}));await page.goto('/cyclone-loader-test');
 const result=await page.evaluate(async raw=>{let count=0;const now=Date.now();raw[0].issue.UTC=new Date(now).toISOString();fetchWithCorsFallback=async url=>{count++;await new Promise(resolve=>setTimeout(resolve,5));return new Response(JSON.stringify(url.endsWith('targetTc.json')?[{tropicalCyclone:'TC2636',issue:new Date(now).toISOString()}]:raw),{status:200});};const q={id:'loader',type:'hurricane',place:'CHAMPI',coords:[130,18]};const all=await Promise.all(Array.from({length:20},()=>CycloneJMA.load(q)));const before=count;await CycloneJMA.load(q);await CycloneJMA.load({...q,id:'mismatch',place:'OTHER'});await CycloneJMA.load({...q,id:'mismatch',place:'OTHER'});const after=count;await CycloneJMA.load({...q,coords:[-45,20]});await CycloneJMA.load({...q,coneUrl:'https://example.invalid/nhc.kmz'});return {before,after,final:count,all:all.every(p=>p?.provider==='JMA')};},raw);
 expect(result).toEqual({before:2,after:3,final:3,all:true});
});
