/* Official INMET warning footprints; no invented municipal boundaries. */
(function(){
'use strict';
const SOURCE='inmet-warning-areas',FILL='inmet-warning-fill',DRY='inmet-warning-dry',LINE='inmet-warning-outline';
let border,loading,fingerprint='',boundMap;
function geometry(value){try{const g=typeof value==='string'?JSON.parse(value):value;if(!g||!['Polygon','MultiPolygon'].includes(g.type))return null;const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;if(!Array.isArray(polys)||!polys.length)return null;for(const p of polys){if(!Array.isArray(p)||!p.length)return null;for(const r of p){if(!Array.isArray(r)||r.length<4||r.some(c=>!Array.isArray(c)||c.length<2||!Number.isFinite(c[0])||!Number.isFinite(c[1])||Math.abs(c[0])>180||Math.abs(c[1])>90)||r[0][0]!==r.at(-1)[0]||r[0][1]!==r.at(-1)[1])return null;}}return {type:g.type,coordinates:g.coordinates};}catch{return null;}}
function load(){if(border)return Promise.resolve(border);if(loading)return loading;loading=fetch('assets/weather/br-border.json?v=1').then(r=>{if(!r.ok)throw Error('Brazil border unavailable');return r.json();}).then(g=>{border=geometry(g);if(!border)throw Error('Invalid Brazil border');return border;}).catch(e=>{loading=null;throw e;});return loading;}
function multi(g){return g.type==='Polygon'?[g.coordinates]:g.coordinates;}
function collection(alerts){
 const features=[];if(!border||typeof polygonClipping==='undefined')return {type:'FeatureCollection',features};
 let covered=[];
 const ranked=alerts.filter(a=>a.warningGeometry&&alertVisivelNaLista(a)&&(a.inicioTs||0)<=Date.now()&&passesGeoFilter(a)).sort((a,b)=>(Number(b.sev)||0)-(Number(a.sev)||0));
 for(const a of ranked){try{
  let coords=polygonClipping.intersection(multi(a.warningGeometry),multi(border));
  const radius=Number.parseFloat(geoFilter),ref=minhaPosicao||(typeof weatherLoc==='undefined'?null:weatherLoc);
  if(Number.isFinite(radius)&&ref?.lat!=null&&ref?.lng!=null){const ring=[];for(let i=0;i<=64;i++){const angle=i/64*Math.PI*2,dy=radius/111.195*Math.sin(angle),dx=radius/(111.195*Math.cos(ref.lat*Math.PI/180))*Math.cos(angle);ring.push([ref.lng+dx,ref.lat+dy]);}ring[64]=ring[0];coords=polygonClipping.intersection(coords,[[ring]]);}
  const full=coords;if(covered.length&&coords.length)coords=polygonClipping.difference(coords,covered);if(full.length)covered=covered.length?polygonClipping.union(covered,full):full;
  if(coords.length)features.push({type:'Feature',geometry:{type:'MultiPolygon',coordinates:coords},properties:{alertId:a.id,color:corSeveridadeAlerta(a),priority:Number(a.sev)||0,kind:/baixa\s+umidade|umidade\s+baixa/i.test(a.descOnly||a.place||'')?'dry':'rain'}});
 }catch(e){console.warn('INMET area:',a.id,e.message);}}
 return {type:'FeatureCollection',features};
}
function sync(alerts){
 if(!map||!border)return;
 if(!map.getSource(SOURCE)){map.addSource(SOURCE,{type:'geojson',data:{type:'FeatureCollection',features:[]}});fingerprint='';}
 if(!map.hasImage('inmet-dry-hatch')){const c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d');x.strokeStyle='rgba(255,255,255,.28)';x.lineWidth=1;for(const n of [-16,0,16]){x.beginPath();x.moveTo(n,16);x.lineTo(n+16,0);x.stroke();}map.addImage('inmet-dry-hatch',x.getImageData(0,0,16,16));}
 const before=map.getLayer('inmet-municipality-points')?'inmet-municipality-points':undefined;
 if(!map.getLayer(FILL))map.addLayer({id:FILL,type:'fill',source:SOURCE,paint:{'fill-color':['get','color'],'fill-opacity':.18}},before);
 if(!map.getLayer(DRY))map.addLayer({id:DRY,type:'fill',source:SOURCE,filter:['==',['get','kind'],'dry'],paint:{'fill-pattern':'inmet-dry-hatch','fill-opacity':.5}},before);
 if(!map.getLayer(LINE))map.addLayer({id:LINE,type:'line',source:SOURCE,paint:{'line-color':['get','color'],'line-width':.7,'line-opacity':.45}},before);
 const fp=JSON.stringify([alerts.map(a=>[a.id,a.warningGeometry,a.sev,a.type,a.fimTs,a.inicioTs]),geoFilter,sidebarFilter,soCriticos,layerVisibility,minhaPosicao,typeof weatherLoc==='undefined'?null:weatherLoc]);
 if(fp!==fingerprint){map.getSource(SOURCE).setData(collection(alerts));fingerprint=fp;}
 const selected=eventoSelecionadoId==null?'':String(eventoSelecionadoId);
 map.setPaintProperty(LINE,'line-width',['case',['==',['get','alertId'],selected],2.5,.7]);
 if(boundMap!==map){boundMap=map;map.on('click',FILL,e=>{const a=globalAlerts.find(a=>a.id===e.features?.[0]?.properties.alertId);if(a)selectMapEvent(a,false);});map.on('mouseenter',FILL,()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave',FILL,()=>map.getCanvas().style.cursor='');}
}
window.InmetAreas={geometry,load,sync,collection,ready:()=>!!border};
})();
