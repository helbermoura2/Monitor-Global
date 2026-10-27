const {test,expect}=require('@playwright/test');
async function boot(page){await page.setViewportSize({width:411,height:806});const png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=256;return c.toDataURL().split(',')[1];}),'base64');await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='127.0.0.1')return r.continue();if(u.hostname==='server.arcgisonline.com'&&u.pathname.includes('/tile/'))return r.fulfill({body:png,contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*'}});return r.abort();});await page.goto('/');await page.waitForFunction(()=>__mgMapReady&&!__fetchGlobalFeedsEmAndamento);await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);EventCamera.cancel();SeismicPaintTour.stop();stopWaveFront();});}
test('native MapLibre spare textures stay bounded; active texture and camera survive; exit releases spares',async({page},testInfo)=>{
 await boot(page);await page.waitForFunction(()=>Object.values(map.style.tileManagers||map.style.sourceCaches||map.style._sourceCaches||{}).some(c=>Object.values(c._tiles||{}).some(t=>t.texture)));
 const result=await page.evaluate(()=>{
  const p=map.painter,caches=Object.values(map.style.tileManagers||map.style.sourceCaches||map.style._sourceCaches||{}),tile=caches.flatMap(c=>Object.values(c._tiles||{})).find(t=>t.texture),active=tile.texture,Texture=active.constructor,gl=p.context.gl,before=map.getCenter().toArray(),zoom=map.getZoom();
  const stock=Object.getPrototypeOf(p).saveTileTexture;
  for(let i=0;i<40;i++)stock.call(p,new Texture(p.context,new ImageData(512,512),gl.RGBA,{useMipmap:true}));
  const stockStats=MapRenderBudget.stats();for(const bin of Object.values(p._tileTextures))while(bin.length)bin.pop().destroy();
  const held=[];for(let i=0;i<40;i++)held.push(new Texture(p.context,new ImageData(512,512),gl.RGBA,{useMipmap:true}));
  for(const texture of held)p.saveTileTexture(texture);
  const stats=MapRenderBudget.stats(),alive=gl.isTexture(active.texture);window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));const cleared=MapRenderBudget.stats();
  return {stockStats,stats,cleared,alive,sameCamera:JSON.stringify(before)===JSON.stringify(map.getCenter().toArray())&&zoom===map.getZoom()};
 });
 const fs=require('node:fs'),crypto=require('node:crypto');const output={method:'Local Chromium, native MapLibre painter and real 512x512 RGBA WebGL textures; stock prototype versus bounded instance. Byte counts are RGBA+mipmap estimates, not measured process/GPU RAM.',rendererSha256:crypto.createHash('sha256').update(fs.readFileSync('vendor/maplibre-gl.js')).digest('hex'),budgetSha256:crypto.createHash('sha256').update(fs.readFileSync('js/map-render-budget.js')).digest('hex'),...result};const path=testInfo.outputPath('texture-pool.json');fs.writeFileSync(path,JSON.stringify(output,null,2)+'\n');await testInfo.attach('native-texture-pool',{path,contentType:'application/json'});
 expect(result.stockStats.estimatedSpareTextureBytes).toBeGreaterThan(50*1024*1024);
 expect(result.alive).toBe(true);expect(result.sameCamera).toBe(true);expect(result.stats.sparePoolBound).toBe(true);expect(result.stats.disposedSpareTextures).toBeGreaterThan(30);expect(result.stats.estimatedSpareTextureBytes).toBeLessThanOrEqual(8*1024*1024);expect(result.cleared.spareTextures).toBe(0);
});
test('external alert values remain text in flag, wind and flood fields',async({page})=>{
 await boot(page);await page.evaluate(()=>{window.__xss=0;const payload='<img src=x onerror="window.__xss++">';window.__mgSoftCycle=true;const a={id:'xss-flood',type:'flood',source:'QA',coords:[165,-14],time:Date.now(),place:payload,bandeira:payload,hazardNature:'warning',warningLevel:payload,detail:payload};globalAlerts=[a];showAlertDetails(a,false);clearTimeout(cycleTimeout);EventCamera.cancel();});
 await expect(page.locator('#pd-mercalli')).toContainText('<img');await expect(page.locator('#pd-mercalli img')).toHaveCount(0);await expect(page.locator('#pd-flag img')).toHaveCount(0);
 await page.evaluate(()=>{const a={...globalAlerts[0],id:'xss-wind',type:'wind',windKmh:'<img src=x onerror="window.__xss++">'};globalAlerts=[a];showAlertDetails(a,false);clearTimeout(cycleTimeout);EventCamera.cancel();});await expect(page.locator('#pd-mercalli img')).toHaveCount(0);expect(await page.evaluate(()=>window.__xss)).toBe(0);
});
test('forecast and voice history do not parse external HTML; cyclone direction updates reuse one row',async({page})=>{
 await boot(page);await page.evaluate(async()=>{
  window.__xss=0;const payload='<img src=x onerror="window.__xss++">';const now=new Date().toISOString(),day=now.slice(0,10);
  RainbowWeather.refresh=async()=>null;fetchWithCorsFallback=async()=>({json:async()=>({daily:{time:[day],temperature_2m_max:[20],temperature_2m_min:[10],weather_code:[2],precipitation_probability_max:[payload],precipitation_sum:[0]},hourly:{time:[now],temperature_2m:[20],weather_code:[2],precipitation_probability:[0],precipitation:[0],wind_gusts_10m:[10]}})});
  await fetchSPForecast();vozHistorico=[{txt:payload,t:Date.now()}];document.getElementById('btn-voz-hist').click();
  eventoSelecionadoId='direction';document.getElementById('pd-cities-title').textContent='Direção';for(let i=0;i<100;i++)atualizarDirecaoPainel({id:'direction',movementInfo:{compass:payload,bearing:i}});
 });
 await expect(page.locator('#fc-strip img')).toHaveCount(0);await expect(page.locator('#menu-float-panel img')).toHaveCount(0);await expect(page.locator('[data-cyclone-direction]')).toHaveCount(1);await expect(page.locator('[data-cyclone-direction] img')).toHaveCount(0);await expect(page.locator('#menu-float-panel')).toContainText('<img');expect(await page.evaluate(()=>window.__xss)).toBe(0);
});
