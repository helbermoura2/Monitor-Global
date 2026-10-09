const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block',reducedMotion:'reduce'});
for(const width of [1280,390])test('aleatório exclui 222h, respeita 72h e mantém acesso manual '+width,async({page})=>{
 const base=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';
 await page.setViewportSize({width,height:844});
 await page.route('**/*',r=>new URL(r.request().url()).hostname===new URL(base).hostname?r.continue():r.abort());
 await page.goto(base+'/?verify=auto-age-72h');
 await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&window.__mgMapReady);
 await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 const result=await page.evaluate(()=>{
  pausarBuscas();clearTimeout(cycleTimeout);PresentationLimits.clear();pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();activeAlertingIds.clear();
  window.__mgRevisionProtectedUntil=0;window.__mgLiveQuakeUntil=0;window.__mgHoldEndsAt=0;window.__mgAutoRotation=undefined;eventoSelecionadoId=null;isFirstDisplay=false;
  const now=Date.now(),quake=(id,hours)=>({id,type:'earthquake',mag:4.3,depth:10,time:now-hours*3600000,coords:[-65,-20],place:id,source:'EMSC'});
  globalEvents=[quake('Old 222h Bolivia',222),quake('Exactly 72h',72),quake('Recent 2h',2)];
  globalAlerts=[{id:'Old storm',type:'storm',time:now-222*3600000,coords:[-46,-23],place:'Old storm'}, {id:'Recent storm',type:'storm',time:now-3600000,coords:[-46,-23],place:'Recent storm'}];
  const ids=[];for(let i=0;i<30;i++)ids.push(selectNextAutoCycleItem()?.id);
  pendingQuakeRevisions.set(globalEvents[0].id,{...globalEvents[0],_updatedAt:now});
  const revised=focusNextQuakeRevision();
  return {ids:[...new Set(ids)],revised,pending:pendingQuakeRevisions.size};
 });
 expect(result.ids.sort()).toEqual(['Exactly 72h','Recent 2h','Recent storm']);expect(result.revised).toBe(false);expect(result.pending).toBe(0);
 await page.clock.runFor(1);
 const aged=await page.evaluate(()=>{const ids=[];for(let i=0;i<20;i++)ids.push(selectNextAutoCycleItem()?.id);return [...new Set(ids)]});
 expect(aged.sort()).toEqual(['Recent 2h','Recent storm']);
 await page.evaluate(()=>{window.__mgSoftCycle=false;showEventDetails(0,true);clearTimeout(cycleTimeout)});
 await expect(page.locator('#pd-local')).toContainText('Old 222h Bolivia');
 expect(await page.evaluate(()=>window.__lastPainelDetalheError)).toBeFalsy();
});
