const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
for(const width of [1280,390])test('relâmpagos ramificados, informação legível e troca de evento '+width,async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.setViewportSize({width,height:844});await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento);
 await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+200));
 await page.evaluate(()=>{const item={id:'storm-observed',type:'storm',source:'NOAA METAR',hazardNature:'observed',detail:'Trovoada reportada no aeródromo',place:'São Paulo — Brasil',bandeira:'🇧🇷',coords:[-46.63,-23.55],time:Date.now()};globalAlerts=[item];upsertAlert(item);showAlertDetails(item,false);clearTimeout(cycleTimeout);});
 await page.clock.runFor(1000);
 await expect(page.locator('#painel-direito')).toHaveAttribute('data-lightning','on');await expect(page.locator('#pd-mag')).not.toContainText('⚡');await expect(page.locator('#pd-mag svg[role="img"]')).toHaveAttribute('aria-label',/relâmpagos/);await expect(page.locator('.pd-fx-bolt polygon')).toHaveCount(0);await expect(page.locator('.pd-cinema-storm-bolt .pd-bolt-branch')).toHaveCount(4);await expect(page.locator('#pd-local')).toContainText('São Paulo');
 const before=await page.locator('.pd-cinema-storm-bolt .pd-bolt-core').getAttribute('d');await page.evaluate(()=>showAlertDetails(EventStore.getSelected(),false,true));expect(await page.locator('.pd-cinema-storm-bolt .pd-bolt-core').getAttribute('d')).toBe(before);
 // Advance the shared rain/cloud/light clock to a discharge, then inspect the frozen frame.
 await page.clock.runFor(1340);
 expect(await page.locator('.pd-cinema-storm-bolt').evaluate(el=>Number(el.style.opacity))).toBeGreaterThan(.05);
 await expect(page.locator('.pd-cinema-storm-bolt')).toHaveCSS('pointer-events','none');
 expect(await page.locator('#painel-direito').evaluate(el=>Number(el.style.getPropertyValue('--pd-storm-flash')))).toBeGreaterThan(.1);
 await expect(page.locator('.pd-fx-bolt-1')).toHaveCSS('display','none');
 await page.screenshot({path:'/tmp/storm-lightning-'+width+'.png'});
 await page.evaluate(()=>{globalEvents=[{id:'after-storm',type:'earthquake',place:'Sismo de teste',coords:[-90,13],time:Date.now(),depth:10,mag:4.8}];showEventDetails(0,false);clearTimeout(cycleTimeout);});await page.clock.runFor(700);await expect(page.locator('#painel-direito')).not.toHaveClass(/pd-fx-storm/);await expect(page.locator('#pd-mag svg')).toHaveCount(0);await expect(page.locator('.pd-cinema-storm-bolt')).toHaveCount(0);expect(await page.locator('#painel-direito').evaluate(el=>el.style.getPropertyValue('--pd-storm-flash'))).toBe('');
});
test('aviso de chuva não ganha relâmpagos, e movimento reduzido não pisca',async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{const item={id:'rain-warning',type:'storm',hazardNature:'warning',warningEvent:'Heavy Rainfall Warning',detail:'Aviso de chuva intensa',source:'ECCC',place:'Região de teste',time:Date.now(),coords:[-90,50]};globalAlerts=[item];upsertAlert(item);showAlertDetails(item,false);clearTimeout(cycleTimeout);});await expect(page.locator('#painel-direito')).toHaveAttribute('data-lightning','off');await expect(page.locator('.pd-fx-bolt-1')).toHaveCSS('display','none');await expect(page.locator('#lightning-flash')).toBeHidden();
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{const item={...EventStore.getSelected(),id:'thunder-warning',warningEvent:'Severe Thunderstorm Warning'};upsertAlert(item);showAlertDetails(item,false);clearTimeout(cycleTimeout);});await expect(page.locator('#painel-direito')).toHaveAttribute('data-lightning','on');await expect(page.locator('.pd-fx-bolt-1')).toHaveCSS('animation-name','none');await expect(page.locator('#lightning-flash')).toHaveCSS('animation-name','none');
});
