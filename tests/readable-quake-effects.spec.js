const {test,expect}=require('@playwright/test');const fs=require('fs'),path=require('path');
for(const width of [411,1280])test('M0.9 through M5.9 keep every card field readable while magnitude response grows '+width,async({page})=>{
 await page.setViewportSize({width,height:806});await page.setContent('<body class="mobile-details-open"><div id="painel-direito" style="position:relative;width:320px;height:500px;background:#152a2a;color:white"><div class="pd-gauge-wrap"><svg id="pd-gauge" width="120" height="66"></svg><div id="pd-mag">M3,0</div></div><div id="pd-flag">🇺🇸</div><div id="pd-local">Ilha do Havaí</div><div id="pd-horario">16:32 BRT</div><div class="stat-card-value">0 km</div><button id="control">Detalhes</button></div></body>');
 for(const f of ['card-event-typography.css','cinematic-card.css'])await page.addStyleTag({content:fs.readFileSync(path.join(__dirname,'../css',f),'utf8')});
 await page.evaluate(()=>{requestAnimationFrame=fn=>(window.__frame=fn,1);cancelAnimationFrame=()=>window.__frame=null;window.CardCinemaFilm={create:()=>null,footage:()=>null};window.CardWeatherPhysics={create:()=>null};});
 for(const f of ['painel-fx.js','card-effect-quality.js','quake-card-motion.js','card-artifact-effects.js','card-event-typography.js','cinematic-card.js'])await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../js',f),'utf8')});
 let prev=0;
 for(const mag of [.9,2,3,4,5,5.9]){
  const r=await page.evaluate(mag=>{const begin=performance.now();CinematicCard.start({id:'m'+mag,type:'earthquake',mag},16000);const fields=[...document.querySelectorAll('#pd-mag,#pd-flag,#pd-local,#pd-horario,.stat-card-value')],before=fields.map(e=>e.textContent);let max=0;
   for(let t=100;t<16000;t+=80){if(!__frame)break;__frame(begin+t);for(const e of fields)if(getComputedStyle(e).opacity!=='1'||e.style.transform)throw Error('Essential field was obscured');max=Math.max(max,Math.abs(parseFloat(document.getElementById('painel-direito').style.getPropertyValue('--pd-quake-x'))||0));}
   return {before,after:fields.map(e=>e.textContent),max,letters:document.querySelectorAll('.pd-fx-windletter,[data-card-reaction],[data-event-reaction]').length,active:CinematicCard.isActive(),translate:document.getElementById('painel-direito').style.getPropertyValue('--pd-quake-x')};},mag);
  expect(r.after).toEqual(r.before);expect(r.letters).toBe(0);expect(r.max).toBeLessThanOrEqual(1.5);expect(r.max).toBeGreaterThanOrEqual(prev);prev=r.max;expect(r.active).toBe(false);expect(r.translate).toBe('');
 }
 await page.locator('#control').click();
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>CinematicCard.start({id:'reduced',type:'earthquake',mag:5.9}));await expect(page.locator('.pd-cinema-layer')).toHaveCount(0);
});
