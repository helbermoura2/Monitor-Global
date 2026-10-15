import {distanceKm,exposureRadii} from './population-exposure-worker.mjs';
import './js/rupture-shaking-model.js';
let catalogPromise,retryAfter=0;const results=new Map();
export function decodeLocalities(buffer){const view=new DataView(buffer),count=view.byteLength>=16?view.getUint32(4,true):0;if(view.byteLength<16||String.fromCharCode(...new Uint8Array(buffer,0,4))!=='MGP1'||count<1||count>300000||view.getUint32(8,true)!==16||view.getUint32(12,true)!==1||view.byteLength!==16+count*16)throw Error('Invalid locality catalog');let previous=-90;for(let i=0;i<count;i++){const offset=16+i*16,lat=view.getFloat32(offset+4,true),lon=view.getFloat32(offset+8,true);if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<previous||Math.abs(lat)>90||Math.abs(lon)>180||!view.getUint32(offset+12,true))throw Error('Invalid locality record');previous=lat;}return {view,count};}
async function catalog(){if(catalogPromise)return catalogPromise;if(Date.now()<retryAfter)return null;catalogPromise=(async()=>{const c=new AbortController(),timer=setTimeout(()=>c.abort(),5000);try{const r=await fetch('https://monitorglobal.top/assets/population/geonames-localities-v1.bin?v=1',{signal:c.signal});if(!r.ok||Number(r.headers.get('content-length'))>5000000)throw Error('Catalog unavailable');return decodeLocalities(await r.arrayBuffer());}finally{clearTimeout(timer);}})().catch(()=>{catalogPromise=null;retryAfter=Date.now()+60000;return null;});return catalogPromise;}
export function calculateLocalityExposure(ev,catalog){
 const {lat,lon,mag,depth}=ev;if(![lat,lon,mag,depth].every(Number.isFinite)||Math.abs(lat)>90||Math.abs(lon)>180||depth<0)return null;
 const grid=globalThis.RuptureShakingModel.valid(ev.shaking?.grid)?ev.shaking.grid:null;
 if(!grid&&(mag<3||mag>8.5||depth>70||Math.abs(lat)>85))return null;
 const ranges=exposureRadii(mag,depth).map(r=>({...r,population:0,localities:0})),radius=ranges[0].radiusKm;
 if(!grid&&!radius)return null;
 const south=grid?grid.y0:lat-radius/111,north=grid?grid.y1:lat+radius/111;
 const span=Math.min(180,radius/(111*Math.max(.001,Math.cos(Math.min(89.9,Math.max(Math.abs(south),Math.abs(north)))*Math.PI/180))));
 const {view,count}=catalog;let low=0,high=count;while(low<high){const mid=(low+high)>>>1;if(view.getFloat32(20+mid*16,true)<south)low=mid+1;else high=mid;}
 for(let i=low;i<count;i++){const offset=16+i*16,y=view.getFloat32(offset+4,true);if(y>north)break;const x=view.getFloat32(offset+8,true),population=view.getUint32(offset+12,true);let levels;
  if(grid){const mmi=globalThis.RuptureShakingModel.sample(grid,x,y);levels=ranges.map(r=>mmi!==null&&mmi>=r.threshold);}else{if(Math.abs(((x-lon+540)%360)-180)>span)continue;const distance=distanceKm(lat,lon,y,x);levels=ranges.map(r=>distance<=r.radiusKm&&r.radiusKm>0);}
  levels.forEach((inside,j)=>{if(inside){ranges[j].population+=population;ranges[j].localities++;}});
 }
 if(!ranges[0].localities)return null;
 for(const r of ranges)if(!r.localities)r.population=null;
 return {status:'available',method:'geonames-localities',provider:'GeoNames',partial:true,preliminary:true,ranges,model:grid?'USGS ShakeMap nos centros das localidades':'Allen, Wald e Worden (2012), centros das localidades',catalogVersion:'cities500-aed0822-v1',shakingVersion:grid?ev.shaking.version:null,note:'Soma aproximada de populações cadastradas nas localidades dentro da área estimada. Não inclui toda a população rural; áreas urbanas podem sobrepor-se. Não é contagem de quem sentiu, vítimas ou danos.'};
}
export async function queryLocalityExposure(ev){
 const key=JSON.stringify([ev.lat,ev.lon,ev.mag,ev.depth,ev.shaking?.version]);if(results.has(key))return results.get(key);
 if(![ev.lat,ev.lon,ev.mag,ev.depth].every(Number.isFinite))return null;
 if(!globalThis.RuptureShakingModel.valid(ev.shaking?.grid)&&(ev.mag<3||ev.mag>8.5||ev.depth>70||Math.abs(ev.lat)>85))return null;
 const data=await catalog();if(!data)return null;const result=calculateLocalityExposure(ev,data);results.set(key,result);if(results.size>64)results.delete(results.keys().next().value);return result;
}
