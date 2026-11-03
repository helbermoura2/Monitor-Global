(function(){'use strict';
 const notice=document.getElementById('notice'),retry=document.getElementById('retry'),empty=document.getElementById('empty');
 let map=null,loaded=false,active=true,events=[],focus=null,markers=[],fitted=false,tileErrors=0;
 function validCoordinates(item){return item&&Number.isFinite(item.longitude)&&Number.isFinite(item.latitude)&&Math.abs(item.longitude)<=180&&Math.abs(item.latitude)<=90;}
 function located(item){return validCoordinates(item)&&Math.abs(item.latitude)<=85.05112878;}
 function info(text,canRetry){notice.textContent=text;notice.hidden=false;retry.hidden=!canRetry;}
 function removeMarkers(){for(const marker of markers)marker.remove();markers=[];}
 function selected(id){if(window.MonitorMapBridge&&typeof window.MonitorMapBridge.selectEvent==='function')window.MonitorMapBridge.selectEvent(id);}
 function popup(event){const content=document.createElement('div'),title=document.createElement('p'),button=document.createElement('button');title.className='event-title';title.textContent=event.title;button.type='button';button.className='event-action';button.textContent='Ver detalhes';button.addEventListener('click',()=>selected(event.id));content.append(title,button);return new maplibregl.Popup({offset:12,maxWidth:'270px',focusAfterOpen:false}).setDOMContent(content);}
 function showEvents(){if(!loaded||!active)return;removeMarkers();empty.hidden=events.length>0;for(const event of events){const point=document.createElement('button');point.type='button';point.className='marker'+(event.kind==='tsunami'?' tsunami':'');point.setAttribute('aria-label',event.title||'Evento monitorado');markers.push(new maplibregl.Marker({element:point}).setLngLat([event.longitude,event.latitude]).setPopup(popup(event)).addTo(map));}
  if(!fitted&&events.length&&!focus){fitted=true;if(events.length===1)map.jumpTo({center:[events[0].longitude,events[0].latitude],zoom:5});else{const bounds=new maplibregl.LngLatBounds();events.forEach(e=>bounds.extend([e.longitude,e.latitude]));map.fitBounds(bounds,{padding:50,maxZoom:5,duration:0});}}
 }
 function showFocus(){if(!active||!focus)return;if(!located(focus)){focus=null;info('Evento fora da área desta projeção; consulte os detalhes.',false);return;}if(!loaded)return;const target=focus;focus=null;fitted=true;if(tileErrors===0){notice.hidden=true;retry.hidden=true;}map.jumpTo({center:[target.longitude,target.latitude],zoom:5});}
 function initialize(){
  removeMarkers();if(map){map.remove();map=null;}loaded=false;tileErrors=0;fitted=false;info('Carregando mapa…',false);
  if(!window.maplibregl||!maplibregl.supported()){info('Mapa indisponível neste aparelho. Use a lista para consultar os eventos.',true);return;}
  try{map=new maplibregl.Map({container:'map',center:[-47,-15],zoom:1.7,minZoom:1,maxZoom:14,renderWorldCopies:false,pixelRatio:Math.min(window.devicePixelRatio||1,1.25),maxTileCacheSize:96,fadeDuration:0,attributionControl:false,style:{version:8,sources:{imagery:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19,attribution:'Imagens © <a href="https://www.esri.com/en-us/legal/terms/full-master-agreement" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics e GIS User Community'}},layers:[{id:'imagery',type:'raster',source:'imagery',paint:{'raster-fade-duration':0}}]}});
   map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');map.addControl(new maplibregl.AttributionControl({compact:false}),'bottom-right');
   map.on('load',()=>{loaded=true;if(tileErrors===0){notice.hidden=true;retry.hidden=true;}showEvents();showFocus();if(!active)map.stop();});
   map.on('error',()=>{tileErrors++;info('Mapa sem conexão ou imagens indisponíveis. Os eventos continuam acessíveis na lista.',true);});
   map.on('webglcontextlost',()=>{loaded=false;info('O mapa foi pausado pelo aparelho. Toque para recarregar.',true);});
  }catch(error){info('Não foi possível abrir o mapa. Os eventos continuam acessíveis na lista.',true);}
 }
 window.MonitorMap={setEvents:function(value){const known=Array.isArray(value)?value.slice(0,120).filter(e=>validCoordinates(e)&&typeof e.id==='string'&&typeof e.title==='string'):[];events=known.filter(located);empty.textContent=known.length>events.length?'Nenhum evento pode ser exibido nesta projeção. Consulte os detalhes na lista.':'Sem eventos com localização disponível nesta consulta.';showEvents();},focus:function(value){focus=validCoordinates(value)?value:null;showFocus();},pause:function(){active=false;if(map)map.stop();},resume:function(){active=true;if(map){map.resize();showEvents();}},close:function(){active=false;removeMarkers();if(map){map.remove();map=null;}loaded=false;events=[];focus=null;}};
 retry.addEventListener('click',initialize);window.addEventListener('pagehide',()=>window.MonitorMap.close());initialize();
})();
