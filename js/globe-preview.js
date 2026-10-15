/* Globo opcional, na mesma instância do mapa; Mercator continua padrão. */
(function () {
 'use strict';
 let mode='mercator', originalSky, panel=null, status=null;
 const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
 const ready=()=>typeof map!=='undefined'&&map&&window.__mgMapReady;
 function message(text){if(typeof showToast==='function')showToast(text,'info');}
 function close(){panel?.remove();panel=null;}
 function refresh(){
  status?.remove();status=null;
  if(mode!=='globe')return;
  status=document.createElement('aside');status.id='globe-preview-status';status.setAttribute('aria-label','Teste de globo');
  const label=document.createElement('strong');label.textContent='Globo · teste';status.append(label);
  const planet=document.createElement('button');planet.type='button';planet.textContent='Ver planeta';planet.onclick=overview;status.append(planet);
  const flat=document.createElement('button');flat.type='button';flat.textContent='Voltar ao mapa plano';flat.onclick=()=>setMode('mercator');status.append(flat);
  document.body.append(status);
 }
 function setMode(next){
  if(!['globe','mercator'].includes(next)||!ready()) {message('Aguarde o mapa carregar.');return false;}
  if(next===mode)return true;
  if(typeof QuakeMarkerPreview!=='undefined')QuakeMarkerPreview.close();
  try {
   if(next==='globe')originalSky=copy(map.getSky());
   map.setProjection({type:next});
   if(next==='globe')map.setSky({'sky-color':'#030b17','horizon-color':'#75b8df','sky-horizon-blend':0.08,'fog-color':'#10243a','fog-ground-blend':0,'horizon-fog-blend':0,'atmosphere-blend':['interpolate',['linear'],['zoom'],0,1,4,0]});
   else map.setSky(copy(originalSky));
   mode=next;document.body.classList.toggle('map-globe-test',mode==='globe');
   refresh();close();map.triggerRepaint();return true;
  } catch(error){
   try{map.setProjection({type:mode});if(mode==='mercator')map.setSky(copy(originalSky));}catch(_){}
   message('Não foi possível trocar a visualização. O mapa anterior foi mantido.');return false;
  }
 }
 function overview(){
  if(!ready()||mode!=='globe')return;
  // Esta ação equivale a abrir o zoom manualmente; eventos novos seguem prioritários.
  window.EventCamera?.cancel();window.SeismicPaintTour?.pause();window.TsunamiPresentation?.pause();window.SeismicFocus?.pause();
  if(typeof waveCamAbortHandler==='function')waveCamAbortHandler({originalEvent:{type:'globe-overview'}});
  if(typeof stopMapCamera==='function')stopMapCamera();
  const c=map.getCenter();
  map.easeTo({center:[c.lng,Math.max(-65,Math.min(65,c.lat))],zoom:0.5,bearing:0,pitch:0,padding:0,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:4500,essential:true});
 }
 function open(){
  close();panel=document.createElement('section');panel.id='globe-preview-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Visualização do mapa');
  const title=document.createElement('h3');title.textContent='Visualização do mapa';panel.append(title);
  const text=document.createElement('p');text.textContent='Experimente o globo com os mesmos eventos, pins e áreas pintadas. O mapa plano continua sendo o padrão ao recarregar.';panel.append(text);
  const hint=document.createElement('p');hint.className='globe-preview-current';hint.textContent='Atual: '+(mode==='globe'?'Globo · teste':'Mapa plano');panel.append(hint);
  for(const [value,label]of [['globe','Usar globo — teste'],['mercator','Usar mapa plano']]){
   const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-pressed',String(mode===value));b.onclick=()=>setMode(value);panel.append(b);
  }
  const exit=document.createElement('button');exit.type='button';exit.className='globe-preview-close';exit.setAttribute('aria-label','Fechar visualização do mapa');exit.textContent='×';exit.onclick=close;panel.append(exit);document.body.append(panel);exit.focus();
 }
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 window.addEventListener('pagehide',close);
 window.GlobePreview={open,close,setMode,overview,state:()=>({mode,testing:mode==='globe'})};
})();
