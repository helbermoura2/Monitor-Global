const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block',reducedMotion:'no-preference'});
async function boot(page,width){
 await page.setViewportSize({width,height:900});await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto('/');await page.waitForFunction(()=>__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{
  pausarBuscas();map._render=()=>{};clearTimeout(cycleTimeout);pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();activeAlertingIds.clear();globalAlerts=[];isFirstLoad=false;isFirstDisplay=false;window.__mgColdLoadGraceUntil=0;
  globalEvents=[{id:'sound-start',type:'earthquake',mag:2.4,depth:10,coords:[-50,-20],time:Date.now()-3600000,place:'Inicial',source:'QA'},{id:'sound-next',type:'earthquake',mag:6.4,depth:10,coords:[140,35],time:Date.now(),place:'Novo sismo',source:'QA'}];
  somAtivo=true;somMutedTypes.clear();historicoSomSismo=[];sismosSonorizados.clear();filaSonsPendentes=[];processandoFilaSom=false;proximoSomLivre=0;
  window.__soundLog=[];window.__voiceLog=[];window.__cardLog=[];ensureAudio=()=>true;tone=(...args)=>__soundLog.push({at:Date.now(),args});noise=()=>{};speakAlert=(...args)=>__voiceLog.push({at:Date.now(),args});
  const original=triggerCardFx;triggerCardFx=(type,color,item)=>{__cardLog.push({id:item.id,at:Date.now()});return original(type,color,item);};
 });
 await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 await page.evaluate(()=>{window.__mgSoftCycle=true;showEventDetails(0,false);clearTimeout(cycleTimeout);});await page.clock.runFor(6000);
 await page.evaluate(()=>{SeismicCinema.stop();CinematicCard.stop();EventCamera.cancel();map.stop();__cardLog=[];});
}
for(const width of [1280,390])for(const kind of ['quake','volcano'])test('sound starts at world view, card effect at destination '+kind+' '+width,async({page})=>{
 await boot(page,width);
 await page.evaluate(kind=>{
  window.__audioTripAt=Date.now();
  if(kind==='quake')anunciarSismosSuplementares([globalEvents[1]]);
  else{const item={id:'sound-volcano',type:'volcano',coords:[127.63,1.49],time:Date.now(),place:'Ibu',source:'VAAC DARWIN',detail:'ERUPTION REPORTED. VA EMISSION TO FL100.'};globalAlerts=[item];VolcanoPriority.enqueue(item,'Erupção reportada');VolcanoPriority.focus();}
  clearTimeout(cycleTimeout);
 },kind);
 const id=kind==='quake'?'sound-next':'sound-volcano';expect(await page.evaluate(()=>eventoSelecionadoId)).toBe(id);
 expect(await page.evaluate(()=>__soundLog.length)).toBe(0);await page.clock.runFor(5999);expect(await page.evaluate(()=>__soundLog.length)).toBe(0);
 await page.clock.runFor(101);const sounds=await page.evaluate(()=>__soundLog.map(s=>s.at-__audioTripAt));expect(sounds.length).toBeGreaterThan(0);expect(sounds[0]).toBeGreaterThanOrEqual(6000);expect(sounds[0]).toBeLessThanOrEqual(6100);
 expect(await page.evaluate(()=>map.getZoom())).toBeLessThan(3);expect(await page.evaluate(()=>__cardLog.length)).toBe(0);
 await page.clock.runFor(1500);expect(await page.evaluate(()=>__voiceLog.length)).toBe(kind==='quake'?1:0);
 await page.clock.runFor(10300);expect(await page.evaluate(()=>__cardLog.length)).toBe(0);await page.clock.runFor(100);
 expect(await page.evaluate(()=>__cardLog.map(c=>c.id))).toEqual([id]);
});
test('manual map interaction cancels the pending event sound',async({page})=>{
 await boot(page,390);await page.evaluate(()=>anunciarSismosSuplementares([globalEvents[1]]));await page.clock.runFor(4000);
 await page.evaluate(()=>map.fire('dragstart',{originalEvent:{}}));await page.clock.runFor(15000);
 expect(await page.evaluate(()=>__soundLog.length)).toBe(0);expect(await page.evaluate(()=>__voiceLog.length)).toBe(0);
});
