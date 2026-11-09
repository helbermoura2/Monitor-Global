(function(){
'use strict';
const M=window.PhoneBrazilModel, $=id=>document.getElementById(id);
const LAYERS={temperature:{field:'temperature_2m',label:'Temperatura',unit:'°C'},wind:{field:'wind_speed_10m',label:'Vento a 10 m',unit:'km/h'},rain:{field:'precipitation',label:'Precipitação prevista',unit:'mm em 1 h'},pressure:{field:'pressure_msl',label:'Pressão ao nível do mar',unit:'hPa'}};
let map=null,markers=[],ready=false,active=true,closed=false,loading=false,controller=null,timer=0,playTimer=0,forecast=null,lastAttempt=0,lastSuccess=0,layer='temperature',step=0,chosen=13;
const CACHE_MS=3*3600000, MIN_RETRY=10*60000, MAX_DAILY=8, CACHE_KEY='mg-brazil-forecast-v1', BUDGET_KEY='mg-brazil-budget-v1', ATTEMPT_KEY='mg-brazil-last-attempt-v1';
function stored(key){try{return JSON.parse(localStorage.getItem(key));}catch(e){return null;}}
function store(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(e){/* Cache is optional. */}}
function restore(){const data=stored(CACHE_KEY),now=Date.now();if(!data||!Number.isFinite(data.at)||data.at>now||now-data.at>CACHE_MS)return;const parsed=M.parse(data.payload,now);if(!parsed)return;forecast=parsed;lastSuccess=data.at;$('frame').disabled=false;$('play').disabled=false;showValues();}
function note(message){$('brazil-status').textContent=message;$('brazil-status').hidden=!message;}
function round(n){return n.toLocaleString('pt-BR',{maximumFractionDigits:layer==='rain'?1:0,minimumFractionDigits:layer==='rain'?1:0});}
function clearPlayback(){if(playTimer)clearTimeout(playTimer);playTimer=0;$('play').textContent='▶';$('play').setAttribute('aria-label','Reproduzir evolução da previsão');}
function selectedValue(i,field){return M.value(forecast,i,step,field);}
function showValues(){
 if(!forecast)return;
 const at=forecast.times[forecast.first+step*3];
 $('time-label').textContent=at.substring(8,10)+'/'+at.substring(5,7)+' · '+at.substring(11,16)+' BRT';
 $('frame').value=String(step);
 $('layer-label').textContent=LAYERS[layer].label;
 document.querySelectorAll('[data-layer]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.layer===layer)));
 for(let i=0;i<markers.length;i++){
  const marker=markers[i].getElement(),value=selectedValue(i,LAYERS[layer].field),arrow=marker.querySelector('.arrow');
  marker.dataset.layer=layer;marker.dataset.selected=String(i===chosen);
  marker.querySelector('.value').textContent=round(value)+(layer==='temperature'?'°':layer==='pressure'?'':layer==='rain'?'':'');
  arrow.style.rotate=String((selectedValue(i,'wind_direction_10m')+180)%360)+'deg';
  marker.setAttribute('aria-label',M.PLACES[i].name+', '+round(value)+' '+LAYERS[layer].unit);
 }
 const p=M.PLACES[chosen],temperature=selectedValue(chosen,'temperature_2m'),wind=selectedValue(chosen,'wind_speed_10m'),rain=selectedValue(chosen,'precipitation'),pressure=selectedValue(chosen,'pressure_msl');
 $('place').textContent=p.name.toUpperCase()+' · BRASIL';
 $('headline').textContent=round(selectedValue(chosen,LAYERS[layer].field))+' '+LAYERS[layer].unit+' · '+LAYERS[layer].label;
 const facts=$('facts');facts.replaceChildren();
 for(const entry of [[temperature.toFixed(0)+' °C','Temperatura'],[wind.toFixed(0)+' km/h','Vento 10 m'],[rain.toFixed(1)+' mm','Chuva em 1 h'],[pressure.toFixed(0)+' hPa','Pressão']]){
  const cell=document.createElement('div'),strong=document.createElement('strong');strong.textContent=entry[0];cell.append(strong,document.createTextNode(entry[1]));facts.appendChild(cell);
 }
 adjustDensity();
 $('validity').textContent='Pontos de referência em 16 cidades brasileiras · previsões pontuais de modelo, não radar nem campo contínuo. Consulta '+new Date(lastSuccess).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+'.';
}
function adjustDensity(){if(!map||!markers.length)return;const expanded=map.getZoom()>=4.3;for(let i=0;i<markers.length;i++){markers[i].getElement().style.visibility=(expanded||chosen===i||![7,9,11,12,14].includes(i))?'visible':'hidden';}}
function createMarkers(){
 if(!map||!ready)return;
 for(const m of markers)m.remove();markers=[];
 for(let i=0;i<M.PLACES.length;i++){
  const p=M.PLACES[i],button=document.createElement('button');button.type='button';button.className='brazil-dot';button.dataset.layer=layer;button.dataset.selected=String(i===chosen);
  const a=document.createElement('span'),value=document.createElement('span'),name=document.createElement('span');
  a.className='arrow';a.textContent='↑';a.setAttribute('aria-hidden','true');value.className='value';value.textContent='–';name.className='name';name.textContent=p.name;
  button.append(a,value,name);button.setAttribute('aria-label','Consultar previsão para '+p.name);
  button.addEventListener('click',()=>{chosen=i;showValues();});
  markers.push(new maplibregl.Marker({element:button,anchor:'center'}).setLngLat([p.lon,p.lat]).addTo(map));
 }
 showValues();adjustDensity();
}
function initMap(){
 try{
  if(!window.maplibregl)throw Error('MapLibre ausente');
  map=new maplibregl.Map({container:'brazil-map',center:[-53,-15],zoom:2.65,minZoom:2,maxZoom:10,renderWorldCopies:false,pixelRatio:Math.min(window.devicePixelRatio||1,1.25),maxTileCacheSize:96,fadeDuration:0,attributionControl:false,style:{version:8,sources:{imagery:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19,attribution:'Imagens © Esri, Maxar, Earthstar Geographics e GIS User Community'}},layers:[{id:'imagery',type:'raster',source:'imagery',paint:{'raster-fade-duration':0}}]}});
  map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
  map.on('load',()=>{ready=true;createMarkers();if(forecast)note('');});
  map.on('zoom',adjustDensity);
  map.on('error',e=>{if(e.sourceId==='imagery')note('Imagens do mapa indisponíveis. Os dados das cidades podem continuar acessíveis.');});
  map.on('webglcontextlost',()=>{ready=false;note('Mapa pausado pelo sistema. Reabra a visualização para atualizar.');});
 }catch(e){note('Não foi possível abrir o mapa neste aparelho.');}
}
async function load(force){
 if(!active||closed||loading)return;
 const now=Date.now();
 if(forecast&&!force&&now-lastSuccess<CACHE_MS){showValues();return;}
 const day=M.brHour(now).slice(0,10),previous=stored(BUDGET_KEY),used=previous&&previous.day===day&&Number.isSafeInteger(previous.used)?previous.used:0;
 if(used>=MAX_DAILY){note('Limite diário de consultas meteorológicas deste aparelho. Tente amanhã; sem cobrança.');return;}
 const persisted=stored(ATTEMPT_KEY),lastSaved=Number(persisted?.at)||0;
 if(now-Math.max(lastAttempt,lastSaved)<MIN_RETRY){note(forecast?'Última previsão preservada. Aguarde antes de consultar novamente.':'Aguarde alguns minutos antes de tentar novamente.');return;}
 lastAttempt=now;store(ATTEMPT_KEY,{at:now});store(BUDGET_KEY,{day,used:used+1});loading=true;controller=new AbortController();const abort=controller,stop=setTimeout(()=>abort.abort(),11000);
 note('Consultando previsões meteorológicas do Brasil…');
 try{
  const response=await fetch(M.url(),{headers:{Accept:'application/json'},signal:abort.signal,credentials:'omit',redirect:'error'});
  if(!response.ok||Number(response.headers.get('content-length')||0)>320000)throw Error('API indisponível');
  const body=await response.text();if(body.length>320000)throw Error('Resposta muito grande');
  const parsed=M.parse(JSON.parse(body),Date.now());if(!parsed)throw Error('Dados inválidos');
  if(!active||closed)return;
  forecast=parsed;lastSuccess=Date.now();store(CACHE_KEY,{at:lastSuccess,payload:JSON.parse(body)});$('frame').disabled=false;$('play').disabled=false;step=0;createMarkers();showValues();note('');
 }catch(e){if(active&&!closed)note(forecast?'Sem nova atualização. Mantendo previsão anterior com horário identificado.':'Previsão indisponível. Verifique a internet e tente novamente.');}
 finally{clearTimeout(stop);if(controller===abort)controller=null;loading=false;}
}
function pause(){active=false;document.body.classList.add('is-paused');clearPlayback();if(map)map.stop();if(controller)controller.abort();}
function resume(){if(closed)return;active=true;document.body.classList.remove('is-paused');if(map)map.resize();if(!forecast||Date.now()-lastSuccess>=CACHE_MS)load(false);}
function close(){if(closed)return;pause();closed=true;if(map){map.remove();map=null;}markers=[];ready=false;}
function advance(){if(!active||!forecast)return;step=(step+1)%9;showValues();playTimer=setTimeout(advance,1300);}
$('frame').addEventListener('input',event=>{clearPlayback();step=Number(event.target.value);showValues();});
$('play').addEventListener('click',()=>{if(playTimer){clearPlayback();return;}if(forecast){$('play').textContent='❚❚';advance();}});
$('refresh').addEventListener('click',()=>load(true));
$('recenter').addEventListener('click',()=>{if(map)map.jumpTo({center:[-53,-15],zoom:2.65});});
document.querySelectorAll('[data-layer]').forEach(button=>button.addEventListener('click',()=>{layer=button.dataset.layer;showValues();}));
window.MonitorMap={pause,resume,close};
window.addEventListener('pagehide',close);
initMap();restore();load(false);
})();
