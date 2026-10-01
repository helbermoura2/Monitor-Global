const {test,expect}=require('@playwright/test');const fs=require('fs');
test.use({serviceWorkers:'block'});
const sample=JSON.parse(fs.readFileSync('tests/fixtures/world-alerts/eccc.json','utf8')).features[0];
test('avisos oficiais: área, severidade, revisão, cancelamento e links seguros',async({page})=>{
 await page.goto('about:blank');await page.addScriptTag({path:'js/hazard-evidence.js'});await page.addScriptTag({path:'js/official-weather-alerts.js'});await page.addScriptTag({path:'js/meteoalarm-warnings.js'});
 const fixtures={sample,bom:fs.readFileSync('tests/fixtures/world-alerts/bom-vic.xml','utf8'),europe:fs.readFileSync('tests/fixtures/world-alerts/meteoalarm.xml','utf8')};
 const d=await page.evaluate(f=>{
  const now=Date.parse('2026-10-01T21:50:00Z'),r=OfficialWeatherAlerts,p=f.sample.properties,a=r.eccc(f.sample,now),revision=r.eccc({...f.sample,id:'new-publication-id',properties:{...p,publication_datetime:'2026-10-01T21:48:00Z'}},now),missing=r.eccc({...f.sample,geometry:null},now);
  return {a,revision,missing,cancel:r.eccc({...f.sample,properties:{...p,status_en:'ended'}},now),expired:r.eccc(f.sample,Date.parse(p.expiration_datetime)+1),b:r.bom(f.bom,'Victoria',now),m:MeteoalarmWarnings.parse(f.europe,'Alemanha',now),unsafe:r.validLink('https://www.bom.gov.au.evil.test/fwo/fake',['www.bom.gov.au']),countries:MeteoalarmWarnings.countries.length};
 },fixtures);
 expect(d.a.type).toBe('flood');expect(d.a.hazardNature).toBe('warning');expect(d.a.severityLabel).toBe('Moderada');expect(d.a.coords[0]).toBeLessThan(-138);expect(d.a.coords[1]).toBeGreaterThan(69);expect(d.a.id).toBe(d.revision.id);expect(d.missing.coords).toBeUndefined();expect(d.cancel).toBeNull();expect(d.expired).toBeNull();expect(d.b.find(x=>x.type==='flood').warningLevel).toBe('Atenção');expect(d.b.every(x=>x.coords===undefined&&x.expiresAt===undefined)).toBe(true);expect(d.unsafe).toBeNull();expect(d.countries).toBe(16);expect(d.m.length).toBeGreaterThan(0);expect(d.m.every(x=>x.coords===undefined)).toBe(true);
 const cancelled=await page.evaluate(xml=>{const doc=new DOMParser().parseFromString(xml,'application/xml'),e=doc.getElementsByTagNameNS('*','entry')[0],copy=e.cloneNode(true);copy.getElementsByTagNameNS('urn:oasis:names:tc:emergency:cap:1.2','message_type')[0].textContent='Cancel';doc.documentElement.append(copy);return MeteoalarmWarnings.parse(new XMLSerializer().serializeToString(doc),'Alemanha',Date.parse('2026-10-01T21:50:00Z'));},fixtures.europe);expect(cancelled.length).toBe(d.m.length-1);
});
for(const width of [1280,390])test('lista oficial mantém foco sísmico e não inventa marcadores '+width,async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.setViewportSize({width,height:844});await page.goto('/',{waitUntil:'domcontentloaded'});
 const state=await page.evaluate(sample=>{
  const now=Date.now();globalEvents=[{id:'quake-keep',type:'earthquake',coords:[-90,13],mag:5.6,depth:10,time:now}];EventStore.setSelected('quake-keep');const p=sample.properties,feature={...sample,properties:{...p,publication_datetime:new Date(now-60000).toISOString(),expiration_datetime:new Date(now+3600000).toISOString(),validity_datetime:new Date(now+1800000).toISOString()}};
  const e=OfficialWeatherAlerts.eccc(feature),unlocated={...e,id:'unlocated',place:'Área sem polígono',coords:undefined,warningDescription:'<img src=x onerror=alert(1)> texto original'};
  OfficialWeatherAlerts.set('test-eccc','ECCC Canadá',[e,e,unlocated]);OfficialWeatherAlerts.set('test-eccc','ECCC Canadá',[{...e,detail:'Aviso atualizado'},unlocated]);
  const separate=dedupeFeedItems([e,{...e,id:'other-warning',source:'Outra agência'},{...e,id:'reported-flood',source:'GDACS',hazardNature:'report'}]);if(separate.length!==3)throw Error('Avisos distintos foram fundidos');
  const result={selected:EventStore.selectedId,mapped:globalAlerts.filter(x=>x.officialWeatherManaged&&Array.isArray(x.coords)).length,unlocatedOnMap:globalAlerts.some(x=>x.id==='unlocated'&&Array.isArray(x.coords))};
  showEventDetails(0,false);WeatherPanel.show();document.getElementById('weather-more').open=true;document.querySelector('#official-weather-warnings details').open=true;OfficialWeatherAlerts.render();return result;
 },sample);
 expect(state.selected).toBe('quake-keep');expect(state.mapped).toBe(1);expect(state.unlocatedOnMap).toBe(false);
 const host=page.locator('#official-weather-warnings');await host.scrollIntoViewIfNeeded();await expect(host).toBeVisible();const bounds=await host.boundingBox();expect(bounds.x+bounds.width).toBeLessThanOrEqual(width+1);await page.screenshot({path:'/tmp/official-weather-'+width+'.png'});await expect(host).toContainText('Área sem polígono');await expect(host).toContainText('Moderada');await expect(host).toContainText('Início previsto');expect(await host.locator('img').count()).toBe(0);
 await page.evaluate(()=>{OfficialWeatherAlerts.set('test-eccc','ECCC Canadá',[],{error:'HTTP 503'});});await expect(host).toContainText('Consulta indisponível');await expect(host).toContainText('último retorno válido');
 await page.evaluate(()=>{OfficialWeatherAlerts.set('test-eccc','ECCC Canadá',[]);});expect(await page.evaluate(()=>globalAlerts.filter(x=>x.officialWeatherManaged).length)).toBe(0);
});
test('aviso de inundação costeira não recebe previsão de cheia de rio',async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{const now=Date.now();const item={id:'coastal-warning',type:'flood',coords:[-139,69],place:'Costa do Yukon',source:'ECCC / Environment Canada',hazardNature:'warning',warningEvent:'storm surge warning',severityLabel:'Moderada',time:now,expiresAt:now+3600000};upsertAlert(item);EventStore.setSelected(item.id);document.getElementById('painel-direito').style.display='block';window.__riverFetched=false;window.fetchWithCorsFallback=async()=>{window.__riverFetched=true;throw Error('Não consultar rio para maré')};togglePainelMaisDetalhes(true);});
 await expect(page.locator('#pd-details-verso')).toBeVisible();await expect(page.locator('#pd-details-verso')).toContainText('Moderada');await expect(page.locator('#pd-details-verso')).not.toContainText('Rios · previsão de vazão');expect(await page.evaluate(()=>window.__riverFetched)).toBe(false);
});
