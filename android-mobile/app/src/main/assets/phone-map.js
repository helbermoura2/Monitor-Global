/* Argos Orbis mobile map: lightweight clusters, verified administrative contours
 * and transparent distinction between observed imagery and forecast metadata. */
(function(){'use strict';
const $=id=>document.getElementById(id);
const notice=$('notice'),retry=$('retry'),empty=$('empty'),reference=$('reference');
let map=null,satellite=null,boundaries=null,loaded=false,active=true,events=[],focus=null,markers=[],fitted=false,tileErrors=0,needsReload=false;
let filter={region:'world',hours:0,minMagnitude:0},opacity=70;
const ACTIVE_TSUNAMI_STATES=new Set(['warning','watch','advisory']);
// Preserve quiet/ended bulletins in the native history, but do not pin them as an active threat.
const onAlertMap=e=>e.kind!=='tsunami'||ACTIVE_TSUNAMI_STATES.has(String(e.state||''));
const valid=e=>e&&Number.isFinite(e.longitude)&&Number.isFinite(e.latitude)&&Math.abs(e.longitude)<=180&&Math.abs(e.latitude)<=85.05112878;
const haversine=(a,b,c,d)=>{
 const rad=Math.PI/180,dy=(c-a)*rad,dx=(d-b)*rad;
 return 12742*Math.asin(Math.sqrt(Math.min(1,Math.sin(dy/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin(dx/2)**2)));
};
function info(message,canRetry){empty.hidden=true;notice.textContent=message;notice.hidden=false;retry.hidden=!canRetry;}
function removeMarkers(){for(const marker of markers)marker.remove();markers=[];}
function details(id){if(window.MonitorMapBridge&&typeof window.MonitorMapBridge.selectEvent==='function')window.MonitorMapBridge.selectEvent(id);}
function date(epoch){return Number.isFinite(epoch)&&epoch>0?new Date(epoch).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'} )+' BRT':'Horário não informado';}
function button(label,onClick){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',onClick);return b;}
function popup(event){
 const content=document.createElement('section');content.className='argos-area-popup';
 const title=document.createElement('strong');title.textContent=event.title||'Evento monitorado';content.appendChild(title);
 const specs=document.createElement('div');
 const detailsList=[];
 if(Number.isFinite(event.magnitude))detailsList.push('Magnitude '+event.magnitude.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1}));
 if(Number.isFinite(event.depth))detailsList.push('Prof. '+Math.round(event.depth)+' km');
 if(event.kind==='tsunami')detailsList.push('Boletim de tsunami');
 specs.textContent=detailsList.join(' · ')||'Registro monitorado';content.appendChild(specs);
 const when=document.createElement('small');when.textContent=date(event.eventTime);content.appendChild(when);
 if(event.source){const source=document.createElement('small');source.textContent='Fonte: '+event.source;content.appendChild(source);}
 content.appendChild(button('Ver detalhes',()=>details(event.id)));
 const pop=new maplibregl.Popup({offset:14,maxWidth:'270px',focusAfterOpen:false}).setDOMContent(content);
 pop.on('open',()=>{
  document.body.classList.add('argos-popup-active');
  for(const marker of markers){
   if(marker.getPopup()!==pop)continue;
   const icon=marker.getElement();
   icon.classList.remove('epicenter-pulse');
   requestAnimationFrame(()=>{if(pop.isOpen())icon.classList.add('epicenter-pulse');});
  }
 });
 pop.on('close',()=>document.body.classList.remove('argos-popup-active'));
 return pop;
}
function filtered(){
 const now=Date.now();
 return events.filter(e=>{
  if(!onAlertMap(e))return false;
  if(filter.region==='brasil'&&e.countryCode!=='BR'&&!(e.longitude>=-74&&e.longitude<=-32&&e.latitude>=-34&&e.latitude<=6))return false;
  if(filter.hours>0&&(!Number.isFinite(e.eventTime)||e.eventTime<now-filter.hours*3600000||e.eventTime>now+3600000))return false;
  if(filter.minMagnitude>0&&(!Number.isFinite(e.magnitude)||e.magnitude<filter.minMagnitude))return false;
  return true;
 });
}
function countMessage(list){
 reference.textContent=list.length+' eventos exibidos no mapa';
 empty.textContent=events.length&&events.every(e=>e.kind==='tsunami')?'Nenhum aviso ativo de tsunami nesta consulta. Boletins informativos e encerrados permanecem no histórico.':'Sem eventos para os filtros escolhidos nesta consulta. Isso não significa ausência de eventos.';
}
function showEvents(){
 if(!loaded||!active||!map)return;
 const list=filtered();countMessage(list);
 empty.hidden=list.length>0||!notice.hidden;
 if(!fitted&&list.length&&!focus){
  fitted=true;
  if(list.length===1)map.jumpTo({center:[list[0].longitude,list[0].latitude],zoom:5});
  else map.jumpTo({center:[-53,-14],zoom:3.1}); // Brazil overview first; distant events remain browsable.
 }
 // Fit can fire a synchronous moveend and reenter showEvents. Clearing after
 // fitting guarantees only one set of markers survives the nested rendering.
 removeMarkers();
 // Cluster in projected screen space, without a glyph server or per-frame workload.
 const cells=new Map(),zoom=map.getZoom();
 for(const event of list){
  const pt=map.project([event.longitude,event.latitude]),key=zoom<9?Math.floor(pt.x/51)+':'+Math.floor(pt.y/51):event.id;
  if(!cells.has(key))cells.set(key,[]);
  cells.get(key).push(event);
 }
 for(const group of cells.values()){
  const item=group[0],many=group.length>1;
  const el=document.createElement('button');el.type='button';
  el.className='marker'+(many?' cluster':item.kind==='tsunami'?' tsunami':'');
  el.setAttribute('aria-label',many?group.length+' eventos próximos · ampliar mapa':item.title||'Evento monitorado');
  if(many){
   el.textContent=String(group.length);
   el.addEventListener('click',()=>{const lon=group.reduce((n,e)=>n+e.longitude,0)/group.length;
    const lat=group.reduce((n,e)=>n+e.latitude,0)/group.length;
    map.easeTo({center:[lon,lat],zoom:Math.min(14,map.getZoom()+2.2),duration:250});});
  }else if(Number.isFinite(item.magnitude)){
   el.textContent='M'+item.magnitude.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});el.dataset.level=item.magnitude>=6?'high':item.magnitude>=5?'medium':'low';
  }
  const lon=group.reduce((n,e)=>n+e.longitude,0)/group.length,lat=group.reduce((n,e)=>n+e.latitude,0)/group.length;
  const marker=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([lon,lat]);
  if(!many)marker.setPopup(popup(item));
  marker.addTo(map);markers.push(marker);
 }
}
function showFocus(){
 if(!active||!focus||!map)return;
 if(!valid(focus)){focus=null;info('Evento fora da área desta projeção; consulte os detalhes.',false);return;}
 if(!loaded)return;const target=focus;focus=null;fitted=true;
 if(tileErrors===0&&!needsReload){notice.hidden=true;retry.hidden=true;}
 filter={region:'world',hours:0,minMagnitude:0};
 updateControls();map.jumpTo({center:[target.longitude,target.latitude],zoom:7});showEvents();
}
function nearby({lng,lat}){
 const closest=events.filter(valid).map(e=>({event:e,d:haversine(lat,lng,e.latitude,e.longitude)})).sort((a,b)=>a.d-b.d);
 const near=closest.filter(x=>x.d<=100);
 if(!near.length)return 'Nenhum evento localizado em até 100 km nesta consulta.';
 return near.length+' evento(s) a até 100 km · mais próximo a '+Math.round(near[0].d)+' km.';
}
function createFilters(){
 const host=document.createElement('details');host.id='argos-map-filters';host.className='argos-map-filters';
 const summary=document.createElement('summary');summary.textContent='Filtros · eventos';host.appendChild(summary);
 const region=document.createElement('select');region.setAttribute('aria-label','Filtrar região');
 for(const [id,title] of [['world','Mundo'],['brasil','Brasil e águas próximas']])region.appendChild(new Option(title,id));
 const hours=document.createElement('select');hours.setAttribute('aria-label','Período disponível na fonte');
 for(const [id,title] of [[0,'Todo o catálogo recebido'],[1,'Última 1 hora'],[24,'Últimas 24 horas'],[168,'Últimos 7 dias*']])hours.appendChild(new Option(title,String(id)));
 const label=document.createElement('label');label.textContent='Magnitude mínima';
 const mag=document.createElement('input');mag.type='range';mag.min='0';mag.max='8';mag.step='0.5';mag.value='0';mag.id='map-mag';
 const value=document.createElement('output');value.htmlFor='map-mag';value.textContent='Todas';
 const row=document.createElement('div');row.className='filter-mag';row.append(label,value);host.append(region,hours,row,mag);
 const caveat=document.createElement('small');caveat.textContent='* Até 7 dias, se houver registros no catálogo recebido. Não é cobertura garantida.';host.appendChild(caveat);
 host.appendChild(button('Enquadrar eventos',()=>{const list=filtered();if(!list.length||!map)return;const bounds=new maplibregl.LngLatBounds();list.forEach(e=>bounds.extend([e.longitude,e.latitude]));if(list.length===1)map.easeTo({center:[list[0].longitude,list[0].latitude],zoom:5});else map.fitBounds(bounds,{padding:42,maxZoom:5,duration:250});host.open=false;}));
 region.addEventListener('change',()=>{filter.region=region.value;fitted=true;showEvents();});
 hours.addEventListener('change',()=>{filter.hours=Number(hours.value);fitted=true;showEvents();});
 mag.addEventListener('input',()=>{filter.minMagnitude=Number(mag.value);value.textContent=filter.minMagnitude?'M'+filter.minMagnitude.toFixed(1)+'+':'Todas';fitted=true;showEvents();});
 host.addEventListener('pointerdown',e=>e.stopPropagation());document.body.appendChild(host);
 return {host,region,hours,mag,value};
}
let controls=null;
function updateControls(){
 if(!controls)return;
 controls.region.value=filter.region;controls.hours.value=String(filter.hours);
 controls.mag.value=String(filter.minMagnitude);controls.value.textContent=filter.minMagnitude?'M'+filter.minMagnitude.toFixed(1)+'+':'Todas';
}
function setOpacity(value){
 opacity=Math.max(25,Math.min(100,Number(value)||70));
 if(map?.getLayer('br-satellite-layer'))try{map.setPaintProperty('br-satellite-layer','raster-opacity',opacity/100);}catch{}
}
function createOpacity(){
 const panel=document.createElement('label');panel.className='argos-map-opacity';
 panel.textContent='Transparência do satélite · ';
 const number=document.createElement('output');number.textContent=opacity+'%';panel.appendChild(number);
 const slider=document.createElement('input');slider.id='layer-opacity';slider.type='range';slider.min='25';slider.max='100';slider.step='5';slider.value=String(opacity);
 slider.setAttribute('aria-label','Opacidade da imagem do satélite');
 slider.addEventListener('input',()=>{number.textContent=slider.value+'%';setOpacity(slider.value);});
 panel.appendChild(slider);$('map-legend').appendChild(panel);
}
function initialize(){
 satellite?.destroy();satellite=null;boundaries?.destroy();boundaries=null;
 removeMarkers();if(map){map.remove();map=null;}loaded=false;tileErrors=0;fitted=false;info('Carregando mapa…',false);
 try{
  if(!window.maplibregl||typeof maplibregl.Map!=='function'){info('Não foi possível carregar os recursos do mapa. Toque para tentar novamente.',true);return;}
  map=new maplibregl.Map({container:'map',center:[-53,-14],zoom:3.1,minZoom:1.3,maxZoom:14,renderWorldCopies:false,pixelRatio:Math.min(window.devicePixelRatio||1,1.25),maxTileCacheSize:96,fadeDuration:0,attributionControl:false,style:{version:8,sources:{imagery:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19,attribution:'Imagens © Esri, Maxar, Earthstar Geographics e GIS User Community'}},layers:[{id:'imagery',type:'raster',source:'imagery',paint:{'raster-fade-duration':0}}]}});
  map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
  map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
  map.on('load',()=>{
   loaded=true;if(tileErrors===0){notice.hidden=true;retry.hidden=true;}
   try{
    if(!window.BrazilSatellite||typeof window.BrazilSatellite.create!=='function')throw Error('Satélite indisponível');
    satellite=window.BrazilSatellite.create({map,host:document.body});satellite.setActive(active);needsReload=false;
   }catch{needsReload=true;info('Não foi possível iniciar o satélite. Toque em Recarregar mapa.',true);}
   try{boundaries=window.ArgosBoundaries.create({map,host:document.body,onPlace:nearby});boundaries?.setActive(active);}
   catch{info('Limites administrativos indisponíveis; eventos e imagens permanecem acessíveis.',false);}
   showEvents();showFocus();if(!active)map.stop();
  });
  map.on('moveend',()=>{if(active)showEvents();});
  map.on('click',()=>{if(controls?.host?.open)controls.host.open=false;const panel=document.querySelector('.admin-boundary-controls');if(panel?.open)panel.open=false;});
  map.on('error',event=>{
   if(event.sourceId==='br-satellite-source'||event.sourceId==='argos-uf'||event.sourceId==='argos-mun')return;
   if(event.sourceId==='imagery'){tileErrors++;info('Mapa-base sem conexão. Os eventos continuam disponíveis na lista.',true);}
  });
  map.on('webglcontextlost',()=>{loaded=false;info('O mapa foi pausado pelo aparelho. Toque para recarregar.',true);});
 }catch{info('Não foi possível abrir o mapa. Os eventos continuam acessíveis na lista.',true);}
}
if(typeof document.createElement==='function'){controls=createFilters();createOpacity();}
window.MonitorMap={
 setEvents(value){
  events=Array.isArray(value)?value.slice(0,120).filter(e=>valid(e)&&typeof e.id==='string'&&typeof e.title==='string'):[];
  showEvents();
 },
 focus(value){focus=valid(value)?value:null;showFocus();},
 pause(){active=false;satellite?.setActive(false);boundaries?.setActive(false);map?.stop();},
 resume(){active=true;satellite?.setActive(true);boundaries?.setActive(true);map?.resize();showEvents();},
 showSatellite(){if(!satellite&&map)return;setOpacity(opacity);},
 close(){active=false;satellite?.destroy();satellite=null;boundaries?.destroy();boundaries=null;removeMarkers();map?.remove();map=null;loaded=false;events=[];focus=null;}
};
retry.addEventListener('click',()=>{if(needsReload)window.location.reload();else initialize();});
window.addEventListener('pagehide',()=>window.MonitorMap.close());
initialize();
})();
