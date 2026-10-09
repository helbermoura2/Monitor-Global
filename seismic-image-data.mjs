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
export async function overlayImageIntensity(rgba,frame,ev){if(Number(ev.mag)<5)return false;try{return paintImageIntensity(rgba,frame,ev,await land())>0;}catch{return false;}}
export function validImageExposure(data){return data?.status==='available'&&['pager','worldpop'].includes(data.method)&&data.ranges?.length===3&&data.ranges.every((r,i)=>r.population!==null&&Number.isFinite(Number(r.population))&&Number(r.population)>=0&&(!i||Number(r.population)<=Number(data.ranges[i-1].population)));}
export async function queryImageExposure(ev,env){
 const url=new URL('https://internal/population-exposure');
 const provider=ev.provider||ev.source||'',eventId=/^(USGS|US|PT)$/i.test(provider)?String(ev.id||'').replace(/^USGS-(?:RT-)?/i,''):'';
 for(const [k,v] of Object.entries({lat:ev.lat,lng:ev.lon,mag:ev.mag,depth:ev.depth??0,time:Date.parse(ev.timeIso),...(eventId?{eventId}:{})}))url.searchParams.set(k,String(v));
 const job=handlePopulationExposure(new Request(url),env||{}).then(r=>r.json());
 if(env?.IMAGE_WAIT_UNTIL)env.IMAGE_WAIT_UNTIL(job);
 let timer;try{return await Promise.race([job,new Promise(resolve=>{timer=setTimeout(()=>resolve({status:'pending'}),2500);})]);}catch{return {status:'unavailable'};}finally{clearTimeout(timer);}
}
export const exposureVersion=data=>validImageExposure(data)?JSON.stringify([data.method,data.partial,data.ranges.map(r=>r.population)]):data?.status||'pending';
