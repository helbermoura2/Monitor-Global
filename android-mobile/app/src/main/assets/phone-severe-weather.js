/* Observed GLM cells and active municipal notices, with independent times and coverage. */
(function(root){'use strict';
const BASE='https://raw.githubusercontent.com/helbermoura2/Monitor-Global/main/data/';
const MINUTE=60000, EMPTY={type:'FeatureCollection',features:[]};
const sources={lightning:'br-severe-lightning',notices:'br-severe-notices'};
const fresh=(time,now,minutes)=>Number.isSafeInteger(time)&&time>0&&time<=now+MINUTE&&now-time<=minutes*MINUTE;
const coordinate=(lon,lat)=>Number.isFinite(lon)&&Number.isFinite(lat)&&lon>=-90&&lon<=-30&&lat>=-60&&lat<=18;
const clock=time=>new Date(time).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' BRT';
function point(lon,lat,properties){return {type:'Feature',geometry:{type:'Point',coordinates:[lon,lat]},properties};}

function lightning(data,now=Date.now()){
 if(data?.version!==1||data.source!=='NOAA GOES-19 GLM'||data.resolution!==.25||
    !fresh(data.end,now,35)||!Number.isSafeInteger(data.start)||data.end-data.start<11*MINUTE||data.end-data.start>16*MINUTE||
    data.expected!==45||!Number.isInteger(data.files)||data.files<38||data.files>45||
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

function create(map,host){
 const byId=id=>host.querySelector('#'+id);
 const mapReadout=document.getElementById('severe-map-readout');
 const lightningStatus=byId('severe-lightning-status'),noticeStatus=byId('severe-notice-status');
 const lightningButton=byId('severe-lightning'),noticeButton=byId('severe-notices');
 let enabled=false,active=true,request=null,interval=0,popup=null;
 let lightningData=null,noticeData=null,lastFetched=0,showLightning=true,showNotices=true;

 map.addSource(sources.lightning,{type:'geojson',data:EMPTY,attribution:'Raios: NOAA GOES-19 GLM'});
 map.addSource(sources.notices,{type:'geojson',data:EMPTY,attribution:'Alertas municipais: Cemaden'});
 map.addLayer({id:sources.lightning,source:sources.lightning,type:'circle',paint:{
  'circle-radius':['interpolate',['linear'],['get','count'],1,3,60,7,500,12], 'circle-color':'#ff7bda',
  'circle-opacity':.72,'circle-stroke-color':'#ffd6f1','circle-stroke-width':.55
 }});
 map.addLayer({id:sources.notices,source:sources.notices,type:'circle',paint:{
  'circle-radius':8,'circle-color':['match',['get','severity'],3,'#f3646f',2,'#fc9a58','#ffd181'],
  'circle-opacity':.75,'circle-stroke-color':'#fff2cc','circle-stroke-width':1.3
 }});
 function raise(){
  const order=map.getStyle()?.layers?.map(layer=>layer.id)||[];
  const satellite=order.indexOf('br-satellite-layer'),radar=order.indexOf('br-historical-radar-layer');
  if(satellite>=0&&radar>=0&&satellite>radar)map.moveLayer('br-historical-radar-layer');
  else if(order.at(-2)===sources.lightning&&order.at(-1)===sources.notices)return;
  for(const name of Object.values(sources))if(map.getLayer(name))map.moveLayer(name);
 }
 function updateCount(){
  if(!enabled||!active)return;
  const area=map.getBounds(),readout=[];
  if(lightningData&&fresh(lightningData.end,Date.now(),35)){
   const count=lightningData.collection.features.reduce((sum,f)=>area.contains(f.geometry.coordinates)?sum+f.properties.count:sum,0);
   if(showLightning)readout.push('Raios: '+count.toLocaleString('pt-BR'));
   lightningStatus.textContent=showLightning?
    count.toLocaleString('pt-BR')+' detecções nas células cobertas do recorte · NOAA GOES-19 · '+clock(lightningData.start)+' – '+clock(lightningData.end)+(lightningData.partial?' · janela parcial':''):
    'Camada de raios oculta.';
  }else{lightningStatus.textContent='Raios sem dados recentes do GOES-19 para esta visualização.';if(showLightning)readout.push('Raios: sem dados recentes');}
  if(noticeData&&fresh(noticeData.checkedAt,Date.now(),90)){
   const count=noticeData.collection.features.filter(f=>area.contains(f.geometry.coordinates)).length;
   if(showNotices)readout.push('Cemaden: '+count);
   noticeStatus.textContent=showNotices?count+' '+(count===1?'alerta municipal':'alertas municipais')+' no recorte · Cemaden · '+clock(noticeData.checkedAt):
    'Camada de alertas oculta.';
  }else{noticeStatus.textContent='Alertas municipais indisponíveis nesta consulta.';if(showNotices)readout.push('Cemaden: indisponível');}
  mapReadout.textContent=readout.join(' · ');mapReadout.hidden=!readout.length;
 }
 function draw(){
  const now=Date.now();
  map.getSource(sources.lightning)?.setData(enabled&&active&&showLightning&&lightningData&&fresh(lightningData.end,now,35)?lightningData.collection:EMPTY);
  map.getSource(sources.notices)?.setData(enabled&&active&&showNotices&&noticeData&&fresh(noticeData.checkedAt,now,90)?noticeData.collection:EMPTY);
  updateCount();
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
  if(glm.status==='fulfilled')lightningData=lightning(glm.value);
  if(cemaden.status==='fulfilled')noticeData=notices(cemaden.value);
  draw();
 }
 function click(e){
  if(!enabled||!active)return;
  const results=map.queryRenderedFeatures(e.point,{layers:Object.values(sources)});
  const feature=results.find(f=>f.layer.id===sources.notices)||results[0];
  if(!feature)return;
  const content=document.createElement('div'),title=document.createElement('strong'),description=document.createElement('p');
  if(feature.layer.id===sources.notices){
   title.textContent=feature.properties.city;
   description.textContent=feature.properties.event+' · Cemaden. O ponto identifica o município.';
  }else{
   title.textContent=Number(feature.properties.count).toLocaleString('pt-BR')+' detecções GLM';
   description.textContent='Célula aproximada de 0,25°. Descargas detectadas pelo GOES-19 dentro da janela indicada.';
  }
  content.className='severe-popup';content.append(title,description);
  popup?.remove();popup=new maplibregl.Popup({closeButton:true,maxWidth:'235px'}).setLngLat(feature.geometry.coordinates).setDOMContent(content).addTo(map);
 }
 function wake(){
  clearInterval(interval);interval=0;
  if(enabled&&active){draw();refresh();interval=setInterval(()=>{draw();refresh();},2*MINUTE);}
  else{mapReadout.hidden=true;const old=request;request=null;if(old){lastFetched=0;old.abort();}popup?.remove();draw();}
 }
 map.on('moveend',updateCount);map.on('click',click);
 lightningButton.addEventListener('click',()=>{showLightning=!showLightning;lightningButton.setAttribute('aria-pressed',String(showLightning));draw();});
 noticeButton.addEventListener('click',()=>{showNotices=!showNotices;noticeButton.setAttribute('aria-pressed',String(showNotices));draw();});
 byId('severe-refresh').addEventListener('click',()=>refresh(Date.now()-lastFetched>=15000));
 return {raise,toggle(next){enabled=!!next;host.hidden=!enabled;wake();},
  setActive(next){active=!!next;wake();},
  destroy(){enabled=false;active=false;wake();map.off('moveend',updateCount);map.off('click',click);}};
}
const api={create,lightning,notices};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PhoneSevereWeather=api;
})(typeof window==='undefined'?globalThis:window);
