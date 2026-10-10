/* Static layers, loaded on demand. No wave animation, timers or network polling. */
(function(){
 'use strict';
 const SOURCE='tsunami-official-regions',layers=['tsunami-regions-fill','tsunami-coasts-glow','tsunami-coasts-line'];
 let assetPromise=null,generation=0,legend=null,current=null,signature=null;
 const empty=()=>({type:'FeatureCollection',features:[]});
 function stop(){generation++;current=null;signature=null;legend?.remove();legend=null;try{for(const id of layers)if(map.getLayer(id))map.removeLayer(id);if(map.getSource(SOURCE))map.removeSource(SOURCE);}catch(e){}}
 function selected(id){return typeof eventoSelecionadoId!=='undefined'&&eventoSelecionadoId===id;}
 function load(){return assetPromise||(assetPromise=fetch('assets/tsunami/ne-50m-coastal-regions.geojson?v=1').then(r=>{if(!r.ok)throw Error('Contornos indisponíveis');return r.json();}).catch(e=>{assetPromise=null;throw e;}));}
 function ensure(){
  if(!map.getSource(SOURCE))map.addSource(SOURCE,{type:'geojson',data:empty(),attribution:'Costas: Natural Earth 1:50m (domínio público)'});
  const before=map.getLayer('esri-boundaries-places')?'esri-boundaries-places':undefined;
  if(!map.getLayer(layers[0]))map.addLayer({id:layers[0],type:'fill',source:SOURCE,filter:['==',['get','kind'],'official'],paint:{'fill-color':['get','color'],'fill-opacity':.2}},before);
  if(!map.getLayer(layers[1]))map.addLayer({id:layers[1],type:'line',source:SOURCE,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','color'],'line-width':10,'line-blur':4,'line-opacity':.35}},before);
  if(!map.getLayer(layers[2]))map.addLayer({id:layers[2],type:'line',source:SOURCE,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','color'],'line-width':['interpolate',['linear'],['zoom'],1,2,7,4],'line-opacity':.95}},before);
 }
 function node(tag,text,host){const n=document.createElement(tag);n.textContent=text;host.append(n);return n;}
 function label(item,result,failed=false){
  legend?.remove();legend=document.createElement('section');legend.id='tsunami-map-legend';legend.setAttribute('aria-label','Legenda dos boletins de tsunami');
  node('strong','🌊 Regiões do boletim · '+item.source,legend);
  const colors=document.createElement('div');colors.className='tsunami-map-colors';legend.append(colors);
  for(const c of result.entries){const row=node('span',c.label,colors);row.style.setProperty('--tsunami-area-color',c.color);}
  const official=result.data.features.some(f=>f.properties.kind==='official'),reference=result.data.features.some(f=>f.properties.kind==='reference');
  node('small',failed?'Contornos indisponíveis. Consulte o boletim oficial.':!result.data.features.length?'Este boletim não fornece regiões com contornos identificáveis.':reference?'Costas das regiões citadas: referência geográfica. Trechos sob aviso seguem o boletim oficial.':official?'Área publicada pela autoridade.':'',legend);
  node('small','Não representa inundação nem intensidade do tremor.',legend);
  if(result.unmapped.length)node('small',result.unmapped.length+' região(ões) sem contorno nesta escala.',legend);
  if(result.data.features.length){const b=node('button','Ver regiões',legend);b.type='button';b.onclick=()=>fit();}
  const host=document.getElementById('mapWrap');
  if(innerWidth<700&&host){const bottom=Math.max(...['top-strip','ux-controlbar','latest-event-ticker'].map(id=>document.getElementById(id)?.getBoundingClientRect().bottom||0));legend.style.top=Math.max(12,bottom-host.getBoundingClientRect().top+8)+'px';legend.style.bottom='auto';}
  host?.append(legend);
 }
 function fit(){if(!current||!selected(current.id))return;const points=[];const scan=c=>{if(typeof c[0]==='number')points.push(c);else c.forEach(scan);};current.data.features.forEach(f=>scan(f.geometry.coordinates));if(!points.length)return;
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),wide=innerWidth>1000;
  // Full-world references safely use the world extent rather than crossing the date line.
  map.stop();map.fitBounds([[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)]],{padding:{top:wide?225:220,bottom:wide?100:150,left:wide?315:35,right:wide?355:35},maxZoom:7,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:1500,essential:true});
 }
 async function show(item){
  if(item?.type!=='tsunami'||!window.TsunamiLink?.official(item)||!selected(item.id)){stop();return;}
  const key=JSON.stringify([item.id,item.time,item.cancelled,item.hazardNature,item.warningLevel,item.affectedAreas,item.coverageAreas,item.warningGeometry]);if(key===signature)return;
  stop();signature=key;const token=generation;
  try{const regions=(item.affectedAreas?.length||item.coverageAreas?.length)?await load():empty();if(token!==generation||!selected(item.id))return;
   const result=window.TsunamiMapModel.build(item,regions);ensure();map.getSource(SOURCE).setData(result.data);current={id:item.id,data:result.data};label(item,result);
  }catch(error){if(token===generation&&selected(item.id))label(item,{data:empty(),entries:[],unmapped:[]},true);console.warn('[costas tsunami]',error.message);}
 }
 window.addEventListener('pagehide',stop);window.TsunamiMap={show,stop,fit};
})();
