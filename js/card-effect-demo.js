/* Temporary, isolated visual previews. Never insert records or play audio. Tsunami map previews restore the camera. */
(function(){
 'use strict';
 let dialog=null,bar=null,timer=0,active=false;
 const labels={'seismic-rupture':'Teste · ruptura alongada','seismic-aftershocks':'Teste · novas réplicas','seismic-tsunami':'Teste · sismo com tsunami',civil:'Alerta · varredura',dry:'Baixa umidade',earthquake:'Sismo',storm:'Tempestade',hurricane:'Furacão',typhoon:'Tufão','tropical-storm':'Tempestade tropical',depression:'Depressão tropical',tornado:'Tornado',fire:'Incêndio','volcano-lava':'Vulcão · lava','volcano-ash':'Vulcão · cinzas','volcano-monitoring':'Vulcão · monitoramento',flood:'Enchente',tsunami:'Tsunami · pintura no mapa',wind:'Rajadas de vento'};
 function removeControls(){clearTimeout(timer);timer=0;bar?.remove();bar=null;dialog?.remove();dialog=null;}
 function cancelForRealEvent(){window.SeismicScenarioDemo?.stop(false);if(window.TsunamiPresentation?.state()?.demo)window.TsunamiPresentation.stop();window.TsunamiMap?.closePreview(false);active=false;removeControls();}
 function stop(){window.SeismicScenarioDemo?.stop();const mapPreview=window.TsunamiMap?.isPreview();window.TsunamiMap?.closePreview();if(mapPreview&&typeof scheduleNextAutoCycle==='function')scheduleNextAutoCycle(30000);const was=active;active=false;removeControls();if(was){window.CinematicCard?.stop();}}
 function preview(key,mode='warning'){
  stop();window.SeismicCinema?.closeDemo();
  if(key==='seismic-tsunami'){key='tsunami';mode='linked';}
  if(key==='seismic-rupture'||key==='seismic-aftershocks'){const duration=window.SeismicScenarioDemo?.start(key==='seismic-rupture'?'rupture':'replicas');if(!duration)return;active=true;controls('TESTE · '+(key==='seismic-rupture'?'Ruptura alongada · 45 s':'Novas réplicas · 60 s'),true);timer=setTimeout(stop,duration);return;}
  if(key==='earthquake'){window.SeismicCinema?.openDemo();return;}
  const type=key==='dry'?'civil':key.startsWith('volcano')?'volcano':['typhoon','tropical-storm','depression'].includes(key)?'hurricane':key;
  const item={id:'effect-demo-'+key,type,__cinemaDemo:true,sev:3,windKmh:140,detail:labels[key]};
  if(key==='depression')item.windKmh=45;
  if(key==='tropical-storm')item.windKmh=85;
  if(key==='dry')item.descOnly='Baixa Umidade';
  if(key==='storm')item.detail='Trovoadas e chuva intensa';
  if(key==='volcano-lava')Object.assign(item,{eruptionStatus:'Em erupção',detail:'Fluxo de lava ativo · emissão de cinzas'});
  if(key==='volcano-ash')Object.assign(item,{eruptionStatus:'Em erupção',detail:'Emissão de cinzas · sem lava'});
  if(key==='volcano-monitoring')Object.assign(item,{eruptionStatus:'Sem atividade eruptiva',detail:'Em monitoramento'});
  const panel=document.getElementById('painel-direito');if(!panel)return;
  const duration=key==='tsunami'?(mode==='linked'?120000:60000):16000;
  if(key==='tsunami'){if(typeof cycleTimeout!=='undefined')clearTimeout(cycleTimeout);clearTimeout(window.__mgCycleGuard);window.TsunamiMap?.preview(mode);if(mode==='information'||mode==='cancelled')Object.assign(item,{hazardNature:'bulletin',cancelled:mode==='cancelled'});}
  active=true;const played=window.CinematicCard?.start(item,duration);
  // Demo storm illumination is carried by its own scene, not the real event's metadata.
  controls(key==='tsunami'?'TESTE · '+(mode==='linked'?'Sismo + tsunami · passeio · 120 s':'Tsunami · cenário fictício · 60 s'):'DEMONSTRAÇÃO · '+labels[key]+(played?' · '+duration/1000+' s':' · Movimento reduzido'),key==='tsunami');
  if(played||key==='tsunami')timer=setTimeout(stop,duration);
 }
 function controls(label,mapTest=false){
  bar=document.createElement('aside');bar.id='card-fx-demo-status';bar.className='card-effect-status'+(mapTest?' card-effect-status-map':'');bar.setAttribute('aria-live','polite');const text=document.createElement('span');text.textContent=label;
  const change=document.createElement('button');change.type='button';change.textContent='Trocar';change.onclick=()=>{stop();open();};const end=document.createElement('button');end.type='button';end.textContent='Parar';end.onclick=stop;bar.append(text);if(window.SeismicScenarioDemo?.isActive()){const pause=document.createElement('button');pause.type='button';pause.id='seismic-scenario-pause';pause.textContent='Pausar câmera';pause.onclick=()=>window.SeismicScenarioDemo.togglePause();bar.append(pause);}bar.append(change,end);document.body.append(bar);
 }
 function open(){
  stop();window.SeismicCinema?.closeDemo();
  dialog=document.createElement('section');dialog.id='card-fx-demo-dialog';dialog.className='card-effect-demo';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-label','Demonstração dos efeitos');
  dialog.innerHTML='<button class="effect-demo-close" type="button" aria-label="Fechar demonstração">×</button><h3>Efeitos · demonstração</h3><p>Escolha um efeito no cartão ou um teste no mapa. Os testes sísmicos mostram pintura, novas réplicas e passeio pelas regiões de tsunami.</p><label>Evento<select id="card-fx-demo-type"></select></label><label id="card-fx-demo-tsunami-options" hidden>Cenário de tsunami<select id="card-fx-demo-tsunami-mode"><option value="linked" selected>Sismo + tsunami · passeio</option><option value="warning">Aviso · faixas coloridas</option><option value="information">Informativo · azul</option><option value="cancelled">Encerrado · cinza</option></select></label><p>Sem criar registros ou tocar alarmes. Os testes no mapa movem a câmera e restauram a vista ao terminar. Ruptura e réplicas usam dados fictícios. As imagens ilustrativas não são filmagens do evento selecionado.</p><button id="card-fx-demo-play" type="button">Reproduzir efeito</button><a href="media/card-fx/credits.html" target="_blank" rel="noopener">Fontes e créditos das imagens</a>';
  const select=dialog.querySelector('select');for(const [value,label] of Object.entries(labels)){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
  dialog.querySelector('.effect-demo-close').onclick=()=>{dialog.remove();dialog=null;};
  dialog.querySelector('#card-fx-demo-play').onclick=()=>{const key=select.value,mode=dialog.querySelector('#card-fx-demo-tsunami-mode').value;dialog.remove();dialog=null;preview(key,mode);};
  select.onchange=()=>{dialog.querySelector('#card-fx-demo-tsunami-options').hidden=select.value!=='tsunami';dialog.querySelector('#card-fx-demo-play').textContent=select.value.startsWith('seismic-')?'Iniciar teste':'Reproduzir efeito';};select.onchange();
  document.body.append(dialog);select.focus();
 }
 document.addEventListener('keydown',e=>{if(e.key==='Escape')stop();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 window.addEventListener('pagehide',()=>{window.SeismicScenarioDemo?.stop(false);active=false;removeControls();});
 window.CardEffectDemo={open,preview,stop,cancelForRealEvent,isActive:()=>active};
})();

