const {test,expect}=require('@playwright/test');test.use({serviceWorkers:'block',reducedMotion:'reduce'});
async function boot(page,width=1280){await page.setViewportSize({width,height:900});await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento&&window.SeismicScenarioDemo);await page.evaluate(()=>{pausarBuscas();map._render=()=>{};clearTimeout(cycleTimeout);pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();activeAlertingIds.clear();isFirstDisplay=false;isFirstLoad=false;window.__mgColdLoadGraceUntil=0;globalEvents=[];globalAlerts=[];});}
for(const width of [1280,390])test('menu oficial mostra a grade histórica real, sem catálogo ou anéis, e restaura a vista '+width,async({page})=>{
 await boot(page,width);await page.evaluate(()=>{map.jumpTo({center:[12,32],zoom:4});});const before=await page.evaluate(()=>({events:JSON.stringify(globalEvents),alerts:JSON.stringify(globalAlerts),selected:eventoSelecionadoId,center:map.getCenter().toArray(),zoom:map.getZoom()}));
 await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 await page.evaluate(()=>CardEffectDemo.open());await page.locator('#card-fx-demo-type').selectOption('seismic-official');await page.locator('#card-fx-demo-play').click();
 await expect.poll(()=>page.evaluate(()=>!!map.getLayer('quake-rupture-line'))).toBe(true);await expect(page.locator('.seismic-impact-status')).toContainText('Projeção da ruptura USGS');
 await expect(page.locator('#pd-linked-presentation')).toContainText('TESTE HISTÓRICO');await expect(page.locator('#pd-linked-presentation')).toContainText('M7,8');await expect(page.locator('#pd-linked-presentation')).toContainText('USGS ShakeMap');
 await page.waitForFunction(()=>__mgSeismicImpactState?.id==='seismic-scenario-official'&&__mgSeismicImpactState.features>0,{},{timeout:25000});
 expect(await page.evaluate(()=>__mgSeismicImpactState.method)).toBe('usgs-shakemap-finite');await expect(page.locator('.seismic-impact-status')).toContainText('USGS ShakeMap');await expect(page.locator('.seismic-impact-status')).not.toContainText('fictícia');
 expect(await page.evaluate(()=>['wave-front-p-line','wave-front-s-line'].map(id=>map.getLayoutProperty(id,'visibility')))).toEqual(['none','none']);
 await page.clock.runFor(6600);expect(await page.evaluate(()=>SeismicImpact.bounds('seismic-scenario-official'))).not.toBeNull();
 await page.getByRole('button',{name:'Parar',exact:true}).click();expect(await page.evaluate(()=>({events:JSON.stringify(globalEvents),alerts:JSON.stringify(globalAlerts),selected:eventoSelecionadoId,center:map.getCenter().toArray(),zoom:map.getZoom()}))).toEqual(before);
 await expect(page.locator('.seismic-scenario-pin,#pd-linked-presentation,#card-fx-demo-status')).toHaveCount(0);
});
test('M5,5 consulta novamente após um minuto, pausa oculto e troca para o oficial sem perder seleção',async({page})=>{
 await boot(page);let calls=0;const available={status:'available',method:'usgs-shakemap-grid',version:'official-poll-qa',provider:'USGS ShakeMap · intensidade publicada',grid:{nx:3,ny:3,x0:36,x1:38,y0:36,y1:38,values:[3,4,3,4,7,4,3,4,3]}};
 await page.route('**/rupture-shaking?**',r=>{calls++;return r.fulfill({json:calls===1?{status:'unavailable'}:available});});
 await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 await page.evaluate(()=>{globalEvents=[{id:'official-arrival',type:'earthquake',source:'QA',coords:[37,37],mag:5.5,depth:10,time:Date.now(),place:'Turquia'}];showEventDetails(0,true);});await expect.poll(()=>calls).toBe(1);await expect(page.locator('.seismic-impact-status')).toContainText('Aguardando mapa oficial USGS');
 await page.evaluate(()=>{window.__testHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>__testHidden});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.runFor(60000);expect(calls).toBe(1);
 await page.evaluate(()=>{__testHidden=false;document.dispatchEvent(new Event('visibilitychange'));});await expect.poll(()=>calls).toBe(2);await page.waitForFunction(()=>__mgSeismicImpactState?.method==='usgs-shakemap-grid');
 await expect(page.locator('.seismic-impact-status')).not.toContainText('Aguardando mapa oficial USGS');expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('official-arrival');await page.clock.runFor(30000);expect(calls).toBe(2);
 await page.evaluate(()=>{showAlertDetails({id:'leave-official',type:'storm',coords:[-100,50],time:Date.now(),source:'QA',place:'Outro evento'},false);});await page.clock.runFor(60000);expect(calls).toBe(2);
});
test('M5,4 fica com a estimativa e não consulta o mapa oficial',async({page})=>{
 await boot(page);let calls=0;await page.route('**/rupture-shaking?**',r=>{calls++;return r.fulfill({json:{status:'unavailable'}});});
 await page.evaluate(()=>{globalEvents=[{id:'below-official',type:'earthquake',source:'QA',coords:[37,37],mag:5.4,depth:10,time:Date.now(),place:'Turquia'}];showEventDetails(0,true);});await page.waitForFunction(()=>__mgSeismicImpactState?.id==='below-official'&&__mgSeismicImpactState.features>0);expect(calls).toBe(0);expect(await page.evaluate(()=>__mgSeismicImpactState.method)).toBe('radial');
});

