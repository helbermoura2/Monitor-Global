/* Static layers on demand; coast tours use one timeout, without network polling. */
(function(){
 'use strict';
 const SOURCE='tsunami-official-regions',layers=['tsunami-coast-halo','tsunami-regions-fill','tsunami-coast-paint'];
 let assetPromise=null,generation=0,legend=null,current=null,signature=null,demo=null,linkedHost=null,visible=true,tour=null,frameNode=null,notice=null;
 const empty=()=>({type:'FeatureCollection',features:[]});
 function stop(){stopTour();demo?.originMarker?.remove();document.getElementById('pd-coastal-demo')?.remove();document.getElementById('painel-direito')?.classList.remove('tsunami-coastal-demo');demo=null;linkedHost=null;visible=true;generation++;current=null;signature=null;frameNode?.remove();frameNode=null;notice?.remove();notice=null;legend?.remove();legend=null;try{for(const id of layers)if(map.getLayer(id))map.removeLayer(id);if(map.getSource(SOURCE))map.removeSource(SOURCE);}catch(e){}}
 function selected(id){return demo?.id===id||typeof eventoSelecionadoId!=='undefined'&&eventoSelecionadoId===(linkedHost||id);}
 function load(){return assetPromise||(assetPromise=fetch('assets/tsunami/ne-50m-coastal-regions.geojson?v=3').then(r=>{if(!r.ok)throw Error('Contornos indisponíveis');return r.json();}).catch(e=>{assetPromise=null;throw e;}));}
 function ensure(){
  if(!map.getSource(SOURCE))map.addSource(SOURCE,{type:'geojson',data:empty(),attribution:'Costas: Natural Earth 1:50m (domínio público)'});
  const before=map.getLayer('esri-boundaries-places')?'esri-boundaries-places':undefined;
  const layout={visibility:visible?'visible':'none'},line=['==',['get','band'],'shoreline'];
  if(!map.getLayer(layers[0]))map.addLayer({id:layers[0],type:'line',source:SOURCE,filter:line,layout:{...layout,'line-cap':'round','line-join':'round'},paint:{'line-color':['get','color'],'line-width':['interpolate',['linear'],['zoom'],1,12,4,9,7,4,11,1.5],'line-opacity':['case',['>=',['get','rank'],2],.22,.06],'line-blur':2}},before);
  if(!map.getLayer(layers[1]))map.addLayer({id:layers[1],type:'fill',source:SOURCE,filter:['!=',['get','band'],'shoreline'],layout,paint:{'fill-color':['get','color'],'fill-opacity':['case',['<',['get','rank'],2],.09,['==',['get','kind'],'official'],.46,['==',['get','band'],'inner'],.82,.42],'fill-antialias':true}},before);
  if(!map.getLayer(layers[2]))map.addLayer({id:layers[2],type:'line',source:SOURCE,filter:line,layout:{...layout,'line-cap':'round','line-join':'round'},paint:{'line-color':['get','color'],'line-width':['interpolate',['linear'],['zoom'],1,6,4,5,7,2.5,11,.6],'line-opacity':['case',['>=',['get','rank'],2],.9,.3]}},before);
 }
 function node(tag,text,host){const n=document.createElement(tag);n.textContent=text;host.append(n);return n;}
 function decorate(item,result){
  frameNode?.remove();notice?.remove();
  const c=result.entries[0]||TsunamiMapModel.category({},item),warning=window.TsunamiRegional?.hasThreat(item)??(!item.cancelled&&item.hazardNature!=='bulletin');
  frameNode=document.createElement('div');frameNode.id='tsunami-coastal-frame';frameNode.dataset.level=warning?'warning':item.cancelled?'ended':'information';frameNode.setAttribute('aria-hidden','true');frameNode.style.setProperty('--tsunami-frame-color',warning?'#fbbf24':c.color);document.body.append(frameNode);
  notice=document.createElement('aside');notice.id='tsunami-coastal-notice';notice.setAttribute('role','status');notice.style.setProperty('--tsunami-frame-color',warning?'#fbbf24':c.color);
  node('strong',(item.__tsunamiMapDemo?'TESTE FICTÍCIO · MODELO 1 · ':'')+(warning?'AVISO DE TSUNAMI':item.cancelled?'BOLETIM ENCERRADO':'BOLETIM INFORMATIVO'),notice);
  node('small',item.__tsunamiMapDemo?(item.place||'Faixas costeiras demonstrativas'):(item.source+' · '+(item.warningLevel||'Boletim oficial')),notice);
  const toggle=node('button','Ver legenda',notice);toggle.type='button';toggle.setAttribute('aria-controls','tsunami-map-legend');toggle.setAttribute('aria-expanded','false');toggle.onclick=()=>{if(!legend)return;legend.hidden=!legend.hidden;toggle.setAttribute('aria-expanded',String(!legend.hidden));positionNotice();};
  document.getElementById('mapWrap')?.append(notice);positionNotice();
 }
 function positionNotice(){if(!notice)return;const host=document.getElementById('mapWrap');if(!host)return;const bottom=Math.max(...['top-strip','ux-controlbar','latest-event-ticker'].map(id=>document.getElementById(id)?.getBoundingClientRect().bottom||0));notice.style.top=Math.max(12,bottom-host.getBoundingClientRect().top+8)+'px';if(innerWidth<700&&legend)legend.style.top=(notice.offsetTop+notice.offsetHeight+8)+'px';}
 function label(item,result,failed=false){
  if(!item.__tsunamiMapDemo){legend?.remove();legend=null;notice?.remove();notice=null;frameNode?.remove();frameNode=null;if(window.TsunamiMapModel.status(item).level==='warning'){decorate(item,result);notice?.remove();notice=null;}return;}
  legend?.remove();legend=document.createElement('section');legend.id='tsunami-map-legend';legend.setAttribute('aria-label','Legenda dos boletins de tsunami');
  node('strong',item.__tsunamiMapDemo?'🌊 TESTE · pintura de tsunami':'🌊 Regiões do boletim · '+item.source,legend);
  if(item.__tsunamiMapDemo)node('small','Cenário fictício para demonstração. Não é um alerta real.',legend);
  const colors=document.createElement('div');colors.className='tsunami-map-colors';legend.append(colors);
  for(const c of result.entries){const row=node('span',c.label,colors);row.style.setProperty('--tsunami-area-color',c.color);}
  const official=result.data.features.some(f=>f.properties.kind==='official'),reference=result.data.features.some(f=>f.properties.kind==='reference');
  node('small',failed?'Contornos indisponíveis. Consulte o boletim oficial.':!result.data.features.length?'Este boletim não fornece regiões com contornos identificáveis.':reference?'Costas das regiões citadas: referência geográfica. Trechos sob aviso seguem o boletim oficial.':official?'Área publicada pela autoridade.':'',legend);
  node('small','Faixa cartográfica costeira · Não representa inundação nem intensidade do tremor.',legend);
  if(result.unmapped.length)node('small',result.unmapped.length+' região(ões) sem contorno nesta escala.',legend);
  if(result.data.features.length){const b=node('button','Ver regiões',legend);b.type='button';b.onclick=()=>fit();if(!item.__tsunamiMapDemo){const info=node('button','Costas e horários',legend);info.type='button';info.onclick=()=>window.EventInsights?.open('coasts');}}
  decorate(item,result);
  const host=document.getElementById('mapWrap');
  if(innerWidth<700&&host){const bottom=Math.max(...['top-strip','ux-controlbar','latest-event-ticker'].map(id=>document.getElementById(id)?.getBoundingClientRect().bottom||0));legend.style.top=Math.max(12,bottom-host.getBoundingClientRect().top+8)+'px';legend.style.bottom='auto';}
  host?.append(legend);legend.style.display=visible?'':'none';legend.hidden=innerWidth<700;positionNotice();
 }
 function bounds(features){const points=[];const scan=c=>{if(typeof c[0]==='number')points.push(c);else c.forEach(scan);};features.forEach(f=>scan(f.geometry.coordinates));if(!points.length)return null;
  const [west,east]=window.TsunamiMapModel.longitudeBounds(points.map(p=>p[0]));let south=90,north=-90;for(const p of points){south=Math.min(south,p[1]);north=Math.max(north,p[1]);}return [[west,south],[east,north]];
 }
 function padding(){const wide=innerWidth>1000;return {top:wide?225:220,bottom:wide?100:150,left:wide?315:35,right:wide?355:35};}
 function stopTour(){clearTimeout(tour?.timer);tour=null;}
 function startTour(){
  if(!current||demo||linkedHost||window.TsunamiRegional&&!window.TsunamiRegional.hasThreat(current.item)||current.item.hazardNature==='bulletin'||current.item.cancelled||!selected(current.id)||!stops().length)return;
  if(tour?.id===current.id)return;stopTour();const t=tour={id:current.id,index:0};window.PresentationLimits?.extendStay?.(current.id,Math.min(180000,Math.max(60000,18000+stops().length*12000)));
  const next=()=>{if(tour!==t||!current||!selected(t.id)){stopTour();return;}if(document.hidden){t.timer=null;return;}if(window.EventCamera?.owns(current.id)){t.timer=setTimeout(next,1000);return;}if(!t.arrived){t.arrived=true;t.timer=setTimeout(next,6000);return;}const index=t.index++;visit(index,index===0?8000:6000);t.timer=setTimeout(next,12000);};t.next=next;next();
 }
 function cameraFor(b,maxZoom=7){if(window.WeatherWarningCamera){const c=WeatherWarningCamera.frame(b);return {...c,zoom:Math.max(map.getMinZoom(),Math.min(maxZoom,c.zoom-.2))};}return map.cameraForBounds(b,{padding:padding(),maxZoom});}
 function fit(){stopTour();if(!current||!selected(current.id))return;const box=bounds(current.data.features);if(!box)return;const camera=cameraFor(box);if(!camera)return;map.stop();map.flyTo({...camera,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:6000,essential:true});}
 function stops(){if(!current)return [];if(current.route)return current.route;const groups=new Map();for(const f of current.data.features){if(f.properties.band==='inner'||f.properties.band==='shoreline'||!demo&&f.properties.rank<2)continue;const name=f.properties.name||current.item.place||'Área do boletim';if(!groups.has(name))groups.set(name,[]);groups.get(name).push(f);}
  const origin=window.TsunamiLink?.origin(current.item)?current.item.coords:[map.getCenter().lng,map.getCenter().lat];
  const rows=[...groups].map(([name,features])=>({name:TsunamiMapModel.placeLabel(name),bounds:bounds(features)})).filter(r=>r.bounds);
  const midpoint=r=>[(r.bounds[0][0]+r.bounds[1][0])/2,(r.bounds[0][1]+r.bounds[1][1])/2];
  rows.sort((a,b)=>(window.TsunamiLink?.distance(origin,midpoint(a))||0)-(window.TsunamiLink?.distance(origin,midpoint(b))||0));
  if(!rows.length)return [];const focus=demo?current.data.features:current.data.features.filter(f=>f.properties.rank>=2);return current.route=[{name:demo?'Todas as regiões indicadas':'Regiões com aviso ativo',bounds:bounds(focus)},...rows];
 }
 function visit(index=0,duration=6000){if(!current||!selected(current.id))return null;const rows=stops();if(!rows.length)return null;const target=rows[index%rows.length],camera=cameraFor(target.bounds,index%rows.length?7:5.5);if(!camera)return null;
  setVisible(true);if(!window.EventCamera?.owns(linkedHost||current.id)){map.stop();map.flyTo({...camera,pitch:0,bearing:0,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:duration,curve:1.25,essential:true});}
  if(demo?.mode==='russia'){const h=document.querySelector('#pd-coastal-demo h3');if(h)h.textContent=target.name;}
  window.EventInsights?.setCoastTarget(target.name);
  const heading=legend?.querySelector('strong');if(heading)heading.textContent=(current.item.__tsunamiMapDemo?'🌊 TESTE':'🌊 '+current.item.source)+' · '+target.name;
  return target;
 }
 function setVisible(value){visible=!!value;if(legend)legend.style.display=visible?'':'none';try{for(const id of layers)if(map.getLayer(id))map.setLayoutProperty(id,'visibility',visible?'visible':'none');}catch(e){}}
 async function show(item,previewContext=null,hostId=null){
  if(item?.type!=='tsunami'||(!previewContext&&(!window.TsunamiLink?.official(item)||typeof eventoSelecionadoId==='undefined'||eventoSelecionadoId!==(hostId||item.id)))){stop();return;}
  const regional=!previewContext&&window.TsunamiRegional?.bundle(item,typeof globalAlerts==='undefined'?[]:globalAlerts,typeof globalEvents==='undefined'?[]:globalEvents);
  const key=JSON.stringify([regional?.rows,hostId,item.id,item.time,item.cancelled,item.hazardNature,item.warningLevel,item.affectedAreas,item.coverageAreas,item.warningGeometry,window.TsunamiMapModel.status(item).level]);if(key===signature)return;
  stop();linkedHost=hostId;if(previewContext)demo={id:item.id,previous:previewContext,mode:item.__tsunamiCoastalRussia?'russia':null};signature=key;const token=generation;
  try{const regions=regional?.rows?.some(r=>r.scoped&&!r.geometryOnly)||item.affectedAreas?.length||item.coverageAreas?.length?await load():empty();if(token!==generation||!selected(item.id))return;
   const result=regional?.bulletins?.length?window.TsunamiMapModel.buildGroup(regional,regions):window.TsunamiMapModel.build(item,regions);ensure();map.getSource(SOURCE).setData(result.data);current={id:item.id,item,data:result.data};label(item,result);if(previewContext&&!item.__tsunamiCoastalRussia)fit();
  }catch(error){if(token===generation&&selected(item.id))label(item,{data:empty(),entries:[],unmapped:[]},true);console.warn('[costas tsunami]',error.message);}
 }
 function closePreview(restore=true){
  if(!demo)return;window.TsunamiPresentation?.stop();const previous=demo.previous;stop();
  if(restore){if(previous.mobileState){for(const [name,enabled]of Object.entries(previous.mobileState))document.body.classList.toggle(name,enabled);}
   map.stop();map.jumpTo(previous.camera);
   const real=(typeof globalEvents==='undefined'?[]:globalEvents).find(q=>q.id===previous.selectedId);
   if(real&&typeof eventoSelecionadoId!=='undefined'&&eventoSelecionadoId===real.id){
    if(previous.wave?.id===real.id&&typeof startWaveFront==='function')startWaveFront(...real.coords,real.mag,real.depth,previous.wave.mode==='live'?real.time:previous.wave.originTime,{id:real.id,mode:previous.wave.mode,chaseCam:false,returnToEpicenter:false,protectUntilEnd:window.__mgQuakePresentationMode!=='auto'});
    else if(previous.impact?.id===real.id)window.SeismicImpact?.start({id:real.id,lng:real.coords[0],lat:real.coords[1],mag:real.mag,depth:real.depth,keepCamera:true},true);
    window.TsunamiLinkedPanel?.refresh();
   }else if(previous.item&&typeof eventoSelecionadoId!=='undefined'&&eventoSelecionadoId===(previous.hostId||previous.item.id)){show(previous.item,null,previous.hostId);window.TsunamiLinkedPanel?.refresh();}
  }
 }
 function preview(mode='warning'){
  closePreview();const previous={mobileState:{'mobile-details-mid':document.body.classList.contains('mobile-details-mid'),'mobile-details-open':document.body.classList.contains('mobile-details-open')},camera:{center:map.getCenter(),zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch(),padding:map.getPadding()},item:current?.item,hostId:linkedHost,selectedId:typeof eventoSelecionadoId==='undefined'?null:eventoSelecionadoId,wave:window.__mgWaveFrontState,impact:window.__mgSeismicImpactState};window.TsunamiPresentation?.stop();
  const item={id:'tsunami-map-demo',type:'tsunami',coords:[-80.8,7.5],__tsunamiMapDemo:true,source:'DEMONSTRAÇÃO',time:Date.now(),hazardNature:mode==='information'?'bulletin':'warning',warningLevel:mode==='information'?'Informativo':mode==='cancelled'?'Encerrado':'Aviso de tsunami',cancelled:mode==='cancelled',affectedAreas:[{name:'Panamá',category:'1 TO 3 METERS'},{name:'Costa Rica',category:'0.3 TO 1 METERS'},{name:'Nicaragua',category:'LESS THAN 0.3 METERS'}]};
  if(mode==='russia')Object.assign(item,{__tsunamiCoastalRussia:true,place:'Kamchatka · Rússia / Pacífico Norte',coords:[157.4,51.9],coordinateRole:'earthquake-origin',affectedAreas:[{name:'Kamchatka',category:'GREATER THAN 3 METERS'},{name:'Kuril Islands',category:'1 TO 3 METERS'},{name:'Northeastern Japan',category:'0.3 TO 1 METERS'},{name:'Aleutian Islands',category:'0.3 TO 1 METERS'},{name:'Southern Alaska',category:'LESS THAN 0.3 METERS'}]});
  window.EventCamera?.cancel();window.SeismicPaintTour?.stop();window.PresentationLimits?.clear();window.SeismicImpact?.stop();if(typeof fecharViradaCardAlcance==='function')fecharViradaCardAlcance();
  if(typeof stopMapCamera==='function')stopMapCamera();
  if(typeof stopWaveFront==='function')stopWaveFront();
  if(typeof stopFeltZone==='function')stopFeltZone();
  if(typeof userInteractingWithGlobe!=='undefined')userInteractingWithGlobe=true;
  return show(item,previous).then(()=>{if(mode==='russia'&&demo?.id===item.id)startRussiaTour();if(mode==='linked'&&demo?.id===item.id)window.TsunamiPresentation?.preview(item);});
 }
 function showRussiaCard(){
  if(innerWidth<900&&typeof abrirPainelDetalhesMobile==='function')abrirPainelDetalhesMobile();
  const panel=document.getElementById('painel-direito');if(panel){document.getElementById('pd-coastal-demo')?.remove();const card=document.createElement('section');card.id='pd-coastal-demo';
   node('small','TESTE FICTÍCIO · MODELO 1',card);node('h2','Costas pintadas',card);node('h3','Origem · Kamchatka, Rússia',card);node('p','Cenário demonstrativo no Pacífico Norte. Não é um alerta real.',card);
   const list=document.createElement('ul');card.append(list);for(const a of current.item.affectedAreas){const c=TsunamiMapModel.category(a,current.item);const row=node('li',TsunamiMapModel.placeLabel(a.name)+' · '+c.label,list);row.style.color=c.color;}
   node('small','Faixas cartográficas nas regiões citadas; não indicam até onde a água entraria em terra.',card);panel.querySelector('.pd-header-row')?.after(card);panel.classList.add('tsunami-coastal-demo');}
  if(!demo.originMarker){const pin=document.createElement('div');pin.className='tsunami-demo-origin event-pin-surface';node('i','',pin);node('strong','Origem fictícia · Rússia',pin);const Marker=window.maplibregl?.Marker||(typeof GL!=='undefined'?GL.Marker:null);if(Marker)demo.originMarker=new Marker({element:pin,anchor:'bottom',offset:[0,-3]}).setLngLat(current.item.coords).addTo(map);}
 }
 function startRussiaTour(){
  if(demo?.mode!=='russia'||!current)return;stopTour();showRussiaCard();const t=tour={id:current.id,index:0,demo:true};
  const next=()=>{if(tour!==t||demo?.id!==t.id||!current)return;if(document.hidden){t.timer=null;return;}
   if(t.index>=stops().length){visit(0,8000);t.timer=setTimeout(()=>{if(tour===t)stopTour();},15000);return;}
   const index=t.index++;visit(index,index===0?8000:6000);t.timer=setTimeout(next,index===0?14000:11000);
  };t.next=next;
  const center=typeof centroCompensado==='function'?centroCompensado(...current.item.coords,5):current.item.coords;
  map.stop();map.flyTo({center,zoom:5,padding:{top:0,right:0,bottom:0,left:0},bearing:0,pitch:0,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:6000,essential:true,curve:1.42});
  t.timer=setTimeout(next,11000);
 }
 function install(){if(!map)return;['dragstart','wheel','touchstart'].forEach(name=>map.on(name,e=>{if(e?.originalEvent)stopTour();}));}
 if(typeof map!=='undefined'&&map)install();else window.addEventListener('load',install,{once:true});
 document.addEventListener('visibilitychange',()=>{if(!tour)return;clearTimeout(tour.timer);if(!document.hidden)tour.timer=setTimeout(tour.next,10000);});
 window.addEventListener('resize',positionNotice);window.addEventListener('pagehide',stop);window.TsunamiMap={show,stop,fit,startTour,preview,closePreview,showLinked:(item,hostId)=>show(item,null,hostId),setVisible,visit,stops,cameraFor,startRussiaTour,pauseTour:()=>{stopTour();if(map)map.stop();},tourState:()=>tour?{id:tour.id,index:tour.index,demo:!!tour.demo}:null,isPreview:()=>!!demo};
})();
