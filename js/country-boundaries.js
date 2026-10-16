/* Country/territory lookup by cartographic polygons, never place text.
   Natural Earth is cartographic, not cadastral: abstain within 2 km of an edge. */
(function(root){'use strict';
 let polygons=[],loaded=false;const cache=new Map(),empty=()=>({nome:'',flag:'',countryCode:null});
 const valid=(lat,lng)=>Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
 function inside(ring,x,y){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
 function near(ring,x,y){const cos=Math.max(.01,Math.cos(y*Math.PI/180)),scale=111.195;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[j],b=ring[i],ax=(a[0]-x)*cos*scale,ay=(a[1]-y)*scale,bx=(b[0]-x)*cos*scale,by=(b[1]-y)*scale,dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));
  if(Math.hypot(ax+t*dx,ay+t*dy)<=2)return true;
 }return false;}
 function setData(data){polygons=[];cache.clear();for(const f of data.features||[]){const p=f.properties||{},g=f.geometry,parts=g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:[];if(!/^[A-Z]{2}$/.test(p.countryCode))continue;
  for(const rings of parts){if(!rings?.[0]?.length)continue;let w=180,e=-180,s=90,n=-90;for(const [x,y]of rings[0]){w=Math.min(w,x);e=Math.max(e,x);s=Math.min(s,y);n=Math.max(n,y);}polygons.push({rings,w,e,s,n,code:p.countryCode,name:p.name});}
 }loaded=true;}
 function lookup(lat,lng){if(!loaded||!valid(lat,lng))return empty();const key=lat.toFixed(5)+','+lng.toFixed(5);if(cache.has(key))return {...cache.get(key)};
  const hits=[];let uncertain=false;
  for(const p of polygons){const margin=.03/Math.max(.01,Math.cos(lat*Math.PI/180));if(lng<p.w-margin||lng>p.e+margin||lat<p.s-.03||lat>p.n+.03)continue;
   if(p.rings.some(r=>near(r,lng,lat))){uncertain=true;continue;}
   if(inside(p.rings[0],lng,lat)&&!p.rings.slice(1).some(r=>inside(r,lng,lat)))hits.push(p);
  }
  const codes=new Set(hits.map(p=>p.code)),p=hits[0];const result=!uncertain&&codes.size===1?{nome:p.name,flag:String.fromCodePoint(...[...p.code].map(c=>127397+c.charCodeAt(0))),countryCode:p.code}:empty();
  cache.set(key,result);if(cache.size>12000)cache.delete(cache.keys().next().value);return {...result};
 }
 function apply(item){if(!item||!(item.type==='earthquake'||(!item.type&&item.mag!=null)))return item;const c=lookup(item.coords?.[1],item.coords?.[0]);item.countryCode=c.countryCode;item.pais=c.nome;item.bandeira=c.flag;item.countrySource=c.countryCode?'Natural Earth · coordenadas':null;return item;}
 const ready=fetch('assets/geography/countries-10m.json').then(r=>{if(!r.ok)throw Error('Fronteiras indisponíveis');return r.json();}).then(d=>{setData(d);if(typeof globalEvents!=='undefined')globalEvents.forEach(apply);if(typeof applyFilters==='function')applyFilters();if(typeof eventoSelecionadoId!=='undefined'&&typeof globalEvents!=='undefined'){const i=globalEvents.findIndex(e=>e.id===eventoSelecionadoId);if(i>=0&&typeof showEventDetails==='function')showEventDetails(i,false,true);}}).catch(e=>console.warn('[país por coordenadas]',e.message));
 root.CountryBoundaries={lookup,apply,ready,setData};
})(window);
