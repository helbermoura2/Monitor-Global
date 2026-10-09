/* Official INMET warning footprints; no invented municipal boundaries. */
(function(){
'use strict';
const SOURCE='inmet-warning-areas',FILL='inmet-warning-fill',DRY='inmet-warning-dry',LINE='inmet-warning-outline';
let border,loading,boundMap,sourceData,sourceIdentity,lineIdentity,selectedLine;
// Feed revisions replace geometry/city snapshots; visibility is evaluated on every sync.
const parsed=new Map(),clippedBrazil=new WeakMap(),tokens=new WeakMap();let nextToken=0,parsedSize=0,lastCollectionKey='',lastCollection;
function token(g){if(!g||typeof g!=='object')return 0;if(!tokens.has(g))tokens.set(g,++nextToken);return tokens.get(g);}
function rememberGeometry(raw,g){if(typeof raw!=='string'||raw.length>1000000)return g;parsed.set(raw,g);parsedSize+=raw.length;while(parsed.size>32||parsedSize>2000000){const k=parsed.keys().next().value;parsedSize-=k.length;parsed.delete(k);}return g;}
function geoContext(){const ref=minhaPosicao||(typeof weatherLoc==='undefined'?null:weatherLoc);return [geoFilter,ref?.lat,ref?.lng];}
function geometry(value){if(typeof value==='string'&&parsed.has(value)){const g=parsed.get(value);parsed.delete(value);parsed.set(value,g);return g;}try{const g=typeof value==='string'?JSON.parse(value):value;if(!g||!['Polygon','MultiPolygon'].includes(g.type))return null;const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;if(!Array.isArray(polys)||!polys.length)return null;for(const p of polys){if(!Array.isArray(p)||!p.length)return null;for(const r of p){if(!Array.isArray(r)||r.length<4||r.some(c=>!Array.isArray(c)||c.length<2||!Number.isFinite(c[0])||!Number.isFinite(c[1])||Math.abs(c[0])>180||Math.abs(c[1])>90)||r[0][0]!==r.at(-1)[0]||r[0][1]!==r.at(-1)[1])return null;}}return rememberGeometry(value,{type:g.type,coordinates:g.coordinates});}catch{return null;}}
function load(){if(border)return Promise.resolve(border);if(loading)return loading;loading=fetch('assets/weather/br-border.json?v=1').then(r=>{if(!r.ok)throw Error('Brazil border unavailable');return r.json();}).then(g=>{border=geometry(g);if(!border)throw Error('Invalid Brazil border');return border;}).catch(e=>{loading=null;throw e;});return loading;}
function multi(g){return g.type==='Polygon'?[g.coordinates]:g.coordinates;}
function collection(alerts){
 const features=[];if(!border||typeof polygonClipping==='undefined')return {type:'FeatureCollection',features};
 const eligible=alerts.filter(a=>a.warningGeometry&&alertVisivelNaLista(a)&&(a.inicioTs||0)<=Date.now());
 const fp=JSON.stringify([eligible.map(a=>[a.id,token(a.warningGeometry),Number(a.sev)||0,corSeveridadeAlerta(a),a.descOnly||a.place||'',a.meAtinge,token(a.municipalityLocations),a.coords]),geoContext()]);
 if(fp===lastCollectionKey&&lastCollection)return lastCollection;
 let covered=[];
 const ranked=eligible.filter(passesGeoFilter).sort((a,b)=>(Number(b.sev)||0)-(Number(a.sev)||0));
 for(const a of ranked){try{
  let coords=clippedBrazil.get(a.warningGeometry);if(!coords){coords=polygonClipping.intersection(multi(a.warningGeometry),multi(border));clippedBrazil.set(a.warningGeometry,coords);}
  const radius=Number.parseFloat(geoFilter),ref=minhaPosicao||(typeof weatherLoc==='undefined'?null:weatherLoc);
  if(Number.isFinite(radius)&&ref?.lat!=null&&ref?.lng!=null){const ring=[];for(let i=0;i<=64;i++){const angle=i/64*Math.PI*2,dy=radius/111.195*Math.sin(angle),dx=radius/(111.195*Math.cos(ref.lat*Math.PI/180))*Math.cos(angle);ring.push([ref.lng+dx,ref.lat+dy]);}ring[64]=ring[0];coords=polygonClipping.intersection(coords,[[ring]]);}
  const full=coords;if(covered.length&&coords.length)coords=polygonClipping.difference(coords,covered);if(full.length)covered=covered.length?polygonClipping.union(covered,full):full;
  if(coords.length)features.push({type:'Feature',geometry:{type:'MultiPolygon',coordinates:coords},properties:{alertId:a.id,color:corSeveridadeAlerta(a),priority:Number(a.sev)||0,kind:/baixa\s+umidade|umidade\s+baixa/i.test(a.descOnly||a.place||'')?'dry':'rain'}});
 }catch(e){console.warn('INMET area:',a.id,e.message);}}
 lastCollectionKey=fp;return lastCollection={type:'FeatureCollection',features};
}
function sync(alerts){
 if(!map||!border)return;
 if(!map.getSource(SOURCE)){map.addSource(SOURCE,{type:'geojson',data:{type:'FeatureCollection',features:[]}});sourceIdentity=null;}
 if(!map.hasImage('inmet-dry-hatch')){const c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d');x.strokeStyle='rgba(255,255,255,.28)';x.lineWidth=1;for(const n of [-16,0,16]){x.beginPath();x.moveTo(n,16);x.lineTo(n+16,0);x.stroke();}map.addImage('inmet-dry-hatch',x.getImageData(0,0,16,16));}
 const before=map.getLayer('inmet-municipality-points')?'inmet-municipality-points':undefined;
 if(!map.getLayer(FILL))map.addLayer({id:FILL,type:'fill',source:SOURCE,paint:{'fill-color':['get','color'],'fill-opacity':.18}},before);
 if(!map.getLayer(DRY))map.addLayer({id:DRY,type:'fill',source:SOURCE,filter:['==',['get','kind'],'dry'],paint:{'fill-pattern':'inmet-dry-hatch','fill-opacity':.5}},before);
 if(!map.getLayer(LINE)){selectedLine=undefined;map.addLayer({id:LINE,type:'line',source:SOURCE,paint:{'line-color':['get','color'],'line-width':.7,'line-opacity':.45}},before);}
 const data=collection(alerts),source=map.getSource(SOURCE);
 if(sourceIdentity!==source||sourceData!==data){source.setData(data);sourceIdentity=source;sourceData=data;}
 const selected=eventoSelecionadoId==null?'':String(eventoSelecionadoId),line=source;
 if(lineIdentity!==line||selectedLine!==selected){map.setPaintProperty(LINE,'line-width',['case',['==',['get','alertId'],selected],2.5,.7]);lineIdentity=line;selectedLine=selected;}
 if(boundMap!==map){boundMap=map;map.on('click',FILL,e=>{const a=globalAlerts.find(a=>a.id===e.features?.[0]?.properties.alertId);if(a)selectMapEvent(a,false);});map.on('mouseenter',FILL,()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave',FILL,()=>map.getCanvas().style.cursor='');}
}
window.InmetAreas={geometry,load,sync,collection,ready:()=>!!border};
})();
