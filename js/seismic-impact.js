/* Estimated shaking on land. GlobalQuake Gen2 attenuation (MIT); Natural Earth
   coastlines (public domain). This is a model, not reported shaking or damage. */
(function(){
'use strict';
const SOURCE='quake-impact',LAYER='quake-impact-fill';
const {pga,extent,color}=window.SeismicImpactModel;
let landPromise,generation=0,scene=null,legend=null;
function loadLand(){return landPromise||(landPromise=fetch('assets/seismic/ne-50m-land.geojson?v=50m1',{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('Coastlines unavailable');return r.json();}).then(d=>d.features.flatMap(f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates)).catch(e=>{landPromise=null;throw e;}));}

// Four footprints / 100k vertices at most. Keys include every physical input.
const geometryCache=new Map();let cacheVertices=0,worker=null,workerUnavailable=false,active=null,requestId=0;
function key(c){return [c.lng,c.lat,c.mag,c.depth].join('|');}
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
function complete(job,result){if(active!==job||job.cancelled)return;active=null;remember(job.key,result);job.resolve(result.data);}
function calculate(context){
 const k=key(context);if(active?.key===k)return active.promise;if(active)cancelCalculation();
 if(geometryCache.has(k)){const result=geometryCache.get(k);geometryCache.delete(k);geometryCache.set(k,result);return Promise.resolve(result.data);}
 let resolve,reject;const promise=new Promise((ok,no)=>{resolve=ok;reject=no;});
 const job={id:++requestId,key:k,context:{lng:context.lng,lat:context.lat,mag:context.mag,depth:context.depth},promise,resolve,reject,cancelled:false};active=job;
 const useFallback=()=>fallback(job).catch(error=>{if(active===job){active=null;reject(error);}});
 if(!workerUnavailable&&typeof Worker==='function'){
  try{
   if(!worker){worker=new Worker('js/seismic-impact-worker.js?v=20261009-heavy-map');
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
 if(!map.getLayer(LAYER))map.addLayer({id:LAYER,type:'fill',source:SOURCE,paint:{'fill-color':['get','color'],'fill-opacity':.56,'fill-antialias':false}},map.getLayer('wave-front-p-glow')?'wave-front-p-glow':undefined);
}
function label(text){if(!legend){legend=document.createElement('div');legend.className='seismic-impact-status';const host=document.getElementById('mapWrap')||document.body,headerBottom=Math.max(...['top-strip','ux-controlbar','latest-event-ticker'].map(id=>document.getElementById(id)?.getBoundingClientRect().bottom||0));legend.style.top=Math.max(12,headerBottom-host.getBoundingClientRect().top+42)+'px';legend.style.whiteSpace='normal';legend.style.textAlign='center';legend.style.maxWidth='calc(100% - 24px)';legend.title='Modelo de atenuação GlobalQuake Gen2 sobre terras Natural Earth. Sem correção local de solo, relatos ou confirmação de danos.';(document.getElementById('mapWrap')||document.body).append(legend);}legend.textContent=text;}
function stop(keepCalculation=false){if(!keepCalculation)cancelCalculation();generation++;scene=null;legend?.remove();legend=null;window.__mgSeismicImpactState=null;try{if(map?.getLayer(LAYER))map.removeLayer(LAYER);if(map?.getSource(SOURCE))map.removeSource(SOURCE);}catch(e){}}
function reveal(radius,full=false){if(!scene)return;scene.radius=Math.max(scene.radius,Number(radius)||0);scene.full=scene.full||full;try{if(map.getLayer(LAYER)){const bandWidth=scene.bandWidth||1,key=scene.full?-1:Math.min(48,Math.floor(scene.radius/bandWidth));if(scene.filterKey!==key){map.setFilter(LAYER,scene.full?null:['<=',['get','distanceKm'],key*bandWidth+.000001]);scene.filterKey=key;}}}catch(e){}window.__mgSeismicImpactState={id:scene.id,stage:scene.full?'impact':'propagating',radius:scene.radius,estimated:true,features:scene.features||0};}
function start(context,full=false){
 stop(true);const token=generation;scene={...context,radius:0,full,bandWidth:extent(context.mag,context.depth)/48};
 label('Intensidade estimada · I fraca → IX+ forte · '+(full?'Ondas já passaram':'Acompanhando a onda S'));
 calculate(context).then(data=>{
  if(token!==generation||!scene)return;
  ensure();map.getSource(SOURCE).setData(data);scene.features=data.features.length;reveal(scene.radius,scene.full);
 }).catch(e=>{if(token===generation){label('Intensidade estimada · Camada indisponível');console.warn('[intensidade estimada]',e);}});
}
function finish(){if(scene){reveal(scene.radius,true);label('Intensidade estimada · I fraca → IX+ forte · Área afetada');}}
function refresh(c){if(scene?.id!==c.id)return;if(['lng','lat','depth','mag'].some(k=>scene[k]!==c[k])){const r=scene.radius,full=scene.full;start(c,full);reveal(r,full);}}
window.SeismicImpact={start,reveal,finish,refresh,stop,pga,extent,color};
})();
