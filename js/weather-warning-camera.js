/* Resolve official warning areas only for the selected record. */
(function(root){'use strict';
const zones=new Map(),inflight=new Map();let generation=0;
const point=p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
function geometryPoints(g){
 const polys=g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:null;
 if(!Array.isArray(polys)||!polys.length)return [];
 const points=[];for(const poly of polys){if(!Array.isArray(poly)||!poly.length)return [];for(const ring of poly){if(!Array.isArray(ring)||ring.length<3||!ring.every(point))return [];points.push(...ring);if(points.length>50000)return [];}}
 return points;
}
function bounds(points){
 if(!points.length)return null;
 // Minimal longitude arc prevents Alaska/dateline areas from fitting the globe.
 const xs=points.map(p=>(p[0]+360)%360).sort((a,b)=>a-b);let gap=-1,start=0;
 for(let i=0;i<xs.length;i++){const d=(i+1<xs.length?xs[i+1]:xs[0]+360)-xs[i];if(d>gap){gap=d;start=(i+1)%xs.length;}}
 let west=xs[start],east=west+360-gap;if(west>180){west-=360;east-=360;}
 let south=90,north=-90;for(const p of points){south=Math.min(south,p[1]);north=Math.max(north,p[1]);}return [[west,south],[east,north]];
}
function zoneURL(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='api.weather.gov'&&!u.username&&!u.password&&/^\/zones\/(?:forecast|county|fire)\/[A-Z0-9]+$/.test(u.pathname)?u.origin+u.pathname:null;}catch{return null;}}
async function zone(url){
 const hit=zones.get(url);if(hit&&hit.until>Date.now())return hit.points;
 if(inflight.has(url))return inflight.get(url);
 const task=(async()=>{const r=await fetchWithCorsFallback(url,6000);if(!r.ok)throw Error('Área oficial indisponível');const d=await r.json(),pts=geometryPoints(d.geometry);if(!pts.length)throw Error('Área sem geometria válida');zones.delete(url);zones.set(url,{points:pts,until:Date.now()+86400000});while(zones.size>64)zones.delete(zones.keys().next().value);return pts;})();
 inflight.set(url,task);try{return await task;}finally{inflight.delete(url);}
}
function localPoints(item){const pts=geometryPoints(item.warningGeometry);if(pts.length)return pts;return (item.municipalityLocations||[]).map(c=>c.coords).filter(point);}
async function resolve(item,active=()=>true){
 const local=localPoints(item);if(local.length)return bounds(local);
 const urls=[...new Set((item.affectedZones||[]).map(zoneURL).filter(Boolean))].slice(0,40);
 if(!urls.length)return point(item.coords)?bounds([item.coords]):null;
 const pts=[];for(let i=0;i<urls.length;i+=4){if(!active())return null;const rows=await Promise.allSettled(urls.slice(i,i+4).map(zone));for(const r of rows)if(r.status==='fulfilled')pts.push(...r.value);}
 // A failed area request never invents an epicenter or changes to a global view.
 return pts.length?bounds(pts):null;
}
function fit(b,id){
 if(!b||!map)return false;const c=map.getContainer(),w=c.clientWidth||root.innerWidth,h=c.clientHeight||root.innerHeight,wide=w>900;
 const padding={top:Math.min(wide?225:215,h*.25),bottom:Math.min(wide?60:300,h*.36),left:Math.min(wide?335:32,w*.27),right:Math.min(wide?380:32,w*.30)};
 clearTimeout(root.__mgRecenterT);clearTimeout(root.__mgRecenterAlertT);clearTimeout(root.__mgSoftFlyT);
 if(typeof userInteractingWithGlobe!=='undefined')userInteractingWithGlobe=true;
 const options={padding,maxZoom:8,pitch:0,bearing:0,duration:root.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:6000,essential:true};
 if(root.EventCamera){const camera=map.cameraForBounds(b,options);root.EventCamera.enter(id,camera,()=>map.fitBounds(b,options));}
 else map.fitBounds(b,options);return true;
}
async function focus(item){const token=++generation;const b=await resolve(item,()=>token===generation&&eventoSelecionadoId===item.id);if(token!==generation||eventoSelecionadoId!==item.id)return false;return fit(b,item.id);}
root.WeatherWarningCamera={focus,resolve,bounds,geometryPoints};
})(typeof window!=='undefined'?window:globalThis);
