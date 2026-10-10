/* Static layers on demand; coast tours use one timeout, without network polling. */
(function(){
 'use strict';
 const SOURCE='tsunami-official-regions',layers=['tsunami-regions-fill'];
 let assetPromise=null,generation=0,legend=null,current=null,signature=null,demo=null,linkedHost=null,visible=true,tour=null;
 const empty=()=>({type:'FeatureCollection',features:[]});
 function stop(){stopTour();demo=null;linkedHost=null;visible=true;generation++;current=null;signature=null;legend?.remove();legend=null;try{for(const id of layers)if(map.getLayer(id))map.removeLayer(id);if(map.getSource(SOURCE))map.removeSource(SOURCE);}catch(e){}}
 function selected(id){return demo?.id===id||typeof eventoSelecionadoId!=='undefined'&&eventoSelecionadoId===(linkedHost||id);}
 function load(){return assetPromise||(assetPromise=fetch('assets/tsunami/ne-50m-coastal-regions.geojson?v=2').then(r=>{if(!r.ok)throw Error('Contornos indisponíveis');return r.json();}).catch(e=>{assetPromise=null;throw e;}));}
 function ensure(){
  if(!map.getSource(SOURCE))map.addSource(SOURCE,{type:'geojson',data:empty(),attribution:'Costas: Natural Earth 1:50m (domínio público)'});
  const before=map.getLayer('esri-boundaries-places')?'esri-boundaries-places':undefined;
  if(!map.getLayer(layers[0]))map.addLayer({id:layers[0],type:'fill',source:SOURCE,layout:{visibility:visible?'visible':'none'},paint:{'fill-color':['get','color'],'fill-opacity':['case',['==',['get','kind'],'official'],.2,['==',['get','band'],'inner'],.3,.13],'fill-antialias':true}},before);
 }
 function node(tag,text,host){const n=document.createElement(tag);n.textContent=text;host.append(n);return n;}
 function label(item,result,failed=false){
  legend?.remove();legend=document.createElement('section');legend.id='tsunami-map-legend';legend.setAttribute('aria-label','Legenda dos boletins de tsunami');
  node('strong',item.__tsunamiMapDemo?'🌊 TESTE · pintura de tsunami':'🌊 Regiões do boletim · '+item.source,legend);
  if(item.__tsunamiMapDemo)node('small','Cenário fictício para demonstração. Não é um alerta real.',legend);
  const colors=document.createElement('div');colors.className='tsunami-map-colors';legend.append(colors);
  for(const c of result.entries){const row=node('span',c.label,colors);row.style.setProperty('--tsunami-area-color',c.color);}
  const official=result.data.features.some(f=>f.properties.kind==='official'),reference=result.data.features.some(f=>f.properties.kind==='reference');
  node('small',failed?'Contornos indisponíveis. Consulte o boletim oficial.':!result.data.features.length?'Este boletim não fornece regiões com contornos identificáveis.':reference?'Costas das regiões citadas: referência geográfica. Trechos sob aviso seguem o boletim oficial.':official?'Área publicada pela autoridade.':'',legend);
  node('small','Não representa inundação nem intensidade do tremor.',legend);
  if(result.unmapped.length)node('small',result.unmapped.length+' região(ões) sem contorno nesta escala.',legend);
  if(result.data.features.length){const b=node('button','Ver regiões',legend);b.type='button';b.onclick=()=>fit();}
  const host=document.getElementById('mapWrap');
  if(innerWidth<700&&host){const bottom=Math.max(...['top-strip','ux-controlbar','latest-event-ticker'].map(id=>document.getElementById(id)?.getBoundingClientRect().bottom||0));legend.style.top=Math.max(12,bottom-host.getBoundingClientRect().top+8)+'px';legend.style.bottom='auto';}
  host?.append(legend);legend.style.display=visible?'':'none';
 }
 function bounds(features){const points=[];const scan=c=>{if(typeof c[0]==='number')points.push(c);else c.forEach(scan);};features.forEach(f=>scan(f.geometry.coordinates));if(!points.length)return null;
  const [west,east]=window.TsunamiMapModel.longitudeBounds(points.map(p=>p[0]));return [[west,Math.min(...points.map(p=>p[1]))],[east,Math.max(...points.map(p=>p[1]))]];
 }
 function padding(){const wide=innerWidth>1000;return {top:wide?225:220,bottom:wide?100:150,left:wide?315:35,right:wide?355:35};}
 function stopTour(){clearTimeout(tour?.timer);tour=null;}
 function startTour(){
  if(!current||demo||linkedHost||current.item.cancelled||!selected(current.id)||!stops().length)return;
  if(tour?.id===current.id)return;stopTour();const t=tour={id:current.id,index:0};
  const next=()=>{if(tour!==t||!current||!selected(t.id)){stopTour();return;}if(document.hidden){t.timer=null;return;}visit(t.index++,6000);t.timer=setTimeout(next,10000);};t.next=next;next();
 }
 function fit(){stopTour();if(!current||!selected(current.id))return;const box=bounds(current.data.features);if(!box)return;map.stop();map.fitBounds(box,{padding:padding(),maxZoom:7,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:1500,essential:true});}
 function stops(){if(!current)return [];if(current.route)return current.route;const groups=new Map();for(const f of current.data.features){if(f.properties.band==='inner')continue;const name=f.properties.name||current.item.place||'Área do boletim';if(!groups.has(name))groups.set(name,[]);groups.get(name).push(f);}
  const origin=window.TsunamiLink?.origin(current.item)?current.item.coords:[map.getCenter().lng,map.getCenter().lat];
  const rows=[...groups].map(([name,features])=>({name:window.EventPortuguese?.place(name)||name,bounds:bounds(features)})).filter(r=>r.bounds);
  const midpoint=r=>[(r.bounds[0][0]+r.bounds[1][0])/2,(r.bounds[0][1]+r.bounds[1][1])/2];
  rows.sort((a,b)=>(window.TsunamiLink?.distance(origin,midpoint(a))||0)-(window.TsunamiLink?.distance(origin,midpoint(b))||0));
  return current.route=[{name:'Todas as regiões indicadas',bounds:bounds(current.data.features)},...rows];
 }
 function visit(index=0,duration=6000){if(!current||!selected(current.id))return null;const rows=stops();if(!rows.length)return null;const target=rows[index%rows.length],camera=map.cameraForBounds(target.bounds,{padding:padding(),maxZoom:index%rows.length?7:5.5});if(!camera)return null;
  setVisible(true);map.stop();map.flyTo({...camera,padding:padding(),pitch:0,bearing:0,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:duration,curve:1.25,essential:true});
  const heading=legend?.querySelector('strong');if(heading)heading.textContent=(current.item.__tsunamiMapDemo?'🌊 TESTE':'🌊 '+current.item.source)+' · '+target.name;
  return target;
 }
 function setVisible(value){visible=!!value;if(legend)legend.style.display=visible?'':'none';try{if(map.getLayer(layers[0]))map.setLayoutProperty(layers[0],'visibility',visible?'visible':'none');}catch(e){}}
 async function show(item,previewContext=null,hostId=null){
  if(item?.type!=='tsunami'||(!previewContext&&(!window.TsunamiLink?.official(item)||typeof eventoSelecionadoId==='undefined'||eventoSelecionadoId!==(hostId||item.id)))){stop();return;}
  const key=JSON.stringify([hostId,item.id,item.time,item.cancelled,item.hazardNature,item.warningLevel,item.affectedAreas,item.coverageAreas,item.warningGeometry]);if(key===signature)return;
  stop();linkedHost=hostId;if(previewContext)demo={id:item.id,previous:previewContext};signature=key;const token=generation;
  try{const regions=(item.affectedAreas?.length||item.coverageAreas?.length)?await load():empty();if(token!==generation||!selected(item.id))return;
   const result=window.TsunamiMapModel.build(item,regions);ensure();map.getSource(SOURCE).setData(result.data);current={id:item.id,item,data:result.data};label(item,result);if(previewContext)fit();
  }catch(error){if(token===generation&&selected(item.id))label(item,{data:empty(),entries:[],unmapped:[]},true);console.warn('[costas tsunami]',error.message);}
 }
 function closePreview(restore=true){
  if(!demo)return;window.TsunamiPresentation?.stop();const previous=demo.previous;stop();
  if(restore){map.stop();map.jumpTo(previous.camera);
   const real=(typeof globalEvents==='undefined'?[]:globalEvents).find(q=>q.id===previous.selectedId);
   if(real&&typeof eventoSelecionadoId!=='undefined'&&eventoSelecionadoId===real.id){
    if(previous.wave?.id===real.id&&typeof startWaveFront==='function')startWaveFront(...real.coords,real.mag,real.depth,previous.wave.mode==='live'?real.time:previous.wave.originTime,{id:real.id,mode:previous.wave.mode,chaseCam:true,returnToEpicenter:real.mag>=5,protectUntilEnd:window.__mgQuakePresentationMode!=='auto'});
    else if(previous.impact?.id===real.id)window.SeismicImpact?.start({id:real.id,lng:real.coords[0],lat:real.coords[1],mag:real.mag,depth:real.depth},true);
    window.TsunamiLinkedPanel?.refresh();
   }else if(previous.item&&typeof eventoSelecionadoId!=='undefined'&&eventoSelecionadoId===(previous.hostId||previous.item.id)){show(previous.item,null,previous.hostId);window.TsunamiLinkedPanel?.refresh();}
  }
 }
 function preview(mode='warning'){
  closePreview();const previous={camera:{center:map.getCenter(),zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch(),padding:map.getPadding()},item:current?.item,hostId:linkedHost,selectedId:typeof eventoSelecionadoId==='undefined'?null:eventoSelecionadoId,wave:window.__mgWaveFrontState,impact:window.__mgSeismicImpactState};window.TsunamiPresentation?.stop();
  const item={id:'tsunami-map-demo',type:'tsunami',coords:[-80.8,7.5],__tsunamiMapDemo:true,source:'DEMONSTRAÇÃO',time:Date.now(),hazardNature:mode==='information'?'bulletin':'warning',warningLevel:mode==='information'?'Informativo':mode==='cancelled'?'Encerrado':'Aviso de tsunami',cancelled:mode==='cancelled',affectedAreas:[{name:'Panamá',category:'1 TO 3 METERS'},{name:'Costa Rica',category:'0.3 TO 1 METERS'},{name:'Nicaragua',category:'LESS THAN 0.3 METERS'}]};
  if(typeof stopMapCamera==='function')stopMapCamera();
  if(typeof stopWaveFront==='function')stopWaveFront();
  if(typeof stopFeltZone==='function')stopFeltZone();
  if(typeof userInteractingWithGlobe!=='undefined')userInteractingWithGlobe=true;
  return show(item,previous).then(()=>{if(mode==='linked'&&demo?.id===item.id)window.TsunamiPresentation?.preview(item);});
 }
 if(typeof map!=='undefined'&&map)['dragstart','wheel','touchstart'].forEach(name=>map.on(name,e=>{if(e?.originalEvent)stopTour();}));
 document.addEventListener('visibilitychange',()=>{if(!tour)return;clearTimeout(tour.timer);if(!document.hidden)tour.timer=setTimeout(tour.next,10000);});
 window.addEventListener('pagehide',stop);window.TsunamiMap={show,stop,fit,startTour,preview,closePreview,showLinked:(item,hostId)=>show(item,null,hostId),setVisible,visit,stops,isPreview:()=>!!demo};
})();
