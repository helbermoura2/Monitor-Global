const {test,expect}=require('@playwright/test');
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
 for(const key of ['hurricane','typhoon']){
  await page.evaluate(k=>CardEffectDemo.preview(k),key);
  await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-scene','hurricane');
  await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-renderer','film');
  await expect(page.locator('#pd-local .pd-fx-windletter')).toHaveCount(0);
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
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.pd-cinema-layer')).toHaveCount(0);
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
