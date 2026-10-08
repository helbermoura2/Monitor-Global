/* Estimated shaking on land. GlobalQuake Gen2 attenuation (MIT); Natural Earth
   coastlines (public domain). This is a model, not reported shaking or damage. */
(function(){
'use strict';
const SOURCE='quake-impact',LAYER='quake-impact-fill';
const SCALE=[[.5,'I',[170,170,170]],[1,'II',[200,190,240]],[2.1,'III',[132,162,232]],[5,'IV',[130,214,255]],[11,'V',[85,242,15]],[26,'VI',[255,255,0]],[60,'VII',[255,200,0]],[140,'VIII',[255,120,0]],[321.8,'IX',[255,0,0]],[740,'X',[190,0,0]],[1702,'XI',[130,0,0]],[3000,'XII',[65,0,0]]];
let landPromise,generation=0,scene=null,legend=null;
function pga(mag,depth,km){
 const h=Math.max(0,Number(depth)||0),correction=Math.log10(h+160)-Math.log10(160);
 const adjusted=mag+.4*correction,distance=Math.sqrt(h*h+4*6379*(6379-h)*Math.sin(km/(2*6379))**2)/(1+.75*correction);
 return Math.pow(10,adjusted*.575)/(.36*Math.pow(distance,1.25+adjusted/22)+10);
}
function extent(mag,depth){let lo=0,hi=12000;for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(pga(mag,depth,mid)>=.5)lo=mid;else hi=mid;}return lo;}
function color(value){let i=0;while(i<SCALE.length-1&&value>=SCALE[i+1][0])i++;const a=SCALE[i],b=SCALE[Math.min(i+1,SCALE.length-1)];const t=a===b?0:Math.max(0,Math.min(1,Math.log(value/a[0])/Math.log(b[0]/a[0])));return 'rgb('+a[2].map((v,j)=>Math.round(v+(b[2][j]-v)*t)).join(',')+')';}
function loadLand(){return landPromise||(landPromise=fetch('assets/seismic/ne-50m-land.geojson?v=50m1',{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('Coastlines unavailable');return r.json();}).then(d=>d.features.flatMap(f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates)).catch(e=>{landPromise=null;throw e;}));}
function shiftedLand(polygons,minLng,maxLng){return polygons.flatMap(p=>{const xs=p[0].map(x=>x[0]),lo=Math.min(...xs),hi=Math.max(...xs);const shifts=[-360,0,360].filter(s=>hi+s>=minLng&&lo+s<=maxLng);return shifts.map(s=>p.map(r=>r.map(([x,y])=>[x+s,y])));});}
function geometry(c,land){
 const outer=extent(c.mag,c.depth),features=[];if(outer<1)return {type:'FeatureCollection',features};
 const ring=r=>{
  const points=anelGeodesico(c.lng,c.lat,r,160),first=points[0],last=points[points.length-1];
  // Rings crossing a pole wind through 360° of longitude. Close along the
  // pole rather than drawing a chord across the other side of the map.
  if(Math.abs(last[0]-first[0])>180){const pole=c.lat>=0?90:-90;points.push([last[0],pole],[first[0],pole],first);}
  return points;
 };
 const domain=[ring(outer)];
 // Clip once to the region before intersecting the 48 smooth intensity bands.
 const xs=domain[0].map(p=>p[0]);
 const clipped=polygonClipping.intersection(shiftedLand(land,Math.min(...xs),Math.max(...xs)),domain);
 for(let i=0;i<48;i++){
  const inner=outer*i/48,r=outer*(i+1)/48,mid=(inner+r)/2;
  const band=[ring(r)];if(inner>0)band.push(ring(inner).reverse());
  const coordinates=polygonClipping.intersection(clipped,band);
  if(coordinates.length)features.push({type:'Feature',properties:{distanceKm:r,pga:pga(c.mag,c.depth,mid),color:color(pga(c.mag,c.depth,mid))},geometry:{type:'MultiPolygon',coordinates}});
 }
 return {type:'FeatureCollection',features};
}
function ensure(){
 if(!map.getSource(SOURCE))map.addSource(SOURCE,{type:'geojson',data:{type:'FeatureCollection',features:[]}});
 if(!map.getLayer(LAYER))map.addLayer({id:LAYER,type:'fill',source:SOURCE,paint:{'fill-color':['get','color'],'fill-opacity':.56,'fill-antialias':false}},map.getLayer('wave-front-p-glow')?'wave-front-p-glow':undefined);
}
function label(text){if(!legend){legend=document.createElement('div');legend.className='seismic-impact-status';const host=document.getElementById('mapWrap')||document.body,headerBottom=Math.max(...['top-strip','ux-controlbar','latest-event-ticker'].map(id=>document.getElementById(id)?.getBoundingClientRect().bottom||0));legend.style.top=Math.max(12,headerBottom-host.getBoundingClientRect().top+42)+'px';legend.style.whiteSpace='normal';legend.style.textAlign='center';legend.style.maxWidth='calc(100% - 24px)';legend.title='Modelo de atenuação GlobalQuake Gen2 sobre terras Natural Earth. Sem correção local de solo, relatos ou confirmação de danos.';(document.getElementById('mapWrap')||document.body).append(legend);}legend.textContent=text;}
function stop(){generation++;scene=null;legend?.remove();legend=null;window.__mgSeismicImpactState=null;try{if(map?.getLayer(LAYER))map.removeLayer(LAYER);if(map?.getSource(SOURCE))map.removeSource(SOURCE);}catch(e){}}
function reveal(radius,full=false){if(!scene)return;scene.radius=Math.max(scene.radius,Number(radius)||0);scene.full=scene.full||full;try{if(map.getLayer(LAYER)){const bandWidth=scene.bandWidth||1,key=scene.full?-1:Math.min(48,Math.floor(scene.radius/bandWidth));if(scene.filterKey!==key){map.setFilter(LAYER,scene.full?null:['<=',['get','distanceKm'],key*bandWidth+.000001]);scene.filterKey=key;}}}catch(e){}window.__mgSeismicImpactState={id:scene.id,stage:scene.full?'impact':'propagating',radius:scene.radius,estimated:true,features:scene.features||0};}
function start(context,full=false){
 stop();const token=generation;scene={...context,radius:0,full,bandWidth:extent(context.mag,context.depth)/48};
 label('Intensidade estimada · I fraca → IX+ forte · '+(full?'Ondas já passaram':'Acompanhando a onda S'));
 loadLand().then(land=>{
  if(token!==generation||!scene)return;
  const data=geometry(scene,land);if(token!==generation)return;
  ensure();map.getSource(SOURCE).setData(data);scene.features=data.features.length;reveal(scene.radius,scene.full);
 }).catch(e=>{if(token===generation){label('Intensidade estimada · Camada indisponível');console.warn('[intensidade estimada]',e);}});
}
function finish(){if(scene){reveal(scene.radius,true);label('Intensidade estimada · I fraca → IX+ forte · Epicentro');}}
function refresh(c){if(scene?.id!==c.id)return;if(['lng','lat','depth','mag'].some(k=>scene[k]!==c[k])){const r=scene.radius,full=scene.full;start(c,full);reveal(r,full);}}
window.SeismicImpact={start,reveal,finish,refresh,stop,pga,extent,color};
})();
