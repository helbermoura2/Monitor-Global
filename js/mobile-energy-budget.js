/* Rendering budgets only. Feed priority and event deadlines remain wall-clock based. */
(function(){
 let economy=false;
 try{economy=localStorage.getItem('monitor_energy_saving')==='true';}catch(e){}
 const mobile=()=>economy||matchMedia('(max-width:900px)').matches||matchMedia('(pointer:coarse)').matches;
 const mapPixelRatio=()=>mobile()?Math.min(devicePixelRatio||1,1.25):devicePixelRatio||1;
 const label=()=> '🔋 Economia: '+(economy?'ligada':'desligada');
 function buttonHTML(){return '<button type="button" data-energy-saving aria-pressed="'+economy+'" title="Reduzir o esforço do mapa e dos efeitos. Ideal para DeX e uso prolongado.">'+label()+'</button>';}
 function setEconomy(value){
  economy=!!value;
  try{localStorage.setItem('monitor_energy_saving',String(economy));}catch(e){}
  update();
 }
 let resumeTimer=null;
 function update(){
  document.documentElement.classList.toggle('mg-mobile-budget',mobile());
  document.documentElement.classList.toggle('mg-tab-hidden',document.hidden);
  document.querySelectorAll('[data-energy-saving]').forEach(button=>{button.textContent=label();button.setAttribute('aria-pressed',String(economy));});
  try{if(typeof map!=='undefined'&&map?.setPixelRatio&&map.getPixelRatio()!==mapPixelRatio())map.setPixelRatio(mapPixelRatio());}catch(e){}

 }
 document.addEventListener('visibilitychange',()=>{
  update();clearTimeout(resumeTimer);
  if(document.hidden){
   // CinematicCard already pauses its own footage and freezes its rAF loop on
   // document.hidden (see its frame()/visibilitychange handling), resuming on
   // its own when the tab comes back. Calling stop() here tore the whole scene
   // down instead of pausing it -- the card vanished and never came back.
   window.stopRainEffect?.();window.stopIconSpin?.();
   try{if(typeof cycleTimeout!=='undefined')clearTimeout(cycleTimeout);if(typeof stopMapCamera==='function')stopMapCamera();else if(typeof map!=='undefined')map?.stop();}catch(e){}
  }else{
   resumeTimer=setTimeout(()=>{if(!document.hidden&&typeof runAutoCycle==='function')runAutoCycle();},100);
  }
 });
 document.addEventListener('click',event=>{if(event.target.closest?.('[data-energy-saving]'))setEconomy(!economy);});
 addEventListener('storage',event=>{if(event.key==='monitor_energy_saving'||event.key===null){try{economy=localStorage.getItem('monitor_energy_saving')==='true';}catch(e){}update();}});
 addEventListener('resize',update,{passive:true});update();
 window.MobileEnergyBudget={mobile,mapPixelRatio,economy:()=>economy,setEconomy,buttonHTML};
})();
