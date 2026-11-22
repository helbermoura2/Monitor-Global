/* Observed GLM cells and active municipal notices, with independent times and coverage. */
(function(root){'use strict';
const BASE='https://raw.githubusercontent.com/helbermoura2/Monitor-Global/main/data/';
const MINUTE=60000, EMPTY={type:'FeatureCollection',features:[]};
const sources={lightning:'br-severe-lightning',notices:'br-severe-notices',cells:'br-storm-cells'};
const fresh=(time,now,minutes)=>Number.isSafeInteger(time)&&time>0&&time<=now+MINUTE&&now-time<=minutes*MINUTE;
const coordinate=(lon,lat)=>Number.isFinite(lon)&&Number.isFinite(lat)&&lon>=-90&&lon<=-30&&lat>=-60&&lat<=18;
const clock=time=>new Date(time).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' BRT';
function point(lon,lat,properties){return {type:'Feature',geometry:{type:'Point',coordinates:[lon,lat]},properties};}

function lightning(data,now=Date.now(),hour=false){
 if(hour){if(!data?.hour)return null;data={version:data.version,source:data.source,resolution:data.resolution,...data.hour};}
 if(data?.version!==1||data.source!=='NOAA GOES-19 GLM'||data.resolution!==.25||
    !fresh(data.end,now,35)||!Number.isSafeInteger(data.start)||data.end-data.start<(hour?50:11)*MINUTE||data.end-data.start>(hour?61:16)*MINUTE||
    data.expected!==(hour?180:45)||!Number.isInteger(data.files)||data.files<(hour?153:38)||data.files>data.expected||
    !Array.isArray(data.cells)||data.cells.length>30000)return null;
 const features=[],seen=new Set();
 for(const cell of data.cells){
  if(!Array.isArray(cell)||cell.length!==3)return null;
  const [lon,lat,count]=cell;
  const key=lon+','+lat;
  if(!coordinate(lon,lat)||!Number.isInteger(count)||count<=0||count>100000||seen.has(key))return null;
  seen.add(key);features.push(point(lon,lat,{count}));
 }
 return {start:data.start,end:data.end,partial:data.files<data.expected,collection:{type:'FeatureCollection',features}};
}
function notices(data,now=Date.now()){
 if(data?.version!==1||data.source!=='https://painelalertas.cemaden.gov.br/wsAlertas2'||
    !fresh(data.checkedAt,now,90)||!Array.isArray(data.alerts)||data.alerts.length>2000)return null;
 const features=[];
 for(const a of data.alerts){
  if(a?.status!==1||!coordinate(a.lng,a.lat)||typeof a.city!=='string'||typeof a.event!=='string')continue;
  const level=String(a.level||'').slice(0,30);
  features.push(point(a.lng,a.lat,{city:a.city.slice(0,100)+' · '+String(a.uf||'').slice(0,2),
   event:a.event.slice(0,180),level,severity:/extremo|muito alto/i.test(level)?3:/alto/i.test(level)?2:1}));
 }
 return {checkedAt:data.checkedAt,collection:{type:'FeatureCollection',features}};
}

function create(map,host,getRadar,getModel,present){
 const byId=id=>host.querySelector('#'+id);
 const mapReadout=document.getElementById('severe-map-readout');
 const lightningStatus=byId('severe-lightning-status'),noticeStatus=byId('severe-notice-status');
 const lightningButton=byId('severe-lightning'),noticeButton=byId('severe-notices'),cellButton=byId('severe-cells');
 const cellStatus=byId('severe-cell-status');
 const storms=root.PhoneStormSignals;
 let recent=null,cellData=EMPTY,cellTime=0,cellWindow=null,scanKey='',scanning=null,showCells=true;
 let enabled=false,active=true,request=null,interval=0;
 let lightningData=null,noticeData=null,lastFetched=0,showLightning=true,showNotices=true;

 map.addSource(sources.lightning,{type:'geojson',data:EMPTY,cluster:true,clusterRadius:24,clusterMaxZoom:5,
  clusterProperties:{flashCount:['+',['get','count']]},attribution:'Raios: NOAA GOES-19 GLM'});
 map.addSource(sources.cells,{type:'geojson',data:EMPTY});
 map.addSource(sources.notices,{type:'geojson',data:EMPTY,attribution:'Alertas municipais: Cemaden'});
 map.addLayer({id:sources.lightning,source:sources.lightning,type:'circle',paint:{
  'circle-radius':['interpolate',['linear'],['coalesce',['get','flashCount'],['get','count']],1,2.5,60,4,500,6.5,3000,10],
  'circle-color':'#ff80d9','circle-opacity':.60,'circle-stroke-color':'#ffc7eb','circle-stroke-width':.55
 }});
 map.addLayer({id:sources.notices,source:sources.notices,type:'circle',paint:{
  'circle-radius':8,'circle-color':['match',['get','severity'],3,'#f3646f',2,'#fc9a58','#ffd181'],
  'circle-opacity':.75,'circle-stroke-color':'#fff2cc','circle-stroke-width':1.3
 }});
 map.addLayer({id:sources.cells,source:sources.cells,type:'circle',paint:{
  'circle-radius':['interpolate',['linear'],['zoom'],2,9,7,15],'circle-color':'#f58837','circle-opacity':.13,
  'circle-stroke-color':'#ff9e52','circle-stroke-width':2.6
 }});
 function analyze(){
  if(!enabled||!active||!showCells||!storms)return;
  const radar=getRadar(),latest=radar?.latest,at=latest?.time*1000;
  if(!radar?.enabled||!recent||!fresh(recent.end,Date.now(),35)||!fresh(at,Date.now(),35)||
     at<recent.start-5*MINUTE||at>recent.end+10*MINUTE){
   scanning?.abort();scanning=null;scanKey='';cellData=EMPTY;cellTime=0;cellWindow=null;
   map.getSource(sources.cells)?.setData(EMPTY);
   cellStatus.textContent='Aguardando radar recente e uma janela de raios compatível.';
   return;
  }
  const key=latest.path+'/'+recent.end;
  if(key===scanKey)return;
  scanning?.abort();
  const request=new AbortController(),window=recent;
  scanning=request;scanKey=key;cellData=EMPTY;cellTime=0;cellWindow=null;
  map.getSource(sources.cells)?.setData(EMPTY);
  const timeout=setTimeout(()=>request.abort(),10000);
  cellStatus.textContent='Comparando os ecos do radar com as descargas recentes…';
  storms.scan(window.collection,root.PhoneBrazilRadar.tileUrl(latest),request.signal).then(result=>{
   if(scanning!==request||!enabled||!active)return;
   cellData=result;cellTime=at;cellWindow=window;
   map.getSource(sources.cells)?.setData(showCells?cellData:EMPTY);
   cellStatus.textContent=result.features.length?result.features.length+(result.features.length===1?' área':' áreas')+' com eco intenso e raios · radar '+clock(at):
    'Nenhuma coincidência nos pontos analisados · cobertura variável.';
  }).catch(()=>{if(scanning===request)cellStatus.textContent='Análise de células indisponível.';})
   .finally(()=>{clearTimeout(timeout);if(scanning===request)scanning=null;});
 }
 function raise(){
  const order=map.getStyle()?.layers?.map(layer=>layer.id)||[];
  const satellite=order.indexOf('br-satellite-layer'),radar=order.indexOf('br-historical-radar-layer');
  if(satellite>=0&&radar>=0&&satellite>radar)map.moveLayer('br-historical-radar-layer');
  else if(order.at(-3)===sources.lightning&&order.at(-2)===sources.notices&&order.at(-1)===sources.cells)return;
  for(const name of Object.values(sources))if(map.getLayer(name))map.moveLayer(name);
 }
 function updateCount(){
  if(!enabled||!active)return;
  const area=map.getBounds(),readout=[];
  if(lightningData&&fresh(lightningData.end,Date.now(),35)){
   const count=lightningData.collection.features.reduce((sum,f)=>area.contains(f.geometry.coordinates)?sum+f.properties.count:sum,0);
   if(showLightning)readout.push({name:lightningData.end-lightningData.start>50*MINUTE?'Raios · 1 h':'Raios',value:count.toLocaleString('pt-BR')});
   lightningStatus.textContent=showLightning?
    count.toLocaleString('pt-BR')+' detecções nas células cobertas do recorte · NOAA GOES-19 · '+clock(lightningData.start)+' – '+clock(lightningData.end)+(lightningData.partial?' · janela parcial':''):
    'Camada de raios oculta.';
  }else{lightningStatus.textContent='Raios sem dados recentes do GOES-19 para esta visualização.';if(showLightning)readout.push({name:'Raios',value:'Sem dados recentes'});}
  if(noticeData&&fresh(noticeData.checkedAt,Date.now(),90)){
   const count=noticeData.collection.features.filter(f=>area.contains(f.geometry.coordinates)).length;
   if(showNotices)readout.push({name:'Alertas Cemaden',value:String(count)});
   noticeStatus.textContent=showNotices?count+' '+(count===1?'alerta municipal':'alertas municipais')+' no recorte · Cemaden · '+clock(noticeData.checkedAt):
    'Camada de alertas oculta.';
  }else{noticeStatus.textContent='Alertas municipais indisponíveis nesta consulta.';if(showNotices)readout.push({name:'Alertas Cemaden',value:'Indisponível'});}
  mapReadout.replaceChildren(...readout.map(item=>{
   const cell=document.createElement('div'),label=document.createElement('span'),value=document.createElement('strong');
   label.textContent=item.name;value.textContent=item.value;cell.append(label,value);return cell;
  }));mapReadout.hidden=!readout.length;
 }
 function draw(){
  const now=Date.now();
  map.getSource(sources.lightning)?.setData(enabled&&active&&showLightning&&lightningData&&fresh(lightningData.end,now,35)?lightningData.collection:EMPTY);
  map.getSource(sources.notices)?.setData(enabled&&active&&showNotices&&noticeData&&fresh(noticeData.checkedAt,now,90)?noticeData.collection:EMPTY);
  map.getSource(sources.cells)?.setData(enabled&&active&&showCells?cellData:EMPTY);
  updateCount();analyze();
 }
 async function read(path,signal,limit){
  const response=await fetch(BASE+path,{signal,credentials:'omit',redirect:'error'});
  if(!response.ok||Number(response.headers.get('content-length'))>limit)throw Error('Fonte indisponível');
  const raw=await response.text();
  if(raw.length>limit)throw Error('Resposta acima do limite');
  return JSON.parse(raw);
 }
 async function refresh(force=false){
  if(!enabled||!active||request||(!force&&Date.now()-lastFetched<2*MINUTE))return;
  const controller=new AbortController();request=controller;lastFetched=Date.now();
  const timer=setTimeout(()=>controller.abort(),10000);
  const [glm,cemaden]=await Promise.allSettled([read('goes-19-lightning.json',controller.signal,900000),read('cemaden-alerts.json',controller.signal,1000000)]);
  clearTimeout(timer);
  if(request!==controller)return;
  request=null;
  if(glm.status==='fulfilled'){recent=lightning(glm.value);lightningData=lightning(glm.value,Date.now(),true)||recent;}
  if(cemaden.status==='fulfilled')noticeData=notices(cemaden.value);
  draw();
 }
 function click(e){
  if(!enabled||!active)return;
  const results=map.queryRenderedFeatures(e.point,{layers:Object.values(sources)});
  const feature=results.find(f=>f.layer.id===sources.cells)||results.find(f=>f.layer.id===sources.notices)||results[0];
  if(!feature)return;
  if(feature.layer.id===sources.lightning&&Number.isInteger(feature.properties.cluster_id)){
   map.getSource(sources.lightning).getClusterExpansionZoom(feature.properties.cluster_id)
    .then(zoom=>{if(enabled&&active)map.easeTo({center:feature.geometry.coordinates,zoom,duration:250});}).catch(()=>{});
   return;
  }
  const content=document.createElement('div'),title=document.createElement('strong'),description=document.createElement('p');
  if(feature.layer.id===sources.cells&&cellWindow){
   title.textContent='Célula em atenção · experimental';
   description.textContent='O radar e o GOES-19 indicam eco intenso e atividade elétrica na mesma área. Esta leitura não classifica rotação.';
   const more=(label,value)=>{const p=document.createElement('p');p.textContent=label+' · '+value;content.append(p);};
   content.append(title,description);
   more('Quadro usado na análise · RainViewer',feature.properties.echo+' dBZ na vizinhança · '+clock(cellTime));
   more('Raios NOAA GOES-19',feature.properties.count+' detecções na célula · '+clock(cellWindow.start)+' a '+clock(cellWindow.end));
   const coordinates=feature.geometry.coordinates,model=getModel();
   if(model&&storms.distance(coordinates,model.coords)<=30)more('Previsão Open-Meteo',model.place+' · '+model.rain.toLocaleString('pt-BR',{maximumFractionDigits:1})+' mm nas próximas 3 h completas');
   else more('Previsão', 'selecione um município próximo para consultar o modelo local');
   const alerts=noticeData&&fresh(noticeData.checkedAt,Date.now(),90)?noticeData.collection.features
    .filter(item=>storms.distance(coordinates,item.geometry.coordinates)<=50):[];
   if(alerts.length)more('Cemaden próximo',alerts.slice(0,2).map(item=>item.properties.city+' — '+item.properties.event).join(' / ')+' · '+clock(noticeData.checkedAt));
   else more('Cemaden','sem alerta próximo no recorte consultado ou dados indisponíveis');
  }else if(feature.layer.id===sources.notices){
   title.textContent=feature.properties.city;
   description.textContent=feature.properties.event+' · Cemaden. O ponto identifica o município.';
  }else{
   title.textContent=Number(feature.properties.count).toLocaleString('pt-BR')+' detecções GLM';
   description.textContent='Célula aproximada de 0,25°. Descargas detectadas pelo GOES-19 dentro da janela indicada.';
  }
  content.className='weather-selection-data';if(!title.parentNode)content.append(title,description);
  present(content);
 }
 function wake(){
  clearInterval(interval);interval=0;
  if(enabled&&active){draw();refresh();interval=setInterval(()=>{draw();refresh();},2*MINUTE);}
  else{scanning?.abort();scanning=null;scanKey='';cellData=EMPTY;cellTime=0;cellWindow=null;mapReadout.hidden=true;const old=request;request=null;if(old){lastFetched=0;old.abort();}draw();}
 }
 map.on('moveend',updateCount);map.on('click',click);
 lightningButton.addEventListener('click',()=>{showLightning=!showLightning;lightningButton.setAttribute('aria-pressed',String(showLightning));draw();});
 noticeButton.addEventListener('click',()=>{showNotices=!showNotices;noticeButton.setAttribute('aria-pressed',String(showNotices));draw();});
 cellButton.addEventListener('click',()=>{showCells=!showCells;cellButton.setAttribute('aria-pressed',String(showCells));draw();});
 byId('severe-refresh').addEventListener('click',()=>refresh(Date.now()-lastFetched>=15000));
 return {raise,analyze,hasMarkerAt(point){return enabled&&active&&map.queryRenderedFeatures(point,{layers:Object.values(sources)}).length>0;},toggle(next){enabled=!!next;host.hidden=!enabled;wake();},
  setActive(next){active=!!next;wake();},
  destroy(){enabled=false;active=false;wake();map.off('moveend',updateCount);map.off('click',click);}};
}
const api={create,lightning,notices};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PhoneSevereWeather=api;
})(typeof window==='undefined'?globalThis:window);
