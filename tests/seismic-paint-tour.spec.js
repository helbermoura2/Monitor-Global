const {test,expect}=require('@playwright/test');test.use({serviceWorkers:'block',reducedMotion:'reduce'});
for(const width of [1280,390])test('sequência do epicentro à pintura respeita pausas, guarda o evento e não usa anéis '+width,async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.setViewportSize({width,height:844});await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento);await page.evaluate(()=>{pausarBuscas();map._render=()=>{};});
 await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 await page.evaluate(()=>{
  clearTimeout(cycleTimeout);pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();activeAlertingIds.clear();isFirstLoad=false;isFirstDisplay=false;globalAlerts=[];
  globalEvents=[{id:'past-tour',type:'earthquake',source:'QA',place:'Sismo passado',coords:[-70,-20],mag:3.4,depth:10,time:Date.now()-12*3600000}];
  window.__cameraCalls=[];window.__paintCalls=[];
  map.easeTo=o=>__cameraCalls.push(o);map.flyTo=o=>__cameraCalls.push(o);map.stop=()=>{};
  SeismicImpact.start=(c,full)=>__paintCalls.push({start:c,full});SeismicImpact.reveal=(r,full)=>__paintCalls.push({r,full});SeismicImpact.finish=()=>__paintCalls.push({finish:true});SeismicImpact.bounds=()=>[-71,-21,-69,-19];
  window.__mgSoftCycle=true;window.__mgRotationDisplay=true;showEventDetails(0,false);window.__mgRotationDisplay=false;
 });
 expect(await page.evaluate(()=>__mgPaintTourState.stage)).toBe('epicenter-enter');expect(await page.evaluate(()=>PresentationLimits.state())).toBe(null);
 const stages=[];for(const [ms,stage]of [[6000,'epicenter-hold'],[5000,'paint-opening'],[12000,'area-hold'],[5000,'epicenter-return'],[4000,'epicenter-second-hold'],[7000,'area-final-opening'],[10000,'area-final-hold']]){
  await page.clock.runFor(ms);stages.push(await page.evaluate(()=>__mgPaintTourState?.stage));expect(stages.at(-1)).toBe(stage);expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('past-tour');
 }
 const check=await page.evaluate(()=>({remaining:SeismicPaintTour.remaining(),calls:__cameraCalls,paint:__paintCalls,startState:__mgPaintTourState,layers:['wave-front-p-line','wave-front-s-line'].map(id=>map.getLayoutProperty(id,'visibility'))}));
 expect(check.remaining).toBe(7000);expect(check.startState.past).toBe(true);expect(check.layers).toEqual(['none','none']);expect(check.paint.some(c=>c.finish)).toBe(true);expect(check.calls.some(c=>c.bounds?.join(',')==='-71,-21,-69,-19')).toBe(true);
 await page.clock.runFor(7000);expect(await page.evaluate(()=>__mgPaintTourState)).toBe(null);
});
test('troca de seleção cancela todos os movimentos pendentes da pintura',async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento);await page.evaluate(()=>{pausarBuscas();map._render=()=>{};});await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 const before=await page.evaluate(()=>{clearTimeout(cycleTimeout);window.__tourMoves=[];map.easeTo=o=>__tourMoves.push(o);SeismicImpact.start=()=>{};SeismicImpact.bounds=()=>[-71,-21,-69,-19];const q={id:'cancel-tour',coords:[-70,-20],mag:4,depth:10,time:Date.now()};eventoSelecionadoId=q.id;EventStore.setSelected(q.id);SeismicPaintTour.start(q,7);eventoSelecionadoId='different';EventStore.setSelected('different');clearTimeout(cycleTimeout);return __tourMoves.length;});await page.clock.runFor(60000);expect(await page.evaluate(()=>__tourMoves.length)).toBe(before);expect(await page.evaluate(()=>SeismicPaintTour.remaining())).toBe(0);
});
test('pintura real inclui as faixas fracas nos limites do enquadramento',async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);map._render=()=>{};globalAlerts=[];isFirstLoad=false;isFirstDisplay=false;globalEvents=[{id:'real-paint-past',type:'earthquake',source:'QA',coords:[-47,-23],mag:3.4,depth:5,time:Date.now()-12*3600000,place:'Sismo passado Brasil'}];window.__mgSoftCycle=true;window.__mgRotationDisplay=true;showEventDetails(0,false);window.__mgRotationDisplay=false;});
 await page.waitForFunction(()=>SeismicImpact.bounds('real-paint-past'),{},{timeout:15000});
 const r=await page.evaluate(async()=>{const c={id:'real-paint-past',lng:-47,lat:-23,mag:3.4,depth:5},data=await SeismicImpact.snapshot(c),b=SeismicImpact.bounds(c.id);let outside=0,weak=0;for(const f of data.features){if(f.properties.pga<2.1)weak++;for(const poly of f.geometry.coordinates)for(const ring of poly)for(const [x,y]of ring)if(x<b[0]-.00001||x>b[2]+.00001||y<b[1]-.00001||y>b[3]+.00001)outside++;}SeismicPaintTour.stop();clearTimeout(cycleTimeout);return {outside,weak,features:data.features.length};});
 expect(r.features).toBeGreaterThan(0);expect(r.weak).toBeGreaterThan(0);expect(r.outside).toBe(0);
});
test('eventos novos mantêm tempos por magnitude e intercalam foco e área pintada',async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento);await page.evaluate(()=>{pausarBuscas();map._render=()=>{};});await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 const times=await page.evaluate(()=>[4.9,5,5.9,6,6.9,7,7.9,8].map(m=>({m,newMs:SeismicPaintTour.timeline(m,'new').reduce((n,p)=>n+p[1],0),autoMs:SeismicPaintTour.timeline(m,'auto').reduce((n,p)=>n+p[1],0),manualMs:SeismicPaintTour.timeline(m,'manual').reduce((n,p)=>n+p[1],0)})));
 expect(times.map(t=>t.newMs)).toEqual([90000,120000,120000,210000,210000,300000,300000,420000]);expect(times.every(t=>t.autoMs===56000&&t.manualMs===56000)).toBe(true);
 await page.evaluate(()=>{clearTimeout(cycleTimeout);pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();activeAlertingIds.clear();isFirstLoad=false;isFirstDisplay=false;globalAlerts=[];globalEvents=[{id:'new-m6',type:'earthquake',source:'QA',coords:[-70,-20],mag:6.2,depth:10,time:Date.now()-60000,place:'Novo forte'}];SeismicImpact.start=()=>{};SeismicImpact.reveal=()=>{};SeismicImpact.finish=()=>{};SeismicImpact.bounds=()=>[-71,-21,-69,-19];map.easeTo=()=>{};map.flyTo=()=>{};map.stop=()=>{};showEventDetails(0,true);});
 expect(await page.evaluate(()=>SeismicPaintTour.remaining())).toBe(210000);
 await page.clock.runFor(56000);expect(await page.evaluate(()=>SeismicPaintTour.remaining())).toBe(154000);expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('new-m6');
 await page.clock.runFor(154000);expect(await page.evaluate(()=>SeismicPaintTour.remaining())).toBe(0);expect(await page.evaluate(()=>__mgPaintTourState)).toBe(null);
});
