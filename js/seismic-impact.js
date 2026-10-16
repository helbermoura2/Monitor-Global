/* Estimated shaking on land. GlobalQuake Gen2 attenuation (MIT); Natural Earth
   coastlines (public domain). This is a model, not reported shaking or damage. */
(function(){
'use strict';
const SOURCE='quake-impact',LAYER='quake-impact-fill',RUPTURE='quake-published-rupture',RUPTURE_LAYERS=['quake-rupture-halo','quake-rupture-line'];
const {pga,extent,color}=window.SeismicImpactModel;
let landPromise,generation=0,scene=null,legend=null,visible=true,officialTimer=null,officialCheck=null;
function loadLand(){return landPromise||(landPromise=fetch('assets/seismic/ne-50m-land.geojson?v=50m1',{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('Coastlines unavailable');return r.json();}).then(d=>d.features.flatMap(f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates)).catch(e=>{landPromise=null;throw e;}));}

// Four footprints / 100k vertices at most. Keys include every physical input.
const geometryCache=new Map();let cacheVertices=0,worker=null,workerUnavailable=false,active=null,requestId=0;
function key(c){return [c.lng,c.lat,c.mag,c.depth,c.shaking?.version||'radial'].join('|');}
function remember(k,result){if(result.vertices>100000)return;geometryCache.set(k,result);cacheVertices+=result.vertices;
 while(geometryCache.size>4||cacheVertices>100000){const oldest=geometryCache.keys().next().value;cacheVertices-=geometryCache.get(oldest).vertices;geometryCache.delete(oldest);}}
function cancelCalculation(){if(!active)return;const old=active;active=null;old.cancelled=true;worker?.terminate();worker=null;old.reject(Error('Superseded footprint'));}
async function fallback(job){
 const land=await loadLand();if(job.cancelled)return;
 const features=[],iterator=window.SeismicImpactModel.bands(job.context,land);
 let done=false;
 while(!done){
  await new Promise(resolve=>setTimeout(resolve,0));if(job.cancelled)return;
  for(let i=0;i<4;i++){const step=iterator.next();if(step.done){done=true;break;}if(step.value)features.push(step.value);}
 }
 const data={type:'FeatureCollection',features};complete(job,{data,vertices:window.SeismicImpactModel.vertices(data)});
}
function complete(job,result){if(active!==job||job.cancelled)return;active=null;if(job.context.shaking&&result.vertices>100000){job.reject(Error('Grade de intensidade fora dos limites de desenho'));return;}remember(job.key,result);job.resolve(result.data);}
function calculate(context){
 const k=key(context);if(active?.key===k)return active.promise;if(active)cancelCalculation();
 if(geometryCache.has(k)){const result=geometryCache.get(k);geometryCache.delete(k);geometryCache.set(k,result);return Promise.resolve(result.data);}
 let resolve,reject;const promise=new Promise((ok,no)=>{resolve=ok;reject=no;});
 const job={id:++requestId,key:k,context:{lng:context.lng,lat:context.lat,mag:context.mag,depth:context.depth,...(context.shaking?{shaking:context.shaking}:{})},promise,resolve,reject,cancelled:false};active=job;
 const useFallback=()=>fallback(job).catch(error=>{if(active===job){active=null;reject(error);}});
 if(!workerUnavailable&&typeof Worker==='function'){
  try{
   if(!worker){worker=new Worker('js/seismic-impact-worker.js?v=20261016-multi-source');
    const engine=worker;worker.onmessage=({data})=>{if(worker!==engine)return;const current=active;if(!current||data.id!==current.id)return;if(data.error){active=null;current.reject(Error(data.error));}else complete(current,data);};
    worker.onerror=event=>{event.preventDefault();if(worker!==engine)return;worker?.terminate();worker=null;workerUnavailable=true;const current=active;if(current)fallback(current).catch(error=>{if(active===current){active=null;current.reject(error);}});};
   }
   worker.postMessage({id:job.id,context:job.context});return promise;
  }catch(error){worker?.terminate();worker=null;workerUnavailable=true;}
 }
 useFallback();return promise;
}
window.addEventListener('pagehide',()=>{cancelCalculation();worker?.terminate();worker=null;});
function ensure(){
 if(!map.getSource(SOURCE))map.addSource(SOURCE,{type:'geojson',data:{type:'FeatureCollection',features:[]}});
 if(!map.getLayer(LAYER))map.addLayer({id:LAYER,type:'fill',source:SOURCE,layout:{visibility:visible?'visible':'none'},paint:{'fill-color':['get','color'],'fill-opacity':.56,'fill-antialias':false}},map.getLayer('wave-front-p-glow')?'wave-front-p-glow':undefined);
}
function ruptureTrace(c){
 const projection=c.shaking?.rupture;
 // Only normalized official finite geometry can appear in a real scene.
 const lines=!c.demo&&(['available','rupture-only'].includes(c.shaking?.status)||c.shaking?.method==='usgs-shakemap-finite')&&projection?.type==='FeatureCollection'?projection.features.filter(f=>['USGS','INGV','ShakeMap-EU'].includes(f.properties?.provider)&&f.properties?.projection===true&&f.geometry?.type==='LineString'):[];
 if(!lines.length){for(const id of RUPTURE_LAYERS)if(map.getLayer(id))map.removeLayer(id);if(map.getSource(RUPTURE))map.removeSource(RUPTURE);return;}
 const data={type:'FeatureCollection',features:lines};
 if(!map.getSource(RUPTURE))map.addSource(RUPTURE,{type:'geojson',data});else map.getSource(RUPTURE).setData(data);
 RUPTURE_LAYERS.forEach((id,i)=>{if(!map.getLayer(id))map.addLayer({id,type:'line',source:RUPTURE,layout:{visibility:visible?'visible':'none','line-join':'round','line-cap':'round'},paint:{'line-color':i?'#fff2c6':'#152331','line-width':lines.length>100?(i?1:2.5):(i?2.5:5),'line-opacity':i?.95:.8}},map.getLayer('wave-front-p-glow')?'wave-front-p-glow':undefined);});
}
function label(text){
 if(scene?.mag>=5.5&&!scene.shaking&&!scene.skipOfficial&&!scene.demo&&!scene.demoPreview)text+=' · Aguardando mapa oficial USGS';
 if(!legend){
  legend=document.createElement('div');legend.className='seismic-impact-status';
  legend.style.whiteSpace='normal';legend.style.textAlign='center';legend.style.maxWidth='calc(100% - 24px)';
  (document.getElementById('mapWrap')||document.body).append(legend);
 }
 legend.title=scene?.demo?'Cenário fictício para testar a pintura. Não é um produto do USGS nem um evento real.':scene?.shaking?.note||'Modelo de atenuação GlobalQuake Gen2 sobre terras Natural Earth. Sem correção local de solo, relatos ou confirmação de danos.';
 if(!scene?.demo&&scene?.shaking?.rupture?.features?.length)text+=' · Projeção da ruptura '+scene.shaking.rupture.features[0].properties.provider;
 if(scene?.shaking?.rupture?.features?.length)legend.title+=' Projeção em superfície do modelo de ruptura finita publicado pela fonte. A falha pode estar em profundidade; não representa necessariamente uma rachadura observada no solo.';
 legend.textContent=text;legend.style.display=visible?'':'none';
 positionStatus();
}
function positionStatus(){
 if(!legend)return;
 const host=legend.parentElement||document.getElementById('mapWrap')||document.body,hostTop=host.getBoundingClientRect().top;
 const headerBottom=Math.max(...['top-strip','ux-controlbar','latest-event-ticker'].map(id=>document.getElementById(id)?.getBoundingClientRect().bottom||0));
 const waveBottom=host.querySelector?.('.wave-front-status')?.getBoundingClientRect().bottom||0;
 const top=Math.max(6,headerBottom-hostTop+6,waveBottom?waveBottom-hostTop+4:0)+'px';
 if(legend.style.top!==top)legend.style.top=top;
}
function stop(keepCalculation=false,keepLayer=false){clearTimeout(officialTimer);officialTimer=null;officialCheck=null;if(!keepCalculation){cancelCalculation();window.RuptureShaking?.cancel();}generation++;scene=null;if(!keepLayer){legend?.remove();legend=null;}window.__mgSeismicImpactState=null;try{if(!keepLayer){for(const id of RUPTURE_LAYERS)if(map?.getLayer(id))map.removeLayer(id);if(map?.getSource(RUPTURE))map.removeSource(RUPTURE);if(map?.getLayer(LAYER))map.removeLayer(LAYER);if(map?.getSource(SOURCE))map.removeSource(SOURCE);}}catch(e){}}
function setVisible(value){visible=!!value;if(!visible){clearTimeout(officialTimer);officialTimer=null;}else officialCheck?.();if(legend)legend.style.display=visible?'':'none';try{for(const id of [LAYER,...RUPTURE_LAYERS])if(map.getLayer(id))map.setLayoutProperty(id,'visibility',visible?'visible':'none');}catch(e){}}
function reveal(radius,full=false){if(!scene)return;scene.radius=Math.max(scene.radius,Number(radius)||0);scene.full=scene.full||full||!!scene.shaking;try{if(map.getLayer(LAYER)){const bandWidth=scene.bandWidth||1,key=scene.full?-1:Math.min(48,Math.floor(scene.radius/bandWidth));if(scene.filterKey!==key){map.setFilter(LAYER,scene.full?null:['<=',['get','distanceKm'],key*bandWidth+.000001]);scene.filterKey=key;}}}catch(e){}window.__mgSeismicImpactState={id:scene.id,stage:scene.full?'impact':'propagating',radius:scene.radius,estimated:true,features:scene.features||0,method:scene.demo?'simulation':scene.shaking?(scene.shaking.method||'usgs-shakemap-grid'):'radial',rupture:!!scene.shaking?.rupture?.features?.length,version:scene.shaking?.version||null};}
// Informational only: no selection, camera, sound or presentation timers.
const announcedOfficial=new Map();
function announceOfficial(c,features){
 if((!features&&!c.shaking?.rupture?.features?.length)||!c.shaking||c.demo||c.demoPreview||!window.MobileNotices)return;
 const version=String(c.shaking.version||c.shaking.updatedAt||'published');
 if(announcedOfficial.get(c.id)===version)return;
 announcedOfficial.delete(c.id);announcedOfficial.set(c.id,version);
 if(announcedOfficial.size>64)announcedOfficial.delete(announcedOfficial.keys().next().value);
 const item=typeof globalEvents==='undefined'?null:globalEvents.find(q=>q.id===c.id);
 const place=window.EventPortuguese?.place(item?.place)||item?.place||'Local do sismo';
 window.MobileNotices.push({key:'official-map|'+c.id+'|'+version,type:'info',duration:8000,
  title:c.shaking.status==='rupture-only'?'Ruptura publicada disponível':'Mapa oficial atualizado',detail:(c.shaking.source==='eu'?'ShakeMap-EU':c.shaking.source==='ingv'?'INGV ShakeMap':c.shaking.status==='rupture-only'?'USGS · ruptura':'USGS ShakeMap')+' · M'+Number(c.mag).toFixed(1).replace('.',',')+' · '+place});
}
function start(context,full=false){
 const item=typeof globalEvents==='undefined'?null:globalEvents.find(q=>q.id===context.id);context={...context,...(!context.skipOfficial&&!context.shaking&&item&&window.RuptureShaking?.get(item)?{shaking:window.RuptureShaking.get(item)}:{})};
 const previous=scene?.id===context.id?scene:null;stop(true,!!previous);const token=generation;scene={...context,bounds:previous?.bounds||null,radius:0,full,bandWidth:extent(context.mag,context.depth)/48};
 label(context.demo?'TESTE · ruptura alongada · intensidade fictícia':context.shaking?officialLabel(context):context.presentation?'Reprodução visual · Intensidade estimada':'Intensidade estimada · I fraca → IX+ forte · '+(full?'Ondas já passaram':'Acompanhando a onda S'));
 calculate(context).then(data=>{
  if(token!==generation||!scene)return;
  ensure();ruptureTrace(context);map.getSource(SOURCE).setData(data);scene.features=data.features.length;scene.bounds=footprintBounds(data,context);reveal(scene.radius,scene.full);if(!scene.features)label(emptyLabel(context));else if(context.shaking)label(context.demo?'TESTE · ruptura alongada · intensidade fictícia':officialLabel(context));if(context.keepCamera)window.SeismicPaintTour?.ready(context);else window.SeismicFocus?.ready(context);announceOfficial(context,scene.features);if(context.demo||context.demoPreview)window.SeismicScenarioDemo?.paintReady(context);
 }).catch(e=>{if(token===generation){if(context.shaking){start({...context,shaking:null,skipOfficial:true},full);return;}label('Intensidade estimada · Camada indisponível');console.warn('[intensidade estimada]',e);}});
 if(item&&!context.skipOfficial&&(!context.shaking||context.shaking.status==='rupture-only')&&context.mag>=5.5&&window.RuptureShaking){
  let requesting=false;const check=()=>{clearTimeout(officialTimer);officialTimer=null;if(requesting||token!==generation||scene?.id!==context.id||document.hidden||!visible)return;requesting=true;
   window.RuptureShaking.query(item).then(shaking=>{requesting=false;if(token!==generation||scene?.id!==context.id||document.hidden||!visible)return;if(shaking&&shaking.version!==context.shaking?.version){const r=scene.radius;start({...context,shaking},scene.full);reveal(r,true);}else officialTimer=setTimeout(check,60000);});
  };officialCheck=check;check();
 }
}
document.addEventListener?.('visibilitychange',()=>{if(document.hidden){clearTimeout(officialTimer);officialTimer=null;}else officialCheck?.();});
function officialLabel(c){
 if(c.shaking?.status==='rupture-only')return c.shaking.provider+' · Sem mapa oficial de intensidade · Não delimita a área sentida';
 const values=c.shaking?.grid?.values?.filter(v=>v!=null&&v>=1.5)||[],max=values.length?Math.max(...values):null;
 const roman=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
 return (c.shaking.provider||'USGS ShakeMap')+(max!=null?' · faixas MMI II–'+roman[Math.max(0,Math.min(11,Math.round(max)-1))]+(max<3.5?' · fraca':''):'');
}
function emptyLabel(c){if(c.shaking?.status==='rupture-only')return officialLabel(c);return c.shaking?(c.shaking.provider||'USGS ShakeMap')+' · Sem faixa II+ em terra nesta grade':'Intensidade estimada · Sem área em terra estimada para pintar';}
function finish(){if(scene){reveal(scene.radius,true);label(scene.features===0?emptyLabel(scene):scene.demo?'TESTE · ruptura alongada · intensidade fictícia':scene.shaking?officialLabel(scene):'Intensidade estimada · I fraca → IX+ forte · Área afetada');}}
function footprintBounds(data,c){let w=Infinity,e=-Infinity,s=Infinity,n=-Infinity;for(const f of data.features){for(const p of f.geometry.coordinates)for(const ring of p)for(const [x,y]of ring){const lng=c.lng+((x-c.lng+540)%360)-180;w=Math.min(w,lng);e=Math.max(e,lng);s=Math.min(s,y);n=Math.max(n,y);}}for(const f of c.shaking?.rupture?.features||[]){if(f.geometry?.type!=='LineString')continue;for(const [x,y]of f.geometry.coordinates){const lng=c.lng+((x-c.lng+540)%360)-180;w=Math.min(w,lng);e=Math.max(e,lng);s=Math.min(s,y);n=Math.max(n,y);}}if(Number.isFinite(w)&&Number.isFinite(s)){if(w===e){w-=.01;e+=.01;}if(s===n){s=Math.max(-90,s-.01);n=Math.min(90,n+.01);}}return w<e&&s<n?[w,s,e,n]:null;}
function refresh(c){if(scene?.id!==c.id)return;if(['lng','lat','depth','mag'].some(k=>scene[k]!==c[k])){const r=scene.radius,full=scene.full;start(c,full);reveal(r,full);}}
window.SeismicImpact={start,reveal,finish,refresh,stop,setVisible,positionStatus,bounds:id=>scene?.id===id?scene.bounds||null:null,pga,extent,color,snapshot:context=>geometryCache.get(key(context))?.data||(active?.key===key(context)?active.promise:Promise.resolve(null))};
})();
