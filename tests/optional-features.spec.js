const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
async function boot(page,width,requests){
 const base=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';
 page.on('request',r=>requests.push(new URL(r.url()).pathname));
 await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.setViewportSize({width,height:844});await page.goto(base+'/?verify=20261009-on-demand',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&!!window.OptionalFeatures);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();stopWaveFront();CinematicCard.stop();});
}
const optional=['story-share','election-results','tse-results','card-gale-field','card-tornado-field','card-tsunami-surge','card-flood-rise','card-volcano-monitoring'];
test('pending renderer respects the original 16 second deadline',async({page})=>{
 const requests=[];await boot(page,1280,requests);await page.emulateMedia({reducedMotion:'no-preference'});
 await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 let held,release;await page.route('**/js/card-gale-field.js?*',route=>{held=route;return new Promise(resolve=>release=async()=>{await route.continue();resolve();});});
 await page.evaluate(()=>{const item={id:'deadline-wind',type:'wind',coords:[-46,-23],time:Date.now(),place:'Rajada QA',windKmh:140,source:'QA'};globalAlerts=[item];showAlertDetails(item,false);clearTimeout(cycleTimeout);});
 await expect.poll(()=>!!held).toBe(true);expect(await page.evaluate(()=>CinematicCard.isActive())).toBe(true);
 await page.clock.fastForward(16010);expect(await page.evaluate(()=>CinematicCard.isActive())).toBe(false);await expect(page.locator('#painel-direito')).not.toHaveClass(/pd-fx-wind/);
 await release();await page.waitForFunction(()=>OptionalFeatures.effectReady('wind'));await expect(page.locator('.pd-cinema-layer[data-scene="wind"],.pd-gale-field')).toHaveCount(0);
});
test('critical new quake cancels a pending election opening',async({page})=>{
 const requests=[];await boot(page,1280,requests);
 let held,release;await page.route('**/js/election-results.js?*',route=>{held=route;return new Promise(resolve=>release=async()=>{await route.continue();resolve();});});
 await page.locator('#chip-election').click();await expect.poll(()=>!!held).toBe(true);
 await page.evaluate(()=>ElectionPanel.newQuakes([{id:'critical-during-load',mag:6.6}]));
 await release();await page.waitForFunction(()=>typeof ElectionPanel.open==='function');await expect(page.locator('#chip-election')).toBeEnabled();await expect(page.locator('#election-panel')).toBeHidden();
 expect(requests.filter(p=>p.endsWith('.jws'))).toHaveLength(0);
 await page.locator('#chip-election').click();await expect(page.locator('#election-panel')).toBeVisible();
 await page.evaluate(()=>ElectionPanel.newQuakes([{id:'critical-during-load',mag:6.6}]));await expect(page.locator('#election-panel')).toBeVisible();
 await page.evaluate(()=>ElectionPanel.close());
});
for(const width of [1280,390])test('optional modules stay unloaded until use and Story retries failed downloads '+width,async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});const requests=[];await boot(page,width,requests);
 expect(requests.filter(p=>optional.some(name=>p.includes('/'+name+'.')))).toEqual([]);
 await page.evaluate(()=>{
  Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true});
  const item={id:'optional-story',type:'wind',hazardNature:'warning',regionalWarning:true,place:'Aviso regional QA',time:Date.now(),source:'BOM',detail:'Aviso de vento'};
  globalAlerts=[item];showAlertDetails(item,false);clearTimeout(cycleTimeout);
 });
 let attempts=0;await page.route('**/js/story-share.js?*',route=>++attempts===1?route.abort():route.continue());
 const button=page.locator('#pd-share-btn');await button.click();await expect(button).toBeEnabled();await expect(button).toHaveText('📤 Story');
 expect(attempts).toBe(1);
 const downloaded=page.waitForEvent('download');await button.click();expect((await downloaded).suggestedFilename()).toBe('evento-wind-optional-story.png');
 await expect(button).toBeEnabled();expect(attempts).toBe(2);
 const again=page.waitForEvent('download');await button.click();await again;expect(attempts).toBe(2);
 expect(requests.filter(p=>p.includes('/js/election-results.'))).toHaveLength(0);
 expect(requests.filter(p=>/card-(gale|tornado|tsunami|flood|volcano)/.test(p))).toHaveLength(0);
});
for(const width of [1280,390])test('late renderer cannot spill into a new quake and only selected effects download '+width,async({page})=>{
 const requests=[];await boot(page,width,requests);await page.emulateMedia({reducedMotion:'no-preference'});
 let held,release;await page.route('**/js/card-gale-field.js?*',route=>{held=route;return new Promise(resolve=>release=async()=>{await route.continue();resolve();});});
 await page.evaluate(()=>{
  const item={id:'pending-wind',type:'wind',coords:[-46,-23],place:'Rajada QA',time:Date.now(),source:'QA',windKmh:140};globalAlerts=[item];showAlertDetails(item,false);clearTimeout(cycleTimeout);
 });await expect.poll(()=>!!held).toBe(true);
 await page.evaluate(()=>{globalEvents=[{id:'new-quake-qa',type:'earthquake',mag:3.8,depth:10,time:Date.now(),coords:[-70,-20],place:'Sismo novo QA',source:'QA'}];showEventDetails(0,false);clearTimeout(cycleTimeout);});
 await release();await page.waitForFunction(()=>OptionalFeatures.effectReady('wind'));
 expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('new-quake-qa');await expect(page.locator('.pd-cinema-layer[data-scene="wind"],.pd-gale-field')).toHaveCount(0);
 await page.evaluate(()=>{showAlertDetails(globalAlerts[0],false);clearTimeout(cycleTimeout);});await expect(page.locator('.pd-gale-field')).toHaveCount(1);
 expect(requests.filter(p=>p==='/js/card-gale-field.js')).toHaveLength(1);
 expect(requests.filter(p=>/card-(tornado|tsunami|flood|volcano)/.test(p))).toHaveLength(0);
 for(const [type,selector] of [['tornado','.pd-tornado-field'],['flood','.pd-flood-rise-contact'],['tsunami','.pd-tsunami-contact'],['volcano','.pd-volcano-monitor']]){
  await page.evaluate(type=>{const item={id:'optional-'+type,type,time:Date.now(),coords:[-46,-23],place:type,detail:type==='volcano'?'Em monitoramento':type,source:'QA'};globalAlerts=[item];showAlertDetails(item,false);clearTimeout(cycleTimeout);},type);
  await page.waitForFunction(type=>OptionalFeatures.effectReady(type),type);
  await expect(page.locator('.pd-cinema-layer[data-scene="'+type+'"]')).toHaveCount(1);
  await expect(page.locator(selector)).toHaveCount(1);
 }
 await page.evaluate(()=>CinematicCard.stop());await expect(page.locator('.pd-cinema-layer,.pd-cinema-contact')).toHaveCount(0);
});
