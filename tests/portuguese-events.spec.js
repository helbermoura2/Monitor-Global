const {test,expect}=require('@playwright/test');test.use({serviceWorkers:'block',reducedMotion:'reduce'});
test('Portuguese locations, labels and translated bulletins preserve original hazard records and manual selection',async({page})=>{
 const base=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';let calls=0;
 await page.route('**/*',r=>{const url=new URL(r.request().url());if(url.pathname==='/translate-pt'){calls++;const {texts}=r.request().postDataJSON();return r.fulfill({json:{translations:texts.map(t=>t.includes('Hazardous')?'Ondas perigosas de tsunami são possíveis ao longo da costa do Pacífico. Consulte as instruções das autoridades.':'Boletim oficial traduzido em português.')}});}return url.hostname===new URL(base).hostname?r.continue():r.abort();});
 await page.goto(base+'/?verify='+Date.now());await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&window.__mgMapReady);
 await page.evaluate(()=>{pausarBuscas();globalAlerts=[];globalEvents=[{id:'pt-quake',mag:4.1,depth:12.647,place:'12 km WSW of Pitaloza Arriba, Panama',coords:[-80.77,7.59],time:Date.now(),source:'USGS'}];window.__mgSoftCycle=false;showEventDetails(0);clearTimeout(cycleTimeout);});
 await expect(page.locator('#pd-local')).toContainText('12 km a oeste-sudoeste de Pitaloza Arriba, Panamá');await expect(page.locator('#pd-depth')).toContainText('13 km');
 await expect(page.locator('#pd-share-btn')).toHaveText('📤 Imagem');
 await page.evaluate(()=>{const item={id:'pt-tsunami',type:'tsunami',hazardNature:'warning',place:'Panama',displayLabel:'Tsunami Warning',severityLabel:'Severe',detail:'Hazardous tsunami waves are possible along the Pacific coast. Follow instructions from authorities.',warningDescription:'Hazardous tsunami waves are possible along the Pacific coast. Follow instructions from authorities.',time:Date.now(),coords:[-80.77,7.59],source:'PTWC',link:'https://www.tsunami.gov/'};globalAlerts=[item];window.__mgSoftCycle=true;showAlertDetails(item,false);clearTimeout(cycleTimeout);});
 await expect(page.locator('#pd-local')).toContainText('Panamá');await expect(page.locator('#pd-notice-brief')).toContainText('Alerta de tsunami');await expect(page.locator('#pd-notice-brief')).toContainText('Ondas perigosas de tsunami');
 expect(await page.evaluate(()=>globalAlerts[0].detail)).toContain('Hazardous tsunami waves');expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('pt-tsunami');expect(calls).toBe(1);
 await page.evaluate(()=>{showAlertDetails(globalAlerts[0],false);clearTimeout(cycleTimeout);});expect(calls).toBe(1);
});
