(function(){
'use strict';
const API='https://black-sky-9ba0.terrestre.workers.dev',M=window.PhoneRainModel,$=id=>document.getElementById(id),CENTER=[-46.635,-23.555];
let map=null,loaded=false,active=true,closed=false,epoch=0,metadata=null,rawForecast=null,frames=[],index=3,currentSource='',playing=false,playTimer=0,frameTimer=0,expiryTimer=0,lastLoad=0,loading=false,detailsChosen=false,detailsInitialized=false,refreshAfter=0,baseFailed=false;
const requests=new Set(),sources=new Set(),failedSources=new Set();
function message(value){$('map-status').textContent=value;$('map-status').hidden=!value;}
function time(value){return new Date(value).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'})+' BRT';}
function number(value){return value.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});}
function halt(){playing=false;clearTimeout(playTimer);playTimer=0;$('play').textContent='▶';$('play').setAttribute('aria-label','Reproduzir animação');}
function clearGraph(text){$('headline').textContent=text;$('chart').replaceChildren();$('facts').replaceChildren();$('selected-point').textContent='';$('forecast-details').hidden=true;$('forecast-source').textContent='Previsão por minuto indisponível para este ponto.';}
function renderForecast(){
 const value=M.forecast(rawForecast);if(!value){clearGraph('Previsão da Liberdade indisponível');return;}
 $('headline').textContent=value.headline;$('horizon').textContent=value.minutes>=120?'2 horas':value.minutes+' min';$('forecast-details').querySelector('summary').firstChild.textContent='Ver gráfico · próximas '+(value.minutes>=120?'2 horas':value.minutes+' min')+' ';$('chart').replaceChildren();$('facts').replaceChildren();$('forecast-details').hidden=false;if(!detailsInitialized&&!detailsChosen){$('forecast-details').open=value.peak>=.1;detailsInitialized=true;}
 const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 350 130');svg.setAttribute('role','img');svg.setAttribute('aria-label','Precipitação estimada na Liberdade: próximos '+value.minutes+' minutos, pico '+number(value.peak)+' milímetros por hora');
 const make=(tag,attrs,text)=>{const el=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;svg.appendChild(el);return el;};
 const scale=Math.max(2.5,value.peak*1.15),x=t=>32+304*(t-value.now)/(value.until-value.now),y=r=>96-76*r/scale;
 for(const rate of [0,scale/2,scale]){const at=y(rate);make('line',{x1:32,y1:at,x2:336,y2:at,stroke:'#1c3b50','stroke-width':1});make('text',{x:27,y:at+3,'text-anchor':'end'},number(rate));}
 make('text',{x:32,y:9},'mm/h');
 let path='';for(const p of value.points){const left=x(Math.max(p.start,value.now)),right=x(Math.min(p.end,value.until)),height=y(p.rate);path+=(path?' L':'M')+left.toFixed(2)+' '+height.toFixed(2)+' L'+right.toFixed(2)+' '+height.toFixed(2);}
 make('path',{d:path+' L336 96 L32 96 Z',fill:'#16a4d5','fill-opacity':'.25'});make('path',{d:path,fill:'none',stroke:'#49d7fb','stroke-width':2,'stroke-linejoin':'round'});
 for(const fraction of [0,.25,.5,.75,1])make('text',{x:32+304*fraction,y:119,'text-anchor':fraction===0?'start':fraction===1?'end':'middle'},fraction===0?'Agora':'+'+Math.round(value.minutes*fraction)+' min');
 $('chart').appendChild(svg);
 const facts=[[number(value.amount)+' mm','em '+value.minutes+' min']];if(value.duration>0)facts.push(['~'+value.duration+' min',value.arrival===0?'de chuva restante':'de chuva prevista']);
 for(const [amount,label] of facts){const cell=document.createElement('div'),strong=document.createElement('strong');strong.textContent=amount;cell.append(strong,document.createTextNode(label));$('facts').appendChild(cell);}
 $('forecast-source').textContent='Previsão por minuto · consulta '+time(value.at)+(value.minutes<120?' · horizonte disponível: '+value.minutes+' min':'');updateSelectedPoint(value);
}
function updateSelectedPoint(value=M.forecast(rawForecast)){
 const frame=frames[index];if(!value||!frame){$('selected-point').textContent='';return;}const at=frame.time;const old=$('chart').querySelector('.selected-cursor');if(old)old.remove();
 if(at<value.now){$('selected-point').textContent='Mapa de '+time(at)+'. Previsão do ponto a partir de '+time(value.now)+'.';return;}const point=value.points.find(p=>p.start<=at&&p.end>at);if(!point){$('selected-point').textContent='O horário do mapa está fora da previsão disponível para o ponto.';return;}
 $('selected-point').textContent='Às '+time(at)+' no ponto: '+number(point.rate)+' mm/h previstos';const svg=$('chart').querySelector('svg');if(svg){const cursor=document.createElementNS('http://www.w3.org/2000/svg','line'),x=32+304*(at-value.now)/(value.until-value.now);for(const [k,v]of Object.entries({x1:x,x2:x,y1:20,y2:96,class:'selected-cursor'}))cursor.setAttribute(k,v);svg.appendChild(cursor);}
}
function hideRain(){if(!map||!loaded)return;for(const id of sources)if(map.getLayer(id))map.setLayoutProperty(id,'visibility','none');}
function settled(){
 if(!active||closed||!currentSource||failedSources.has(currentSource)||!map||!map.getSource(currentSource)||!map.isSourceLoaded(currentSource))return;
 clearTimeout(frameTimer);frameTimer=0;const frame=frames[index];if(!frame)return;
 message(baseFailed?'Mapa de referência indisponível. Os dados de chuva continuam identificados abaixo.':'');$('frame-kind').textContent=frame.offset<0?'HISTÓRICO':frame.offset>0?'PREVISÃO':'ÚLTIMO QUADRO';$('frame-kind').dataset.kind=frame.offset>0?'forecast':'history';$('frame-label').textContent=(frame.offset<0?'Histórico':frame.offset>0?'Previsão':'Quadro atual')+' · '+time(frame.time);$('frame').setAttribute('aria-valuetext',$('frame-label').textContent);
 const age=Math.max(0,Math.floor((Date.now()-metadata.snapshot*1000)/60000));$('map-source').textContent='Base do mapa: '+time(metadata.snapshot*1000)+' · há '+age+' min';$('map-source').dataset.stale=String(age>15);updateSelectedPoint();
 if(playing&&!playTimer)playTimer=setTimeout(()=>{playTimer=0;if(index>=frames.length-1){halt();return;}showFrame(index+1);},1100);
}
function frameFailed(){if(!active)return;failedSources.add(currentSource);clearTimeout(frameTimer);frameTimer=0;halt();hideRain();message('Este quadro de chuva está indisponível. Tente outro horário ou atualize.');$('frame-label').textContent='Quadro indisponível';}
function showFrame(next){
 if(!loaded||!active||closed||!frames.length)return;
 clearTimeout(frameTimer);clearTimeout(playTimer);playTimer=0;index=Math.max(0,Math.min(frames.length-1,next));$('frame').value=String(index);hideRain();
 const frame=frames[index],id='phone-rain-'+index;currentSource=id;
 if(failedSources.has(id)){if(map.getLayer(id))map.removeLayer(id);if(map.getSource(id))map.removeSource(id);sources.delete(id);failedSources.delete(id);}
 $('frame-label').textContent='Carregando '+time(frame.time)+'…';message('Carregando '+(frame.offset>0?'previsão':'histórico')+' de '+time(frame.time)+'…');
 if(!map.getSource(id)){map.addSource(id,{type:'raster',tiles:[API+'/rainbow-tile/'+frame.snapshot+'/'+frame.forecast+'/{z}/{x}/{y}'],tileSize:256,maxzoom:7,attribution:'Precipitação: Rainbow Weather'});map.addLayer({id,type:'raster',source:id,paint:{'raster-opacity':.65,'raster-fade-duration':0}});sources.add(id);}
 else map.setLayoutProperty(id,'visibility','visible');
 frameTimer=setTimeout(frameFailed,15000);settled();
}
function removeFrames(){hideRain();if(map&&loaded)for(const id of sources){if(map.getLayer(id))map.removeLayer(id);if(map.getSource(id))map.removeSource(id);}sources.clear();failedSources.clear();currentSource='';}
async function json(path,token){
 const controller=new AbortController();requests.add(controller);const timeout=setTimeout(()=>controller.abort(),12000);
 try{const response=await fetch(API+path,{signal:controller.signal,credentials:'omit',redirect:'error'});if(!response.ok)throw Error('source');const text=await response.text();if(text.length>150000||token!==epoch||!active||closed)throw Error('cancelled');return JSON.parse(text);}
 finally{clearTimeout(timeout);requests.delete(controller);}
}
function scheduleExpiry(){
 clearTimeout(expiryTimer);if(!active||closed)return;const now=Date.now(),times=[metadata?M.mapExpiresAt(metadata):Infinity,rawForecast?rawForecast.expiresAt:Infinity,refreshAfter>now?refreshAfter:Infinity],next=Math.min(...times.filter(t=>t>now));
 if(Number.isFinite(next))expiryTimer=setTimeout(()=>{if(!active||closed)return;renderForecast();if(metadata&&!M.frames(metadata).length){halt();removeFrames();metadata=null;frames=[];$('frame').disabled=true;$('play').disabled=true;$('frame-label').textContent='Atualizando mapa…';}load();},Math.max(100,next-now+50));
 else if(refreshAfter>now)expiryTimer=setTimeout(()=>load(),refreshAfter-now);
}
async function load(force=false){
 if(!active||closed||!loaded||loading)return;if(!force&&Date.now()<refreshAfter){scheduleExpiry();return;}if(force&&Date.now()-lastLoad<30000){message('Aguarde alguns segundos antes de consultar novamente.');return;}
 const token=epoch;loading=true;lastLoad=Date.now();refreshAfter=0;$('refresh').disabled=true;halt();
 const needMap=force||!M.frames(metadata).length,needForecast=force||!M.forecast(rawForecast);
 const jobs=[];
 if(needMap){message('Consultando quadros de chuva…');jobs.push(json('/rainbow-snapshot',token).then(data=>{const list=M.frames(data);if(!list.length)throw Error('metadata');removeFrames();metadata=data;frames=list;index=3;$('frame').disabled=false;$('play').disabled=false;showFrame(index);}).catch(()=>{if(token===epoch&&active){refreshAfter=Date.now()+300000;removeFrames();metadata=null;frames=[];$('frame').disabled=true;$('play').disabled=true;$('frame-label').textContent='Mapa indisponível';message('Mapa de chuva indisponível. Atualize para tentar novamente.');}}));}
 if(needForecast){if(!M.forecast(rawForecast))clearGraph('Atualizando previsão da Liberdade…');jobs.push(json('/tv-rain?area=liberdade',token).then(data=>{if(!M.forecast(data))throw Error('forecast');rawForecast=data;renderForecast();}).catch(()=>{if(token===epoch&&active){refreshAfter=Date.now()+300000;rawForecast=null;clearGraph('Previsão da Liberdade indisponível');}}));}
 await Promise.allSettled(jobs);if(token!==epoch||closed||!active)return;loading=false;$('refresh').disabled=false;if(!needMap)showFrame(index);if(!needForecast)renderForecast();scheduleExpiry();
}
function pause(){active=false;epoch++;loading=false;halt();clearTimeout(frameTimer);clearTimeout(expiryTimer);for(const request of requests)request.abort();requests.clear();hideRain();if(map)map.stop();}
function resume(){if(closed)return;active=true;if(map)map.resize();load();}
function close(){if(closed)return;pause();closed=true;removeFrames();if(map){map.remove();map=null;}loaded=false;metadata=null;rawForecast=null;frames=[];}
window.MonitorMap={pause,resume,close};
$('frame').addEventListener('input',()=>{halt();showFrame(Number($('frame').value));});
$('play').addEventListener('click',()=>{if(playing){halt();return;}if(!active||!frames.length)return;playing=true;$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','Pausar animação');showFrame(index>=frames.length-1?0:index);});
$('latest').addEventListener('click',()=>{halt();showFrame(frames.findIndex(f=>f.offset===0));});$('forecast-details').addEventListener('click',event=>{if(event.target.closest('summary'))detailsChosen=true;});$('refresh').addEventListener('click',()=>load(true));$('recenter').addEventListener('click',()=>{if(map)map.jumpTo({center:CENTER,zoom:7.2});});
document.addEventListener('visibilitychange',()=>document.hidden?pause():resume());window.addEventListener('pagehide',close);
try{
 map=new maplibregl.Map({container:'rain-map',center:CENTER,zoom:7.2,minZoom:3,maxZoom:9,maxBounds:[[-77,-36],[-29,7]],renderWorldCopies:false,pixelRatio:Math.min(window.devicePixelRatio||1,1.25),maxTileCacheSize:48,fadeDuration:0,attributionControl:false,style:{version:8,sources:{base:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:18,attribution:'Mapa © Esri, HERE, Garmin e colaboradores'}},layers:[{id:'base',type:'raster',source:'base',paint:{'raster-brightness-max':.88,'raster-saturation':-.2}}]}});
 map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
 const marker=document.createElement('div');marker.className='liberdade-point';marker.setAttribute('aria-label','Ponto da Liberdade, São Paulo');const pointName=document.createElement('span');pointName.textContent='Liberdade';marker.appendChild(pointName);new maplibregl.Marker({element:marker}).setLngLat(CENTER).addTo(map);
 map.on('load',()=>{loaded=true;if(active)load();});map.on('sourcedata',e=>{if(e.sourceId===currentSource)settled();});map.on('idle',settled);
 map.on('error',e=>{if(e.sourceId===currentSource)frameFailed();else if(e.sourceId==='base'){baseFailed=true;message('Imagem de fundo indisponível. A previsão da Liberdade pode continuar disponível.');}});
 map.on('movestart',e=>{if(e.originalEvent)halt();});
}catch{message('Não foi possível iniciar o mapa. Volte e abra a prévia novamente.');clearGraph('Previsão da Liberdade indisponível');}
})();
