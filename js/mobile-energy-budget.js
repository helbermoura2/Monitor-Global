/* Rendering budgets only. Feed priority and event deadlines remain wall-clock based. */
(function(){
 const mobile=()=>matchMedia('(max-width:900px)').matches||matchMedia('(pointer:coarse)').matches;
 let resumeTimer=null;
 function update(){
  document.documentElement.classList.toggle('mg-mobile-budget',mobile());
  document.documentElement.classList.toggle('mg-tab-hidden',document.hidden);
 }
 document.addEventListener('visibilitychange',()=>{
  update();clearTimeout(resumeTimer);
  if(document.hidden){
   window.CinematicCard?.stop();
   window.stopRainEffect?.();window.stopIconSpin?.();
   try{if(typeof cycleTimeout!=='undefined')clearTimeout(cycleTimeout);if(typeof stopMapCamera==='function')stopMapCamera();else if(typeof map!=='undefined')map?.stop();}catch(e){}
  }else{
   resumeTimer=setTimeout(()=>{if(!document.hidden&&typeof runAutoCycle==='function')runAutoCycle();},100);
  }
 });
 addEventListener('resize',update,{passive:true});update();
 window.MobileEnergyBudget={mobile,mapPixelRatio:()=>mobile()?Math.min(devicePixelRatio||1,1.25):devicePixelRatio||1};
})();
