/* Forecast only for the municipality selected by the user. No arbitrary spatial extrapolation. */
(function(){'use strict';
const M=window.PhoneBrazilModel,$=id=>document.getElementById(id);
const regional=window.PhoneRainRegion.create(()=>ready?map:null,showWeekly);
const LAYERS={temperature:{field:'temperature_2m',label:'Temperatura',unit:'°C'},wind:{field:'wind_speed_10m',label:'Vento a 10 m',unit:'km/h'},rain:{field:'precipitation',label:'Precipitação prevista',unit:'mm na hora anterior'},pressure:{field:'pressure_msl',label:'Pressão ao nível do mar',unit:'hPa'},humidity:{field:'relative_humidity_2m',label:'Umidade',unit:'%'},gusts:{field:'wind_gusts_10m',label:'Rajadas',unit:'km/h'},feels:{field:'apparent_temperature',label:'Sensação térmica',unit:'°C'}};
const CACHE_MS=3*3600000,MIN_RETRY=10*60000,MAX_DAILY=8,CACHE_KEY='mg-brazil-city-v2',BUDGET_KEY='mg-brazil-budget-v1',ATTEMPT_KEY='mg-brazil-last-attempt-v2';
let pendingSevere=false,mapSize=null;
let city={name:'São Paulo',uf:'SP',id:'3550308',lat:-23.555,lon:-46.635},cities=[],map=null,markers=[],satellite=null,radar=null,boundaries=null,severe=null,severeOn=false,pendingSatellite=false,ready=false,active=true,closed=false,loading=false,controller=null,playTimer=0,forecast=null,lastAttempt=0,lastSuccess=0,layer='temperature',step=0,requestId=0;
function note(message){const box=$('brazil-status');box.textContent=message;box.hidden=!message;box.dataset.kind=/aguarde|limite|indispon|falha|tente|recente/i.test(message)?'warning':'info';if(message&&!forecast&&/aguarde|limite|indispon|falha|tente|recente/i.test(message)){$('headline').textContent='Previsão não disponível no momento';$('time-label').textContent='Aguardando dados';}updateCityCard();renderWeek();}
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
function playbackIcon(playing){
 const button=$('play');
 button.textContent=playing?'Ⅱ':'▶';
 button.setAttribute('aria-label',playing?'Pausar animação':'Reproduzir animação');
 if(typeof button.animate==='function'&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  button.animate([{opacity:.55},{opacity:1}],{duration:130,easing:'ease-out'});
 }
}
function stop(){if(playTimer){clearTimeout(playTimer);playbackIcon(false);}playTimer=0;}
function round(n,decimals=0){return n.toLocaleString('pt-BR',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});}
function value(field){return M.value(forecast,0,step,field);}
let weekly=false,weekKey='';
let comparison=null;
async function compareWeekDay(day,output){
 const target={...city},today=M.brHour(Date.now()).slice(0,10);
 const key=target.id+'/'+today;
 let cached=stored('argos-rain-compare');
 if(cached?.key!==key||Date.now()-cached.at>3*M.HOUR){
  if(comparison){output.textContent='Outra comparação está em andamento. Tente novamente em instantes.';return;}
  const budget=stored('argos-rain-compare-budget');
  const used=budget?.day===today?budget.used:0;
  if(used>=4){output.textContent='Limite diário de comparações atingido.';return;}
  store('argos-rain-compare-budget',{day:today,used:used+1});
  output.textContent='Consultando GFS e ICON…';
  const request=new AbortController();comparison=request;
  const timeout=setTimeout(()=>request.abort(),11000);
  try{
   const response=await fetch(window.PhoneRainRegion.comparisonUrl(target),{signal:request.signal,credentials:'omit',redirect:'error'});
   if(!response.ok||Number(response.headers.get('content-length'))>30000)throw Error();
   const raw=await response.text();
   if(raw.length>30000)throw Error();
   const payload=JSON.parse(raw);
   if(!window.PhoneRainRegion.compare(payload,day.date).length)throw Error();
   cached={key,at:Date.now(),payload};store('argos-rain-compare',cached);
  }catch{output.textContent='Não foi possível consultar os modelos agora.';return;}
  finally{clearTimeout(timeout);if(comparison===request)comparison=null;}
 }
 if(!active||!weekly||target.id!==city.id)return;
 const values=window.PhoneRainRegion.compare(cached.payload,day.date);
 if(!values.length){output.textContent='Sem acumulados disponíveis para este dia.';return;}
 const totals=values.map(item=>item.value);
 const range=values.length>1?' · Faixa entre modelos: '+round(Math.min(...totals),1)+' a '+round(Math.max(...totals),1)+' mm':'';
 output.textContent=values.map(item=>item.name+' '+round(item.value,1)+' mm').join(' · ')+range+
  '. Previsões para o dia no ponto selecionado.';
}

function condition(code){
 if(code===0)return 'Céu limpo';
 if(code===1||code===2)return 'Parcialmente nublado';
 if(code===3)return 'Nublado';
 if(code===45||code===48)return 'Nevoeiro';
 if(code>=95)return 'Possíveis trovoadas';
 if((code>=71&&code<=77)||code===85||code===86)return 'Possibilidade de neve';
 if(code>=51&&code<=67)return code<60?'Garoa':'Chuva';
 if(code>=80&&code<=82)return 'Pancadas de chuva';
 return 'Condição indisponível';
}
function renderWeek(){
 if(!weekly)return;
 $('week-place').textContent=city.name+' · '+city.uf;
 const days=forecast?.series[0]?.week||[];
 $('week-retry').hidden=days.length>0||loading;
 $('week-status').textContent=days.length?'':$('brazil-status').textContent||(forecast?'Previsão de 7 dias indisponível nesta consulta.':'Consultando a previsão…');
 const key=city.id+'/'+lastSuccess+'/'+days[0]?.date;
 if(key===weekKey)return;
 weekKey=key;
 const list=document.createDocumentFragment();
 const dayFormat=new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit',timeZone:'UTC'});
 const metric=(value,unit,decimals=0)=>value===null?'—':round(value,decimals)+unit;
 for(const day of days){
  const card=document.createElement('details'),title=document.createElement('summary');
  const date=document.createElement('strong'),temps=document.createElement('span');
  const weather=document.createElement('span'),icon=document.createElement('span'),chevron=document.createElement('span');
  const chance=document.createElement('span'),amount=document.createElement('span');
  const code=day.weather_code;
  icon.className='week-icon';icon.setAttribute('aria-hidden','true');
  icon.textContent=code===null?'·':code===0?'☀':code<=2?'⛅':code<=48?'☁':code>=95?'⛈':/neve/.test(condition(code))?'❄':'🌧';
  date.textContent=dayFormat.format(new Date(day.date+'T00:00Z'));
  temps.className='week-temperatures';temps.textContent='Mín. '+metric(day.temperature_2m_min,'°')+' · Máx. '+metric(day.temperature_2m_max,'°');
  weather.className='week-condition';weather.textContent=condition(code);
  chance.className='week-chance';chance.textContent=metric(day.precipitation_probability_max,'%')+' de chance';
  amount.className='week-amount';amount.textContent=metric(day.precipitation_sum,' mm',1)+' previstos';
  chevron.className='week-chevron';chevron.setAttribute('aria-hidden','true');
  const info=document.createElement('p');
  info.textContent='Vento máximo previsto: '+metric(day.wind_speed_10m_max,' km/h')+
   (day.peak?' · Maior chance de chuva às '+day.peak.at.slice(11,16)+' ('+day.peak.chance+'%).':'.');
  const rainMap=document.createElement('button');
  rainMap.className='week-rain-map';rainMap.type='button';rainMap.textContent='Ver chuva no mapa';
  rainMap.addEventListener('click',()=>{
   showForecast();
   regional.open({...city},days.map(entry=>entry.date),day.date);
  });
  const comparisonButton=document.createElement('button'),comparisonResult=document.createElement('p');
  comparisonButton.type='button';comparisonButton.className='week-rain-map';comparisonButton.textContent='Comparar modelos';
  comparisonResult.setAttribute('role','status');comparisonResult.className='week-comparison-result';
  comparisonButton.addEventListener('click',()=>compareWeekDay(day,comparisonResult));
  title.append(icon,date,temps,chevron,weather,chance,amount);card.append(title,info,rainMap,comparisonButton,comparisonResult);list.append(card);
 }
 $('week-days').replaceChildren(list);
}
function setWeeklyMode(visible){
 if(weekly===visible)return;
 weekly=visible;
 document.body.classList.toggle('weekly-mode',visible);
 $('week-panel').hidden=!visible;
 window.MonitorMapBridge?.weeklyVisible?.(visible);
}
function showWeekly(){
 if(!weekly){showForecast();setWeeklyMode(true);}
 document.querySelector('.brazil-main').scrollTop=0;
 load(false);
 renderWeek();
 $('week-title').focus({preventScroll:true});
}
$('map-week').addEventListener('click',showWeekly);
$('week-map').addEventListener('click',showForecast);
$('week-retry').addEventListener('click',()=>load(true));
function showValues(){
 renderWeek();
 if(!forecast)return;
 const at=forecast.times[forecast.first+step],v=value(LAYERS[layer].field);
 $('time-label').textContent=at.substring(8,10)+'/'+at.substring(5,7)+' · '+at.substring(11,16)+' BRT';
 $('frame').value=String(step);$('layer-label').textContent=LAYERS[layer].label;
 for(const marker of markers){
  const element=marker.getElement();element.dataset.layer=layer;element.dataset.selected='true';element.dataset.observed=String(!!radar?.enabled||!!satellite?.state.enabled);
  element.querySelector('.value').textContent=Number.isFinite(v)?round(v,layer==='rain'?1:0)+(layer==='temperature'?'°':''):'—';
  const direction=value('wind_direction_10m');element.querySelector('.arrow').style.rotate=Number.isFinite(direction)?((direction+180)%360)+'deg':'0deg';
  element.setAttribute('aria-label',element.dataset.observed==='true'?city.name+' · '+city.uf+' · referência geográfica':city.name+' '+city.uf+', '+(Number.isFinite(v)?round(v,layer==='rain'?1:0)+' '+LAYERS[layer].unit:'dado indisponível'));
 }
 $('place').textContent=city.name.toUpperCase()+' · '+city.uf;
 $('headline').textContent=Number.isFinite(v)?round(v,layer==='rain'?1:0)+' '+LAYERS[layer].unit+' · '+LAYERS[layer].label:LAYERS[layer].label+' · dado ainda indisponível';
 $('facts').replaceChildren();
 for(const [amount,label] of [[round(value('temperature_2m'))+' °C','Temperatura'],[round(value('wind_speed_10m'))+' km/h','Vento a 10 m'],[round(value('precipitation'),1)+' mm','Chuva na hora anterior'],[round(value('pressure_msl'))+' hPa','Pressão'],[Number.isFinite(value('relative_humidity_2m'))?round(value('relative_humidity_2m'))+'%':'—','Umidade'],[Number.isFinite(value('wind_gusts_10m'))?round(value('wind_gusts_10m'))+' km/h':'—','Rajadas'],[Number.isFinite(value('apparent_temperature'))?round(value('apparent_temperature'))+' °C':'—','Sensação térmica']]){
  const cell=document.createElement('div'),strong=document.createElement('strong');strong.textContent=amount;cell.append(strong,document.createTextNode(label));$('facts').appendChild(cell);
 }
 showRain24(forecast);
 $('validity').textContent='Previsão de modelo para '+city.name+' ('+city.uf+') · consulta '+new Date(lastSuccess).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+'. Radar e satélite são imagens observadas independentes.';
}
const shortTime=time=>time.slice(11,16);
function windowText(from,to){
 const day=time=>time.slice(8,10)+'/'+time.slice(5,7);
 return day(from)+' · '+shortTime(from)+'–'+(from.slice(0,10)===to.slice(0,10)?'':day(to)+' ')+shortTime(to);
}
let rain24Key='';
function updateCityCard(){
 const card=$('map-city-card');
 if(card.hidden)return;
 $('map-city-title').textContent=city.name+' · '+city.uf;
 const facts=$('map-city-facts');facts.replaceChildren();
 if(forecast)for(const [field,label,unit] of [['temperature_2m','Temperatura','°C'],['wind_speed_10m','Vento','km/h'],['relative_humidity_2m','Umidade','%'],['apparent_temperature','Sensação','°C'],['wind_gusts_10m','Rajadas','km/h'],['pressure_msl','Pressão','hPa']]){
 const v=value(field);if(!Number.isFinite(v))continue;
 const cell=document.createElement('div'),strong=document.createElement('strong');strong.textContent=Math.round(v)+' '+unit;cell.append(strong,document.createTextNode(label));facts.append(cell);
 }
 const available=!$('city-rain-summary').hidden&&!!forecast;
 $('map-city-total').textContent=available?$('rain24-volume').textContent+' previstos · até 24 h':
  ($('brazil-status').hidden?'Consultando previsão…':$('brazil-status').textContent);
 $('map-city-peak').textContent=available?$('rain24-peak').textContent:'';
 $('map-city-more').hidden=!available;
}
function closeCityCard(){
 $('map-city-card').hidden=true;
 $('map-city-more').open=false;
 $('facts').after($('city-rain-summary'));
}
function openCityCard(){
 closeSelection();
 setLayerMenu(false);
 $('map-city-card').hidden=false;
 updateCityCard();
 $('map-city-title').focus({preventScroll:true});
}
function setLayerMenu(open){
 $('layer-menu').hidden=!open;
 $('layers-toggle').setAttribute('aria-expanded',String(open));
}
$('layers-toggle').addEventListener('click',()=>{
 const open=$('layer-menu').hidden;
 if(open)closeCityCard();
 setLayerMenu(open);
});
$('layer-menu').addEventListener('keydown',event=>{
 if(event.key==='Escape'){setLayerMenu(false);$('layers-toggle').focus();}
});
$('map-city-close').addEventListener('click',()=>{
 closeCityCard();markers[0]?.getElement().focus({preventScroll:true});
});
const grip=$('map-city-grip');let gripY=null;
 grip.addEventListener('click',()=>{if(!$('map-city-more').hidden)$('map-city-more').open=!$('map-city-more').open;});
 grip.addEventListener('pointerdown',e=>{gripY=e.clientY;grip.setPointerCapture(e.pointerId);});
 grip.addEventListener('pointercancel',()=>{gripY=null;});
 grip.addEventListener('pointerup',e=>{if(gripY===null)return;const dy=e.clientY-gripY;gripY=null;if(Math.abs(dy)>24&&!$('map-city-more').hidden){$('map-city-more').open=dy<0;grip.dataset.swiped='true';setTimeout(()=>delete grip.dataset.swiped,350);}});
 grip.addEventListener('click',e=>{if(grip.dataset.swiped){delete grip.dataset.swiped;e.stopImmediatePropagation();}},true);
 $('map-city-more').addEventListener('toggle',()=>{
 if($('map-city-more').open)$('map-city-chart').append($('city-rain-summary'));
 else $('facts').after($('city-rain-summary'));
 $('map-city-card').classList.toggle('is-expanded',$('map-city-more').open);
});
function showRain24(data){
 const hours=M.rainIntervals(data);
 const card=$('city-rain-summary');
 card.hidden=hours.length===0;
 if(!hours.length){updateCityCard();return;}
 const from=hours[0].from,to=hours.at(-1).to,key=city.id+'/'+lastSuccess+'/'+from+'/'+to;
 if(key===rain24Key){updateCityCard();return;}
 rain24Key=key;
 const peak=hours.reduce((max,hour)=>hour.amount>max.amount?hour:max);
 const total=hours.reduce((sum,hour)=>sum+hour.amount,0);
 const mm=amount=>(amount>0&&amount<.05?'< 0,1':round(amount,1))+' mm';
 $('rain24-volume').textContent=mm(total);
 $('rain24-window').textContent=windowText(from,to)+' BRT · '+hours.length+' horas completas · Open-Meteo';
 $('rain24-start').textContent=shortTime(from);$('rain24-end').textContent=shortTime(to);
 $('rain24-peak').textContent=peak.amount>0?'Maior volume · '+mm(peak.amount)+' entre '+windowText(peak.from,peak.to)+' BRT':
  'Sem chuva prevista nos intervalos acima.';
 const impact=total===0?'O modelo não indica chuva nesses horários.':
  peak.amount>=30?'Chuva concentrada pode reduzir bastante a visibilidade e causar enxurradas ou alagamentos em pontos vulneráveis.':
  peak.amount>=10||total>=20?'A chuva pode reduzir a visibilidade e causar poças. Em pontos baixos ou com drenagem lenta, pode haver acúmulo de água.':
  'Pode haver pista molhada e poças em pontos com drenagem lenta.';
 const equivalent=total>0?'Cada 1 mm equivale a 1 litro de água por m². ':'';
 $('rain24-impact').textContent=equivalent+impact+' Os efeitos dependem do relevo, da drenagem e da chuva anterior.';
 updateCityCard();
 const bars=document.createDocumentFragment(),table=document.createDocumentFragment();
 for(const hour of hours){
  const slot=document.createElement('span'),bar=document.createElement('i'),row=document.createElement('li');
  bar.style.height=(peak.amount>0?Math.max(2,100*hour.amount/peak.amount):2)+'%';
  slot.append(bar);bars.append(slot);
  const label=document.createElement('span'),amount=document.createElement('strong');
  label.textContent=windowText(hour.from,hour.to);amount.textContent=mm(hour.amount);
  row.append(label,amount);table.append(row);
 }
 $('rain24-bars').replaceChildren(bars);$('rain24-hours').replaceChildren(table);
}
function createMarker(){
 for(const m of markers)m.remove();markers=[];
 if(!map||!ready)return;
 const el=document.createElement('button'),arrow=document.createElement('span'),val=document.createElement('span'),name=document.createElement('span');
 el.type='button';el.className='brazil-dot';arrow.className='arrow';arrow.textContent='↑';arrow.setAttribute('aria-hidden','true');val.className='value';val.textContent='—';name.className='name';name.textContent=city.name;
 el.append(arrow,val,name);el.setAttribute('aria-label','Previsão de '+city.name+', '+city.uf);
 el.addEventListener('click',event=>{event.stopPropagation();openCityCard();});
 markers.push(new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([city.lon,city.lat]).addTo(map));
 showValues();
}
function initMap(){
 try{
  if(!window.maplibregl)throw Error('MapLibre indisponível');
  map=new maplibregl.Map({container:'brazil-map',center:[-53,-15],zoom:2.65,minZoom:2,maxZoom:10,renderWorldCopies:false,pixelRatio:Math.min(window.devicePixelRatio||1,1.25),maxTileCacheSize:96,fadeDuration:0,attributionControl:false,style:{version:8,sources:{imagery:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19,attribution:'Imagens © Esri, Maxar, Earthstar Geographics e GIS User Community'}},layers:[{id:'imagery',type:'raster',source:'imagery',paint:{'raster-fade-duration':0}}]}});
  if(typeof ResizeObserver==='function')mapSize=new ResizeObserver(()=>map?.resize()),mapSize.observe($('brazil-map'));
  map.on('load',()=>{
   ready=true;createMarker();
   try{satellite=window.BrazilSatellite.create({map,host:$('overlay-panel'),enabled:false});const satellitePanel=$('overlay-panel').querySelector('.brazil-satellite-control');satellitePanel.querySelector('details').open=true;satellitePanel.prepend(satellitePanel.querySelector('.br-satellite-status'));satelliteCheckbox()?.addEventListener('change',()=>{if(!severeOn&&satellite?.state.enabled&&radar?.enabled){radar.toggle(false);$('radar-toggle').setAttribute('aria-pressed','false');}syncOverlays();});}catch(e){note('Satélite indisponível nesta visualização.');}
   try{radar=window.PhoneBrazilRadar.create(map,$('overlay-panel'),()=>{severe?.raise();severe?.analyze();});}catch(e){note('Radar indisponível nesta visualização.');}
   try{boundaries=window.ArgosBoundaries.create({map,selectAnywhere:true,host:document.querySelector('.brazil-map-panel'),shouldOpen:point=>!regional.opened&&!severe?.hasMarkerAt(point),presentPlace:content=>{if(content.dataset.citySelected==='true')return;showSelection(content);},onPlace:place=>{const local=cities.find(item=>item.id===place.municipalityId);
     if(!local)return 'Amplie o mapa para identificar o município pelo limite do IBGE.';
     place.element.dataset.citySelected='true';
     selectCity(local,false);returnToMap();openCityCard();
     return '';}});boundaries?.setActive(active);}
   catch(e){note('Limites estaduais e municipais indisponíveis. A previsão segue funcionando.');}
   try{severe=window.PhoneSevereWeather.create(map,$('severe-panel'),()=>radar?.state,()=>{
    const rain=forecast&&M.nextRain(forecast);
    return rain?{coords:[city.lon,city.lat],place:city.name,rain:rain.amount}:null;
   },showSelection);}catch(e){note('Camadas de tempo severo indisponíveis.');}
   syncOverlays();if(pendingSatellite)showSatellite();if(pendingSevere)showSevere();
   if(regional.opened)regional.position();
   if(forecast)note('');
  });
  map.on('contextmenu',event=>{
   const root=document.createElement('section');root.className='weather-selection-data';
   const title=document.createElement('strong');title.textContent='Coordenadas do ponto';
   const coords=document.createElement('p');coords.textContent=event.lngLat.lat.toFixed(6)+', '+event.lngLat.lng.toFixed(6);
   root.append(title,coords);showSelection(root);
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
  button.addEventListener('click',()=>{selectCity(item);openCityCard();});box.appendChild(button);
 }
 box.hidden=!matches.length;
}
function selectCity(p,recenter=true){
 if(!p)return;
 $('city-search').value=p.name+', '+p.uf;$('city-results').hidden=true;
 if(city.id===p.id)return;
 requestId++;controller?.abort();controller=null;loading=false;stop();city={id:p.id,name:p.name,uf:p.uf,lat:p.lat,lon:p.lon};forecast=null;lastSuccess=0;step=0;$('city-rain-summary').hidden=true;
 $('frame').disabled=true;$('play').disabled=true;$('place').textContent=city.name.toUpperCase()+' · '+city.uf;
 $('headline').textContent='Consultando '+city.name+'…';$('facts').replaceChildren();updateCityCard();
 createMarker();if(map&&recenter)map.jumpTo({center:[city.lon,city.lat],zoom:Math.max(5,map.getZoom())});
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
 const now=Date.now();if(forecast&&!force&&now-lastSuccess<CACHE_MS&&(!weekly||forecast.series[0].week.length===7)){showValues();return;}
 const day=M.brHour(now).slice(0,10),previous=stored(BUDGET_KEY),used=previous?.day===day&&Number.isSafeInteger(previous.used)?previous.used:0;
 if(used>=MAX_DAILY){note('Limite diário gratuito atingido. Nova consulta amanhã.');return;}
 const persisted=stored(ATTEMPT_KEY),attempts=persisted?.day===day&&persisted?.cities&&typeof persisted.cities==='object'?persisted.cities:{},lastSaved=Number(attempts[key()])||0;
 if(now-lastSaved<MIN_RETRY){note(forecast?'Exibindo previsão salva. Nova consulta disponível em breve.':'Consulta recente. Tente novamente em alguns minutos.');return;}
 const ticket=++requestId,target={...city};lastAttempt=now;store(ATTEMPT_KEY,{day,cities:{...attempts,[key()]:now}});store(BUDGET_KEY,{day,used:used+1});
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
 finally{clearTimeout(timeout);if(controller===c){controller=null;loading=false;renderWeek();}}
}
function pause(){active=false;comparison?.abort();regional.setActive(false);document.body.classList.add('is-paused');stop();requestId++;controller?.abort();satellite?.setActive(false);radar?.setActive(false);severe?.setActive(false);boundaries?.setActive(false);map?.stop();}
function resume(){if(closed)return;active=true;regional.setActive(true);document.body.classList.remove('is-paused');map?.resize();satellite?.setActive(true);radar?.setActive(true);severe?.setActive(true);boundaries?.setActive(true);syncOverlays();if(!forecast||Date.now()-lastSuccess>=CACHE_MS||weekly&&!forecast.series[0].week.length)load(false);}
function close(){if(closed)return;pause();regional.close();closed=true;mapSize?.disconnect();boundaries?.destroy();boundaries=null;satellite?.destroy();radar?.destroy();severe?.destroy();for(const m of markers)m.remove();markers=[];map?.remove();map=null;}
function advance(){if(!active||!forecast)return;step=(step+1)%25;showValues();playTimer=setTimeout(advance,1300);}
$('forecast-now').addEventListener('click',()=>{stop();step=0;showValues();});
$('frame').addEventListener('input',event=>{stop();step=Number(event.target.value);showValues();});
$('play').addEventListener('click',()=>{if(playTimer){stop();return;}if(forecast){playbackIcon(true);advance();}});
$('refresh').addEventListener('click',()=>load(true));
$('locate').addEventListener('click',()=>{
 if(!navigator.geolocation){note('Localização indisponível.');return;}
 const button=$('locate');button.disabled=true;
 navigator.geolocation.getCurrentPosition(position=>{
  button.disabled=false;if(!map)return;
  const {longitude,latitude}=position.coords;
  map.jumpTo({center:[longitude,latitude],zoom:Math.max(9,map.getZoom())});
  boundaries?.selectPoint(longitude,latitude);
 },error=>{button.disabled=false;note(error.code===1?'Autorize a localização no Android e toque novamente.':'Não foi possível obter a localização.');},{enableHighAccuracy:true,timeout:15000,maximumAge:30000});
});
$('recenter').addEventListener('click',()=>{closeSelection();map?.jumpTo({center:[-53,-15],zoom:2.65});});
document.querySelectorAll('.brazil-toolbar [data-layer]').forEach(button=>button.addEventListener('click',()=>{layer=button.dataset.layer;if(severeOn||radar?.enabled||satellite?.state.enabled)showForecast();else{showValues();syncOverlays();}setLayerMenu(false);}));
$('city-search').addEventListener('input',showResults);
$('city-search').addEventListener('keydown',e=>{if(e.key==='Escape')$('city-results').hidden=true;else if(e.key==='Enter'){const match=$('city-results').querySelector('button');if(match){e.preventDefault();match.click();$('city-search').blur();}}});
function setExpanded(expanded){
 document.body.classList.toggle('map-expanded',expanded);
 const button=$('map-expand');
 button.setAttribute('aria-pressed',String(expanded));
 button.textContent=expanded?'Mostrar controles':'Só mapa';
 requestAnimationFrame(()=>map?.resize());
}
function closeSelection(){
 $('map-selection').hidden=true;
 $('map-selection-content').replaceChildren();
}
function showSelection(content){
 const panel=$('map-selection');closeCityCard();setLayerMenu(false);
 if(document.body.classList.contains('map-expanded'))setExpanded(false);
 // A single destination for both map click handlers.
 content.className='weather-selection-data';
 $('map-selection-content').replaceChildren(content);
 panel.hidden=false;
 requestAnimationFrame(()=>{
  if(panel.hidden)return;
  const heading=$('map-selection-title');
  heading.focus({preventScroll:true});
  panel.scrollIntoView({block:'nearest'});
 });
}
$('map-selection-close').addEventListener('click',()=>{
 closeSelection();document.querySelector('.brazil-main').scrollTop=0;$('map-expand').focus({preventScroll:true});
});
$('map-expand').addEventListener('click',()=>{
 const expanded=!document.body.classList.contains('map-expanded');
 if(expanded){closeSelection();closeCityCard();setLayerMenu(false);}
 setExpanded(expanded);
 document.querySelector('.brazil-main').scrollTop=0;
});
$('map-details').addEventListener('click',()=>{
 $('map-details-panel').scrollIntoView({block:'start'});
 $('map-return').focus({preventScroll:true});
});
function returnToMap(){document.querySelector('.brazil-main').scrollTop=0;}
$('map-return').addEventListener('click',()=>{
 returnToMap();
 $('map-details').focus({preventScroll:true});
});
function satelliteCheckbox(){return document.querySelector('#overlay-panel .brazil-satellite-control input[type=checkbox]');}
function syncOverlays(){
 const satOn=!!satellite?.state.enabled,radarOn=!!radar?.enabled;
 document.body.classList.toggle('observed-mode',satOn||radarOn);
 document.querySelectorAll('.brazil-toolbar [data-layer]').forEach(button=>button.setAttribute('aria-pressed',String(!satOn&&!radarOn&&!severeOn&&button.dataset.layer===layer)));
 $('radar-mini-key').hidden=!radarOn;
 $('map-details').textContent=satOn||radarOn?'Ver legenda e fontes':'Ver previsão e fontes';
 $('satellite-toggle').setAttribute('aria-pressed',String(satOn));
 $('radar-toggle').setAttribute('aria-pressed',String(radarOn));
 const satellitePanel=document.querySelector('#overlay-panel .brazil-satellite-control');if(satellitePanel)satellitePanel.hidden=!satOn;
 for(const marker of markers){const element=marker.getElement();element.dataset.observed=String(satOn||radarOn);if(satOn||radarOn)element.setAttribute('aria-label',city.name+' · '+city.uf+' · referência geográfica');}
 $('overlay-panel').hidden=!satOn&&!radarOn;
 $('map-reading').hidden=!radarOn&&!severeOn;$('radar-key').hidden=!radarOn;
 severe?.raise();
}
$('radar-toggle').addEventListener('click',()=>{
 if(severeOn)setSevere(false);
 if(!radar){note('Radar ainda indisponível.');return;}
 const next=!radar.enabled;
 if(next&&!severeOn&&satellite?.state.enabled){satelliteCheckbox()?.click();}
 radar.toggle(next);syncOverlays();
});
$('satellite-toggle').addEventListener('click',()=>{
 if(severeOn)setSevere(false);
 if(!satellite){note('Satélite indisponível.');return;}
 const next=!satellite.state.enabled;
 if(next&&!severeOn&&radar?.enabled)radar.toggle(false);
 satelliteCheckbox()?.click();syncOverlays();
});
function setSevere(next){
 severeOn=next;closeSelection();
 $('severe-toggle').setAttribute('aria-pressed',String(severeOn));
 document.body.classList.toggle('severe-mode',severeOn);
 if(map.getLayer('imagery')){
  map.setPaintProperty('imagery','raster-brightness-max',severeOn ? .57 : 1);
  map.setPaintProperty('imagery','raster-saturation',severeOn ? -.46 : 0);
 }
 if(severeOn&&!radar.enabled)radar.toggle(true);
 if(!severeOn&&radar.enabled&&satellite?.state.enabled)satelliteCheckbox()?.click();
 severe.toggle(severeOn);syncOverlays();
}
function showSevere(){
 if(regional.opened)regional.close();
 setWeeklyMode(false);
 if(!ready||!severe||!radar){pendingSevere=true;return;}
 pendingSevere=false;if(!severeOn)setSevere(true);
}
$('severe-toggle').addEventListener('click',()=>{
 if(!severe||!radar){note('Aguarde o carregamento do mapa.');return;}
 setSevere(!severeOn);setLayerMenu(false);
});
function showSatellite(){if(regional.opened)regional.close();setWeeklyMode(false);pendingSatellite=true;if(!ready||!satellite)return;pendingSatellite=false;if(radar?.enabled)radar.toggle(false);if(!satellite.state.enabled)satelliteCheckbox()?.click();syncOverlays();}
function showForecast(){
 if(regional.opened)regional.close();
 setWeeklyMode(false);
 pendingSevere=false;pendingSatellite=false;
 if(severeOn)setSevere(false);
 if(radar?.enabled)radar.toggle(false);
 if(satellite?.state.enabled)satelliteCheckbox()?.click();
 if(document.body.classList.contains('map-expanded'))setExpanded(false);
 stop();step=0;showValues();syncOverlays();
 document.querySelector('.brazil-main').scrollTop=0;
}
window.MonitorMap={pause,resume,close,showSatellite,showSevere,showForecast,showWeekly};window.addEventListener('pagehide',close);
initMap();restore();load(false);loadCities();
})();


