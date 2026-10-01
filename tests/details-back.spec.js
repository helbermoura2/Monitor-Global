const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
for(const [width,height] of [[1280,720],[390,844]])test('verso de detalhes preserva nós, vidro e retorno '+width,async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.setViewportSize({width,height});await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{document.getElementById('painel-direito').style.display='block';document.body.classList.add('mobile-details-mid');window.__detailNode=document.getElementById('pd-cities');});
 await page.locator('#pd-more-toggle').click();
 const back=page.locator('#pd-details-verso');await expect(back).toBeVisible();
 await expect(back.getByRole('button',{name:'Voltar ao evento'})).toBeVisible();
 await back.evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{}))));
 await expect.poll(()=>back.evaluate(el=>Math.round(el.getBoundingClientRect().bottom))).toBeLessThanOrEqual(height+1);
 const result=await back.evaluate(el=>({glass:getComputedStyle(el).background,rect:el.getBoundingClientRect().toJSON(),same:window.__detailNode===document.getElementById('pd-cities'),ids:document.querySelectorAll('#pd-cities').length}));
 expect(result.same).toBe(true);expect(result.ids).toBe(1);expect(result.glass).toContain('rgba');expect(result.rect.x).toBeGreaterThanOrEqual(0);expect(result.rect.bottom).toBeLessThanOrEqual(height+1);
 await back.getByRole('button',{name:'Voltar ao evento'}).click();await expect(back).toHaveCount(0);
 expect(await page.evaluate(()=>document.getElementById('painel-direito').contains(window.__detailNode))).toBe(true);
 await page.evaluate(()=>togglePainelMaisDetalhes(true));await page.evaluate(()=>EventStore.setSelected('different-event'));await expect(back).toHaveCount(0);
});
test('Meteoalarm descarta testes/cancelados/expirados e não inventa localização',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});const rows=await page.evaluate(()=>MeteoalarmWarnings.parse('<feed xmlns="http://www.w3.org/2005/Atom" xmlns:cap="urn:oasis:names:tc:emergency:cap:1.2"><entry><cap:status>Actual</cap:status><cap:message_type>Alert</cap:message_type><cap:expires>2030-01-01T00:00Z</cap:expires><cap:event>heavy rain</cap:event><cap:areaDesc>Test region</cap:areaDesc></entry><entry><cap:status>Test</cap:status><cap:expires>2030-01-01T00:00Z</cap:expires><cap:event>wind</cap:event></entry></feed>','Test'));
 expect(rows.length).toBe(1);expect(rows[0].coords).toBeUndefined();
});
test('modelo não ganha prioridade ao vivo e vazão mantém unidade e limitação',async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const state=await page.evaluate(()=>{
  const now=Date.now();upsertAlert({id:'model-test',type:'wind',source:'Open-Meteo',hazardNature:'forecast',time:now,coords:[0,0],expiresAt:now+60000});
  upsertAlert({id:'flood-test',type:'flood',source:'GDACS',hazardNature:'report',place:'Rio de teste',time:now,coords:[-46,-23]});EventStore.setSelected('flood-test');
  window.fetchWithCorsFallback=async()=>new Response(JSON.stringify({latitude:-23,longitude:-46,daily_units:{river_discharge:'m³/s'},daily:{time:['2026-10-01'],river_discharge:[123]}}));
  document.getElementById('painel-direito').style.display='block';togglePainelMaisDetalhes(true);
  return {newModel:activeAlertingIds.has('model-test'),recorded:globalAlerts.some(x=>x.id==='model-test')};
 });
 expect(state.newModel).toBe(false);expect(state.recorded).toBe(true);
 const back=page.locator('#pd-details-verso');await expect(back).toContainText('123 m³/s');await expect(back).toContainText('não confirmam enchente');
 await back.getByRole('button',{name:'Voltar ao evento'}).click();await expect(back).toHaveCount(0);
});
