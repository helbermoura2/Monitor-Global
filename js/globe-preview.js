/* Globo padrão; a escolha explícita de projeção fica salva neste navegador. */
(function () {
 'use strict';
 let mode='mercator', originalSky, panel=null;
 const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
 const preference='mg-map-projection';
 function initialProjection(){try{const saved=localStorage.getItem(preference);if(['globe','mercator'].includes(saved))return saved;}catch(_){}return 'globe';}
 function remember(next){try{localStorage.setItem(preference,next);}catch(_){} }
 const ready=()=>typeof map!=='undefined'&&map&&window.__mgMapReady;
 function message(text){if(typeof showToast==='function')showToast(text,'info');}
 function close(){panel?.remove();panel=null;}
 function refresh(){
  document.getElementById('globe-preview-status')?.remove();
  for(const [id,value] of [['chip-planet','globe'],['chip-map','mercator']]){const b=document.getElementById(id);if(b){b.classList.toggle('active',mode===value);b.setAttribute('aria-pressed',String(mode===value));}}
 }
 function setMode(next,persist=true){
  if(!['globe','mercator'].includes(next)||!ready()) {message('Aguarde o mapa carregar.');return false;}
  if(next===mode){refresh();if(persist)remember(next);close();return true;}
  if(typeof QuakeMarkerPreview!=='undefined')QuakeMarkerPreview.close();
  try {
   if(next==='globe')originalSky=copy(map.getSky());
   map.setProjection({type:next});
   if(next==='globe')map.setSky({'sky-color':'#030b17','horizon-color':'#75b8df','sky-horizon-blend':0.08,'fog-color':'#10243a','fog-ground-blend':0,'horizon-fog-blend':0,'atmosphere-blend':['interpolate',['linear'],['zoom'],0,1,4,0]});
   else {map.setSky(copy(originalSky));map.setPadding({top:0,bottom:0,left:0,right:0});}
   mode=next;document.body.classList.toggle('map-globe-test',mode==='globe');
   refresh();close();if(mode==='globe')window.GlobeSpace?.start();else window.GlobeSpace?.stop();if(persist)remember(next);map.triggerRepaint();return true;
  } catch(error){
   try{map.setProjection({type:mode});if(mode==='mercator')map.setSky(copy(originalSky));}catch(_){}
   message('Não foi possível trocar a visualização. O mapa anterior foi mantido.');return false;
  }
 }
 function initialize(){
  const next=initialProjection();
  if(setMode(next,false)&&next==='globe')map.jumpTo({zoom:worldZoom(map.getCenter().lat),padding:availableRadius().padding});
 }
 function availableRadius(){
  const container=map.getContainer(),mr=container.getBoundingClientRect(),w=mr.width,h=mr.height;
  let left=0,right=w,top=0,bottom=h;
  const box=id=>{const e=document.getElementById(id);if(!e||getComputedStyle(e).display==='none'||getComputedStyle(e).visibility==='hidden')return null;const b=e.getBoundingClientRect();return b.width&&b.height?{left:b.left-mr.left,right:b.right-mr.left,top:b.top-mr.top,bottom:b.bottom-mr.top,width:b.width}:null;};
  for(const id of ['top-strip','latest-event-ticker']){const b=box(id);if(b&&b.top<h/2)top=Math.max(top,b.bottom);}
  if(matchMedia('(max-width:700px) and (orientation:portrait)').matches)for(const e of document.querySelectorAll('.wave-front-status,.seismic-impact-status')){if(getComputedStyle(e).display!=='none'){const b=e.getBoundingClientRect();top=Math.max(top,b.bottom-mr.top);}}
  const sidebar=box('sidebar-left');if(sidebar&&sidebar.width<w*.5&&sidebar.left<w*.2)left=Math.max(left,sidebar.right);
  const card=box('painel-direito');if(card){if(card.width<w*.7&&card.left>w*.4)right=Math.min(right,card.left);else if(card.width>w*.8&&card.top>h*.35)bottom=Math.min(bottom,card.top);}
  const radius=Math.max(45,Math.min(right-left,bottom-top)/2-18);
  return {radius,height:h,center:[(left+right)/2,(top+bottom)/2],padding:{left,right:w-right,top,bottom:h-bottom}};
 }
 function worldZoom(latitude=map.getCenter().lat){
  const area=availableRadius();
  return Math.max(map.getMinZoom(),Math.min(3.8,GlobeSpaceModel.fitZoom(area.radius,latitude,area.height,map.getVerticalFieldOfView())));
 }
 function overview(){
  if(!ready()||mode!=='globe')return;
  // Esta ação equivale a abrir o zoom manualmente; eventos novos seguem prioritários.
  window.EventCamera?.cancel();window.SeismicPaintTour?.pause();window.TsunamiPresentation?.pause();window.SeismicFocus?.pause();
  if(typeof waveCamAbortHandler==='function')waveCamAbortHandler({originalEvent:{type:'globe-overview'}});
  if(typeof stopMapCamera==='function')stopMapCamera();
  const c=map.getCenter();
  map.easeTo({center:[c.lng,Math.max(-65,Math.min(65,c.lat))],zoom:worldZoom(Math.max(-65,Math.min(65,c.lat))),bearing:0,pitch:0,padding:availableRadius().padding,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:4500,essential:true});
 }
 function open(){
  close();panel=document.createElement('section');panel.id='globe-preview-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Visualização do mapa');
  const title=document.createElement('h3');title.textContent='Visualização do mapa';panel.append(title);
  const text=document.createElement('p');text.textContent='O site abre no globo. Sua escolha entre globo e mapa plano fica salva neste navegador, com os mesmos eventos, pins e áreas pintadas. O globo mantém apenas o fundo de estrelas. Para explorar os astros, abra o Sistema Solar: a visão é centrada no Sol, com posições calculadas pelo horário e discos em escala física. Os círculos finos indicam onde encontrar os planetas pequenos.';panel.append(text);
  const hint=document.createElement('p');hint.className='globe-preview-current';hint.textContent='Atual: '+(mode==='globe'?'Globo':'Mapa plano');panel.append(hint);
  for(const [value,label]of [['globe','Usar globo'],['mercator','Usar mapa plano']]){
   const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-pressed',String(mode===value));b.onclick=()=>setMode(value);panel.append(b);
  }
  const planet=document.createElement('button');planet.type='button';planet.textContent='Centralizar planeta';planet.onclick=()=>{close();setMode('globe');overview();};panel.append(planet);
  const exit=document.createElement('button');exit.type='button';exit.className='globe-preview-close';exit.setAttribute('aria-label','Fechar visualização do mapa');exit.textContent='×';exit.onclick=close;panel.append(exit);document.body.append(panel);exit.focus();
 }
 document.addEventListener('click',e=>{if(e.target.closest('#chip-planet')){setMode('globe');overview();}if(e.target.closest('#chip-map'))setMode('mercator');});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 window.addEventListener('pagehide',close);
 // `testing` permanece como compatibilidade dos controladores de câmera e céu.
 window.GlobePreview={open,close,setMode,initialize,initialProjection,overview,worldZoom,availableRadius,state:()=>({mode,testing:mode==='globe'})};
})();
