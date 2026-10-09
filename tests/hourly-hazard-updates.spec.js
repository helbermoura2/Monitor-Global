const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block',reducedMotion:'reduce'});
test('hourly schedules and urgent volcano polling preserve routine data until the hourly refresh',async({page})=>{
 const base=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';
 await page.addInitScript(()=>{let scheduler;window.__scheduled=[];Object.defineProperty(window,'PeriodicScheduler',{configurable:true,get:()=>scheduler,set:value=>{scheduler=value;const every=value.every;value.every=function(key,fn,delay,interval,...rest){window.__scheduled.push({name:fn.name,delay,interval});return every(key,fn,delay,interval,...rest);};}});});
 await page.route('**/*',r=>new URL(r.request().url()).hostname===new URL(base).hostname?r.continue():r.abort());
 await page.goto(base+'/?verify='+Date.now());await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&window.__mgMapReady);
 const intervals=await page.evaluate(()=>__scheduled);
 for(const name of ['fetchRealHurricanes','fetchEonetStorms'])expect(intervals.find(j=>j.name===name)?.interval).toBe(3600000);
 expect(intervals.filter(j=>j.delay===3000).some(j=>j.interval===3600000)).toBe(true);
 expect(intervals.find(j=>j.delay===63000)?.interval).toBe(60000);
 await page.evaluate(async()=>{
  pausarBuscas();await fetchVolcanoes();globalEvents=[];globalAlerts=[];knownAlertIds.clear();for(const f of ['volcanoGdacs','volcanoUsgs','volcanoVaac'])fontesBooted.delete(f);
  clearTimeout(cycleTimeout);eventoSelecionadoId=null;EventStore.selectedId=null;window.__mgHoldEndsAt=0;window.__mgLiveQuakeId=null;pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();
  playAlertTone=()=>{};notificarNavegador=()=>{};fetchGdacsEvents=async()=>[];fetchUSGSVolcanoProfessional=async()=>({all:[],elevated:[]});
  window.__report={name:'Volcano hourly QA',coords:[167.83,-15.4],source:'VAAC Darwin',detail:'Atividade monitorada',time:Date.now()};
  fetchGlobalVolcanoAdvisories=async()=>[__report];await fetchVolcanoes();clearTimeout(cycleTimeout);
  __report.detail='Monitoramento diário atualizado';await fetchVolcanoUrgentUpdates();clearTimeout(cycleTimeout);
 });
 expect(await page.evaluate(()=>globalAlerts.find(a=>a.id==='vaac-volcano-hourly-qa').vulcanicActivity)).toBe('Atividade monitorada');
 await page.evaluate(async()=>{__report.detail='Explosive eruption detected. Ash plume observed.';await fetchVolcanoUrgentUpdates();clearTimeout(cycleTimeout);});
 expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('vaac-volcano-hourly-qa');
 expect(await page.evaluate(()=>globalAlerts.find(a=>a.id==='vaac-volcano-hourly-qa')._volcanoEscalation)).toBe('Explosão reportada pela fonte');
 await page.evaluate(async()=>{fetchGlobalVolcanoAdvisories=async()=>[];await fetchVolcanoUrgentUpdates();clearTimeout(cycleTimeout);});
 expect(await page.evaluate(()=>globalAlerts.some(a=>a.id==='vaac-volcano-hourly-qa'))).toBe(true);
 await page.evaluate(async()=>{__report.detail='Monitoramento após a erupção';fetchGlobalVolcanoAdvisories=async()=>[__report];await fetchVolcanoes();clearTimeout(cycleTimeout);});
 expect(await page.evaluate(()=>globalAlerts.find(a=>a.id==='vaac-volcano-hourly-qa').vulcanicActivity)).toBe('Monitoramento após a erupção');
});
