// Bounded optional geographic context. No Worker/DO requests and no invented places.
const cache=new Map();
import '../js/quake-card-layout.js';
export const contextFrame=ev=>globalThis.QuakeCardLayout.contextFrame(ev);
export async function referencePlaces(ev){
 const key=[ev.lat,ev.lon].join('|'),hit=cache.get(key);if(hit&&hit.until>Date.now())return hit.places;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3500);
 try{const u=new URL('https://earthquake.usgs.gov/ws/geoserve/places.json');for(const [k,v]of Object.entries({latitude:ev.lat,longitude:ev.lon,maxradiuskm:400,minpopulation:10000,type:'geonames',limit:8}))u.searchParams.set(k,v);
 const r=await fetch(u,{signal:controller.signal});if(!r.ok)return[];const data=await r.json();
 const features=data.geonames?.features||[];
 const places=features.slice(0,8).map(p=>({name:String(p.properties?.name||'').slice(0,65),region:String(p.properties?.admin1_name||'').slice(0,65),country:String(p.properties?.country_name||'').slice(0,65),lat:Number(p.geometry?.coordinates?.[1]),lon:Number(p.geometry?.coordinates?.[0])})).filter(p=>p.name&&Number.isFinite(p.lat)&&Number.isFinite(p.lon));
 cache.set(key,{until:Date.now()+3600000,places});while(cache.size>24)cache.delete(cache.keys().next().value);return places;
 }catch{return[];}finally{clearTimeout(timer);}
}
export function drawMapReferences(p,frame,ev,places){
 const L=globalThis.QuakeCardLayout,H=L.MAP_HEIGHT,Y=L.MAP_Y,C=L.CONTEXT;
 const project=(lon,lat)=>[(lon-frame.minLon)/(frame.maxLon-frame.minLon)*800,Y+(frame.maxLat-lat)/(frame.maxLat-frame.minLat)*H];
 const occupied=[[C.x,C.y,C.x+C.width,C.y+C.height],[285,Y+L.ANCHOR_Y-20,590,Y+L.ANCHOR_Y+55],[550,Y+H-60,784,Y+H]];
 let count=0;for(const place of places){let lon=place.lon;lon+=360*Math.round((Number(ev.lon)-lon)/360);const [x,y]=project(lon,place.lat);let name=place.name;while(p.measure(name,15,true)>200&&name.length>3)name=name.slice(0,-4)+'...';const w=p.measure(name,15,true)+16,h=28,left=Math.max(16,Math.min(784-w,x+10)),top=y-14;
 if(x<16||x>784||y<Y+20||y>Y+H-24||occupied.some(([a,b,c,d])=>left<c&&left+w>a&&top<d&&top+h>b))continue;
 p.dot(x,y,4,'#ffffff');p.dot(x,y,2,'#162c34');p.roundRect(left,top,w,h,'#142a33');p.text(name,left+8,top+6,15,'#edf6fa',true);occupied.push([left,top,left+w,top+h]);if(++count===4)break;
 }
 const lat=Number(ev.lat)*Math.PI/180,kmPerDegree=111.32*Math.max(.05,Math.cos(lat)),widthKm=(frame.maxLon-frame.minLon)*kmPerDegree;
 const target=widthKm*.2,unit=10**Math.floor(Math.log10(target)),km=[1,2,5,10].map(n=>n*unit).filter(n=>n<=target).at(-1)||unit,px=km/widthKm*800;
 const y=Y+H-52;p.roundRect(552,y,224,42,'#142a33');p.rect(566,y+28,px,2,'#edf6fa');p.rect(566,y+24,2,8,'#edf6fa');p.rect(566+px,y+24,2,8,'#edf6fa');p.text('0',566,y+5,13,'#edf6fa');p.text(km+' km',566+px-35,y+5,13,'#edf6fa');
}
