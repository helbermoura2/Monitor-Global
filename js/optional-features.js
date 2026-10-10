/* Optional interfaces and type-specific renderers. Core alerts stay synchronous. */
(function(){
 'use strict';
 const loaded=new Map();
 const effects={
  wind:['js/card-gale-field.js?v=20261009-adaptive-quality','css/wind-cinema.css?v=20261007-flying-letters'],
  tornado:['js/card-tornado-field.js?v=20261009-adaptive-quality','css/tornado-cinema.css?v=20261005-tornado-vortex'],
  flood:['js/card-flood-rise.js?v=20261009-adaptive-quality','css/flood-rise.css?v=20261007-flood-rise'],
  tsunami:['js/card-tsunami-surge.js?v=20261009-adaptive-quality','css/tsunami-cinema.css?v=20261007-hydraulic-bore'],
  volcano:['js/card-volcano-monitoring.js?v=20261009-adaptive-quality']
 };
 const ready=new Set();
 function asset(url,module=false){
  if(loaded.has(url))return loaded.get(url);
  const promise=new Promise((resolve,reject)=>{
   const css=url.startsWith('css/'),node=document.createElement(css?'link':'script');
   if(css){node.rel='stylesheet';node.href=url;}else{node.src=url;if(module)node.type='module';}
   node.onload=()=>resolve();node.onerror=()=>{node.remove();loaded.delete(url);reject(Error('Falha ao carregar '+url));};
   document.head.append(node);
  });loaded.set(url,promise);return promise;
 }
 function effect(type){
  return Promise.all((effects[type]||[]).map(url=>asset(url))).then(()=>ready.add(type));
 }
 window.OptionalFeatures={effect,effectReady:type=>!effects[type]||ready.has(type),fetch:window.fetch.bind(window)};
 function selected(){
  try{EventStore.syncFromLegacy();const item=EventStore.getSelected();if(item)return item;}catch(e){}
  const id=typeof eventoSelecionadoId==='undefined'?null:eventoSelecionadoId;
  return [...(typeof globalEvents==='undefined'?[]:globalEvents),...(typeof globalAlerts==='undefined'?[]:globalAlerts),...(typeof lastMerged==='undefined'?[]:lastMerged)].find(item=>item.id===id);
 }
 function failure(error){console.warn('[recurso opcional]',error);window.showToast?.('Não foi possível carregar. Tente novamente.','warning');}
 window.shareResumoDiarioStory=async()=>{try{await asset('js/quake-card-layout.js?v=cartographic-v7-numbers-revisions');await asset('js/quake-image-paint.js?v=cartographic-v7-numbers-revisions');await asset('js/story-share.js?v=cartographic-v7-numbers-revisions');return await window.shareResumoDiarioStory();}catch(error){failure(error);}};
 function init(){
  const button=document.getElementById('pd-share-btn');
  button?.addEventListener('click',async event=>{
   event.stopPropagation();const item=selected();
   if(!item){window.showToast?.('Selecione um evento na lista primeiro.','info');return;}
   button.disabled=true;button.textContent='Carregando…';
   try{await asset('js/quake-card-layout.js?v=cartographic-v7-numbers-revisions');await asset('js/quake-image-paint.js?v=cartographic-v7-numbers-revisions');await asset('js/story-share.js?v=cartographic-v7-numbers-revisions');await window.shareEventAsStory(item);}catch(error){failure(error);}
   finally{button.disabled=false;button.textContent='📤 Imagem';}
  });
  const brazil=document.getElementById('chip-geo-br');if(!brazil)return;
  const desktop=matchMedia('(min-width:1101px)'),retireAt=Date.parse('2026-11-01T00:00:00-03:00');
  let generation=0,busy=false,expiryTimer;
  const chip=document.createElement('button');chip.id='chip-election';chip.className='chip chip-toggle';chip.type='button';
  chip.setAttribute('aria-controls','election-panel');chip.setAttribute('aria-expanded','false');chip.setAttribute('data-tt','Apuração presidencial · TSE');
  chip.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 12h16v8H4zM7 12l-2-3h4m7 0h3l2 3M10 3l7 4-4 7-7-4z"/><path d="m10 8 1 2 3-1M8 17h8"/></svg><span>Eleição</span>';brazil.after(chip);
  const visibility=()=>{chip.hidden=!desktop.matches||Date.now()>=retireAt;clearTimeout(expiryTimer);if(!chip.hidden)expiryTimer=setTimeout(visibility,Math.min(3600000,retireAt-Date.now()));};visibility();desktop.addEventListener('change',visibility);document.addEventListener('visibilitychange',visibility);
  const arrivals=new Set();
  window.ElectionPanel={arrivalIds:arrivals,newQuakes:items=>{
   for(const item of items||[]){if(!item||item.id==null||arrivals.has(item.id))continue;arrivals.add(item.id);if(Number(item.mag)>6)generation++;}
   if(arrivals.size>1000){const recent=[...arrivals].slice(-500);arrivals.clear();recent.forEach(id=>arrivals.add(id));}
  }};
  async function open(){
   if(busy||chip.hidden)return;busy=true;const token=generation;chip.disabled=true;chip.setAttribute('aria-busy','true');
   try{
    await asset('css/election-results.css?v=20261010-session-trend');
    await asset('js/election-results.js?v=20261010-session-trend',true);
    chip.removeEventListener('click',open);desktop.removeEventListener('change',visibility);document.removeEventListener('visibilitychange',visibility);clearTimeout(expiryTimer);
    if(token===generation&&desktop.matches&&Date.now()<retireAt)window.ElectionPanel.open();
   }catch(error){failure(error);}
   finally{busy=false;chip.disabled=false;chip.removeAttribute('aria-busy');}
  }
  chip.addEventListener('click',open);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
