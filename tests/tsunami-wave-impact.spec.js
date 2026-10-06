const {test,expect}=require('@playwright/test');
// O tsunami agora leva um golpe de onda de verdade nas letras (deslocamento
// forte com decaimento + breve apagão de opacidade simulando a água
// passando por cima), em vez do balanço ambiente contínuo compartilhado
// com a enchente. Este teste não depende de decodificação de vídeo (o
// golpe nas letras funciona independente do estado do <video>/WebGL) --
// só verifica a física aplicada via estilo inline, amostrando ao longo de
// um ciclo completo (TSUNAMI_CYCLE = 6s).
test.use({serviceWorkers:'block'});
test('golpe de onda nas letras do tsunami: impacto forte seguido de ressaca fraca',async({page})=>{
 test.setTimeout(30000);
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.setViewportSize({width:390,height:844});
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.CardEffectDemo);
 await page.evaluate(()=>{
  const item={id:'wave-impact-check',type:'tsunami',place:'Tsunami — teste de física',source:'QA',coords:[-46.63,-23.55],time:Date.now(),sev:3};
  globalAlerts=[item];upsertAlert(item);showAlertDetails(item,false);clearTimeout(cycleTimeout);clearTimeout(window.__mgRadarDelayT);clearTimeout(window.__mgWaveDelayT);
  if(innerWidth<900){document.body.classList.remove('mobile-details-mid');document.body.classList.add('mobile-details-open');}
 });
 await page.waitForFunction(()=>document.querySelectorAll('#painel-direito .pd-water-submerged .pd-fx-windletter').length>0,{timeout:15000});

 let sawImpact=false,sawResidual=false;
 const deadline=Date.now()+6800;
 while(Date.now()<deadline&&!(sawImpact&&sawResidual)){
  const sample=await page.evaluate(()=>{
   const letters=Array.from(document.querySelectorAll('#painel-direito .pd-water-submerged .pd-fx-windletter'));
   let maxAbsDx=0,minOpacity=1;
   for(const el of letters){
    const m=/translate3d\(([-\d.]+)px/.exec(el.style.transform||'');
    const dx=m?Math.abs(parseFloat(m[1])):0;
    if(dx>maxAbsDx)maxAbsDx=dx;
    const op=el.style.opacity?parseFloat(el.style.opacity):1;
    if(op<minOpacity)minOpacity=op;
   }
   return {maxAbsDx,minOpacity,count:letters.length};
  });
  if(sample.count>0){
   if(sample.maxAbsDx>6&&sample.minOpacity<.85)sawImpact=true;
   if(sample.maxAbsDx>0&&sample.maxAbsDx<2&&sample.minOpacity>.95)sawResidual=true;
  }
  await page.waitForTimeout(100);
 }
 expect(sawImpact,'deve haver um instante de golpe forte (deslocamento >6px) com apagão de opacidade (<0.85)').toBe(true);
 expect(sawResidual,'deve haver um instante de ressaca fraca (deslocamento <2px) com opacidade quase normal (>0.95)').toBe(true);

 // reduced motion continua desligando tudo, igual às outras fontes de água
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect(page.locator('.pd-weather-material')).toHaveCount(0);
});
