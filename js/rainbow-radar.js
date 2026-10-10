/* One current frame, fetched only when enabled. RainViewer is a reserve. */
(function(){
'use strict';
let generation=0,activeMap=null,errorHandler=null,fallback=false,failedUntil=0;
const SOURCE='pro-radar-source',LAYER='pro-radar-layer';
function remove(m){if(!m)return;if(m.getLayer(LAYER))m.removeLayer(LAYER);if(m.getSource(SOURCE))m.removeSource(SOURCE);}
function off(){generation++;if(errorHandler&&activeMap)activeMap.off('error',errorHandler);errorHandler=null;remove(activeMap);activeMap=null;fallback=false;}
function legend(source,time){
 const el=document.getElementById('radar-legend-pro');if(!el)return;
 el.querySelector('b').textContent=source==='Rainbow'?'MAPA DE CHUVA · RAINBOW':'RADAR · FONTE RESERVA';
 el.querySelector('span').textContent=source==='Rainbow'?'Precipitação estimada · quadro atual':'Precipitação observada · RainViewer';
 el.querySelector('small').textContent='Atualizado '+new Date(time).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});el.style.display='block';
}
async function on(m,enabled){
 const token=++generation;activeMap=m;fallback=false;
 if(errorHandler)m.off('error',errorHandler);errorHandler=null;
 const valid=()=>token===generation&&enabled()&&!document.hidden;
 const install=(url,attribution)=>{if(!valid())return false;remove(m);m.addSource(SOURCE,{type:'raster',tiles:[url],tileSize:256,maxzoom:7,attribution});m.addLayer({id:LAYER,type:'raster',source:SOURCE,paint:{'raster-opacity':.62,'raster-fade-duration':0}});return true;};
 async function reserve(){
  if(!valid()||fallback)return false;fallback=true;failedUntil=Date.now()+600000;
  if(errorHandler)m.off('error',errorHandler);errorHandler=null;
  try{
   const r=await fetch('https://api.rainviewer.com/public/weather-maps.json',{cache:'no-store'});if(!r.ok)throw Error('reserve');const d=await r.json(),frame=d.radar?.past?.at(-1);
   if(!frame||!/^https:\/\/[^/]+/.test(d.host))throw Error('frame');
   if(!install(d.host+frame.path+'/256/{z}/{x}/{y}/2/1_1.png','Dados meteorológicos: RainViewer'))return false;
   legend('RainViewer',frame.time*1000);window.MonitorFreshness?.record('RainViewer',true,frame.time*1000);return true;
  }catch{if(valid()){remove(m);const el=document.getElementById('radar-time-pro');if(el)el.textContent='Camada de chuva indisponível';}return false;}
 }
 if(Date.now()<failedUntil)return reserve();
 try{
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),15000);let d;
  try{const r=await fetch(workerBaseUrl()+'/rainbow-snapshot',{signal:c.signal});d=await r.json();if(!r.ok||!d.ok||!Number.isSafeInteger(d.snapshot)||Date.now()-d.snapshot*1000>1800000)throw Error('snapshot');}finally{clearTimeout(timer);}
  if(!valid())return false;
  if(!install(workerBaseUrl()+'/rainbow-tile/'+d.snapshot+'/{z}/{x}/{y}','Dados meteorológicos: Rainbow Weather'))return false;
  legend('Rainbow',d.snapshot*1000);window.MonitorFreshness?.record('RainbowTiles',true,d.snapshot*1000);
  errorHandler=e=>{if(e.sourceId===SOURCE||String(e.error?.message||'').includes('/rainbow-tile/')){window.MonitorFreshness?.record('RainbowTiles',false);reserve();}};
  m.on('error',errorHandler);return true;
 }catch{window.MonitorFreshness?.record('RainbowTiles',false);return reserve();}
}
window.RainbowRadar={on,off};
})();
