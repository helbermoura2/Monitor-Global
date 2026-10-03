const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
test.use({serviceWorkers:'block'});
async function boot(page,width){
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.setViewportSize({width,height:844});await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&!!window.CardEffectDemo);
 await page.evaluate(()=>{const q={id:'cyclone-qa',type:'earthquake',mag:3,depth:10,source:'QA',coords:[-70,-20],place:'Evento real de teste',time:Date.now()};globalEvents=[q];showEventDetails(0,false);clearTimeout(cycleTimeout);clearTimeout(window.__mgRadarDelayT);clearTimeout(window.__mgWaveDelayT);SeismicCinema.stop();});
}
for(const width of [1280,390])test('ciclones cinematográficos preservam dados e controles '+width,async({page})=>{
 await boot(page,width);const errors=[];// External feeds are deliberately aborted by boot; retain all other browser errors.
 page.on('pageerror',e=>{if(e.message!=='Failed to fetch')errors.push(e.message);});page.on('console',m=>{if(m.text().includes('[CardCinema]'))errors.push(m.text());});
 await expect(page.locator('#pd-local')).toHaveText('Evento real de teste — Bolívia');
 const before=await page.evaluate(()=>({id:eventoSelecionadoId,local:document.getElementById('pd-local').textContent,mag:document.getElementById('pd-mag').textContent}));
 for(const key of ['hurricane','typhoon','tropical-storm']){
  await page.evaluate(k=>CardEffectDemo.preview(k),key);
  await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-scene','hurricane');
  await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-renderer','film');
  await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-cyclone-stage',key==='tropical-storm'?'tropical-storm':'mature');
  await expect.poll(()=>page.locator('#pd-local .pd-fx-windletter').count()).toBeGreaterThan(5);
  await expect.poll(()=>page.locator('#pd-depth .pd-fx-windletter').count()).toBeGreaterThan(1);
  await expect(page.locator('.pd-cinema-contact')).toHaveCSS('pointer-events','none');
  await expect(page.locator('.pd-cinema-footage')).toHaveCount(0);
  await expect(page.locator('#painel-direito')).toHaveCSS('animation-name',width===390?'sheetUp':'none');
  await page.waitForTimeout(1500);
  expect(await page.evaluate(()=>({id:eventoSelecionadoId,local:document.getElementById('pd-local').textContent,mag:document.getElementById('pd-mag').textContent}))).toEqual(before);
  expect(await page.locator('#pd-focus-btn').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#pd-focus-btn')===el;})).toBe(true);
  await page.screenshot({path:'/tmp/cyclone-'+key+'-'+width+'.png'});
  if(width===390){
   await page.evaluate(()=>{document.body.classList.remove('mobile-details-mid');document.body.classList.add('mobile-details-open');});
   await page.waitForTimeout(500);await page.screenshot({path:'/tmp/cyclone-'+key+'-expanded-'+width+'.png'});
   await page.evaluate(()=>{document.body.classList.remove('mobile-details-open');document.body.classList.add('mobile-details-mid');});
  }
 }
 expect(errors).toEqual([]);
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.pd-cinema-layer,.pd-cinema-contact,.pd-fx-windletter,.pd-fx-windword')).toHaveCount(0);
 expect(await page.locator('#painel-direito').evaluate(el=>Array.from(el.style).filter(k=>k.startsWith('--pd-wind-')))).toEqual([]);
});

// The fallback exercises the pressure field and text lifecycle without a GPU.
async function isolatedCyclone(page,width=1280){
 await page.setViewportSize({width,height:844});
 await page.setContent('<body class="mobile-details-mid"><div id="painel-direito" style="position:absolute;left:20px;top:30px;width:320px;height:600px;background:#0b2231;border:1px solid #68808d;border-radius:16px;isolation:isolate"><div id="pd-mag"></div><div id="pd-local">Furacão JOANA — São Paulo</div><div id="pd-horario" class="pd-time">03/10/2026 às 12:30 UTC</div><div id="pd-depth" class="stat-card-value"><strong style="color:rgb(235,189,82)">Categoria 3</strong></div><div id="pd-fault-type">Furacão do Atlântico</div><button id="control">Detalhes oficiais</button></div></body>');
 for(const file of ['painel-fx.css','cinematic-card.css'])await page.addStyleTag({content:fs.readFileSync(path.join(__dirname,'../css',file),'utf8')});
 await page.evaluate(()=>{window.__cycloneFrame=null;window.requestAnimationFrame=cb=>{__cycloneFrame=cb;return 1;};window.cancelAnimationFrame=()=>{__cycloneFrame=null;};});
 for(const file of ['painel-fx.js','cinematic-card.js'])await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../js',file),'utf8')});
}
for(const width of [1280,390])test('ciclone move vidro e tipografia, preservando palavras e fallback '+width,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await isolatedCyclone(page,width);
 const result=await page.evaluate(()=>{
  const ids=['pd-local','pd-horario','pd-depth','pd-fault-type'];
  const text=()=>Object.fromEntries(ids.map(id=>[id,document.getElementById(id).textContent]));
  const before=text(),begin=performance.now();CinematicCard.start({id:'fallback-cyclone',type:'hurricane',windKmh:165,coords:[-45,18]},Infinity);
  const panel=document.getElementById('painel-direito'),values=[];let letter=0;
  for(let i=1;i<=180;i++){
   __cycloneFrame(begin+i*33.34);values.push(parseFloat(panel.style.getPropertyValue('--pd-wind-x')));
   for(const el of panel.querySelectorAll('.pd-fx-windletter'))letter=Math.max(letter,Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m41));
  }
  const canvas=document.querySelector('.pd-cinema-contact canvas'),pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  return {before,after:text(),movement:Math.max(...values)-Math.min(...values),letter,wet:pixels.some((v,i)=>i%4===3&&v>8),wrapped:ids.every(id=>document.getElementById(id).querySelector('.pd-fx-windletter')),renderer:document.querySelector('.pd-cinema-layer').dataset.renderer};
 });
 expect(result.renderer).toBe('layers');expect(result.wrapped).toBe(true);
 expect(result.movement).toBeGreaterThan(.4);expect(result.letter).toBeGreaterThan(.5);expect(result.wet).toBe(true);
 expect(result.after).toEqual(result.before);
 await expect(page.locator('#pd-depth strong')).toHaveCSS('color','rgb(235, 189, 82)');
 await expect(page.locator('#control .pd-fx-windletter')).toHaveCount(0);
 await expect(page.locator('.pd-fx-windword .pd-fx-windword,.pd-fx-windletter .pd-fx-windletter')).toHaveCount(0);
 await page.evaluate(()=>document.getElementById('pd-local').textContent='Tufão atualizado — outro local');
 await expect(page.locator('#pd-local .pd-fx-windletter')).not.toHaveCount(0);
 await expect(page.locator('#pd-local')).toHaveText('Tufão atualizado — outro local');
 await page.evaluate(()=>document.getElementById('pd-local').textContent='National-Hurricane-Center/NOAA-Atlantic-and-East-Pacific 👨‍👩‍👧‍👦');
 await expect(page.locator('#pd-local')).toHaveText('National-Hurricane-Center/NOAA-Atlantic-and-East-Pacific 👨‍👩‍👧‍👦');
 expect(await page.locator('#painel-direito').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
 await expect(page.locator('#pd-local .pd-fx-windletter').filter({hasText:'👨‍👩‍👧‍👦'})).toHaveCount(1);
 await page.evaluate(()=>document.getElementById('pd-local').textContent='Tufão atualizado — outro local');
 await expect(page.locator('#pd-local .pd-fx-windletter')).not.toHaveCount(0);
 await page.evaluate(()=>CinematicCard.stop());
 await expect(page.locator('.pd-cinema-layer,.pd-cinema-contact,.pd-cinema-afterglow,.pd-fx-windletter,.pd-fx-windword')).toHaveCount(0);
 await expect(page.locator('#pd-local')).toHaveText('Tufão atualizado — outro local');
 expect(await page.locator('#painel-direito').evaluate(el=>Array.from(el.style).filter(k=>k.startsWith('--pd-wind-')))).toEqual([]);
 await page.locator('#control').click();expect(errors).toEqual([]);
});
test('rótulos dos feeds e códigos oficiais determinam o estágio e o hemisfério',async({page})=>{
 await isolatedCyclone(page);
 const cases=[
  [{cycloneLabel:'T. Tropical'},'tropical-storm'],
  [{cycloneLabel:'Tempestade Tropical Severa',windKmh:155},'tropical-storm'],
  [{classification:'TS',windKmh:155},'tropical-storm'],
  [{classification:'STS'},'tropical-storm'],
  [{classification:'TD',cycloneLabel:'Furacão',windKmh:140},'depression'],
  [{displayLabel:'Depressão Tropical'},'depression'],
  [{classification:'HU',detail:'Anteriormente tempestade tropical'},'mature'],
  [{cycloneLabel:'Super Tufão',windKmh:180},'mature'],
  [{windKmh:62},'depression'],[{windKmh:63},'tropical-storm'],[{windKmh:118},'tropical-storm'],[{windKmh:119},'mature']
 ];
 for(const [extra,stage] of cases){
  await page.evaluate(extra=>CinematicCard.start({id:'profile-cyclone',type:'hurricane',coords:[130,-18],...extra},Infinity),extra);
  await expect(page.locator('.pd-cinema-layer'),JSON.stringify(extra)).toHaveAttribute('data-cyclone-stage',stage);
  await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-rotation-direction','-1');
  await expect(page.locator('.pd-cinema-layer')).toHaveCount(1);
 }
 await page.evaluate(()=>CinematicCard.start({id:'north-cyclone',type:'hurricane',coords:[130,18],windKmh:140},500));
 await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-rotation-direction','1');
 await page.evaluate(()=>__cycloneFrame(performance.now()+1000));
 await expect(page.locator('.pd-cinema-layer,.pd-cinema-contact,.pd-cinema-afterglow,.pd-fx-windletter,.pd-fx-windword')).toHaveCount(0);
});
test('revisão silenciosa atualiza textos e hemisfério sem reiniciar a mesma fase',async({page})=>{
 await boot(page,1280);
 await page.evaluate(()=>{
  const item={id:'cyclone-live',type:'hurricane',source:'Visual QA',place:'JOANA',cycloneLabel:'Furacão',classification:'HU',windKmh:150,coords:[-45,18],time:Date.now()};
  globalAlerts=[item];upsertAlert(item);showAlertDetails(item,false);clearTimeout(cycleTimeout);clearTimeout(window.__mgRadarDelayT);clearTimeout(window.__mgWaveDelayT);
  document.querySelector('.pd-cinema-layer').dataset.testIdentity='retained';
 });
 const layer=page.locator('.pd-cinema-layer');await expect(layer).toHaveAttribute('data-cyclone-stage','mature');
 await page.evaluate(()=>{
  const item={...EventStore.getSelected(),place:'JOANA atualizado',windKmh:170,coords:[-45,-18]};
  upsertAlert(item);showAlertDetails(item,false,true);clearTimeout(cycleTimeout);
 });
 await expect(layer).toHaveAttribute('data-test-identity','retained');await expect(layer).toHaveAttribute('data-rotation-direction','-1');
 await expect(page.locator('#pd-local')).toContainText('JOANA atualizado');
 for(const id of ['pd-local','pd-horario','pd-depth','pd-fault-type'])await expect(page.locator('#'+id+' .pd-fx-windletter')).not.toHaveCount(0);
 await expect(page.locator('.pd-fx-windletter .pd-fx-windletter')).toHaveCount(0);
 expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('cyclone-live');
 await page.evaluate(()=>{
  const item={...EventStore.getSelected(),classification:'TS',cycloneLabel:'T. Tropical',windKmh:85};
  upsertAlert(item);showAlertDetails(item,false,true);clearTimeout(cycleTimeout);
 });
 await expect(layer).toHaveAttribute('data-cyclone-stage','tropical-storm');await expect(layer).not.toHaveAttribute('data-test-identity','retained');
 await expect(layer).toHaveCount(1);await expect(page.locator('.pd-cinema-contact')).toHaveCount(1);
 await expect(page.locator('.pd-cinema-afterglow')).toHaveCount(0);
 await expect(page.locator('#pd-local')).toContainText('JOANA atualizado');
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect(page.locator('.pd-cinema-layer,.pd-cinema-contact,.pd-fx-windletter,.pd-fx-windword')).toHaveCount(0);
 await expect(page.locator('#pd-local')).toContainText('JOANA atualizado');
 expect(await page.locator('#painel-direito').evaluate(el=>Array.from(el.style).filter(k=>k.startsWith('--pd-wind-')))).toEqual([]);
});
test('fotografia local só aparece em ciclones maduros e é liberada na troca',async({page})=>{
 await boot(page,1280);let requests=0;
 page.on('request',request=>{if(request.url().endsWith('/cyclone-eye.jpg'))requests++;});
 await page.evaluate(()=>CardEffectDemo.preview('tropical-storm'));
 await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-cyclone-stage','tropical-storm');
 await expect(page.locator('.pd-cinema-film')).not.toHaveAttribute('data-texture','nasa');expect(requests).toBe(0);
 await page.evaluate(()=>CardEffectDemo.preview('hurricane'));
 await expect(page.locator('.pd-cinema-film')).toHaveAttribute('data-texture','nasa');expect(requests).toBe(1);
 const prior=await page.locator('.pd-cinema-film').elementHandle();
 await page.evaluate(()=>CardEffectDemo.preview('tropical-storm'));
 await expect.poll(()=>prior.evaluate(c=>!c.isConnected&&c.getContext('webgl').isContextLost())).toBe(true);
 await expect(page.locator('.pd-cinema-film')).not.toHaveAttribute('data-texture','nasa');expect(requests).toBe(1);
 await page.evaluate(()=>CardEffectDemo.stop());
 await expect(page.locator('[data-texture="nasa"],.pd-fx-windletter,.pd-fx-windword')).toHaveCount(0);
});
// A fresh context avoids a previously decoded photograph bypassing the request.
test('falha da fotografia mantém nuvens e permite encerrar o efeito',async({page})=>{
 await boot(page,1280);
 await page.route('**/cyclone-eye.jpg',route=>route.abort());
 await page.evaluate(()=>CardEffectDemo.preview('typhoon'));
 await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-renderer','film');
 await expect(page.locator('.pd-cinema-film')).not.toHaveAttribute('data-texture','nasa');
 await expect.poll(()=>page.locator('.pd-cinema-film').evaluate(film=>{
  const c=document.createElement('canvas');c.width=film.width;c.height=film.height;const ctx=c.getContext('2d');ctx.drawImage(film,0,0);
  return ctx.getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4!==3&&v>40);
 })).toBe(true);
 await page.evaluate(()=>CardEffectDemo.stop());
 await expect(page.locator('[data-texture="nasa"],.pd-fx-windletter,.pd-fx-windword')).toHaveCount(0);
});
test('olho profundo, movimento contínuo e hemisférios na renderização real',async({page})=>{
 await boot(page,1280);
 const result=await page.evaluate(()=>{
  function render(width,height,stage,direction,time){
   const cfg={type:'hurricane',strength:.8,cycloneStage:stage,rotationDirection:direction};
   const film=CardCinemaFilm.create(cfg,false);if(!film)throw Error('WebGL unavailable');
   film.resize(width,height);film.draw(time,cfg,false,false);
   const c=document.createElement('canvas');c.width=film.canvas.width;c.height=film.canvas.height;
   const ctx=c.getContext('2d');ctx.drawImage(film.canvas,0,0);
   const pixels=ctx.getImageData(0,0,c.width,c.height).data;
   const cx=(.52+.008*Math.sin(time*.035))*c.width,cy=(1-(.62+.008*Math.cos(time*.027)))*c.height;
   const radius=c.width*.66;let eye=0,wall=0,ne=0,nw=0;
   for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
    const r=Math.hypot(x-cx,y-cy)/radius,i=(y*c.width+x)*4;
    const l=pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722;
    if(r<.10){eye+=l;ne++;}if(r>.27&&r<.38){wall+=l;nw++;}
   }
   film.destroy();return {eye:eye/ne,wall:wall/nw,pixels:Array.from(pixels)};
  }
  const mature=render(320,600,'mature',1,0),later=render(320,600,'mature',1,6),south=render(320,600,'mature',-1,6),depression=render(320,600,'depression',1,0),compact=render(390,260,'mature',1,0);
  const delta=(a,b)=>a.pixels.reduce((sum,v,i)=>sum+Math.abs(v-b.pixels[i]),0)/a.pixels.length;
  return {contrast:mature.wall-mature.eye,compactContrast:compact.wall-compact.eye,depressionEye:depression.eye,matureEye:mature.eye,movement:delta(mature,later),hemisphere:delta(later,south)};
 });
 expect(result.contrast).toBeGreaterThan(15);expect(result.compactContrast).toBeGreaterThan(15);
 expect(result.depressionEye).toBeGreaterThan(result.matureEye+10);
 expect(result.movement).toBeGreaterThan(1);expect(result.hemisphere).toBeGreaterThan(1);
});
