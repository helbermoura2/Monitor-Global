const {test,expect}=require('@playwright/test');test.use({serviceWorkers:'block',reducedMotion:'reduce'});
async function boot(page){const base=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());await page.goto(base+'/?verify=tsunami-link',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento&&window.TsunamiLinkedPanel);await page.evaluate(()=>{pausarBuscas();PeriodicScheduler.cancel('correlation');clearTimeout(cycleTimeout);stopWaveFront();stopFeltZone();map.stop();globalAlerts=[];globalEvents=[];pendingNewCameraQuakes.clear();PresentationLimits.clear();});}
function fixtures(){const now=Date.now(),q={id:'panama-major',type:'earthquake',mag:7.7,depth:13,coords:[-80.75,7.54],time:now-3600000,place:'Panama',source:'QA'};return {q,a:{id:'PTWC-warning',type:'tsunami',source:'PTWC',feedKey:'PTWC-WEPA40',official:true,originTime:q.time,originMag:7.6,coords:[-80.8,7.5],time:now,place:'Panama',detail:'Aviso para as costas indicadas no boletim',hazardNature:'warning',warningLevel:'Ameaça oficial',displayLabel:'Tsunami · Ameaça oficial',sev:4,affectedAreas:[{name:'Panama',category:'1-3 meters'}],link:'https://www.tsunami.gov/'}};}
for(const width of [1280,390])test('major quake keeps focus when bulletin arrives; exact two-way navigation '+width,async({page})=>{
 await page.setViewportSize({width,height:900});await boot(page);const {q,a}=fixtures();
 await page.evaluate(q=>{globalEvents=[q,{...q,id:'old',time:q.time-19*3600000,mag:4.8}];showEventDetails(0,true);clearTimeout(cycleTimeout);},q);
 await page.route('**/tsunami-alerts',r=>r.fulfill({json:{ok:true,sources:[{source:'PTWC',feedKey:'PTWC-WEPA40',ok:true}],items:[a]}}));await page.evaluate(()=>fetchOfficialTsunamiAlerts());
 expect(await page.evaluate(()=>eventoSelecionadoId)).toBe(q.id);await expect(page.locator('#pd-tsunami-link')).toContainText('Ameaça oficial');await expect(page.locator('#pd-tsunami-link')).toContainText('1-3 metros');await expect(page.locator('#pd-tsunami-link')).toContainText('Panamá');
 if(width===390){expect(await page.evaluate(()=>{const b=document.getElementById('pd-share-btn'),r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')?.id;})).toBe('pd-share-btn');await page.locator('#mobile-detail-handle').click();}
 await page.locator('#pd-tsunami-link button').click();await expect(page.locator('#pd-tsunami-link')).toHaveAttribute('data-quake-id',q.id);expect(await page.evaluate(()=>eventoSelecionadoId)).toBe(a.id);
 if(width===390)await page.locator('#mobile-detail-handle').click();
 await page.locator('#pd-tsunami-link button').click();expect(await page.evaluate(()=>eventoSelecionadoId)).toBe(q.id);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('regional coastal polygons and a different origin time never attach to a nearby quake',async({page})=>{
 await boot(page);const {q,a}=fixtures();await page.evaluate(({q,a})=>{globalEvents=[q];globalAlerts=[a];showAlertDetails({...a,id:'regional',coordinateRole:'warning-area'},false);clearTimeout(cycleTimeout);},{q,a});
 await expect(page.locator('#pd-tsunami-link')).toContainText('permanece regional');await expect(page.locator('#pd-tsunami-link button')).toHaveCount(0);await expect(page.locator('#pd-notice-brief')).toContainText('não o epicentro');
 await page.evaluate(a=>{const older={...a,originTime:a.originTime-17*3600000};globalAlerts=[older];showAlertDetails(older,false);clearTimeout(cycleTimeout);},a);await expect(page.locator('#pd-tsunami-link')).toContainText('Nenhum sismo');await expect(page.locator('#pd-tsunami-link button')).toHaveCount(0);
});
test('cancellation replaces its product while an independent bulletin and the quake remain visible',async({page})=>{
 await boot(page);const {q,a}=fixtures(),info={...a,id:'NTWC-info',source:'NTWC',feedKey:'NTWC-General',hazardNature:'bulletin',warningLevel:'Informativo',sev:0};let items=[a,info];await page.route('**/tsunami-alerts',r=>r.fulfill({json:{ok:true,sources:[{source:'PTWC',feedKey:a.feedKey,ok:true},{source:'NTWC',feedKey:info.feedKey,ok:true}],items}}));
 await page.evaluate(q=>{globalEvents=[q];showEventDetails(0,true);clearTimeout(cycleTimeout);},q);await page.evaluate(()=>fetchOfficialTsunamiAlerts());await expect(page.locator('#pd-tsunami-link .tsunami-link-row')).toHaveCount(2);
 const ended={...a,id:'PTWC-ended',time:Date.now()+1000,cancelled:true,hazardNature:'bulletin',warningLevel:'Encerrado',sev:0};items=[a,info,ended];await page.evaluate(()=>fetchOfficialTsunamiAlerts());await expect(page.locator('#pd-tsunami-link')).toContainText('Encerrado');await expect(page.locator('#pd-tsunami-link')).not.toContainText('Ameaça oficial');expect(await page.evaluate(()=>eventoSelecionadoId)).toBe(q.id);await expect(page.locator('#pd-tsunami-link .tsunami-link-row')).toHaveCount(2);
 await page.evaluate(ended=>{showAlertDetails(ended,false);clearTimeout(cycleTimeout);},ended);
 const revision={...ended,id:'PTWC-end-revision',time:Date.now()+2000};items=[info,revision];await page.evaluate(()=>fetchOfficialTsunamiAlerts());expect(await page.evaluate(()=>eventoSelecionadoId)).toBe(revision.id);expect(await page.evaluate(()=>window.__mgRevisionProtectedId)).toBe(revision.id);
});
test('a late quake correlation response cannot rewrite the tsunami card',async({page})=>{
 await boot(page);const {q,a}=fixtures();let resolveResponse;await page.route('**/correlate?**',async route=>{await new Promise(r=>resolveResponse=r);await route.fulfill({json:{tsunami:{level:'ALTO',score:90,action:'Old quake analysis'}}});});
 await page.evaluate(q=>{globalEvents=[q];eventoSelecionadoId=q.id;window.__linkCorrelation=monitorGlobalCorrelate(q);},q);await expect.poll(()=>Boolean(resolveResponse)).toBe(true);
 await page.evaluate(a=>{globalAlerts=[a];showAlertDetails(a,false);clearTimeout(cycleTimeout);},a);resolveResponse();await page.evaluate(()=>window.__linkCorrelation);await expect(page.locator('#mg-correlation-box')).toHaveCount(0);expect(await page.evaluate(()=>eventoSelecionadoId)).toBe(a.id);
});
for(const regional of [false,true])test('a manual bulletin after a random quake survives rotation and a minor arrival '+regional,async({page})=>{
 await boot(page);const {q,a}=fixtures(),info={...a,id:'panama-info',time:Date.now()-7*3600000,hazardNature:'bulletin',warningLevel:'Informativo',sev:0},regionalInfo={...info,id:'regional-info',source:'NTWC',feedKey:'NTWC-General',coords:null,place:'Área do boletim oficial'};
 await page.evaluate(({q,info,regionalInfo})=>{
  globalEvents=[{...q,id:'chile-old',mag:2.5,time:Date.now()-27*3600000,coords:[-69.4,-20],place:'Tarapaca, Chile'}];globalAlerts=[info,regionalInfo];pendingQuakeRevisions.clear();sidebarFilter='tsunami';applyFilters();window.__mgSoftCycle=true;showEventDetails(0,false);clearTimeout(cycleTimeout);map.stop();
 },{q,info,regionalInfo});
 const item=regional?regionalInfo:info;await page.locator('#events .event').filter({hasText:item.place==='Panama'?'Panamá':item.place}).click();await expect(page.locator('#pd-local')).toHaveText(regional?'Área do boletim oficial':'Panamá');
 expect(await page.evaluate(()=>getAutoCycleProtectionRemaining())).toBeGreaterThan(25000);
 await page.evaluate(()=>{map.stop();runAutoCycle();clearTimeout(cycleTimeout);});expect(await page.evaluate(()=>eventoSelecionadoId)).toBe(item.id);
 await page.clock.setFixedTime(await page.evaluate(()=>window.PresentationLimits.state().startedAt+35000));
 await page.evaluate(()=>{queueQuakeRevisions([{...globalEvents[0],_previousMag:2.4,_updatedAt:Date.now()}]);focusNextQuakeRevision();});expect(await page.evaluate(()=>eventoSelecionadoId)).toBe(item.id);
 await page.evaluate(()=>{const small={id:'new-small',type:'earthquake',mag:2.8,depth:10,time:Date.now(),coords:[26,36],place:'Turkey',source:'QA'};globalEvents.push(small);queueNewCameraQuakes([small]);focusNextNewCameraQuake();});expect(await page.evaluate(()=>eventoSelecionadoId)).toBe(item.id);
 await page.evaluate(()=>{const major={id:'new-major',type:'earthquake',mag:5.2,depth:10,time:Date.now(),coords:[26,36],place:'Turkey',source:'QA'};globalEvents.push(major);queueNewCameraQuakes([major]);focusNextNewCameraQuake();clearTimeout(cycleTimeout);});expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('new-major');
});
test('toolbar lets the user choose the exact bulletin; information effect clears on the next quake',async({page})=>{
 await boot(page);await page.emulateMedia({reducedMotion:'no-preference'});const {q,a}=fixtures(),info={...a,id:'panama-info',hazardNature:'bulletin',warningLevel:'Informativo',sev:0},regional={...info,id:'regional-info',source:'NTWC',feedKey:'NTWC-General',coords:null,place:'Área do boletim oficial'};
 await page.route('**/tsunami-alerts',r=>r.fulfill({json:{ok:true,sources:[{source:'PTWC',ok:true},{source:'NTWC',ok:true}],items:[info,regional]}}));
 await page.evaluate(q=>{globalEvents=[q];showEventDetails(0,false);clearTimeout(cycleTimeout);},q);await page.evaluate(()=>fetchOfficialTsunamiAlerts());
 await page.locator('#chip-tsunami-official').click();await expect(page.locator('#tsunami-bulletin-picker')).toBeVisible();
 await page.locator('#tsunami-bulletin-picker button[data-bulletin-id="panama-info"]').click();
 expect(await page.evaluate(()=>eventoSelecionadoId)).toBe(info.id);await expect(page.locator('#painel-direito')).toHaveClass(/pd-fx-tsunami-info/);await expect(page.locator('#pd-fx-overlay')).toHaveCSS('animation-name','pdBulletinEntrance');
 await expect(page.locator('.tsunami-bulletin-origin')).toHaveCount(1);await expect(page.locator('#pd-tsunami-link')).toHaveAttribute('data-quake-id',q.id);await expect(page.locator('#painel-direito .pd-cinema-layer')).toHaveCount(0);
 await page.evaluate(()=>{showEventDetails(0,false);clearTimeout(cycleTimeout);});await expect(page.locator('#painel-direito')).not.toHaveClass(/pd-fx-tsunami-info/);await expect(page.locator('.tsunami-bulletin-origin')).toHaveCount(0);
 await page.locator('#chip-tsunami-official').click();await page.locator('#tsunami-bulletin-picker button[data-bulletin-id="regional-info"]').click();
 expect(await page.evaluate(()=>eventoSelecionadoId)).toBe(regional.id);await expect(page.locator('#pd-tsunami-link')).toContainText('permanece regional');
});
