import {queryLocalityExposure} from './locality-exposure.mjs';
import {handleRuptureShaking} from './rupture-shaking-worker.mjs';
import './js/event-portuguese.js';
import './js/seismic-impact-model.js';
import './js/quake-image-paint.js';
import './js/quake-card-layout.js';
import {handlePopulationExposure} from './population-exposure-worker.mjs';
const model=globalThis.SeismicImpactModel;
export const imageMapFrame=ev=>globalThis.QuakeCardLayout.frame(ev);
export function imageProject(frame,lng,lat){return [(lng-frame.minLon)/(frame.maxLon-frame.minLon)*frame.width,(frame.maxLat-lat)/(frame.maxLat-frame.minLat)*frame.height];}
export function imageMetersPerPixel(frame,lat){return distance(lat,frame.minLon,lat,frame.minLon+(frame.maxLon-frame.minLon)/frame.width)*1000;}
let landPromise;
async function land(){
 if(!landPromise){landPromise=(async()=>{const c=new AbortController(),timer=setTimeout(()=>c.abort(),5000);try{const r=await fetch('https://monitorglobal.top/assets/seismic/ne-50m-land.geojson?v=50m1',{signal:c.signal});if(!r.ok)throw Error('Coastlines');const d=await r.json();return d.features.flatMap(f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates);}finally{clearTimeout(timer);}})().catch(e=>{landPromise=null;throw e;});}
 return landPromise;
}
const distance=(a,b,c,d)=>{const rad=Math.PI/180,x=Math.sin((c-a)*rad/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin((d-b)*rad/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));};
// Scanline land mask, including holes. Paint only on land, at a bounded 4px grid.
export const paintImageIntensity=(...args)=>globalThis.QuakeImagePaint.paint(...args);
export async function overlayImageIntensity(rgba,frame,ev){if(![ev.mag,ev.lat,ev.lon,ev.depth].every(v=>v!=null&&Number.isFinite(Number(v))))return false;try{return paintImageIntensity(rgba,frame,ev,await land())>0;}catch{return false;}}
export const validImageExposure=data=>globalThis.QuakeCardLayout.validExposure(data);
const exposureRanks={pager:3,worldpop:2,'geonames-localities':1};
export const exposureQuality=data=>validImageExposure(data)?exposureRanks[data.method]:0;
export function exposureVersionQuality(version){try{return exposureRanks[JSON.parse(version)?.[0]]||0;}catch{return 0;}}
export async function queryImageExposure(ev,env){
 const url=new URL('https://internal/population-exposure');
 const provider=ev.provider||ev.source||'',eventId=/^(USGS|US|PT)$/i.test(provider)?String(ev.id||'').replace(/^USGS-(?:RT-)?/i,''):'';
 for(const [k,v] of Object.entries({lat:ev.lat,lng:ev.lon,mag:ev.mag,depth:ev.depth??0,time:Date.parse(ev.timeIso),...(eventId?{eventId}:{})}))url.searchParams.set(k,String(v));
 const job=handlePopulationExposure(new Request(url),env||{}).then(r=>r.json());
 if(env?.IMAGE_WAIT_UNTIL)env.IMAGE_WAIT_UNTIL(job);
 let timer,data;try{data=await Promise.race([job,new Promise(resolve=>{timer=setTimeout(()=>resolve({status:'pending'}),2500);})]);}catch{data={status:'unavailable'};}finally{clearTimeout(timer);}
 if(validImageExposure(data))return data;const reserve=await queryLocalityExposure(ev);return reserve?{...reserve,upstreamStatus:data.status}:data;
}
export const exposureVersion=data=>validImageExposure(data)?JSON.stringify([data.method,data.partial,data.ranges.map(r=>r.population)]):data?.status||'pending';

export async function queryImageShaking(ev){
 const time=Number.isFinite(ev.time)?ev.time:Date.parse(ev.timeIso);
 if(![ev.lat,ev.lon,ev.mag,time].every(Number.isFinite)||ev.mag<5.5)return {status:'unavailable'};
 const provider=ev.provider||ev.source||'',eventId=/^(USGS|US|PT)$/i.test(provider)?String(ev.id||'').replace(/^USGS-(?:RT-)?/i,''):'';
 const url=new URL('https://internal/rupture-shaking');
 for(const [key,value]of Object.entries({lat:ev.lat,lng:ev.lon,mag:ev.mag,time,...(eventId?{eventId}:{})}))url.searchParams.set(key,String(value));
 try{return await handleRuptureShaking(new Request(url)).then(r=>r.json());}catch{return {status:'unavailable'};}
}
export const validImageShaking=data=>data?.status==='available'&&['usgs-shakemap-grid','usgs-shakemap-finite'].includes(data.method)&&globalThis.RuptureShakingModel.valid(data.grid);
export const shakingVersion=data=>validImageShaking(data)?String(data.version):data?.status||'unavailable';

export function imageEpicenterMmi(ev,fallback){
 if(!validImageShaking(ev.shaking))return fallback;
 const value=globalThis.RuptureShakingModel.sample(ev.shaking.grid,ev.lon,ev.lat);
 return value===null?'—':['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][Math.max(0,Math.min(11,Math.round(value)-1))];
}
