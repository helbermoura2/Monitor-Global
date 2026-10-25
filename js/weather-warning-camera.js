/* Resolve official warning areas only for the selected record. */
(function(root){'use strict';
const zones=new Map(),inflight=new Map(),MAX_ZONE_BYTES=8*1024*1024;let generation=0,zoneBytes=0,cacheEpoch=0;
const point=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
function dropZone(key){zoneBytes-=zones.get(key)?.bytes||0;zones.delete(key);}
function pruneZones(){for(const [key,row]of zones)if(row.until<=Date.now())dropZone(key);while(zones.size>64||zoneBytes>MAX_ZONE_BYTES)dropZone(zones.keys().next().value);}
function geometryPoints(g){
 const polys=g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:null;
 if(!Array.isArray(polys)||!polys.length)return [];
 const points=[];for(const poly of polys){if(!Array.isArray(poly)||!poly.length)return [];for(const ring of poly){if(!Array.isArray(ring)||ring.length<3||points.length+ring.length>50000||!ring.every(point))return [];points.push(...ring);}}
 return points;
}
function compact(points){const xs=new Float64Array(points.length);let south=90,north=-90;for(let i=0;i<points.length;i++){xs[i]=(points[i][0]+360)%360;south=Math.min(south,points[i][1]);north=Math.max(north,points[i][1]);}xs.sort();return {xs,south,north};}
function areaBounds(areas){
 const count=areas.reduce((n,a)=>n+a.xs.length,0);if(!count)return null;
 // Minimal longitude arc prevents Alaska/dateline areas from fitting the globe.
 // Keep exact longitudes in compact typed arrays, not whole GeoJSON rings.
 const xs=areas.length===1?areas[0].xs:new Float64Array(count);let offset=0,south=90,north=-90;
 for(const a of areas){if(areas.length>1){xs.set(a.xs,offset);offset+=a.xs.length;}south=Math.min(south,a.south);north=Math.max(north,a.north);}if(areas.length>1)xs.sort();let gap=-1,start=0;
 for(let i=0;i<xs.length;i++){const d=(i+1<xs.length?xs[i+1]:xs[0]+360)-xs[i];if(d>gap){gap=d;start=(i+1)%xs.length;}}
 let west=xs[start],east=west+360-gap;if(west>180){west-=360;east-=360;}
 return [[west,south],[east,north]];
}
function bounds(points){return points.length?areaBounds([compact(points)]):null;}
function zoneURL(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='api.weather.gov'&&!u.username&&!u.password&&/^\/zones\/(?:forecast|county|fire)\/[A-Z0-9]+$/.test(u.pathname)?u.origin+u.pathname:null;}catch{return null;}}
async function zone(url){
 pruneZones();const hit=zones.get(url);if(hit){zones.delete(url);zones.set(url,hit);return hit.area;}
 if(inflight.has(url))return inflight.get(url);
 const epoch=cacheEpoch;
 const task=(async()=>{const r=await fetchWithCorsFallback(url,6000);if(!r.ok)throw Error('Área oficial indisponível');const d=await r.json(),pts=geometryPoints(d.geometry);if(!pts.length)throw Error('Área sem geometria válida');const area=compact(pts),bytes=area.xs.byteLength;if(epoch===cacheEpoch){dropZone(url);zones.set(url,{area,bytes,until:Date.now()+86400000});zoneBytes+=bytes;pruneZones();}return area;})();
 inflight.set(url,task);try{return await task;}finally{inflight.delete(url);}
}
// Administrative reference bounds are refreshed server-side every six hours.
// They locate a live Atom warning; they are never themselves weather alerts.
let catalogue=null,catalogueUntil=0,cataloguePending=null;
const codes=new Set('DE FR ES PT IT UK AT BE NL CH PL NO SE FI DK IE'.split(' '));
const validBounds=b=>Array.isArray(b)&&b.length===2&&b.every(point)&&b[0][0]<b[1][0]&&b[0][1]<b[1][1];
const areaName=s=>String(s||'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
// Coarse feed coverage, never an alert polygon or a point of occurrence.
const bomAreas={
 'New South Wales / ACT':[[141,-37.6],[154,-28]],'Victoria':[[140.9,-39.2],[150,-34]],
 'Queensland':[[137.9,-29.2],[154,-9.1]],'Western Australia':[[112.8,-35.2],[129.1,-13.5]],
 'South Australia':[[129,-38.1],[141.1,-25.9]],'Tasmania':[[143.7,-44],[149,-39.2]],
 'Northern Territory':[[129,-26],[138.1,-10.8]]
};
async function reference(item){
 if(/^BOM\b/.test(item.source||'')&&Object.hasOwn(bomAreas,item.bomRegion))return {bounds:bomAreas[item.bomRegion],exact:false,label:item.bomRegion+' — Austrália'};
 if(!item.meteoalarmArea||!codes.has(item.countryCode))return null;
 if(catalogueUntil<=Date.now()&&!cataloguePending){
  cataloguePending=(async()=>{try{
   const r=await fetch('data/meteoalarm-areas.json',{cache:'no-cache',signal:AbortSignal.timeout(6000)});
   if(!r.ok)throw Error('Catálogo de áreas indisponível');
   const d=await r.json();if(!d.countries||!d.areas)throw Error('Catálogo inválido');
   catalogue=d;catalogueUntil=Date.now()+21600000;
  }catch{catalogueUntil=Date.now()+60000;}finally{cataloguePending=null;}})();
 }
 if(cataloguePending)await cataloguePending;
 const code=item.countryCode,rows=catalogue?.areas?.[code]||{},name=areaName(item.meteoalarmArea);
 const matches=Object.entries(rows).filter(([key,row])=>areaName(key)===name&&validBounds(row.bb)&&Date.parse(row.verified)>=Date.now()-90*86400000);
 if(matches.length===1)return {bounds:matches[0][1].bb,exact:true};
 const b=catalogue?.countries?.[code];return validBounds(b)?{bounds:b,exact:false}:null;
}
function locationNote(item,text){
 if(eventoSelecionadoId!==item.id)return;
 let el=document.getElementById('pd-warning-location');
 if(!el){const anchor=document.getElementById('pd-horario');if(!anchor)return;el=document.createElement('p');el.id='pd-warning-location';el.style.cssText='font-size:11px;line-height:1.45;color:#b6d9e5;margin:8px 0;text-align:center';el.setAttribute('role','status');anchor.insertAdjacentElement('afterend',el);}
 el.textContent=text;
}
function localPoints(item){const pts=geometryPoints(item.warningGeometry);if(pts.length)return pts;return (item.municipalityLocations?.length?item.municipalityLocations:item.municipalities||[]).map(c=>c.coords).filter(point);}
async function resolve(item,active=()=>true){
 let local=localPoints(item);if(local.length)return bounds(local);
 if(/INMET/i.test(item.source||'')&&item.municipalities?.length&&root.InmetMunicipalities){try{await root.InmetMunicipalities.load();if(!active())return null;const rows=root.InmetMunicipalities.resolve(item.municipalities.map(c=>({nome:c.name||c.nome,uf:c.uf})),item.ufs||[]);local=rows.map(c=>c.coords).filter(point);if(local.length)return bounds(local);}catch{}}
 const urls=[...new Set((item.affectedZones||[]).map(zoneURL).filter(Boolean))].slice(0,40);
 if(!urls.length){if(point(item.coords))return bounds([item.coords]);const ref=await reference(item);return active()&&ref?.exact?ref.bounds:null;}
 const areas=[];for(let i=0;i<urls.length;i+=4){if(!active())return null;const rows=await Promise.allSettled(urls.slice(i,i+4).map(zone));for(const r of rows)if(r.status==='fulfilled')areas.push(r.value);}
 // A failed area request never invents an epicenter or changes to a global view.
 return areaBounds(areas);
}
// Compute the destination independently of the current globe orientation.
// cameraForBounds/fitBounds on the globe can frame a remote region around the pole.
function frame(b){
 if(!Array.isArray(b)||b.length!==2||!b.every(p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite))||b[0][1]>b[1][1])return null;
 if(typeof map==='undefined'||!map?.getContainer)return null;
 const c=map.getContainer();if(!c)return null;
 const w=c.clientWidth||root.innerWidth,h=c.clientHeight||root.innerHeight,wide=w>900;
 const padding={top:Math.min(wide?225:215,h*.25),bottom:Math.min(wide?60:300,h*.36),left:Math.min(wide?335:32,w*.27),right:Math.min(wide?380:32,w*.30)};
 const y=lat=>(1-Math.log(Math.tan(Math.PI/4+Math.max(-85.05112878,Math.min(85.05112878,lat))*Math.PI/360))/Math.PI)/2;
 const north=y(b[1][1]),south=y(b[0][1]),dx=Math.max(1e-8,(b[1][0]-b[0][0])/360),dy=Math.max(1e-8,south-north);
 const zoom=Math.max(map.getMinZoom(),Math.min(8,Math.log2(Math.min(Math.max(1,w-padding.left-padding.right-32)/(512*dx),Math.max(1,h-padding.top-padding.bottom-32)/(512*dy)))));
 const latitude=Math.atan(Math.sinh(Math.PI*(1-north-south)))*180/Math.PI;
 return {center:[(b[0][0]+b[1][0])/2,latitude],zoom,padding,bearing:0,pitch:0};
}
function fit(b,id){
 const camera=frame(b);if(!camera)return false;
 clearTimeout(root.__mgRecenterT);clearTimeout(root.__mgRecenterAlertT);clearTimeout(root.__mgSoftFlyT);
 if(typeof userInteractingWithGlobe!=='undefined')userInteractingWithGlobe=true;
 if(root.EventCamera)root.EventCamera.enter(id,camera);
 else map.flyTo({...camera,duration:root.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:6000,essential:true});return true;
}
async function focus(item){
 if(!item?.id)return false;
 const token=++generation,active=()=>token===generation&&eventoSelecionadoId===item.id;
 let b=await resolve(item,active);if(!active())return false;
 if(!b&&(item.meteoalarmArea||item.bomRegion)){
  const ref=await reference(item);if(!active())return false;
  if(ref){b=ref.bounds;locationNote(item,ref.exact?'Enquadramento da área oficial · Meteoalarm':'Referência regional: '+(ref.label||item.country)+' · área exata do aviso indisponível no mapa. Consulte o boletim oficial.');}
 }else if(b&&item.meteoalarmArea)locationNote(item,'Enquadramento da área oficial · Meteoalarm');
 if(b&&/INMET/i.test(item.source||'')&&!geometryPoints(item.warningGeometry).length)locationNote(item,b[0][0]===b[1][0]&&b[0][1]===b[1][1]?'Ponto de referência do aviso; área exata indisponível. Consulte o boletim oficial.':'Enquadramento de referência dos municípios citados no aviso; não representa um epicentro nem o limite exato da tempestade.');
 if(!b)locationNote(item,'Aviso sem localização verificável no mapa. Consulte a região descrita no boletim oficial.');
 return fit(b,item.id);
}
root.addEventListener?.('pagehide',()=>{cacheEpoch++;zones.clear();zoneBytes=0;});
root.WeatherWarningCamera={focus,resolve,bounds,geometryPoints,frame,stats:()=>{pruneZones();return {entries:zones.size,coordinateBytes:zoneBytes,maxCoordinateBytes:MAX_ZONE_BYTES,inflight:inflight.size};}};
})(typeof window!=='undefined'?window:globalThis);
