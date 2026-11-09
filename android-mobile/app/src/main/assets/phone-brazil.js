/* Forecast only for the municipality selected by the user. No arbitrary spatial extrapolation. */
(function(){'use strict';
const M=window.PhoneBrazilModel,$=id=>document.getElementById(id);
const LAYERS={temperature:{field:'temperature_2m',label:'Temperatura',unit:'°C'},wind:{field:'wind_speed_10m',label:'Vento a 10 m',unit:'km/h'},rain:{field:'precipitation',label:'Precipitação prevista',unit:'mm em 1 h'},pressure:{field:'pressure_msl',label:'Pressão ao nível do mar',unit:'hPa'}};
const CACHE_MS=3*3600000,MIN_RETRY=10*60000,MAX_DAILY=8,CACHE_KEY='mg-brazil-city-v2',BUDGET_KEY='mg-brazil-budget-v1',ATTEMPT_KEY='mg-brazil-last-attempt-v1';
let city={name:'São Paulo',uf:'SP',id:'3550308',lat:-23.555,lon:-46.635},cities=[],map=null,markers=[],satellite=null,radar=null,ready=false,active=true,closed=false,loading=false,controller=null,playTimer=0,forecast=null,lastAttempt=0,lastSuccess=0,layer='temperature',step=0,requestId=0;
function note(message){$('brazil-status').textContent=message;$('brazil-status').hidden=!message;}
function stored(key){try{return JSON.parse(localStorage.getItem(key));}catch(e){return null;}}
function store(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(e){/* Cache is optional; network remains bounded per session. */}}
function key(){return city.id;}
function entries(){const data=stored(CACHE_KEY);return data&&typeof data==='object'&&data.entries&&typeof data.entries==='object'?data.entries:{};}
function restore(){
 const cached=entries()[key()],now=Date.now();if(!cached||!Number.isFinite(cached.at)||cached.at>now||now-cached.at>CACHE_MS)return false;
 const parsed=M.parse(cached.payload,now,[city]);if(!parsed)return false;
 forecast=parsed;lastSuccess=cached.at;$('frame').disabled=false;$('play').disabled=false;showValues();return true;
}
function remember(payload){
 const old=entries(),next={};next[key()]={at:lastSuccess,payload};
 let count=0;for(const [k,v] of Object.entries(old)){if(k===key()||!v||!Number.isFinite(v.at)||Date.now()-v.at>CACHE_MS||count>=3)continue;next[k]=v;count++;}
 store(CACHE_KEY,{entries:next});
}
function stop(){if(playTimer)clearTimeout(playTimer);playTimer=0;$('play').textContent='▶';}
function round(n,decimals=0){return n.toLocaleString('pt-BR',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});}
function value(field){return M.value(forecast,0,step,field);}
function showValues(){
 if(!forecast)return;
 const at=forecast.times[forecast.first+step*3],v=value(LAYERS[layer].field);
 $('time-label').textContent=at.substring(8,10)+'/'+at.substring(5,7)+' · '+at.substring(11,16)+' BRT';
 $('frame').value=String(step);$('layer-label').textContent=LAYERS[layer].label;
 document.querySelectorAll('[data-layer]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.layer===layer)));
 for(const marker of markers){
  const element=marker.getElement();element.dataset.layer=layer;element.dataset.selected='true';
  element.querySelector('.value').textContent=round(v,layer==='rain'?1:0)+(layer==='temperature'?'°':'');
  element.querySelector('.arrow').style.rotate=((value('wind_direction_10m')+180)%360)+'deg';
  element.setAttribute('aria-label',city.name+' '+city.uf+', '+round(v,layer==='rain'?1:0)+' '+LAYERS[layer].unit);
 }
 $('place').textContent=city.name.toUpperCase()+' · '+city.uf;
 $('headline').textContent=round(v,layer==='rain'?1:0)+' '+LAYERS[layer].unit+' · '+LAYERS[layer].label;
 $('facts').replaceChildren();
 for(const [amount,label] of [[round(value('temperature_2m'))+' °C','Temperatura'],[round(value('wind_speed_10m'))+' km/h','Vento a 10 m'],[round(value('precipitation'),1)+' mm','Chuva em 1 h'],[round(value('pressure_msl'))+' hPa','Pressão']]){
  const cell=document.createElement('div'),strong=document.createElement('strong');strong.textContent=amount;cell.append(strong,document.createTextNode(label));$('facts').appendChild(cell);
 }
 $('validity').textContent='Previsão de modelo para '+city.name+' ('+city.uf+') · consulta '+new Date(lastSuccess).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+'. Radar e satélite são imagens observadas independentes.';
}
function createMarker(){
 for(const m of markers)m.remove();markers=[];
 if(!map||!ready)return;
 const el=document.createElement('button'),arrow=document.createElement('span'),val=document.createElement('span'),name=document.createElement('span');
 el.type='button';el.className='brazil-dot';arrow.className='arrow';arrow.textContent='↑';arrow.setAttribute('aria-hidden','true');val.className='value';val.textContent='—';name.className='name';name.textContent=city.name;
 el.append(arrow,val,name);el.setAttribute('aria-label','Previsão de '+city.name+', '+city.uf);
 el.addEventListener('click',()=>showValues());
 markers.push(new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([city.lon,city.lat]).addTo(map));
 showValues();
}
function initMap(){
 try{
  if(!window.maplibregl)throw Error('MapLibre indisponível');
  map=new maplibregl.Map({container:'brazil-map',center:[-53,-15],zoom:2.65,minZoom:2,maxZoom:10,renderWorldCopies:false,pixelRatio:Math.min(window.devicePixelRatio||1,1.25),maxTileCacheSize:96,fadeDuration:0,attributionControl:false,style:{version:8,sources:{imagery:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19,attribution:'Imagens © Esri, Maxar, Earthstar Geographics e GIS User Community'}},layers:[{id:'imagery',type:'raster',source:'imagery',paint:{'raster-fade-duration':0}}]}});
  map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
  map.on('load',()=>{
   ready=true;createMarker();
   try{satellite=window.BrazilSatellite.create({map,host:document.querySelector('.map-panel'),enabled:false});}catch(e){note('Satélite indisponível nesta visualização.');}
   try{radar=window.PhoneBrazilRadar.create(map,document.querySelector('.map-panel'));}catch(e){note('Radar indisponível nesta visualização.');}
   if(forecast)note('');
  });
  map.on('error',event=>{if(event.sourceId==='imagery')note('Imagens de base indisponíveis. A previsão da cidade pode continuar acessível.');});
  map.on('webglcontextlost',()=>{ready=false;note('O mapa foi pausado. Reabra a tela para atualizar.');});
 }catch(e){note('Não foi possível abrir o mapa neste aparelho.');}
}
function normalize(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');}
function showResults(){
 const q=normalize($('city-search').value),box=$('city-results');box.replaceChildren();box.hidden=true;if(q.length<2)return;
 const parts=q.split(',').map(s=>s.trim()),uf=parts.length>1?parts[1].toUpperCase():null;
 const matches=cities.filter(c=>(!uf||c.uf===uf)&&(c.normal.startsWith(parts[0])||c.normal.includes(' '+parts[0]))).slice(0,7);
 for(const item of matches){
  const button=document.createElement('button');button.type='button';button.setAttribute('role','option');button.textContent=item.name+' · '+item.uf;
  button.addEventListener('click',()=>selectCity(item));box.appendChild(button);
 }
 box.hidden=!matches.length;
}
function selectCity(p){
 if(!p)return;
 $('city-search').value=p.name+', '+p.uf;$('city-results').hidden=true;
 if(city.id===p.id)return;
 requestId++;controller?.abort();controller=null;loading=false;stop();city={id:p.id,name:p.name,uf:p.uf,lat:p.lat,lon:p.lon};forecast=null;lastSuccess=0;
 $('frame').disabled=true;$('play').disabled=true;$('place').textContent=city.name.toUpperCase()+' · '+city.uf;
 $('headline').textContent='Consultando '+city.name+'…';$('facts').replaceChildren();
 createMarker();if(map)map.jumpTo({center:[city.lon,city.lat],zoom:Math.max(5,map.getZoom())});
 restore();load(false);
}
async function loadCities(){
 try{
  const response=await fetch('data/br-municipalities.json',{credentials:'omit'});if(!response.ok)throw Error('catálogo indisponível');
  const data=await response.json();if(!Array.isArray(data)||data.length<5000||data.length>6500)throw Error('catálogo inválido');
  cities=data.filter(x=>Array.isArray(x)&&x.length===5&&/^\d{7}$/.test(x[0])&&typeof x[1]==='string'&&typeof x[2]==='string'&&Number.isFinite(x[3])&&Number.isFinite(x[4])).map(([id,name,uf,lon,lat])=>({id,name,uf,lon,lat,normal:normalize(name)}));
  if(cities.length<5000)throw Error('cadastro incompleto');
 }catch(e){note('Busca de municípios indisponível. A previsão de São Paulo continua acessível.');}
}
async function load(force=false){
 if(!active||closed||loading)return;
 const now=Date.now();if(forecast&&!force&&now-lastSuccess<CACHE_MS){showValues();return;}
 const day=M.brHour(now).slice(0,10),previous=stored(BUDGET_KEY),used=previous?.day===day&&Number.isSafeInteger(previous.used)?previous.used:0;
 if(used>=MAX_DAILY){note('Limite diário de consultas meteorológicas deste aparelho. Tente amanhã; sem cobrança.');return;}
 const persisted=stored(ATTEMPT_KEY),lastSaved=Number(persisted?.at)||0;
 if(now-Math.max(lastAttempt,lastSaved)<MIN_RETRY){note(forecast?'Dados salvos preservados. Aguarde antes de consultar novamente.':'Aguarde alguns minutos antes de tentar novamente.');return;}
 const ticket=++requestId,target={...city};lastAttempt=now;store(ATTEMPT_KEY,{at:now});store(BUDGET_KEY,{day,used:used+1});
 loading=true;controller=new AbortController();const c=controller,timeout=setTimeout(()=>c.abort(),11000);note('Consultando previsão de '+target.name+'…');
 try{
  const response=await fetch(M.url([target]),{headers:{Accept:'application/json'},signal:c.signal,credentials:'omit',redirect:'error'});
  if(!response.ok||Number(response.headers.get('content-length')||0)>150000)throw Error('fonte indisponível');
  const raw=await response.text();if(raw.length>150000)throw Error('resposta grande');
  const payload=JSON.parse(raw),result=M.parse(payload,Date.now(),[target]);if(!result)throw Error('previsão inválida');
  if(!active||closed||ticket!==requestId||target.id!==city.id)return;
  forecast=result;lastSuccess=Date.now();remember(payload);step=0;$('frame').disabled=false;$('play').disabled=false;
  createMarker();showValues();note('');
 }catch(e){if(active&&!closed&&ticket===requestId)note(forecast?'Sem atualização. Mantendo a previsão válida anterior.':'Previsão indisponível. Confira a conexão e tente novamente.');}
 finally{clearTimeout(timeout);if(controller===c)controller=null;loading=false;}
}
function pause(){active=false;document.body.classList.add('is-paused');stop();requestId++;controller?.abort();satellite?.setActive(false);radar?.setActive(false);map?.stop();}
function resume(){if(closed)return;active=true;document.body.classList.remove('is-paused');map?.resize();satellite?.setActive(true);radar?.setActive(true);if(!forecast||Date.now()-lastSuccess>=CACHE_MS)load(false);}
function close(){if(closed)return;pause();closed=true;satellite?.destroy();radar?.destroy();for(const m of markers)m.remove();markers=[];map?.remove();map=null;}
function advance(){if(!active||!forecast)return;step=(step+1)%9;showValues();playTimer=setTimeout(advance,1300);}
$('frame').addEventListener('input',event=>{stop();step=Number(event.target.value);showValues();});
$('play').addEventListener('click',()=>{if(playTimer){stop();return;}if(forecast){$('play').textContent='❚❚';advance();}});
$('refresh').addEventListener('click',()=>load(true));
$('recenter').addEventListener('click',()=>map?.jumpTo({center:[-53,-15],zoom:2.65}));
document.querySelectorAll('[data-layer]').forEach(button=>button.addEventListener('click',()=>{layer=button.dataset.layer;showValues();}));
$('city-search').addEventListener('input',showResults);
$('city-search').addEventListener('keydown',e=>{if(e.key==='Escape')$('city-results').hidden=true;else if(e.key==='Enter'){const match=$('city-results').querySelector('button');if(match){e.preventDefault();match.click();$('city-search').blur();}}});
$('radar-toggle').addEventListener('click',()=>{if(!radar){note('Radar ainda indisponível.');return;}const next=!radar.enabled;radar.toggle(next);$('radar-toggle').setAttribute('aria-pressed',String(next));if(next&&satellite?.state.enabled){document.querySelector('.brazil-satellite-control input[type=checkbox]')?.click();$('satellite-toggle').setAttribute('aria-pressed','false');}});
$('satellite-toggle').addEventListener('click',()=>{if(!satellite){note('Satélite indisponível.');return;}document.querySelector('.brazil-satellite-control input[type=checkbox]')?.click();const on=satellite.state.enabled;$('satellite-toggle').setAttribute('aria-pressed',String(on));if(on&&radar?.enabled){radar.toggle(false);$('radar-toggle').setAttribute('aria-pressed','false');}});
window.MonitorMap={pause,resume,close};window.addEventListener('pagehide',close);
initMap();restore();load(false);loadCities();
})();
