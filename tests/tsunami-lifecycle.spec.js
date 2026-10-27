const {test,expect}=require('@playwright/test'),fs=require('node:fs');
const fixture=JSON.parse(fs.readFileSync('android-tv/app/src/test/resources/tsunami-lifecycle.json','utf8'));
test.use({serviceWorkers:'block',reducedMotion:'reduce'});
for(const width of [390,1280])test('same regional lifecycle drives site panel, map, repeat suppression and outage '+width,async({page})=>{
 test.setTimeout(120000);await page.setViewportSize({width,height:900});let stage=fixture.stages[0];
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname==='/tsunami-alerts'){const sources=['PTWC-WEPA40','PTWC-WEPA42','NTWC-WEAK51'].map(feedKey=>({feedKey,source:feedKey.startsWith('NTWC')?'NTWC':'PTWC',ok:stage.tsunamis.ok}));return r.fulfill({json:{...stage.tsunamis,sources}});}return u.hostname==='127.0.0.1'?r.continue():r.abort();});
 await page.goto('/');await page.waitForFunction(()=>__mgMapReady&&!__fetchGlobalFeedsEmAndamento);await page.waitForTimeout(1600);
 await page.clock.setFixedTime(new Date(stage.now));
 await page.evaluate(()=>{pausarBuscas();for(const job of __buscasAgendadas)PeriodicScheduler.cancel(job.key);PeriodicScheduler.cancel('correlation');clearTimeout(cycleTimeout);EventCamera.cancel();SeismicPaintTour.stop();SeismicCinema.stop();stopWaveFront();TsunamiPresentation.stop();TsunamiPresentation.update=()=>false;map.setPixelRatio(.5);for(const l of map.getStyle().layers)if(l.type==='raster')map.removeLayer(l.id);globalEvents=[];globalAlerts=[];getAutoCycleProtectionRemaining=()=>3600000;window.__lifecycleSounds=[];window.__lifecycleNotifications=[];playAlertTone=(type,id)=>__lifecycleSounds.push({type,id});notificarNavegador=(title,place)=>__lifecycleNotifications.push({title,place});});
 await page.evaluate(()=>fetchOfficialTsunamiAlerts());
 for(let i=1;i<fixture.stages.length;i++){
  stage=fixture.stages[i];await page.clock.setFixedTime(new Date(stage.now));
  await page.evaluate(s=>{if(s.quakes.ok&&s.quakes.features.length){const f=s.quakes.features[0],q={id:'USGS:'+f.id,type:'earthquake',mag:f.properties.mag,depth:10,time:f.properties.time,coords:f.geometry.coordinates.slice(0,2),place:f.properties.place,source:'QA'};globalEvents=[q];if(eventoSelecionadoId!==q.id){showEventDetails(0,false);EventCamera.cancel();SeismicCinema.stop();stopWaveFront();clearTimeout(cycleTimeout);}}},stage);
  await page.evaluate(()=>fetchOfficialTsunamiAlerts());
  const list=page.locator('#pd-tsunami-link .tsunami-regional-list');
  if(i<6){await expect(list.locator('[data-state="warning"]')).toHaveCount(2);await expect(list.locator('[data-state="noThreat"]')).toContainText('Alasca');}
  if(i===5)expect(await page.evaluate(()=>activeAlertingIds.has('lifecycle-corrected'))).toBe(false);
  if(i===6){await expect(list.locator('[data-state="ended"]')).toContainText('Vanuatu');await expect(list.locator('[data-state="warning"]')).toContainText('Fiji');await expect.poll(()=>page.evaluate(()=>map.getSource('tsunami-official-regions')?.serialize().data.features.some(f=>f.properties.name==='Fiji'&&f.properties.rank>=2))).toBe(true);}
  if(i===7||i===8||i===10){await expect(list.locator('[data-state="warning"]')).toHaveCount(0);await expect(list.locator('[data-state="noThreat"]').filter({hasText:'Fiji'})).toHaveCount(1);await expect.poll(()=>page.evaluate(()=>map.getSource('tsunami-official-regions')?.serialize().data.features.every(f=>f.properties.rank<=1))).toBe(true);}
  if(i===11||i===12||i===13)await expect(list.locator('[data-state="warning"]')).toContainText('Fiji');
  if(i===12){await expect(list).toContainText('atualização indisponível');expect(await page.evaluate(()=>globalAlerts.filter(a=>a.official).every(a=>!TsunamiRegional.hasThreat(a)))).toBe(true);}
  if(i===14){await expect(list.locator('[data-state="warning"]')).toHaveCount(0);await expect(list.locator('[data-state="ended"]')).toHaveCount(2);}
  if(i===9){await expect(list).toContainText('atualização indisponível');await expect(list.locator('[data-state="ended"]')).toContainText('Vanuatu');}
  expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('USGS:lifecycle-q');
 }
 expect(await page.evaluate(()=>__lifecycleSounds.length)).toBe(4);expect(await page.evaluate(()=>__lifecycleNotifications.length)).toBe(4);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
