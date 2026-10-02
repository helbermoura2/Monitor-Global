/* Temporary, isolated visual previews. Never insert records, fly the map or play audio. */
(function(){
 'use strict';
 let dialog=null,bar=null,timer=0,active=false;
 const labels={earthquake:'Sismo',storm:'Tempestade',hurricane:'Furacão / tufão',tornado:'Tornado',fire:'Incêndio','volcano-lava':'Vulcão · lava','volcano-ash':'Vulcão · cinzas','volcano-monitoring':'Vulcão · monitoramento',flood:'Enchente',tsunami:'Tsunami',wind:'Rajadas de vento'};
 function removeControls(){clearTimeout(timer);timer=0;bar?.remove();bar=null;dialog?.remove();dialog=null;}
 function cancelForRealEvent(){active=false;removeControls();}
 function restore(){
  const selected=window.EventStore?.getSelected();if(!selected)return;
  const type=selected.type||(Number.isFinite(selected.mag)?'earthquake':null);
  window.CinematicCard?.start({...selected,type},type==='earthquake'?7200:Infinity);
 }
 function stop(){const was=active;active=false;removeControls();if(was){window.CinematicCard?.stop();restore();}}
 function preview(key){
  stop();window.SeismicCinema?.closeDemo();
  if(key==='earthquake'){window.SeismicCinema?.openDemo();return;}
  const type=key.startsWith('volcano')?'volcano':key;
  const item={id:'effect-demo-'+key,type,__cinemaDemo:true,sev:3,windKmh:140,detail:labels[key]};
  if(key==='storm')item.detail='Trovoadas e chuva intensa';
  if(key==='volcano-lava')Object.assign(item,{eruptionStatus:'Em erupção',detail:'Fluxo de lava ativo · emissão de cinzas'});
  if(key==='volcano-ash')Object.assign(item,{eruptionStatus:'Em erupção',detail:'Emissão de cinzas · sem lava'});
  if(key==='volcano-monitoring')Object.assign(item,{eruptionStatus:'Sem atividade eruptiva',detail:'Em monitoramento'});
  const panel=document.getElementById('painel-direito');if(!panel)return;
  active=true;const played=window.CinematicCard?.start(item,20000);
  // Demo storm illumination is carried by its own scene, not the real event's metadata.
  bar=document.createElement('aside');bar.id='card-fx-demo-status';bar.className='card-effect-status';bar.setAttribute('aria-live','polite');
  const text=document.createElement('span');text.textContent='DEMONSTRAÇÃO · '+labels[key]+(played?' · 20 s':' · Movimento reduzido');
  const change=document.createElement('button');change.type='button';change.textContent='Trocar';change.onclick=()=>{stop();open();};
  const end=document.createElement('button');end.type='button';end.textContent='Parar';end.onclick=stop;bar.append(text,change,end);document.body.append(bar);
  if(played)timer=setTimeout(stop,20100);
 }
 function open(){
  stop();window.SeismicCinema?.closeDemo();
  dialog=document.createElement('section');dialog.id='card-fx-demo-dialog';dialog.className='card-effect-demo';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-label','Demonstração dos efeitos');
  dialog.innerHTML='<button class="effect-demo-close" type="button" aria-label="Fechar demonstração">×</button><h3>Efeitos · demonstração</h3><p>Compare a ilustração sobre o cartão atual. Os dados do evento permanecem os mesmos.</p><label>Evento<select id="card-fx-demo-type"></select></label><p>Sem criar registros, mover a câmera ou tocar alarmes. As imagens ilustrativas não são filmagens do evento selecionado.</p><button id="card-fx-demo-play" type="button">Reproduzir efeito</button><a href="media/card-fx/credits.html" target="_blank" rel="noopener">Fontes e créditos das imagens</a>';
  const select=dialog.querySelector('select');for(const [value,label] of Object.entries(labels)){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
  dialog.querySelector('.effect-demo-close').onclick=()=>{dialog.remove();dialog=null;};
  dialog.querySelector('#card-fx-demo-play').onclick=()=>{const key=select.value;dialog.remove();dialog=null;preview(key);};
  document.body.append(dialog);select.focus();
 }
 document.addEventListener('keydown',e=>{if(e.key==='Escape')stop();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 window.addEventListener('pagehide',()=>{active=false;removeControls();});
 window.CardEffectDemo={open,preview,stop,cancelForRealEvent,isActive:()=>active};
})();
