/* Argos Orbis administrative map overlay. Geodata from IBGE (simplified, not cadastral).
 * 27 UF polygons and SP municipalities packaged offline; other municipalities fetched
 * by UF only on high zoom. Never download the nationwide municipal mesh at once. */
(function(root){
'use strict';
const STATES='data/br-states.geojson';
const EMPTY={type:'FeatureCollection',features:[]};
const STATE_ID='argos-uf',STATE_FILL='argos-uf-hit',STATE_LINES='argos-uf-lines',STATE_NAMES='argos-uf-labels';
const CITY_ID='argos-mun',CITY_FILL='argos-mun-hit',CITY_LINES='argos-mun-lines',CITY_NAMES='argos-mun-labels';
const UFS=new Set('AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' '));
const PINNED='a4680c128c23c90fde346334fd5888a3b2997d29';
const MUNICIPAL_ZOOM=7.8,NAME_ZOOM=9.9;
const readSetting=()=>{try{return sessionStorage.getItem('argos-boundaries')||'states';}catch{return 'states';}};
const remember=value=>{try{sessionStorage.setItem('argos-boundaries',value);}catch{}};
const text=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;return node;};
const empty=()=>({type:'FeatureCollection',features:[]});
function isGeojson(value,max=700){
 return value&&value.type==='FeatureCollection'&&Array.isArray(value.features)&&value.features.length<=max&&
 value.features.every(f=>f&&f.type==='Feature'&&f.geometry&&['Polygon','MultiPolygon'].includes(f.geometry.type)&&f.properties&&typeof f.properties==='object');
}
async function fetchLimited(url,limit,signal){
 const response=await fetch(url,{credentials:'omit',redirect:'error',cache:'force-cache',signal});
 if(!response.ok||Number(response.headers.get('content-length')||0)>limit)throw Error('Malha indisponível');
 const raw=await response.text();
 if(raw.length>limit)throw Error('Malha excessivamente grande');
 return JSON.parse(raw);
}
function create({map,host=document.body,onPlace=null}={}){
 if(!map||!host)return null;
 let stateData=null,current='states',request=null,seq=0,alive=true,active=true,ufLoaded='',cachedMunicipal=null,mousePopup=null,ufMarkers=[];
 const panel=document.createElement('details');panel.className='admin-boundary-controls';
 panel.setAttribute('aria-label','Limites administrativos');panel.innerHTML='<summary>Limites · Estados</summary><label for="admin-boundary-mode">Limites do mapa</label><select id="admin-boundary-mode" aria-label="Exibir divisões administrativas"><option value="off">Desligados</option><option value="states">Estados</option><option value="cities">Municípios (zoom alto)</option></select><small id="admin-boundary-status">Dados simplificados do IBGE</small>';
 const select=panel.querySelector('select'),status=panel.querySelector('small');host.appendChild(panel);
 current=['off','states','cities'].includes(readSetting())?readSetting():'states';
 select.value=current;
 function warn(message){status.textContent=message||'Malhas territoriais simplificadas · IBGE';}
 function visible(id,on){if(map.getLayer(id))map.setLayoutProperty(id,'visibility',on?'visible':'none');}
 function layer(id,type,source,paint,layout={},minzoom){
  if(map.getLayer(id))return;
  const item={id,type,source,paint,layout};
  if(minzoom!==undefined)item.minzoom=minzoom;
  map.addLayer(item);
 }
 function top(){
  // Satellite/radar raster layers are frequently replaced; administrative
  // limits must stay visible above them without creating recursive style loops.
  const style=map.getStyle(),layers=style&&style.layers;
  if(!layers||!layers.length)return;
  const overlay=['br-satellite-layer','br-historical-radar-layer'];
  let max=-1;for(const id of overlay){const i=layers.findIndex(x=>x.id===id);if(i>max)max=i;}
  if(max<0)return;
  for(const id of [STATE_FILL,STATE_LINES,CITY_FILL,CITY_LINES]){
   const all=map.getStyle().layers||[],a=all.findIndex(x=>x.id===id),b=Math.max(...overlay.map(o=>all.findIndex(x=>x.id===o)));
   if(a>=0&&a<b){try{map.moveLayer(id);}catch{}} 
  }
 }
 function install(){
  if(!alive||!map.isStyleLoaded())return;
  if(!map.getSource(STATE_ID))map.addSource(STATE_ID,{type:'geojson',data:stateData||EMPTY});
  if(!map.getSource(CITY_ID))map.addSource(CITY_ID,{type:'geojson',data:cachedMunicipal||EMPTY});
  layer(STATE_FILL,'fill',STATE_ID,{'fill-color':'#38d6e8','fill-opacity':0.001});
  layer(STATE_LINES,'line',STATE_ID,{'line-color':'#91f3ff','line-opacity':0.88,'line-width':['interpolate',['linear'],['zoom'],2,0.85,7,1.8,12,2.2]});
  layer(CITY_FILL,'fill',CITY_ID,{'fill-color':'#eaf8ff','fill-opacity':0.001},{},MUNICIPAL_ZOOM);
  layer(CITY_LINES,'line',CITY_ID,{'line-color':'#ffe7a6','line-opacity':0.74,'line-width':0.9,'line-dasharray':[3,2]},{},MUNICIPAL_ZOOM);
  // The raster-only style has no external glyph endpoint. Use DOM UF labels
  // instead of symbol layers, preserving offline operation without a paid font CDN.
  update();
 }
 function underCenter(){
  if(!stateData)return null;
  try{
   const names=map.queryRenderedFeatures(map.project(map.getCenter()),{layers:[STATE_FILL]});
   const uf=names.find(f=>UFS.has(f.properties?.sigla))?.properties?.sigla;
   return uf||null;
  }catch{return null;}
 }
 async function fetchStates(){
  if(stateData)return;
  try{
   const data=await fetchLimited(STATES,240000,undefined);
   if(!alive||!isGeojson(data,28)||data.features.length!==27)throw Error('Malha estadual inválida');
   stateData=data;if(map.getSource(STATE_ID))map.getSource(STATE_ID).setData(data);
   for(const marker of ufMarkers)marker.remove();ufMarkers=[];
   for(const f of data.features){
    const rings=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
    let best=[],bestSize=0;
    for(const polygon of rings){const ring=polygon[0]||[];if(ring.length>bestSize){best=ring;bestSize=ring.length;}}
    if(!best.length)continue;
    const x=best.reduce((a,p)=>a+p[0],0)/best.length,y=best.reduce((a,p)=>a+p[1],0)/best.length;
    if(!Number.isFinite(x)||!Number.isFinite(y))continue;
    const node=text('span',f.properties.sigla);node.className='argos-uf-name';node.setAttribute('aria-hidden','true');
    ufMarkers.push(new maplibregl.Marker({element:node,anchor:'center'}).setLngLat([x,y]).addTo(map));
   }
   update();
  }catch{if(alive)warn('Estados indisponíveis nesta consulta');}
 }
 function clearMunicipal(){
  seq++;request?.abort();request=null;ufLoaded='';cachedMunicipal=null;
  if(map.getSource(CITY_ID))map.getSource(CITY_ID).setData(EMPTY);
 }
 async function loadMunicipal(uf){
  if(!UFS.has(uf)||ufLoaded===uf)return;
  seq++;request?.abort();request=new AbortController();
  const ticket=seq,signal=request.signal;
  ufLoaded=uf;warn('Carregando municípios de '+uf+'…');
  if(map.getSource(CITY_ID))map.getSource(CITY_ID).setData(EMPTY);
  try{
   const url=uf==='SP'?'data/br-municipalities-sp.geojson':
   'https://cdn.jsdelivr.net/gh/henriquemalvar/br-geojson@'+PINNED+'/dist/municipios/'+uf+'.geojson';
   const data=await fetchLimited(url,900000,signal);
   if(ticket!==seq||!alive||!active)return;
   if(!isGeojson(data,900)||!data.features.length||data.features.some(f=>f.properties.uf!==uf))throw Error('Geometria municipal inválida');
   cachedMunicipal=data;
   if(map.getSource(CITY_ID))map.getSource(CITY_ID).setData(data);
   warn('Municípios · '+uf+' · IBGE (malha simplificada)');
   top();
  }catch(error){if(ticket===seq&&alive&&!signal.aborted){cachedMunicipal=null;ufLoaded='';warn('Municípios indisponíveis · estados preservados');}}
 }
 function update(){
  panel.querySelector('summary').textContent=current==='off'?'Limites · Off':current==='cities'?'Limites · Municípios':'Limites · Estados';
  if(!alive||!map.getLayer(STATE_LINES))return;
  const states=current!=='off'&&!!stateData;
  for(const id of [STATE_FILL,STATE_LINES])visible(id,states);
  if(ufMarkers.length)for(const marker of ufMarkers)marker.getElement().hidden=!states||map.getZoom()<3.7;
  const municipalities=states&&current==='cities'&&map.getZoom()>=MUNICIPAL_ZOOM;
  if(municipalities){
   const uf=underCenter();
   if(uf){if(ufLoaded!==uf)loadMunicipal(uf);}
   else {if(ufLoaded)clearMunicipal();warn('Aproxime o mapa sobre um estado do Brasil');}
  }else if(ufLoaded){clearMunicipal();}
  for(const id of [CITY_FILL,CITY_LINES])visible(id,municipalities&&!!cachedMunicipal);

  if(!municipalities)warn(current==='off'?'Limites ocultos':current==='cities'?'Amplie para ver os municípios · zoom 8+':'Estados · malha simplificada do IBGE');
  top();
 }
 function featuresAt(point,id){
  try{return map.getLayer(id)?map.queryRenderedFeatures(point,{layers:[id]}):[];}catch{return [];}
 }
 function handleClick(ev){
  if(!alive||current==='off'||!stateData)return;
  const selectedState=featuresAt(ev.point,STATE_FILL)[0];
  const selectedCity=current==='cities'?featuresAt(ev.point,CITY_FILL)[0]:null;
  if(!selectedState&&!selectedCity)return;
  const uf=selectedState?.properties?.sigla||selectedCity?.properties?.uf||'';
  const title=selectedCity?.properties?.nome||selectedState?.properties?.nome||'Brasil';
  const municipalityId=selectedCity?.properties?.cd_geocmu||'';
  if(mousePopup){mousePopup.remove();mousePopup=null;}
  const root=document.createElement('section');root.className='argos-area-popup';
  root.appendChild(text('strong',title+(selectedCity&&uf?' · '+uf:'')));
  root.appendChild(text('div',selectedCity?'Município · IBGE':uf?'Unidade da Federação · '+uf:'Localidade'));
  root.appendChild(text('small',ev.lngLat.lat.toFixed(4)+', '+ev.lngLat.lng.toFixed(4)+' · coordenadas do toque'));
  if(onPlace){
   const found=onPlace({uf,title,municipalityId,lng:ev.lngLat.lng,lat:ev.lngLat.lat,element:root});
   if(typeof found==='string'&&found)root.appendChild(text('small',found));
  }
  mousePopup=new maplibregl.Popup({closeButton:true,closeOnClick:true,offset:8,maxWidth:'285px',focusAfterOpen:false}).setLngLat(ev.lngLat).setDOMContent(root);
  mousePopup.on('open',()=>{document.body.classList.add('argos-popup-active');panel.open=false;});
  mousePopup.on('close',()=>document.body.classList.remove('argos-popup-active'));
  mousePopup.addTo(map);
 }
 function setMode(value){
  if(!['off','states','cities'].includes(value))return;
  current=value;select.value=value;remember(value);update();panel.open=false;
 }
 const move=()=>{if(active)update();};
 let queued=false;
 const style=()=>{if(!alive)return;if(!map.getLayer(STATE_LINES)&&map.isStyleLoaded())install();};
 const overlayMoved=()=>{
  if(!alive||queued)return;queued=true;
  requestAnimationFrame(()=>{queued=false;if(alive&&map.getLayer(STATE_LINES))top();});
 };
 select.addEventListener('change',()=>setMode(select.value));
 map.on('zoomend',move);map.on('moveend',move);map.on('click',handleClick);map.on('style.load',style);map.on('styledata',overlayMoved);
 if(map.isStyleLoaded())install();
 fetchStates();
 return Object.freeze({setMode,get mode(){return current;},setActive(value){active=!!value;if(!active){seq++;request?.abort();if(!cachedMunicipal)ufLoaded='';}else update();},destroy(){
  alive=false;seq++;request?.abort();mousePopup?.remove();
  map.off('zoomend',move);map.off('moveend',move);map.off('click',handleClick);map.off('style.load',style);map.off('styledata',overlayMoved);
  for(const marker of ufMarkers)marker.remove();ufMarkers=[];
  for(const id of [CITY_LINES,CITY_FILL,STATE_LINES,STATE_FILL])if(map.getLayer(id))map.removeLayer(id);
  for(const id of [CITY_ID,STATE_ID])if(map.getSource(id))map.removeSource(id);
  panel.remove();
 }});
}
root.ArgosBoundaries={create,MUNICIPAL_ZOOM};
})(window);