test('grade oficial fraca preserva a fonte e não inventa uma pintura radial em terra',async({page})=>{
 await boot(page);await page.route('**/rupture-shaking?**',r=>r.fulfill({json:{status:'available',method:'usgs-shakemap-grid',version:'weak-official-qa',provider:'USGS ShakeMap · intensidade publicada',grid:{nx:3,ny:3,x0:36,x1:38,y0:36,y1:38,values:Array(9).fill(2.6)}}}));
 await page.evaluate(()=>{globalEvents=[{id:'weak-official',type:'earthquake',source:'QA',coords:[37,37],mag:5.5,depth:195,time:Date.now()-3600000,place:'Evento profundo'}];showEventDetails(0,false);});
 await page.waitForFunction(()=>__mgSeismicImpactState?.method==='usgs-shakemap-grid'&&__mgSeismicImpactState.features===0&&map.getSource('quake-impact')?.serialize().data.features.length===0&&document.querySelector('.seismic-impact-status')?.textContent.includes('nesta resolução'));
 expect(await page.evaluate(()=>map.getSource('quake-impact').serialize().data.features)).toEqual([]);
 await expect(page.locator('.seismic-impact-status')).toContainText('USGS ShakeMap');await expect(page.locator('.seismic-impact-status')).toContainText('Sem área em terra para pintar nesta resolução');
 await page.evaluate(()=>SeismicImpact.finish());await expect(page.locator('.seismic-impact-status')).toContainText('USGS ShakeMap');
 expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('weak-official');
});

for(const width of [1280,390])test('aviso oficial é discreto, não repete versão e dá prioridade aos eventos novos '+width,async({page})=>{
 await boot(page,width);await page.evaluate(()=>{for(let i=0;i<30;i++){const close=document.querySelector('#mobile-notice-stack .notice-close');if(!close)break;close.click();}});
 await page.route('**/rupture-shaking?**',r=>r.fulfill({json:{status:'available',method:'usgs-shakemap-grid',version:'notice-v1',provider:'USGS ShakeMap · intensidade publicada',grid:{nx:3,ny:3,x0:36,x1:38,y0:36,y1:38,values:[3,4,3,4,7,4,3,4,3]}}}));
 await page.evaluate(()=>{globalEvents=[{id:'official-notice',type:'earthquake',source:'QA',coords:[37,37],mag:5.5,depth:10,time:Date.now()-3600000,place:'Turquia'},{id:'new-notice-quake',type:'earthquake',source:'QA',coords:[38,38],mag:7,depth:10,time:Date.now(),place:'Novo sismo'}];showEventDetails(0,false);});
 await expect(page.locator('#mobile-notice-stack')).toContainText('Mapa oficial atualizado');await expect(page.locator('#mobile-notice-stack')).toContainText('USGS ShakeMap · M5,5 · Turquia');
 await page.evaluate(()=>{window.__noticeBefore={selected:eventoSelecionadoId,hold:__mgHoldEndsAt,tour:__mgPaintTourState.endsAt};window.__noticeContext={id:'official-notice',lng:37,lat:37,mag:5.5,depth:10,keepCamera:true,presentation:true};MobileNotices.push({key:'newquake-priority-qa',type:'newquake',title:'Novo sismo prioritário',duration:20000});SeismicImpact.start(__noticeContext,true);});
 await page.waitForFunction(()=>__mgSeismicImpactState?.features>0);await expect(page.locator('#mobile-notice-stack')).toContainText('Novo sismo prioritário');
 expect(await page.evaluate(()=>({selected:eventoSelecionadoId,hold:__mgHoldEndsAt,tour:__mgPaintTourState.endsAt}))).toEqual(await page.evaluate(()=>__noticeBefore));
 await page.evaluate(()=>{const shaking={...RuptureShaking.get(globalEvents[0]),version:'notice-v2'};SeismicImpact.start({...__noticeContext,shaking},true);});await page.waitForFunction(()=>__mgSeismicImpactState?.version==='notice-v2'&&__mgSeismicImpactState.features>0);
 await expect(page.locator('#mobile-notice-stack')).toContainText('Novo sismo prioritário');
 await page.evaluate(()=>MobileNotices.openHistory());expect(await page.locator('.notice-history-row').filter({hasText:'Mapa oficial atualizado'}).count()).toBe(2);await page.locator('#mobile-notice-history').evaluate(el=>el.close());
 await page.evaluate(()=>showEventDetails(1,true));expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('new-notice-quake');
});
