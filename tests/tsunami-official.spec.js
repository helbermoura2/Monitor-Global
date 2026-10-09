const {test,expect}=require('@playwright/test');test.use({serviceWorkers:'block',reducedMotion:'reduce'});
async function boot(page){
 const base=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';
 await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 await page.goto(base+'/?verify=20261009-quake-image-tsunami',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento&&typeof fetchOfficialTsunamiAlerts==='function');
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);stopWaveFront();stopFeltZone();map.stop();globalAlerts=[];globalEvents=[];pendingNewCameraQuakes.clear();PresentationLimits.clear();});
}
function bulletin(source,kind){return {id:'TS-'+source+'-'+kind,source,type:'tsunami',coords:[-80.75,7.54],place:'Panamá',title:'Tsunami '+kind,detail:'Boletim oficial para a costa do Pacífico',time:Date.now(),warningLevel:kind==='Warning'?'Aviso':'Informativo',displayLabel:kind==='Warning'?'Tsunami · Aviso':'Tsunami · Informativo',sev:kind==='Warning'?4:0,hazardNature:kind==='Warning'?'warning':'bulletin',link:'https://www.tsunami.gov/'};}
test('international warning is visible during protected M8, survives NWS cleanup and can be opened manually',async({page})=>{
 await boot(page);const warning={...bulletin('PTWC','Warning'),feedKey:'PTWC-WEPA40'},info={...bulletin('NTWC','Information'),feedKey:'NTWC-General'};
 await page.route('**/tsunami-alerts',r=>r.fulfill({json:{ok:true,sources:[{source:'PTWC',feedKey:'PTWC-WEPA40',ok:true},{source:'PTWC',feedKey:'PTWC-General',ok:true},{source:'NTWC',feedKey:'NTWC-General',ok:true}],items:[warning,info]}}));
 await page.route('https://api.weather.gov/alerts/active?event=Tsunami**',r=>r.fulfill({json:{features:[]}}));
 await page.evaluate(()=>{const q={id:'major',type:'earthquake',mag:8,depth:33,time:Date.now(),coords:[-80.75,7.54],place:'Panamá',source:'QA'};globalEvents=[q];window.__mgSoftCycle=false;showEventDetails(0,true);clearTimeout(cycleTimeout);});
 await page.evaluate(()=>fetchOfficialTsunamiAlerts());expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('major');await expect(page.locator('#chip-tsunami-official')).toHaveText('🌊 Tsunami: Aviso');
 await page.evaluate(()=>fetchTsunamiAlerts());expect(await page.evaluate(()=>globalAlerts.filter(a=>['PTWC','NTWC'].includes(a.source)).length)).toBe(2);
 await page.locator('#chip-tsunami-official').click();expect(await page.evaluate(()=>eventoSelecionadoId)).toBe(warning.id);await expect(page.locator('#pd-mercalli')).toHaveText('Aviso');
 await page.route('**/tsunami-alerts',r=>r.fulfill({json:{ok:true,sources:[{source:'PTWC',feedKey:'PTWC-General',ok:true},{source:'PTWC',feedKey:'PTWC-WEPA40',ok:false},{source:'NTWC',feedKey:'NTWC-General',ok:true}],items:[info]}}));await page.evaluate(()=>fetchOfficialTsunamiAlerts());expect(await page.evaluate(id=>globalAlerts.some(a=>a.id===id),warning.id)).toBe(true);
});
test('a new warning enters the presentation queue while an informational bulletin has no tsunami effect',async({page})=>{
 await boot(page);const warning=bulletin('PTWC','Warning');
 await page.route('**/tsunami-alerts',r=>r.fulfill({json:{ok:true,sources:[{source:'PTWC',ok:true}],items:[warning]}}));await page.evaluate(()=>fetchOfficialTsunamiAlerts());await expect.poll(()=>page.evaluate(()=>eventoSelecionadoId)).toBe(warning.id);
 const info=bulletin('PTWC','Information');await page.evaluate(info=>{globalAlerts=[info];upsertAlert(info);showAlertDetails(info,false);clearTimeout(cycleTimeout);},info);await expect(page.locator('#pd-mercalli')).toHaveText('Informativo');await expect(page.locator('#pd-source')).toContainText('Informativo');await expect(page.locator('.pd-cinema-layer')).toHaveCount(0);expect(await page.evaluate(()=>{triggerEventoMapaFx(globalAlerts[0]);return tsunamiWaveEl===null;})).toBe(true);
 await page.route('**/tsunami-alerts',r=>r.fulfill({json:{ok:true,sources:[{source:'PTWC',ok:true},{source:'NTWC',ok:true}],items:[]}}));await page.evaluate(()=>fetchOfficialTsunamiAlerts());await expect(page.locator('#chip-tsunami-official')).toBeHidden();
});
test('manual tsunami chip clears replay state and obsolete map effects, including a regional bulletin',async({page})=>{
 await boot(page);const info={...bulletin('PTWC','Information'),coords:null,official:true};
 await page.route('**/tsunami-alerts',r=>r.fulfill({json:{ok:true,sources:[{source:'PTWC',ok:true}],items:[info]}}));
 await page.evaluate(()=>{globalEvents=[{id:'old-quake',type:'earthquake',mag:2.4,depth:9,time:Date.now(),coords:[-80.75,7.54],place:'Old quake',source:'QA'}];showEventDetails(0,false);clearTimeout(cycleTimeout);});
 await page.evaluate(()=>fetchOfficialTsunamiAlerts());
 await page.evaluate(()=>{window.__mgSoftCycle=true;window.__mgRotationDisplay=false;window.returnCameraTimeout=setTimeout(()=>showEventDetails(0,false),1000);});
 await page.locator('#chip-tsunami-official').click();
 await expect(page.locator('#pd-source')).toContainText('Informativo');
 await page.waitForTimeout(1300);
 expect(await page.evaluate(()=>eventoSelecionadoId)).toBe(info.id);
 expect(await page.evaluate(()=>window.__mgWaveFrontState)).toBeNull();
 await expect(page.locator('.seismic-impact-status')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__mgSoftCycle)).toBe(false);
});
test('official warning map represents only the bulletin origin and has no invented tsunami sweep',async({page})=>{
 await boot(page);const warning={...bulletin('PTWC','Warning'),official:true};
 await page.evaluate(item=>{globalAlerts=[item];showAlertDetails(item,false);clearTimeout(cycleTimeout);triggerEventoMapaFx(item);},warning);
 await expect(page.locator('#pd-cities')).toContainText('Não representa a extensão do tsunami');
 await expect(page.locator('#pd-cities')).not.toContainText('2.000 km');
 await expect(page.locator('.tsunami-wave-wrap')).toHaveCount(0);
});
