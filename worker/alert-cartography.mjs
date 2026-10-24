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
 const project=(lon,lat)=>[(lon-frame.minLon)/(frame.maxLon-frame.minLon)*800,(frame.maxLat-lat)/(frame.maxLat-frame.minLat)*820],occupied=[[480,40,785,630],[24,700,500,820],[340,505,650,590]];
 const context=places[0];if(context){const name=[context.region,context.country].filter(Boolean).join(' · '),label=(globalThis.EventPortuguese?.place(name)||name).replace(/\bTibet\b/g,'Tibete');let short=label;while(p.measure(short,20,true)>410&&short.length>3)short=short.slice(0,-4)+'...';p.roundRect(24,85,Math.min(440,p.measure(short,20,true)+24),40,'#f5f3e9');p.text(short,36,93,20,'#172d36',true);}
 let count=0;for(const place of places){let lon=place.lon;lon+=360*Math.round((Number(ev.lon)-lon)/360);const [x,y]=project(lon,place.lat);let name=place.name;while(p.measure(name,19,true)>290&&name.length>3)name=name.slice(0,-4)+'...';const w=Math.min(310,p.measure(name,19,true)+20),h=34,left=Math.max(16,Math.min(784-w,x+12)),top=y-17;
 if(x<16||x>784||y<85||y>690||occupied.some(([a,b,c,d])=>left<c&&left+w>a&&top<d&&top+h>b))continue;
 p.dot(x,y,5,'#ffffff');p.dot(x,y,3,'#162c34');p.roundRect(left,top,w,h,'#f5f3e9');p.text(name,left+10,top+5,19,'#172d36',true);occupied.push([left,top,left+w,top+h]);if(++count===4)break;
 }
 const lat=Number(ev.lat)*Math.PI/180,kmPerDegree=111.32*Math.max(.05,Math.cos(lat)),widthKm=(frame.maxLon-frame.minLon)*kmPerDegree;
 const target=widthKm*.2,unit=10**Math.floor(Math.log10(target)),km=[1,2,5,10].map(n=>n*unit).filter(n=>n<=target).at(-1)||unit,px=km/widthKm*800;
 p.roundRect(530,757,250,53,'#f5f3e9');p.rect(545,790,px,3,'#172d36');p.rect(545,784,2,10,'#172d36');p.rect(545+px,784,2,10,'#172d36');p.text('0',545,762,15,'#172d36',true);p.text(km+' km',545+px-35,762,15,'#172d36',true);
 p.roundRect(260,580,150,34,'#172d36');p.text('EPICENTRO',272,587,17,'#ffffff',true);
}
