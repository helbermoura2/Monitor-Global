const {test,expect}=require('@playwright/test');test.use({serviceWorkers:'block'});
for(const [width,height] of [[1280,800],[390,844]])test('aviso regional abre painel e boletim separado, sem câmera falsa '+width,async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.setViewportSize({width,height});await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!isFirstDisplay&&!__fetchGlobalFeedsEmAndamento);
 const before=await page.evaluate(()=>{
  const now=Date.now();globalEvents=[{id:'keep-quake',type:'earthquake',mag:5.6,coords:[-90,13],depth:10,time:now,place:'Sismo de teste'}];showEventDetails(0,false);clearTimeout(cycleTimeout);
  // Isolate card activation from the quake setup timers, whose own wave replacement calls stopWaveFront.
  clearTimeout(window.__mgRadarDelayT);clearTimeout(window.__mgWaveDelayT);
  let cameraCalls=0,stops=0;window.__warningCameraCalls=()=>cameraCalls;window.__warningWaveStops=()=>stops;map.flyTo=()=>{cameraCalls++};window.stopFeltZone=()=>stops++;window.stopWaveFront=()=>stops++;
  const row={id:'regional-warning',type:'wind',place:'Victoria — Austrália',bandeira:'🇦🇺',source:'BOM / Bureau of Meteorology',hazardNature:'warning',time:now-2*86400000,warningEvent:'Marine Wind Warning',severityLabel:'Não informada pelo RSS',detail:'Aviso regional de vento',link:'https://reg.bom.gov.au/vic/warnings/marinewind.shtml'};
  OfficialWeatherAlerts.set('regional','BOM Victoria',[row]);OfficialWeatherAlerts.set('regional','BOM Victoria',[{...row,detail:'Aviso regional revisado'}]);
  const state={selected:EventStore.selectedId,records:globalAlerts.filter(x=>x.id===row.id).length,coords:globalAlerts.find(x=>x.id===row.id).coords};
  if(innerWidth<=900)toggleMobileEventsModal(true);return state;
 });
 expect(before.selected).toBe('keep-quake');expect(before.records).toBe(1);expect(before.coords).toBeUndefined();
 let card=page.locator('#events .event').filter({hasText:'Victoria — Austrália'});await expect(card).toBeVisible();await expect(card).toContainText('AVISO DE VENTO');await expect(card).toContainText('Área regional');await expect(card).toContainText('Validade: consultar boletim');await expect(card).toContainText('Ver no painel →');await expect(card).not.toContainText('Detalhes →');
 // The external link must not select the record, with mouse or keyboard activation.
 const link=card.locator('.ev-bulletin-link');await expect(link).toHaveAttribute('href','https://reg.bom.gov.au/vic/warnings/marinewind.shtml');await link.evaluate(el=>{el.addEventListener('click',e=>e.preventDefault());el.click();});expect(await page.evaluate(()=>EventStore.selectedId)).toBe('keep-quake');
 const effectBefore=await page.evaluate(()=>({calls:__warningCameraCalls(),stops:__warningWaveStops()}));
 if(width===390){await card.focus();await card.press('Enter');}else await card.locator('.ev-action').click();
 await expect(page.locator('#pd-source')).toContainText('AVISO DE VENTO');await expect(page.locator('#pd-local')).toContainText('Victoria');await expect(page.locator('#pd-notice-brief')).toBeVisible();await expect(page.locator('#pd-notice-brief')).toHaveCSS('opacity','1');await expect(page.locator('#pd-notice-brief')).toContainText('Validade não informada');await expect(page.locator('#pd-notice-brief')).toContainText('não fornece um ponto verificado');await expect(page.locator('#pd-focus-btn')).toBeHidden();await expect(page.locator('#pd-share-btn')).toBeHidden();await expect(page.locator('#pd-cities-section')).toBeHidden();
 expect(await page.evaluate(()=>({id:EventStore.selectedId,calls:__warningCameraCalls(),stops:__warningWaveStops()}))).toEqual({id:'regional-warning',...effectBefore});if(width===390){const visual=await page.locator('#pd-notice-brief').evaluate(el=>({opacity:getComputedStyle(el).opacity,top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,panel:el.parentElement.getBoundingClientRect().toJSON()}));expect(visual.top).toBeLessThan(height-70);}await page.screenshot({path:'/tmp/regional-panel-'+width+'.png'});
 await page.evaluate(()=>showEventDetails(0,false));await expect(page.locator('#pd-notice-brief')).toHaveCount(0);await expect(page.locator('#pd-focus-btn')).not.toHaveAttribute('hidden','');expect(await page.locator('#pd-impact').locator('..').evaluate(el=>el.style.display)).toBe('');await expect(page.locator('#painel-direito')).not.toHaveClass(/pd-warning/);
 await page.evaluate(()=>OfficialWeatherAlerts.set('regional','BOM Victoria',[]));expect(await page.evaluate(()=>globalAlerts.some(x=>x.id==='regional-warning'))).toBe(false);
});
test('sem coordenadas não captura seleção automática nem ganha distância fictícia',async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.goto('/',{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(()=>{
  const now=Date.now(),item={id:'unlocated',type:'flood',hazardNature:'warning',source:'Meteoalarm',time:now,expiresAt:now+3600000,place:'Região de teste'};EventStore.setSelected('keep');showAlertDetails(item,true);const triggered=EventStore.selectedId;window.__mgSoftCycle=true;showAlertDetails(item,false);const cycle=EventStore.selectedId;
  const invalid=RecordPresentation.bulletin({...item,link:'https://meteoalarm.org.evil.test/'});return {triggered,cycle,invalid,labels:[RecordPresentation.label({...item,hazardNature:'report'}),RecordPresentation.label({type:'wind',hazardNature:'observed'}),RecordPresentation.label({type:'wind',hazardNature:'forecast'})]};
 });
 expect(result.triggered).toBe('keep');expect(result.cycle).toBe('keep');expect(result.invalid).toBeNull();expect(result.labels).toEqual(['ENCHENTE REPORTADA','RAJADA OBSERVADA','RAJADA PREVISTA']);
});
