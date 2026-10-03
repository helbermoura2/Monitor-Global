const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
test.use({serviceWorkers:'block'});

async function boot(page,width=1280){
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.setViewportSize({width,height:844});await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&!!window.CardEffectDemo);
 await page.evaluate(()=>{
  const q={id:'parity-quake',type:'earthquake',mag:3,depth:10,source:'QA',coords:[-70,-20],place:'Sismo inicial QA',time:Date.now()};
  globalEvents=[q];showEventDetails(0,false);clearTimeout(cycleTimeout);SeismicCinema.stop();
  // Capture the profile at the shared renderer boundary, preserving the renderer.
  const create=CardCinemaFilm.create;CardCinemaFilm.create=function(cfg,...args){window.__effectProfile={...cfg};return create.call(this,cfg,...args);};
 });
 await expect(page.locator('#pd-local')).toHaveText('Sismo inicial QA — Bolívia',{timeout:12000});
}

const realSamples=[
 ['storm',{type:'storm',warningEvent:'Severe Thunderstorm Warning',detail:'Trovoadas e chuva intensa'}],
 ['hurricane',{type:'hurricane',classification:'HU',detail:'Furacão'}],
 ['typhoon',{type:'hurricane',classification:'TY',detail:'Tufão'}],
 ['tropical-storm',{type:'hurricane',classification:'TS',windKmh:85,detail:'Tempestade tropical'}],
 ['depression',{type:'hurricane',classification:'TD',windKmh:45,detail:'Depressão tropical'}],
 ['tornado',{type:'tornado',detail:'Tornado'}],
 ['fire',{type:'fire',detail:'Incêndio'}],
 ['volcano-lava',{type:'volcano',eruptionStatus:'Em erupção',detail:'Fluxo de lava ativo · emissão de cinzas'}],
 ['volcano-ash',{type:'volcano',eruptionStatus:'Em erupção',detail:'Emissão de cinzas · sem lava'}],
 ['volcano-monitoring',{type:'volcano',eruptionStatus:'Sem atividade eruptiva',detail:'Em monitoramento'}],
 ['flood',{type:'flood',detail:'Enchente'}],
 ['tsunami',{type:'tsunami',detail:'Tsunami'}],
 ['wind',{type:'wind',detail:'Rajadas de vento'}],
];
for(const width of [1280,390])test('todos os efeitos atmosféricos do Menu usam o mesmo perfil nos eventos reais '+width,async({page})=>{
 test.setTimeout(180000);await boot(page,width);
 for(const [key,extra] of realSamples){
  await page.evaluate(key=>CardEffectDemo.preview(key),key);
  await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-demo','true');
  const demo=await page.evaluate(()=>({...__effectProfile}));
  const actual=await page.evaluate(extra=>{
   const item={id:'parity-'+extra.type,type:extra.type,source:'QA',sev:3,windKmh:140,coords:[-70,20],place:'Evento real de teste',time:Date.now(),...extra};
   globalAlerts=[item];upsertAlert(item);showAlertDetails(item,false);clearTimeout(cycleTimeout);clearTimeout(window.__mgRadarDelayT);clearTimeout(window.__mgWaveDelayT);
   const text=()=>Object.fromEntries(['pd-local','pd-horario','pd-depth','pd-mercalli','pd-energy'].map(id=>[id,document.getElementById(id).textContent.replace(/\u00a0/g,' ')]));
   return {profile:{...__effectProfile},selectedId:EventStore.selectedId,text:text()};
  },extra);
  await expect(page.locator('#card-fx-demo-status')).toHaveCount(0);
  await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-demo','false');
  expect(actual.profile,key).toEqual(demo);
  await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-scene',extra.type);
  await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-renderer','film');
  if(extra.type==='hurricane')await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-cyclone-stage',key==='tropical-storm'?'tropical-storm':key==='depression'?'depression':'mature');
  if(key==='volcano-lava')await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-material','lava');
  if(key==='volcano-ash')await expect(page.locator('.pd-cinema-footage')).toHaveAttribute('src','media/card-fx/smoke.mp4');
  if(key==='volcano-monitoring')await expect(page.locator('.pd-cinema-footage')).toHaveAttribute('src','media/card-fx/terrain.mp4');
  expect(actual.selectedId).toBe('parity-'+extra.type);
  // Desktop also types each headline while the wind observer wraps graphemes.
  await expect(page.locator('#pd-local')).toHaveText('Evento real de teste',{timeout:12000});
  expect(await page.evaluate(()=>Object.fromEntries(['pd-local','pd-horario','pd-depth','pd-mercalli','pd-energy'].map(id=>[id,document.getElementById(id).textContent.replace(/\u00a0/g,' ')])))).toEqual(actual.text);
  expect(await page.locator('#pd-focus-btn').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#pd-focus-btn')===el;})).toBe(true);
 }
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.pd-cinema-layer,.pd-cinema-contact')).toHaveCount(0);
});

test('VAAC real, tradução USGS e revisão silenciosa mantêm cinzas e removem lava encerrada',async({page})=>{
 await boot(page);
 async function select(extra,silent=false){
  await page.evaluate(({extra,silent})=>{
   const item={id:'parity-feed-volcano',type:'volcano',source:'VAAC DARWIN',coords:[145.033,-4.083],place:'MANAM',time:Date.now(),...extra};
   globalAlerts=[item];upsertAlert(item);showAlertDetails(item,false,silent);clearTimeout(cycleTimeout);clearTimeout(window.__mgRadarDelayT);clearTimeout(window.__mgWaveDelayT);
  },{extra,silent});
 }
 // A real Darwin record uses VA, not the word ash; old profiles showed terrain.
 await select({eruptionStatus:'VA PLUME TO FL070 LAST OBS AT 03/0850Z',ashStatus:'VA PLUME TO FL070 LAST OBS AT 03/0850Z',detail:'VA PLUME TO FL070 LAST OBS AT 03/0850Z'});
 await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-activity','ash');
 await expect(page.locator('.pd-cinema-footage')).toHaveAttribute('src','media/card-fx/smoke.mp4');
 await expect(page.locator('.pd-cinema-heat')).toHaveCount(0);
 // showAlertDetails translates this synopsis before invoking CinematicCard.
 await select({source:'USGS VHP',eruptionStatus:'Atividade elevada / monitorada',detail:'Eruption continues with frequent explosions and ash emissions.'},true);
 await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-activity','eruptive');
 await expect(page.locator('.pd-cinema-heat')).toHaveCount(2);
 await expect(page.locator('.pd-cinema-layer')).not.toHaveAttribute('data-material','lava');
 await select({source:'USGS VHP',eruptionStatus:'ERUPTING',detail:'Active lava flow, no ash.'},true);
 await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-material','lava');
 await select({source:'USGS VHP',eruptionStatus:'Eruption ended',detail:'Lava flow ceased. No ash observed.'},true);
 await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-activity','monitoring');
 await expect(page.locator('.pd-cinema-footage')).toHaveAttribute('src','media/card-fx/terrain.mp4');
 await expect(page.locator('.pd-cinema-heat')).toHaveCount(0);
});

test('atividade vulcânica exige sinais positivos em EN/PT e abreviações VAAC',async({page})=>{
 await page.setContent('<div id="painel-direito" style="width:320px;height:500px"><span id="pd-mag"></span></div>');
 await page.evaluate(()=>{window.CardCinemaFilm={create:cfg=>{window.__profile={...cfg};return null;},footage:()=>null};window.requestAnimationFrame=()=>1;window.cancelAnimationFrame=()=>{};});
 await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../js/cinematic-card.js'),'utf8')});
 const samples=[
  [{detail:'VA PLUME TO FL070 LAST OBS AT 03/0850Z'},[false,true,false]],
  [{detail:'VA TO FL150 LAST OBS AT 03/1630Z MOV NW'},[false,true,false]],
  [{detail:'INTERMITTENT VA ERUPTIONS TO FL070 OBS MOV'},[true,true,false]],
  [{detail:'Volcanic Ash Advisory (Tokyo VAAC)'},[false,true,false]],
  [{detail:'Aviso de cinzas vulcânicas'},[false,true,false]],
  [{activityStatus:'Pluma de cinzas observada'},[false,true,false]],
  [{vonaRemarks:'Ash emissions continue from the summit.'},[true,true,false]],
  [{ashHeight:'FL140'},[false,true,false]],
  [{ashHeight:'3000 m'},[false,true,false]],
  [{detail:'A erupção continua com explosões frequentes e emissões de cinzas'},[true,true,false]],
  [{eruptionStatus:'Atividade eruptiva'},[true,true,false]],
  [{activityStatus:'Eruptivo atividade continua'},[true,true,false]],
  [{eruptionStatus:'ERUPTION'},[true,true,false]],
  [{eruptionStatus:'ERUPTING',detail:'Lava flows active. No ash.'},[true,false,true]],
  [{eruptionStatus:'Em erupção',detail:'Atividade efusiva contínua · sem cinzas'},[true,false,true]],
  [{eruptionStatus:'Em erupção',detail:'Emissão de cinzas · sem fluxo de lava'},[true,true,false]],
  [{eruptionStatus:'Em erupção',detail:'No lava or effusive activity. Ash emission continues.'},[true,true,false]],
  [{eruptionStatus:'Sem atividade eruptiva',detail:'Em monitoramento'},[false,false,false]],
  [{detail:'No eruptive activity at surface but significant volcanic unrest'},[false,false,false]],
  [{detail:'POSSIBLE ERUPTION AT 20261001/1527Z',source:'VAAC DARWIN'},[false,false,false]],
  [{detail:'Nova atividade eruptiva/unrest (relatório semanal)',ashStatus:'New Activity/Unrest'},[false,false,false]],
  [{detail:'Historical lava flow from the previous eruption'},[false,false,false]],
  [{eruptionStatus:'Erupção encerrada',detail:'Fluxo de lava cessou. Sem cinzas'},[false,false,false]],
  [{eruptionStatus:'Erupção ended',detail:'Fluxo de lava ativo · sem cinzas'},[false,false,false]],
  [{eruptionStatus:'No eruptivo atividade',detail:'Lava flow active. No ash.'},[false,false,false]],
  [{detail:'No ash emissions or lava flows observed'},[false,false,false]],
  [{detail:'Eruption continues. Lava flow ceased.'},[true,true,false]],
  [{detail:'A erupção continua. Lava flow ceased in the old crater.'},[true,true,false]],
  [{detail:'Eruption continues with lava flow ceased in the old crater.'},[true,true,false]],
  [{detail:'No evidence of lava flow'},[false,false,false]],
  [{detail:'Ash emissions have not been observed'},[false,false,false]],
  [{detail:'Sem evidências de emissão de cinzas ou fluxo de lava'},[false,false,false]],
  [{detail:'Cinzas não foram observadas'},[false,false,false]],
  [{detail:'No evidence of lava flow. Ash emissions continue.'},[true,true,false]],
  [{detail:'Sem emissão de cinzas, mas fluxo de lava ativo'},[true,false,true]],
  [{detail:'Eruption continues without lava or ash emissions'},[true,false,false]],
  [{detail:'No evidence of eruptive activity'},[false,false,false]],
  [{detail:'Eruptive activity has not been observed'},[false,false,false]],
  [{detail:'Sem evidências de atividade eruptiva'},[false,false,false]],
  [{detail:'Atividade eruptiva não foi observada'},[false,false,false]],
  [{detail:'Lava flows are inactive'},[false,false,false]],
  [{detail:'Lava flows are no longer active'},[false,false,false]],
  [{detail:'Inactive lava flows'},[false,false,false]],
  [{detail:'Fluxos de lava inativos'},[false,false,false]],
  [{detail:'VA NOT IDENTIFIABLE ON SATELLITE'},[false,false,false]],
  [{detail:'Ash advisory terminated. No ash observed.'},[false,false,false]],
  [{aviationColor:'red',usgsAlertLevel:'WARNING',usgsVona:{noticeId:'notice'},detail:'Atividade elevada / monitorada'},[false,false,false]],
  // A residual ash cloud can remain after an eruption stops, without heat/lava.
  [{eruptionStatus:'Eruption ended',detail:'Residual ash cloud drifting east'},[false,true,false]],
 ];
 for(const [extra,expected] of samples){
  const actual=await page.evaluate(extra=>{CinematicCard.start({id:'profile',type:'volcano',...extra});const {hot,ash,lava}=__profile;CinematicCard.stop();return [hot,ash,lava];},extra);
  expect(actual,JSON.stringify(extra)).toEqual(expected);
 }
});
