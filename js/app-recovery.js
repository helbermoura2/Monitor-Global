/* Recover independently: never rebuild the map or discard the current catalogue. */
(function(root){
 'use strict';
 let mapRef=null,lost=false,panel=null,feedBusy=false,lastFeed=-Infinity,feedback='',feedButton=null;
 const sources=new Map(),delays=[4000,16000,60000];
 function message(text){feedback=text;root.showToast?.(text,'info');if(feedButton)feedButton.textContent=text;}
 function draw(){
  if(!panel){const host=document.getElementById('mapWrap');if(!host)return;panel=document.createElement('section');panel.id='map-recovery';panel.setAttribute('role','status');const text=document.createElement('p'),retry=document.createElement('button'),list=document.createElement('button');retry.type=list.type='button';retry.textContent='Tentar mapa novamente';retry.onclick=retryMap;list.textContent='Ver registros';list.onclick=()=>root.toggleMobileEventsModal?.(true);panel.append(text,retry,list);host.append(panel);}
  const failed=[...sources.values()].some(s=>s.failed);panel.hidden=!lost&&!failed;
  panel.querySelector('p').textContent=lost?'O mapa perdeu a conexão gráfica. Os registros continuam disponíveis; aguardando recuperação do navegador.':navigator.onLine===false?'Sem conexão para carregar o mapa. Os registros já recebidos continuam disponíveis.':'Parte do mapa não carregou. Os registros continuam disponíveis.';
  panel.querySelector('button').disabled=lost||navigator.onLine===false;
 }
 function reload(id){const src=mapRef?.getSource(id);if(src?.setTiles){src.setTiles(src.tiles);return true;}return false;}
 function schedule(id){const s=sources.get(id);if(!s||s.timer||s.attempt>=delays.length||lost||document.hidden||navigator.onLine===false)return;s.timer=setTimeout(()=>{s.timer=0;if(document.hidden||navigator.onLine===false||lost)return;s.attempt++;s.lastRetry=Date.now();try{reload(id);}catch(e){console.warn('[recuperação do mapa]',e);}if(s.failed)schedule(id);},delays[s.attempt]);}
 function attach(map){if(mapRef===map)return;mapRef=map;for(const id of ['satellite','esri-boundaries-places'])sources.set(id,{failed:false,attempt:0,timer:0,lastRetry:-Infinity});
  map.on('error',e=>{const s=sources.get(e?.sourceId);if(!s)return;s.failed=true;draw();schedule(e.sourceId);});
  map.on('sourcedata',e=>{const s=sources.get(e?.sourceId);if(!s||e.sourceDataType!=='content'||e.tile?.state!=='loaded')return;s.failed=false;s.attempt=0;clearTimeout(s.timer);s.timer=0;draw();});
  map.on('webglcontextlost',e=>{e.originalEvent?.preventDefault();lost=true;for(const s of sources.values()){clearTimeout(s.timer);s.timer=0;}draw();});
  map.on('webglcontextrestored',()=>{lost=false;map.resize();map.triggerRepaint();draw();for(const [id,s]of sources)if(s.failed)schedule(id);});
  map.on('remove',()=>{for(const s of sources.values())clearTimeout(s.timer);sources.clear();mapRef=null;panel?.remove();panel=null;});
 }
 function retryMap(){if(!mapRef||lost||navigator.onLine===false)return false;let changed=false;for(const [id,s]of sources){if(!s.failed)continue;
   // A manual click cannot bypass the same retry budget or create overlapping timers.
   if(Date.now()-s.lastRetry<8000)continue;if(s.attempt>=delays.length){if(Date.now()-s.lastRetry<60000)continue;s.attempt=0;}clearTimeout(s.timer);s.timer=0;s.attempt++;s.lastRetry=Date.now();try{changed=reload(id)||changed;}catch(e){console.warn('[recuperação do mapa]',e);}schedule(id);
  }mapRef.resize();mapRef.triggerRepaint();if(!changed)message('O mapa aguardará a próxima recuperação da conexão.');return changed;}
 async function retryFeeds(){
  if(navigator.onLine===false){message('Sem conexão. Seus registros foram mantidos.');return false;}
  if(feedBusy||(typeof __fetchGlobalFeedsEmAndamento!=='undefined'&&__fetchGlobalFeedsEmAndamento)){message('Uma atualização dos sismos já está em andamento.');return false;}
  if(Date.now()-lastFeed<60000){message('Aguarde um minuto entre as tentativas de atualização.');return false;}
  if(typeof fetchGlobalFeeds!=='function'){message('A atualização ainda está inicializando.');return false;}
  lastFeed=Date.now();feedBusy=true;if(feedButton)feedButton.disabled=true;message('Atualizando sismos…');
  try{await fetchGlobalFeeds();const state=root.MonitorFreshness?.summary();message(state?.state==='fresh'?'Sismos atualizados.':'Consulta concluída. Veja a situação das fontes para conferir as pendências.');return true;}
  catch(e){message('Não foi possível atualizar. Os registros anteriores foram mantidos.');return false;}
  finally{feedBusy=false;if(feedButton)feedButton.disabled=false;}
 }
 function mountFeeds(host){if(!host||host.querySelector('.source-recovery-button'))return;feedButton=document.createElement('button');feedButton.type='button';feedButton.className='source-recovery-button';feedButton.textContent=feedback||'Tentar atualizar sismos';feedButton.disabled=feedBusy;feedButton.onclick=retryFeeds;host.prepend(feedButton);}
 function resume(){draw();if(document.hidden||navigator.onLine===false)return;for(const [id,s]of sources)if(s.failed)schedule(id);}
 root.addEventListener('online',()=>{for(const s of sources.values())if(s.failed)s.attempt=0;resume();});root.addEventListener('offline',draw);document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const s of sources.values()){clearTimeout(s.timer);s.timer=0;}else resume();});
 root.AppRecovery={attach,retryMap,retryFeeds,mountFeeds,state:()=>({lost,feedBusy,sources:[...sources].map(([id,s])=>({id,failed:s.failed,attempt:s.attempt,pending:!!s.timer}))})};
})(window);
