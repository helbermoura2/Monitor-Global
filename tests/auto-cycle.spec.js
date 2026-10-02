const {test,expect}=require('@playwright/test');test.use({serviceWorkers:'block',reducedMotion:'reduce'});
for(const width of [1280,390])test('ciclo2+1 varia eventos e retoma o slot depois de nova chegada '+width,async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.setViewportSize({width,height:844});await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!isFirstDisplay&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{
  const now=Date.now();globalEvents=Array.from({length:80},(_,i)=>({id:'rotation-q'+i,type:'earthquake',source:'Visual QA',coords:[-46,-23],mag:3,depth:10,time:now,place:'Sismo de teste '+i}));
  globalAlerts=['fire','hurricane','flood','wind','volcano','storm'].map(type=>({id:'rotation-'+type,type,source:'Visual QA',coords:[-46,-23],time:now,place:'Evento de teste '+type,detail:'Registro demonstrativo',bandeira:'🇧🇷'}));
  window.__mgAutoRotation=undefined;window.__mgRevisionProtectedUntil=0;window.__mgLiveQuakeUntil=0;pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();
  map.flyTo=()=>{};map.isMoving=()=>false;window.softFlyToCoords=()=>0;
  window.__tickRotation=()=>{const original=window.setTimeout;let callback;window.setTimeout=(fn,ms)=>{callback=fn;return 0;};try{scheduleNextAutoCycle(5000);}finally{window.setTimeout=original;}callback();clearTimeout(cycleTimeout);clearTimeout(window.__mgRadarDelayT);clearTimeout(window.__mgWaveDelayT);return {id:EventStore.selectedId,type:EventStore.getSelected()?.type,phase:window.__mgAutoRotation?.phase,error:window.__lastPainelDetalheError};};
 });
 const first=await page.evaluate(()=>__tickRotation());expect(first.type).toBe('earthquake');expect(first.phase).toBe(1);expect(first.error).toBeFalsy();
 const incoming=await page.evaluate(()=>{const state=window.__mgAutoRotation,remaining=state.quakes.remaining.slice(),x={...globalEvents[0],id:'rotation-new',mag:5.6,place:'Nova chegada de teste'};globalEvents.push(x);queueNewCameraQuakes([x]);focusNextNewCameraQuake();clearTimeout(cycleTimeout);clearTimeout(window.__mgRadarDelayT);clearTimeout(window.__mgWaveDelayT);return {id:EventStore.selectedId,phase:state.phase,same:remaining.join('|')===state.quakes.remaining.join('|')};});
 expect(incoming).toEqual({id:'rotation-new',phase:1,same:true});await expect(page.locator('#pd-local')).toContainText('Nova chegada');
 const waiting=await page.evaluate(()=>__tickRotation());expect(waiting.id).toBe('rotation-new');expect(waiting.phase).toBe(1);
 await page.evaluate(()=>{window.__mgRevisionProtectedUntil=0;window.__mgLiveQuakeUntil=0;});
 const second=await page.evaluate(()=>__tickRotation());expect(second.type).toBe('earthquake');expect(second.phase).toBe(2);expect(second.id).not.toBe('rotation-new');
 const other=await page.evaluate(()=>__tickRotation());expect(other.type).not.toBe('earthquake');expect(other.phase).toBe(0);expect(other.error).toBeFalsy();await expect(page.locator('#pd-local')).toContainText('Evento de teste');
 const rotation=await page.evaluate(()=>{const rows=[];for(let i=0;i<18;i++)rows.push(__tickRotation());return rows;});
 for(let i=0;i<rotation.length;i++)expect(rotation[i].type==='earthquake').toBe(i%3!==2);
 const types=[other.type,...rotation.filter(x=>x.type!=='earthquake').map(x=>x.type)];expect(new Set(types.slice(0,6)).size).toBe(6);
 expect(rotation.every(x=>!x.error)).toBe(true);await page.evaluate(()=>{clearTimeout(cycleTimeout);CinematicCard.stop();});
});
